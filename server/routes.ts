/**
 * HTTP API. Every handler validates its input, every non-public route
 * declares who may call it, and every state change is delegated to a service
 * that enforces the business rules server-side.
 */
import { ASSET_ORDER, NETWORKS, type AssetCode, type NetworkId } from '@/domain/assets';
import { PAYOUT_ORDER, type PayoutMethodId } from '@/domain/payout';
import { ORDER_STAGES, ORDER_STATUSES, type OrderStage, type OrderStatus } from '@/domain/order';
import { BUY_PAY_INS, PRICING_POLICY, type BuyPayIn } from '@/domain/quote';
import { COURIER_WINDOWS } from '@/domain/courier';
import { formatUsd } from '@/domain/money';
import { REAL_MONEY_ENABLED, FEATURE_FLAGS } from '@/config/runtime';
import { LEGAL_DOCUMENTS } from '@/content/legal';
import type { Actor, AppContext } from './context';
import { migrationStatus } from './db/database';
import { ApiError } from './http/errors';
import { HANDLED, type Ctx, type Role, type Router } from './http/router';
import { parse, queryObject, v } from './http/validate';
import { newId } from './lib/clock';
import { isUsable, providerInfos } from './providers/registry';
import { SIGNATURE_HEADER } from './providers/signature';
import * as admin from './services/admin';
import { audit } from './services/audit';
import * as auth from './services/auth';
import * as credentials from './services/credentials';
import * as customers from './services/customers';
import { withIdempotency } from './services/idempotency';
import { listNotifications, markNotificationsRead, orderNotifications, unreadNotificationCount } from './services/notifications';
import * as ops from './services/operations';
import * as orders from './services/orders';
import { firmQuote, indicativeQuote, referencePrice, type QuoteInput } from './services/quotes';
import { DOCUMENT_TYPES, downloadOrderDocument, uploadOrderDocument } from './services/documents';
import * as payConfirm from './services/paymentConfirmations';
import * as kyc from './services/kyc';
import { ID_DOCUMENT_TYPES, KYC_FILE_KINDS, KYC_FILE_MAX_BYTES } from '@/domain/identity';
import { COUNTRY_CODES } from '@/domain/residence';
import * as sandbox from './services/sandbox';
import * as support from './services/support';
import { ingestWebhook, isWebhookSource } from './services/webhooks';

const assetV = v.enum(ASSET_ORDER as AssetCode[], 'asset');
const networkV = v.enum(Object.keys(NETWORKS) as NetworkId[], 'network');
const methodV = v.enum(PAYOUT_ORDER as PayoutMethodId[], 'payout method');
const reasonV = v.object({ reason: v.string({ min: 4, max: 500, label: 'a reason' }) });
/** Sell: crypto amount and payout method. Buy (cash → crypto): the dollars handed to the courier. */
function quoteInput(raw: unknown): QuoteInput {
  const { direction } = parse(v.object({ direction: v.optional(v.enum(['sell', 'buy'] as const, 'direction')) }), raw);
  if (direction === 'buy')
    return {
      direction,
      ...parse(
        v.object({
          asset: assetV,
          network: networkV,
          cashCents: v.bigintString({ max: 10n ** 15n }),
          payIn: v.optional(v.enum(BUY_PAY_INS as BuyPayIn[], 'payment method')),
        }),
        raw,
      ),
    };
  return parse(
    v.object({ asset: assetV, network: networkV, amountAtomic: v.bigintString({ max: 10n ** 30n }), payoutMethod: methodV }),
    raw,
  );
}

const acceptedV = v.array(v.object({ slug: v.string({ max: 64 }), version: v.string({ max: 32 }) }), { max: 30 });
const pageV = (q: URLSearchParams, max = 100) => ({
  page: parse(v.optional(v.int({ min: 1, max: 100_000 })), q.get('page') ?? undefined) ?? 1,
  pageSize: parse(v.optional(v.int({ min: 1, max })), q.get('pageSize') ?? undefined) ?? 25,
});
const clientIdV = v.nullable(v.string({ min: 8, max: 64, pattern: /^[\w-]+$/ }));

function actorOf(ctx: Ctx): Actor {
  const a = ctx.auth;
  if (!a) return { type: 'customer', id: null, role: null, ip: ctx.ip };
  return { type: a.role === 'customer' ? 'customer' : 'operator', id: a.userId, role: a.role, ip: ctx.ip };
}
const me = (ctx: Ctx) => ctx.auth!.userId;
const staffActor = (ctx: Ctx) => ({ ...actorOf(ctx), role: ctx.auth!.role });

const SIGNIN_LIMIT = { bucket: 'signin', max: 10, windowMs: 15 * 60_000 };
const WRITE_LIMIT = { bucket: 'write', max: 60, windowMs: 60_000 };

export function registerRoutes(r: Router, app: AppContext) {
  /* ---------- Health and configuration ---------- */
  r.get('/api/health', () => ({ body: { status: 'ok', mode: app.config.mode } }));

  r.get('/api/ready', () => {
    const problems: string[] = [];
    try {
      app.db.get('SELECT 1');
      const m = migrationStatus(app.db);
      if (m.pending.length) problems.push(`Pending migrations: ${m.pending.map((p) => p.name).join(', ')}`);
    } catch (e) {
      problems.push(`Database: ${e instanceof Error ? e.message : 'unavailable'}`);
    }
    const providers = providerInfos(app.providers).map((p) => ({ key: p.key, state: p.state }));
    return { status: problems.length ? 503 : 200, body: { ready: problems.length === 0, mode: app.config.mode, problems, providers } };
  });

  r.get('/api/config', () => ({
    body: {
      mode: app.config.mode,
      realMoneyEnabled: REAL_MONEY_ENABLED,
      featureFlags: FEATURE_FLAGS,
      /** Sandbox only: the demo autopilot advances orders after the customer's step (0 = off). */
      sandboxAutopilotStepMs: app.config.mode === 'sandbox' ? app.config.sandbox.autopilotStepMs : 0,
      publicOrigin: app.config.publicOrigin,
      /** Null when CRM shares the customer origin (local single-host mode). */
      crmOrigin: app.config.crmOrigin,
      providers: providerInfos(app.providers).map((p) => ({ key: p.key, label: p.label, state: p.state })),
      policy: {
        quoteTtlMs: PRICING_POLICY.quoteTtlMs,
        depositWindowMs: PRICING_POLICY.depositWindowMs,
        indicativeRefreshMs: PRICING_POLICY.indicativeRefreshMs,
        minimumCents: PRICING_POLICY.minimumCents.toString(),
        largeDeskFromCents: PRICING_POLICY.largeDeskFromCents.toString(),
      },
      legal: LEGAL_DOCUMENTS.map((d) => ({ slug: d.slug, title: d.title, version: d.version, acceptance: d.acceptance })),
    },
  }));

  r.get('/api/prices', async () => {
    const prices = await Promise.all(ASSET_ORDER.map((a) => referencePrice(app, a)));
    return {
      body: { prices: prices.map((p) => ({ asset: p.asset, priceMicros: p.priceMicros, asOf: p.asOf, source: p.source, feed: p.feed })) },
    };
  });

  r.get(
    '/api/quotes/indicative',
    async (ctx) => {
      return { body: await indicativeQuote(app, quoteInput(queryObject(ctx.query))) };
    },
    { rateLimit: { bucket: 'quotes', max: 120, windowMs: 60_000 } },
  );

  r.get('/api/cash/availability', async (ctx) => {
    const zip = parse(v.string({ pattern: /^\d{5}$/, label: 'a 5-digit ZIP code' }), ctx.query.get('zip') ?? '');
    if (!isUsable(app.providers.cash.info()))
      return { body: { available: false, reason: 'Cash delivery is not available right now.', zip } };
    return { body: { ...(await app.providers.cash.checkAvailability(zip)), zip } };
  });

  r.post(
    '/api/large-desk',
    (ctx) => {
      const b = parse(
        v.object({
          asset: assetV,
          network: networkV,
          approximateUsdCents: v.bigintString({ max: 10n ** 13n }),
          customerType: v.enum(['individual', 'business'] as const),
          fullName: v.string({ max: 120, label: 'your full name' }),
          email: v.string({ max: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, label: 'your email' }),
          phone: v.string({ max: 32, pattern: /^[\d\s()+.-]{10,}$/, label: 'a phone number' }),
          timing: v.enum(['this_week', 'this_month', 'exploring'] as const),
          notes: v.optional(v.string({ min: 0, max: 2000 })),
        }),
        ctx.body,
      );
      if (b.approximateUsdCents < PRICING_POLICY.largeDeskFromCents)
        throw new ApiError(
          422,
          'invalid_input',
          `The desk handles ${formatUsd(PRICING_POLICY.largeDeskFromCents, { whole: true })} or more.`,
          {
            field: 'approximateUsdCents',
          },
        );
      const id = newId('lrg');
      const reference = `DESK-${id.slice(-8).toUpperCase()}`;
      app.db.tx(() => {
        app.db.run(
          'INSERT INTO large_desk_requests (id, reference, user_id, asset, network, approximate_usd_cents, customer_type, full_name, email, phone, timing, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            reference,
            ctx.auth?.userId ?? null,
            b.asset,
            b.network,
            Number(b.approximateUsdCents),
            b.customerType,
            b.fullName,
            b.email,
            b.phone,
            b.timing,
            b.notes ?? '',
            app.clock.now(),
          ],
        );
        audit(app, actorOf(ctx), { action: 'large_desk.requested', targetType: 'large_desk', targetId: id });
      });
      return { status: 201, body: { reference, source: app.config.mode } };
    },
    { rateLimit: { bucket: 'desk', max: 5, windowMs: 60 * 60_000 } },
  );

  r.get('/api/legal', () => ({
    body: {
      documents: LEGAL_DOCUMENTS.map((d) => ({
        slug: d.slug,
        title: d.title,
        version: d.version,
        effectiveDate: d.effectiveDate,
        lastUpdated: d.lastUpdated,
        acceptance: d.acceptance,
      })),
    },
  }));

  /* ---------- Authentication ---------- */
  r.get('/api/auth/session', (ctx) => {
    if (!ctx.auth) return { body: { user: null, csrfToken: null, mode: app.config.mode } };
    return {
      body: {
        user: customers.profileView(app, ctx.auth.userId),
        csrfToken: ctx.auth.csrfToken,
        mfaVerified: ctx.auth.mfaVerified,
        mode: app.config.mode,
      },
    };
  });

  r.post(
    '/api/auth/signup',
    async (ctx) => {
      const b = parse(
        v.object({
          email: v.string({ max: 254, label: 'your email' }),
          password: v.string({ min: 1, max: 200, trim: false, label: 'a password' }),
          fullName: v.string({ max: 120, label: 'your full legal name' }),
          stateOfResidence: v.nullable(v.enum(customers.US_STATES_50, 'state')),
          notInRestrictedTerritory: v.bool(),
          accepted: acceptedV,
          /** Accepted but ignored — country is always recorded as US (primary market). */
          countryOfResidence: v.optional(v.nullable(v.string({ max: 2 }))),
        }),
        ctx.body,
      );
      const { userId, grant } = await auth.signUp(app, b, { ip: ctx.ip, userAgent: ctx.userAgent });
      auth.sessionCookies(app, grant).forEach(ctx.setCookie);
      return { status: 201, body: { user: customers.profileView(app, userId), csrfToken: grant.csrfToken } };
    },
    { rateLimit: { bucket: 'signup', max: 10, windowMs: 60 * 60_000 } },
  );

  r.post(
    '/api/auth/signin',
    async (ctx) => {
      const b = parse(
        v.object({
          email: v.string({ max: 254, label: 'your email' }),
          password: v.string({ max: 200, trim: false, label: 'your password' }),
          staffOnly: v.optional(v.bool()),
        }),
        ctx.body,
      );
      const result = await auth.signIn(app, b, { ip: ctx.ip, userAgent: ctx.userAgent });
      if (result.kind === 'mfa') return { body: { mfaRequired: true, challengeId: result.challengeId } };
      auth.sessionCookies(app, result.grant).forEach(ctx.setCookie);
      return { body: { mfaRequired: false, user: customers.profileView(app, result.userId), csrfToken: result.grant.csrfToken } };
    },
    { rateLimit: SIGNIN_LIMIT },
  );

  r.post(
    '/api/auth/mfa',
    (ctx) => {
      const b = parse(
        v.object({ challengeId: v.string({ max: 64 }), code: v.string({ pattern: /^\d{6}$/, label: 'the 6-digit code' }) }),
        ctx.body,
      );
      const { userId, grant } = auth.verifyMfaChallenge(app, b, { ip: ctx.ip, userAgent: ctx.userAgent });
      auth.sessionCookies(app, grant).forEach(ctx.setCookie);
      return { body: { user: customers.profileView(app, userId), csrfToken: grant.csrfToken } };
    },
    { rateLimit: SIGNIN_LIMIT },
  );

  r.post('/api/auth/signout', (ctx) => {
    auth.signOut(app, ctx.auth);
    auth.sessionCookies(app, null).forEach(ctx.setCookie);
    return { status: 204 };
  });

  r.post(
    '/api/auth/password-reset',
    async (ctx) => {
      const b = parse(v.object({ email: v.string({ max: 254, label: 'your email' }) }), ctx.body);
      const { sandboxResetUrl } = await auth.requestPasswordReset(app, b.email, ctx.ip);
      return { status: 202, body: { ok: true, ...(sandboxResetUrl ? { sandboxResetUrl } : {}) } };
    },
    { rateLimit: { bucket: 'reset', max: 5, windowMs: 15 * 60_000 } },
  );

  r.post(
    '/api/auth/password-reset/confirm',
    async (ctx) => {
      const b = parse(
        v.object({ token: v.string({ max: 128 }), password: v.string({ max: 200, trim: false, label: 'a new password' }) }),
        ctx.body,
      );
      await auth.confirmPasswordReset(app, b.token, b.password, ctx.ip);
      return { status: 204 };
    },
    { rateLimit: { bucket: 'reset', max: 10, windowMs: 15 * 60_000 } },
  );

  r.post(
    '/api/auth/password',
    async (ctx) => {
      const b = parse(
        v.object({
          currentPassword: v.string({ max: 200, trim: false, label: 'your current password' }),
          newPassword: v.string({ max: 200, trim: false, label: 'a new password' }),
        }),
        ctx.body,
      );
      await auth.changePassword(app, ctx.auth!, b.currentPassword, b.newPassword, ctx.ip);
      return { status: 204 };
    },
    { auth: 'user', rateLimit: SIGNIN_LIMIT },
  );

  r.post('/api/auth/totp/setup', (ctx) => ({ body: auth.beginTotpEnrollment(app, ctx.auth!) }), { auth: 'user' });
  r.post(
    '/api/auth/totp/confirm',
    (ctx) => {
      auth.confirmTotpEnrollment(
        app,
        ctx.auth!,
        parse(v.object({ code: v.string({ pattern: /^\d{6}$/, label: 'the 6-digit code' }) }), ctx.body).code,
        ctx.ip,
      );
      return { status: 204 };
    },
    { auth: 'user', rateLimit: SIGNIN_LIMIT },
  );
  r.post(
    '/api/auth/totp/disable',
    (ctx) => {
      auth.disableTotp(
        app,
        ctx.auth!,
        parse(v.object({ code: v.string({ pattern: /^\d{6}$/, label: 'the 6-digit code' }) }), ctx.body).code,
        ctx.ip,
      );
      return { status: 204 };
    },
    { auth: 'user', rateLimit: SIGNIN_LIMIT },
  );
  r.get('/api/auth/sessions', (ctx) => ({ body: { sessions: auth.listSessions(app, ctx.auth!) } }), { auth: 'user' });
  r.post('/api/auth/sessions/revoke-others', (ctx) => ({ body: { revoked: auth.revokeOtherSessions(app, ctx.auth!, ctx.ip) } }), {
    auth: 'user',
  });

  /* ---------- Customer: profile, verification, destinations ---------- */
  r.get('/api/me', (ctx) => ({ body: customers.profileView(app, me(ctx)) }), { auth: 'user' });
  r.put(
    '/api/me/profile',
    (ctx) => {
      const b = parse(
        v.object({
          fullName: v.optional(v.string({ max: 120, label: 'your full legal name' })),
          phone: v.nullable(v.string({ max: 32, pattern: /^[\d\s()+.-]{10,}$/, label: 'a phone number' })),
          countryOfResidence: v.optional(v.nullable(v.enum(COUNTRY_CODES, 'country'))),
          stateOfResidence: v.nullable(v.enum(customers.US_STATES, 'state')),
        }),
        ctx.body,
      );
      customers.updateProfile(app, actorOf(ctx), me(ctx), b);
      return { body: customers.profileView(app, me(ctx)) };
    },
    { auth: 'user', rateLimit: WRITE_LIMIT },
  );
  r.post('/api/me/verification', async (ctx) => ({ body: await customers.startVerification(app, actorOf(ctx), me(ctx)) }), {
    auth: 'user',
    rateLimit: { bucket: 'kyc', max: 5, windowMs: 60 * 60_000 },
  });
  /* Identity verification by documents (Service Rules 8.1). */
  const KYC_BODY_BYTES = Math.ceil((KYC_FILE_MAX_BYTES * 4) / 3) + 64 * 1024;
  r.get('/api/me/kyc', (ctx) => ({ body: kyc.customerKyc(app, me(ctx)) }), { auth: 'user' });
  r.put(
    '/api/me/kyc/id-type',
    (ctx) => {
      const b = parse(v.object({ idType: v.enum(ID_DOCUMENT_TYPES, 'ID type') }), ctx.body);
      return { body: kyc.setIdType(app, actorOf(ctx), me(ctx), b.idType) };
    },
    { auth: 'user', rateLimit: WRITE_LIMIT },
  );
  r.post(
    '/api/me/kyc/files',
    (ctx) => {
      const b = parse(
        v.object({
          kind: v.enum(KYC_FILE_KINDS, 'document'),
          fileName: v.string({ max: 200, label: 'a file name' }),
          contentType: v.enum(DOCUMENT_TYPES, 'file type'),
          dataBase64: v.string({ max: KYC_BODY_BYTES, trim: false, label: 'the file' }),
        }),
        ctx.body,
      );
      return { status: 201, body: kyc.uploadKycFile(app, actorOf(ctx), me(ctx), b) };
    },
    { auth: 'user', maxBodyBytes: KYC_BODY_BYTES, rateLimit: { bucket: 'kyc-files', max: 30, windowMs: 60 * 60_000 } },
  );
  r.get('/api/me/kyc/files/:id', (ctx) => ({ body: kyc.customerFile(app, me(ctx), ctx.params.id!) }), { auth: 'user' });
  r.post('/api/me/kyc/submit', async (ctx) => ({ body: await kyc.submitKyc(app, actorOf(ctx), me(ctx)) }), {
    auth: 'user',
    rateLimit: { bucket: 'kyc', max: 5, windowMs: 60 * 60_000 },
  });
  r.get('/api/me/destinations', (ctx) => ({ body: { destinations: customers.listDestinations(app, me(ctx)) } }), { auth: 'user' });
  r.post(
    '/api/me/destinations/bank',
    (ctx) => {
      const b = parse(
        v.object({
          label: v.optional(v.string({ min: 0, max: 60 })),
          routingNumber: v.string({ max: 20, label: 'the routing number' }),
          accountNumber: v.string({ max: 30, label: 'the account number' }),
          accountType: v.enum(['checking', 'savings'] as const, 'account type'),
        }),
        ctx.body,
      );
      return { status: 201, body: customers.addBankAccount(app, actorOf(ctx), me(ctx), { ...b, label: b.label ?? '' }) };
    },
    { auth: 'user', rateLimit: WRITE_LIMIT },
  );
  r.post(
    '/api/me/destinations/card',
    async (ctx) => {
      const b = parse(
        v.object({
          label: v.optional(v.string({ min: 0, max: 60 })),
          cardNumber: v.optional(v.string({ min: 0, max: 32, label: 'a card number' })),
          holderName: v.optional(v.string({ min: 0, max: 80, label: 'the cardholder name' })),
          // Explicitly rejected in the service if present — keep schema from silently dropping them.
          cvv: v.optional(v.string({ min: 0, max: 8 })),
          cvc: v.optional(v.string({ min: 0, max: 8 })),
          pin: v.optional(v.string({ min: 0, max: 12 })),
        }),
        ctx.body,
      );
      return { status: 201, body: await customers.addCard(app, actorOf(ctx), me(ctx), b) };
    },
    { auth: 'user', rateLimit: WRITE_LIMIT },
  );
  r.post(
    '/api/me/destinations/courier',
    async (ctx) => {
      const b = parse(
        v.object({
          phone: v.string({ max: 32, label: 'a phone number' }),
          line1: v.string({ max: 120, label: 'the street address' }),
          line2: v.optional(v.string({ min: 0, max: 80 })),
          city: v.string({ max: 60, label: 'the city' }),
          state: v.enum(customers.US_STATES, 'state'),
          zip: v.string({ max: 10, pattern: /^\d{5}(-\d{4})?$/, label: 'a ZIP code' }),
          window: v.enum(COURIER_WINDOWS, 'delivery window'),
          preferredDate: v.optional(v.string({ min: 0, max: 10 })),
          instructions: v.optional(v.string({ min: 0, max: 200 })),
        }),
        ctx.body,
      );
      return {
        status: 201,
        body: await customers.addCourierAddress(app, actorOf(ctx), me(ctx), {
          ...b,
          line2: b.line2 ?? '',
          preferredDate: b.preferredDate ?? '',
          instructions: b.instructions ?? '',
        }),
      };
    },
    { auth: 'user', rateLimit: WRITE_LIMIT },
  );
  r.delete(
    '/api/me/destinations/:id',
    (ctx) => {
      customers.removeDestination(app, actorOf(ctx), me(ctx), ctx.params.id!);
      return { status: 204 };
    },
    { auth: 'user' },
  );
  r.get(
    '/api/me/notifications',
    (ctx) => ({ body: { notifications: listNotifications(app, me(ctx)), unread: unreadNotificationCount(app, me(ctx)) } }),
    { auth: 'user' },
  );
  r.post(
    '/api/me/notifications/read',
    (ctx) => {
      const b = parse(v.object({ ids: v.optional(v.array(v.string({ max: 64 }), { max: 200 })) }), ctx.body);
      markNotificationsRead(app, me(ctx), b.ids ?? null);
      return { body: { unread: unreadNotificationCount(app, me(ctx)) } };
    },
    { auth: 'user' },
  );
  r.get(
    '/api/me/legal',
    (ctx) => ({
      body: {
        acceptances: app.db
          .all<{
            document_slug: string;
            document_version: string;
            context: string;
            accepted_at: number;
            order_id: string | null;
          }>(
            'SELECT document_slug, document_version, context, accepted_at, order_id FROM legal_acceptances WHERE user_id = ? ORDER BY accepted_at DESC LIMIT 200',
            [me(ctx)],
          )
          .map((a) => ({
            slug: a.document_slug,
            version: a.document_version,
            context: a.context,
            acceptedAt: a.accepted_at,
            orderId: a.order_id,
          })),
      },
    }),
    { auth: 'user' },
  );

  /* ---------- Quotes and orders ---------- */
  r.post(
    '/api/quotes',
    async (ctx) => {
      return { status: 201, body: await firmQuote(app, me(ctx), quoteInput(ctx.body)) };
    },
    { auth: 'user', rateLimit: { bucket: 'firm-quotes', max: 30, windowMs: 60_000 } },
  );

  r.post(
    '/api/orders',
    async (ctx) => {
      const b = parse(
        v.object({
          quoteId: v.string({ max: 64 }),
          // Empty for a buy paid by wire, which has no saved destination; createOrder checks it per order type.
          destinationId: v.string({ min: 0, max: 64 }),
          refundAddress: v.optional(v.nullable(v.string({ max: 128, label: 'a refund address' }))),
          receiveAddress: v.optional(v.nullable(v.string({ max: 128, label: 'a wallet address' }))),
          accepted: acceptedV,
        }),
        ctx.body,
      );
      const key = ctx.req.headers['idempotency-key'];
      return withIdempotency(app, `${me(ctx)}:orders`, typeof key === 'string' ? key : undefined, b, async () => {
        const o = await orders.createOrder(app, actorOf(ctx), me(ctx), b);
        return { status: 201, body: orders.orderView(app, o) };
      });
    },
    { auth: 'user', rateLimit: { bucket: 'orders', max: 10, windowMs: 60_000 } },
  );

  r.get(
    '/api/orders',
    (ctx) => {
      const { page, pageSize } = pageV(ctx.query, 50);
      return { body: orders.listCustomerOrders(app, me(ctx), page, pageSize) };
    },
    { auth: 'user' },
  );
  r.get(
    '/api/orders/:id',
    (ctx) => {
      orders.expireOverdueOrders(app);
      const row = orders.customerOrder(app, me(ctx), ctx.params.id!);
      const view = orders.orderView(app, row) as Record<string, unknown>;
      view.paymentConfirmations = payConfirm.listPaymentConfirmations(app, row.id);
      view.orderMessages = payConfirm.listOrderMessages(app, row.id);
      view.refundRequests = payConfirm.listRefundRequestsForOrder(app, row.id);
      return { body: view };
    },
    { auth: 'user' },
  );
  r.post(
    '/api/orders/:id/cancel',
    (ctx) => ({ body: orders.orderView(app, orders.cancelOrder(app, actorOf(ctx), me(ctx), ctx.params.id!)) }),
    { auth: 'user' },
  );
  r.post(
    '/api/orders/:id/report-sent',
    (ctx) => {
      // A tx hash (sell) or the customer's own wire reference (wire buy); the service checks the format for the order type.
      const b = parse(v.object({ txHash: v.nullable(v.string({ max: 128, pattern: /^[\w ./#-]+$/ })) }), ctx.body);
      return { body: orders.orderView(app, orders.reportSent(app, actorOf(ctx), me(ctx), ctx.params.id!, b.txHash)) };
    },
    { auth: 'user' },
  );

  r.post(
    '/api/orders/:id/refund-address',
    async (ctx) => {
      const b = parse(v.object({ refundAddress: v.string({ max: 128, label: 'a refund address' }) }), ctx.body);
      const o = await ops.setRefundAddress(app, actorOf(ctx), me(ctx), ctx.params.id!, b.refundAddress);
      return { body: orders.orderView(app, o) };
    },
    { auth: 'user', rateLimit: { bucket: 'refund-address', max: 10, windowMs: 60_000 } },
  );

  r.post(
    '/api/orders/:id/accept-courier-fee',
    async (ctx) => {
      const o = await ops.acceptCourierFee(app, actorOf(ctx), me(ctx), ctx.params.id!);
      return { body: orders.orderView(app, o) };
    },
    { auth: 'user', rateLimit: { bucket: 'accept-courier-fee', max: 20, windowMs: 60_000 } },
  );

  r.post(
    '/api/orders/:id/documents',
    (ctx) => {
      const b = parse(
        v.object({
          kind: v.enum(['id_document'] as const, 'document type'),
          fileName: v.string({ max: 200, label: 'a file name' }),
          contentType: v.enum(DOCUMENT_TYPES, 'file type'),
          dataBase64: v.string({ max: 6 * 1024 * 1024, trim: false, label: 'the file' }),
        }),
        ctx.body,
      );
      return { status: 201, body: { documents: uploadOrderDocument(app, actorOf(ctx), me(ctx), ctx.params.id!, b) } };
    },
    { auth: 'user', maxBodyBytes: 6 * 1024 * 1024, rateLimit: { bucket: 'documents', max: 10, windowMs: 60 * 60_000 } },
  );
  r.get(
    '/api/orders/:id/documents/:docId',
    (ctx) => ({
      body: downloadOrderDocument(app, actorOf(ctx), {
        userId: me(ctx),
        role: ctx.auth!.role,
        orderId: ctx.params.id!,
        documentId: ctx.params.docId!,
      }),
    }),
    { auth: 'user', rateLimit: { bucket: 'documents-read', max: 60, windowMs: 60_000 } },
  );

  r.post(
    '/api/orders/:id/payment-confirmation',
    (ctx) => {
      const b = parse(
        v.object({
          txid: v.optional(v.nullable(v.string({ max: 128, label: 'a transaction hash' }))),
          wireReference: v.optional(v.nullable(v.string({ max: 120, label: 'a bank reference' }))),
          comment: v.optional(v.nullable(v.string({ max: 2000, label: 'a comment' }))),
          file: v.optional(
            v.nullable(
              v.object({
                fileName: v.string({ max: 200, label: 'a file name' }),
                contentType: v.enum(DOCUMENT_TYPES, 'file type'),
                dataBase64: v.string({ max: 6 * 1024 * 1024, trim: false, label: 'the file' }),
              }),
            ),
          ),
        }),
        ctx.body,
      );
      return {
        status: 201,
        body: {
          confirmations: payConfirm.submitPaymentConfirmation(app, actorOf(ctx), me(ctx), ctx.params.id!, b),
          order: orders.orderView(app, orders.getOrderRow(app, ctx.params.id!)),
        },
      };
    },
    { auth: 'user', maxBodyBytes: 6 * 1024 * 1024, rateLimit: { bucket: 'payment-confirm', max: 20, windowMs: 60 * 60_000 } },
  );

  r.post(
    '/api/orders/:id/refund-request',
    (ctx) => {
      const b = parse(
        v.object({
          reason: v.string({ min: 4, max: 2000, label: 'a reason' }),
          file: v.optional(
            v.nullable(
              v.object({
                fileName: v.string({ max: 200, label: 'a file name' }),
                contentType: v.enum(DOCUMENT_TYPES, 'file type'),
                dataBase64: v.string({ max: 6 * 1024 * 1024, trim: false, label: 'the file' }),
              }),
            ),
          ),
        }),
        ctx.body,
      );
      return {
        status: 201,
        body: { request: payConfirm.submitRefundRequest(app, actorOf(ctx), me(ctx), ctx.params.id!, b) },
      };
    },
    { auth: 'user', maxBodyBytes: 6 * 1024 * 1024, rateLimit: { bucket: 'refund-request', max: 10, windowMs: 60 * 60_000 } },
  );

  /* ---------- Support ---------- */
  r.get('/api/support/conversations', (ctx) => ({ body: { conversations: support.listCustomerConversations(app, me(ctx)) } }), {
    auth: 'user',
  });
  r.post(
    '/api/support/conversations',
    (ctx) => {
      const b = parse(
        v.object({
          subject: v.string({ max: 140, label: 'a subject' }),
          body: v.string({ max: 4000, label: 'a message' }),
          orderId: v.nullable(v.string({ max: 64 })),
          clientMessageId: clientIdV,
        }),
        ctx.body,
      );
      return { status: 201, body: support.createConversation(app, actorOf(ctx), me(ctx), b) };
    },
    { auth: 'user', rateLimit: { bucket: 'support-new', max: 10, windowMs: 60 * 60_000 } },
  );
  r.get('/api/support/conversations/:id', (ctx) => ({ body: support.getCustomerConversation(app, me(ctx), ctx.params.id!) }), {
    auth: 'user',
  });
  r.post(
    '/api/support/conversations/:id/messages',
    (ctx) => {
      const b = parse(v.object({ body: v.string({ max: 4000, label: 'a message' }), clientMessageId: clientIdV }), ctx.body);
      return { status: 201, body: support.postCustomerMessage(app, me(ctx), ctx.params.id!, b.body, b.clientMessageId) };
    },
    { auth: 'user', rateLimit: { bucket: 'support-msg', max: 30, windowMs: 60_000 } },
  );
  r.post(
    '/api/support/conversations/:id/read',
    (ctx) => {
      support.markCustomerRead(app, me(ctx), ctx.params.id!);
      return { status: 204 };
    },
    { auth: 'user' },
  );

  /* ---------- Live updates (server-sent events) ---------- */
  r.get(
    '/api/events',
    (ctx) => {
      const a = ctx.auth!;
      const res = ctx.res;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Content-Type-Options': 'nosniff',
      });
      res.write(`retry: 3000\nevent: ready\ndata: {"mode":"${app.config.mode}"}\n\n`);
      const isStaff = a.role !== 'customer' && (!app.config.requireStaffMfa || a.mfaVerified);
      const unsubscribe = app.bus.subscribe(a.userId, isStaff, (e) => res.write(`event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`));
      const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25_000);
      heartbeat.unref();
      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      ctx.req.on('close', close);
      res.on('error', close);
      return HANDLED;
    },
    { auth: 'user', rateLimit: { bucket: 'events', max: 30, windowMs: 60_000 } },
  );

  /* ---------- Provider webhooks ---------- */
  r.post(
    '/api/webhooks/:source',
    (ctx) => {
      const source = ctx.params.source!;
      if (!isWebhookSource(source)) throw new ApiError(404, 'not_found', 'Unknown webhook source.');
      const sig = ctx.req.headers[SIGNATURE_HEADER];
      const outcome = ingestWebhook(app, source, typeof sig === 'string' ? sig : undefined, ctx.rawBody);
      return { body: outcome };
    },
    { csrfExempt: true, maxBodyBytes: 256 * 1024, rateLimit: { bucket: 'webhooks', max: 600, windowMs: 60_000 } },
  );

  registerAdminRoutes(r, app);
}

/* ======================= Admin ======================= */

const SUPPORT: Role[] = ['support', 'reviewer', 'admin', 'owner'];
const REVIEWER: Role[] = ['reviewer', 'admin', 'owner'];
const ADMIN: Role[] = ['admin', 'owner'];

function registerAdminRoutes(r: Router, app: AppContext) {
  const staff = (roles: Role[] = SUPPORT) => ({ auth: 'staff' as const, roles });

  r.get('/api/admin/overview', () => ({ body: admin.overview(app) }), staff());
  r.get('/api/admin/staff', () => ({ body: { staff: admin.staffList(app) } }), staff());

  r.get(
    '/api/admin/orders',
    (ctx) => {
      orders.expireOverdueOrders(app);
      const q = ctx.query;
      const statuses = (q.get('status') ?? '').split(',').filter(Boolean);
      for (const s of statuses)
        if (!(ORDER_STATUSES as readonly string[]).includes(s)) throw new ApiError(400, 'invalid_input', `Unknown status ${s}.`);
      const stages = (q.get('stage') ?? '').split(',').filter(Boolean) as OrderStage[];
      for (const s of stages)
        if (!(ORDER_STAGES as readonly string[]).includes(s)) throw new ApiError(400, 'invalid_input', `Unknown stage ${s}.`);
      const num = (k: string) => parse(v.optional(v.int({ min: 0 })), q.get(k) ?? undefined) ?? null;
      const f: admin.QueueFilter = {
        q: q.get('q')?.trim().slice(0, 120) || null,
        statuses: statuses as OrderStatus[],
        stages,
        payoutMethod: q.get('payoutMethod') ? parse(methodV, q.get('payoutMethod')) : null,
        minNetCents: num('minNetCents'),
        maxNetCents: num('maxNetCents'),
        from: num('from'),
        to: num('to'),
        review: q.get('review') === 'open' ? 'open' : 'any',
        assigned: (['me', 'unassigned'] as const).find((x) => x === q.get('assigned')) ?? 'any',
        overdue: q.get('overdue') === 'true',
        attention: q.get('attention') === 'true',
        sort:
          (['created_at', 'updated_at', 'net_cents', 'priority', 'attention'] as const).find((x) => x === q.get('sort')) ?? 'created_at',
        dir: q.get('dir') === 'asc' ? 'asc' : 'desc',
        ...pageV(q),
      };
      return { body: admin.queue(app, ctx.auth!.userId, f) };
    },
    staff(),
  );

  r.get(
    '/api/admin/orders/:id',
    (ctx) => {
      const o = ops.ensureOrder(app, ctx.params.id!);
      return {
        body: {
          order: orders.orderView(app, o, { internal: true }),
          customer: admin.customerSummary(app, o.user_id),
          courierDelivery:
            o.payout_method === 'courier_cash' && o.payout_destination_id
              ? customers.courierDelivery(app, o.payout_destination_id, { masked: ctx.auth!.role === 'support' })
              : null,
          cardDestinationSummary:
            o.payout_method === 'instant_debit' && o.direction === 'sell' && o.payout_destination_id
              ? {
                  destinationId: o.payout_destination_id,
                  last4: o.payout_last4,
                  label: o.payout_label,
                  /** Full PAN requires a separate audited reveal call. */
                  revealPath: `/api/admin/orders/${o.id}/card-destination`,
                }
              : null,
          notes: ops.orderNotes(app, o.id),
          reviews: app.db.all(
            'SELECT id, status, reason, opened_by AS openedBy, decided_by AS decidedBy, decision_reason AS decisionReason, created_at AS createdAt, decided_at AS decidedAt FROM compliance_reviews WHERE order_id = ? ORDER BY created_at',
            [o.id],
          ),
          payouts: app.db.all(
            'SELECT id, attempt, provider, method, amount_cents AS amountCents, status, provider_ref AS providerRef, failure_reason AS failureReason, authorized_by AS authorizedBy, authorization_reason AS authorizationReason, created_at AS createdAt, updated_at AS updatedAt FROM payout_instructions WHERE order_id = ? ORDER BY attempt',
            [o.id],
          ),
          refund:
            app.db.get(
              'SELECT status, provider_ref AS providerRef, tx_hash AS txHash, reason, created_at AS createdAt, updated_at AS updatedAt FROM refunds WHERE order_id = ?',
              [o.id],
            ) ?? null,
          deposits: app.db.all(
            'SELECT provider, provider_event_id AS eventId, tx_hash AS txHash, amount_atomic AS amountAtomic, confirmations, observed_at AS observedAt FROM deposit_observations WHERE order_id = ? ORDER BY observed_at',
            [o.id],
          ),
          conversations: app.db.all(
            'SELECT id, subject, status, last_message_at AS lastMessageAt FROM support_conversations WHERE order_id = ? OR (customer_id = ? AND order_id IS NULL) ORDER BY last_message_at DESC LIMIT 10',
            [o.id, o.user_id],
          ),
          audit: admin.auditLog(app, { targetType: 'order', targetId: o.id, actorId: null, action: null, page: 1, pageSize: 100 }).items,
          notifications: orderNotifications(app, o.id),
          actions: ops.availableActions(app, o, ctx.auth!.role),
          sandboxControls: false,
          paymentConfirmations: payConfirm.listPaymentConfirmations(app, o.id),
          orderMessages: payConfirm.listOrderMessages(app, o.id),
          refundRequests: payConfirm.listRefundRequestsForOrder(app, o.id),
        },
      };
    },
    staff(),
  );
  r.get(
    '/api/admin/orders/:id/documents/:docId',
    (ctx) => ({
      body: downloadOrderDocument(app, staffActor(ctx), {
        userId: me(ctx),
        role: ctx.auth!.role,
        orderId: ctx.params.id!,
        documentId: ctx.params.docId!,
      }),
    }),
    staff(SUPPORT),
  );

  const orderAction = (path: string, roles: Role[], run: (ctx: Ctx, id: string) => unknown) =>
    r.post(
      `/api/admin/orders/:id/${path}`,
      async (ctx) => {
        const o = ops.ensureOrder(app, ctx.params.id!);
        // Two operators can act on one order: an action taken on a screen that no longer shows the
        // current status is refused, so nobody approves or rejects an order that has already moved.
        const expected = (ctx.body as { expectedStatus?: unknown } | null)?.expectedStatus;
        if (typeof expected === 'string' && expected !== o.status)
          throw new ApiError(
            409,
            'stale_status',
            'This order changed while you were looking at it. It has been reloaded; check it and try again.',
          );
        await run(ctx, o.id);
        return { body: orders.orderView(app, orders.getOrderRow(app, o.id), { internal: true }) };
      },
      { ...staff(roles), rateLimit: WRITE_LIMIT },
    );

  orderAction('assign', SUPPORT, (ctx, id) =>
    ops.assignOrder(app, staffActor(ctx), id, parse(v.object({ operatorId: v.nullable(v.string({ max: 64 })) }), ctx.body).operatorId),
  );
  orderAction('notes', SUPPORT, (ctx, id) =>
    ops.addNote(app, staffActor(ctx), id, parse(v.object({ body: v.string({ max: 4000, label: 'a note' }) }), ctx.body).body),
  );
  orderAction('flag', REVIEWER, (ctx, id) => ops.flagForReview(app, staffActor(ctx), id, parse(reasonV, ctx.body).reason));
  orderAction('request-info', SUPPORT, (ctx, id) =>
    ops.messageCustomer(
      app,
      staffActor(ctx),
      id,
      parse(v.object({ message: v.string({ min: 10, max: 2000, label: 'a question' }) }), ctx.body).message,
      { askForInfo: true },
    ),
  );
  orderAction('message', SUPPORT, (ctx, id) =>
    ops.messageCustomer(
      app,
      staffActor(ctx),
      id,
      parse(v.object({ message: v.string({ min: 2, max: 4000, label: 'a message' }) }), ctx.body).message,
    ),
  );
  orderAction('hold', REVIEWER, (ctx, id) => ops.placeHold(app, staffActor(ctx), id, parse(reasonV, ctx.body).reason));
  orderAction('release-hold', REVIEWER, (ctx, id) => ops.releaseHold(app, staffActor(ctx), id, parse(reasonV, ctx.body).reason));
  orderAction('approve', REVIEWER, (ctx, id) => ops.approveReview(app, staffActor(ctx), id, parse(reasonV, ctx.body).reason));
  orderAction('reject', REVIEWER, (ctx, id) => ops.rejectOrder(app, staffActor(ctx), id, parse(reasonV, ctx.body).reason));
  orderAction('confirm-deposit-manual', ADMIN, (ctx, id) => {
    const b = parse(
      v.object({
        txHash: v.string({ min: 4, max: 200, label: 'a transaction id or reference' }),
        amountAtomic: v.string({ min: 1, max: 40, label: 'an amount' }),
        comment: v.string({ min: 4, max: 2000, label: 'a verification comment' }),
        reason: v.optional(v.string({ max: 500, label: 'a reason' })),
      }),
      ctx.body,
    );
    return ops.confirmDepositManual(app, staffActor(ctx), id, b);
  });
  orderAction('authorize-payout', ADMIN, (ctx, id) => ops.authorizePayout(app, staffActor(ctx), id, parse(reasonV, ctx.body).reason));
  orderAction('record-manual-payout', ADMIN, (ctx, id) => {
    const b = parse(
      v.object({
        reason: v.string({ min: 4, max: 500, label: 'a reason' }),
        evidenceRef: v.string({ min: 4, max: 200, label: 'an evidence reference' }),
        evidenceNote: v.optional(v.string({ max: 2000, label: 'evidence notes' })),
        amountCents: v.optional(v.nullable(v.int({ min: 1, max: 100_000_000_00 }))),
        /** Buy→crypto outgoing TXID; optional here — service requires/validates it for buys. */
        payoutTxHash: v.optional(v.nullable(v.string({ min: 8, max: 128, label: 'an outgoing transaction hash' }))),
      }),
      ctx.body,
    );
    return ops.recordManualPayout(app, staffActor(ctx), id, b);
  });
  orderAction('retry-payout', ADMIN, (ctx, id) => ops.retryPayout(app, staffActor(ctx), id, parse(reasonV, ctx.body).reason));
  orderAction('refund', ADMIN, (ctx, id) => ops.initiateRefund(app, staffActor(ctx), id, parse(reasonV, ctx.body).reason));
  orderAction('resubmit-refund', ADMIN, (ctx, id) => ops.submitRefund(app, staffActor(ctx), id, parse(reasonV, ctx.body).reason));
  orderAction('record-manual-refund', ADMIN, (ctx, id) => {
    const b = parse(
      v.object({
        reason: v.string({ min: 4, max: 500, label: 'a reason' }),
        evidenceRef: v.string({ min: 4, max: 200, label: 'an evidence reference' }),
        evidenceNote: v.optional(v.string({ max: 2000, label: 'evidence notes' })),
      }),
      ctx.body,
    );
    return ops.recordManualRefund(app, staffActor(ctx), id, b);
  });
  orderAction('set-courier-fee', REVIEWER, (ctx, id) => {
    const b = parse(
      v.object({
        feeCents: v.int({ min: 0, max: 10_000_000 }),
        reason: v.string({ min: 4, max: 500, label: 'a reason' }),
      }),
      ctx.body,
    );
    return ops.setCourierFee(app, staffActor(ctx), id, b.feeCents, b.reason);
  });
  orderAction('assign-wire-credentials', SUPPORT, (ctx, id) => {
    const b = parse(
      v.object({
        wireSetId: v.string({ min: 8, max: 64 }),
        confirmReplace: v.optional(v.bool()),
        reason: v.optional(v.string({ max: 500, label: 'a reason' })),
      }),
      ctx.body,
    );
    return orders.assignWireCredentials(app, staffActor(ctx), id, b.wireSetId, {
      confirmReplace: b.confirmReplace,
      reason: b.reason,
    });
  });
  orderAction('assign-custom-wire-credentials', SUPPORT, (ctx, id) => {
    const b = parse(
      v.object({
        beneficiary: v.string({ min: 1, max: 200, label: 'a beneficiary' }),
        bankName: v.string({ min: 1, max: 200, label: 'a bank name' }),
        accountNumber: v.optional(v.nullable(v.string({ max: 64, label: 'an account number' }))),
        routingNumber: v.optional(v.nullable(v.string({ max: 34, label: 'a routing number' }))),
        swiftBic: v.optional(v.nullable(v.string({ max: 11, label: 'a SWIFT/BIC' }))),
        bankAddress: v.optional(v.nullable(v.string({ max: 400, label: 'a bank address' }))),
        instructions: v.optional(v.nullable(v.string({ max: 2000, label: 'instructions' }))),
        confirmReplace: v.optional(v.bool()),
        reason: v.optional(v.string({ max: 500, label: 'a reason' })),
      }),
      ctx.body,
    );
    return orders.assignCustomWireCredentials(app, staffActor(ctx), id, b);
  });
  orderAction('assign-wallet-credentials', SUPPORT, (ctx, id) => {
    const b = parse(
      v.object({
        walletId: v.string({ min: 8, max: 64 }),
        confirmReplace: v.optional(v.bool()),
        reason: v.optional(v.string({ max: 500, label: 'a reason' })),
      }),
      ctx.body,
    );
    return orders.assignWalletCredentials(app, staffActor(ctx), id, b.walletId, {
      confirmReplace: b.confirmReplace,
      reason: b.reason,
    });
  });
  orderAction('review-payment-confirmation', SUPPORT, (ctx, id) => {
    const b = parse(
      v.object({
        confirmationId: v.string({ max: 64, label: 'a confirmation id' }),
        status: v.enum(['approved', 'needs_info', 'rejected'] as const, 'status'),
        staffNote: v.optional(v.nullable(v.string({ max: 2000, label: 'a note' }))),
      }),
      ctx.body,
    );
    payConfirm.reviewPaymentConfirmation(app, staffActor(ctx), b.confirmationId, {
      status: b.status,
      staffNote: b.staffNote,
    });
    void id;
  });
  orderAction('verification-message', SUPPORT, (ctx, id) => {
    const b = parse(
      v.object({
        body: v.string({ min: 1, max: 4000, label: 'a message' }),
        file: v.optional(
          v.nullable(
            v.object({
              fileName: v.string({ max: 200, label: 'a file name' }),
              contentType: v.enum(DOCUMENT_TYPES, 'file type'),
              dataBase64: v.string({ max: 6 * 1024 * 1024, trim: false, label: 'the file' }),
            }),
          ),
        ),
      }),
      ctx.body,
    );
    payConfirm.postOrderMessage(app, staffActor(ctx), id, b);
  });
  orderAction('review-refund-request', ADMIN, (ctx, id) => {
    const b = parse(
      v.object({
        requestId: v.string({ max: 64, label: 'a request id' }),
        status: v.enum(['needs_info', 'approved', 'rejected', 'cancelled'] as const, 'status'),
        staffNote: v.optional(v.nullable(v.string({ max: 2000, label: 'a note' }))),
      }),
      ctx.body,
    );
    payConfirm.reviewRefundRequest(app, staffActor(ctx), b.requestId, {
      status: b.status,
      staffNote: b.staffNote,
    });
    void id;
  });
  orderAction('issue-wire-instructions', SUPPORT, (ctx, id) => {
    const b = parse(v.object({ wireSetId: v.optional(v.string({ min: 8, max: 64 })) }), ctx.body && typeof ctx.body === 'object' ? ctx.body : {});
    return orders.issueWireInstructions(app, staffActor(ctx), id, { wireSetId: b.wireSetId });
  });
  orderAction('issue-card-payin-instructions', SUPPORT, (ctx, id) => {
    const b = parse(
      v.object({
        paymentUrl: v.optional(v.nullable(v.string({ min: 0, max: 2000, label: 'a payment URL' }))),
        instructions: v.optional(v.nullable(v.string({ min: 0, max: 4000, label: 'payment instructions' }))),
        providerRef: v.optional(v.nullable(v.string({ min: 0, max: 120, label: 'a provider reference' }))),
      }),
      ctx.body && typeof ctx.body === 'object' ? ctx.body : {},
    );
    return orders.issueCardPayInInstructions(app, staffActor(ctx), id, b);
  });
  r.get(
    '/api/admin/orders/:id/card-destination',
    (ctx) => ({ body: customers.revealOrderCardDestination(app, staffActor(ctx), ctx.params.id!) }),
    { ...staff(ADMIN), rateLimit: WRITE_LIMIT },
  );

  /* ---------- Credentials (wire sets + crypto wallets) ---------- */
  r.get('/api/admin/credentials/wire', () => ({ body: { items: credentials.listWireSets(app) } }), staff());
  r.get('/api/admin/credentials/wallets', () => ({ body: { items: credentials.listWallets(app) } }), staff());
  r.get(
    '/api/admin/credentials/wallets/for-pair',
    (ctx) => {
      const asset = parse(assetV, ctx.query.get('asset'));
      const network = parse(networkV, ctx.query.get('network'));
      return { body: { items: credentials.listActiveWalletsForPair(app, asset, network) } };
    },
    staff(),
  );

  const wireBody = v.object({
    name: v.string({ min: 1, max: 120, label: 'an internal name' }),
    beneficiary: v.string({ min: 1, max: 200, label: 'a beneficiary' }),
    bankName: v.string({ min: 1, max: 200, label: 'a bank name' }),
    accountNumber: v.optional(v.string({ min: 4, max: 64, label: 'an account number' })),
    routingNumber: v.optional(v.string({ min: 4, max: 34, label: 'a routing number' })),
    swiftBic: v.optional(v.string({ min: 8, max: 11, label: 'a SWIFT/BIC' })),
    bankAddress: v.optional(v.string({ max: 400, label: 'a bank address' })),
    instructions: v.optional(v.string({ max: 2000, label: 'instructions' })),
    currency: v.optional(v.enum(['USD'] as const, 'currency')),
  });
  r.post(
    '/api/admin/credentials/wire',
    (ctx) => ({ status: 201, body: credentials.createWireSet(app, staffActor(ctx), parse(wireBody, ctx.body)) }),
    { ...staff(ADMIN), rateLimit: WRITE_LIMIT },
  );
  r.put(
    '/api/admin/credentials/wire/:id',
    (ctx) => ({ body: credentials.updateWireSet(app, staffActor(ctx), ctx.params.id!, parse(wireBody, ctx.body)) }),
    { ...staff(ADMIN), rateLimit: WRITE_LIMIT },
  );
  r.post(
    '/api/admin/credentials/wire/:id/status',
    (ctx) => {
      const status = parse(v.object({ status: v.enum(['active', 'suspended'] as const) }), ctx.body).status;
      return { body: credentials.setWireStatus(app, staffActor(ctx), ctx.params.id!, status) };
    },
    { ...staff(ADMIN), rateLimit: WRITE_LIMIT },
  );
  r.post(
    '/api/admin/credentials/wire/:id/default',
    (ctx) => ({ body: credentials.setWireDefault(app, staffActor(ctx), ctx.params.id!) }),
    { ...staff(ADMIN), rateLimit: WRITE_LIMIT },
  );

  const walletBody = v.object({
    name: v.string({ min: 1, max: 120, label: 'an internal name' }),
    asset: v.optional(v.nullable(assetV)),
    network: v.optional(v.nullable(networkV)),
    address: v.string({ min: 20, max: 128, label: 'a wallet address' }),
    purpose: v.optional(v.enum(['deposit', 'payout'] as const, 'purpose')),
    note: v.optional(v.nullable(v.string({ max: 2000, label: 'a note' }))),
  });
  r.post(
    '/api/admin/credentials/wallets',
    (ctx) => ({ status: 201, body: credentials.createWallet(app, staffActor(ctx), parse(walletBody, ctx.body)) }),
    { ...staff(ADMIN), rateLimit: WRITE_LIMIT },
  );
  r.put(
    '/api/admin/credentials/wallets/:id',
    (ctx) => ({ body: credentials.updateWallet(app, staffActor(ctx), ctx.params.id!, parse(walletBody, ctx.body)) }),
    { ...staff(ADMIN), rateLimit: WRITE_LIMIT },
  );
  r.post(
    '/api/admin/credentials/wallets/:id/status',
    (ctx) => {
      const status = parse(v.object({ status: v.enum(['active', 'suspended'] as const) }), ctx.body).status;
      return { body: credentials.setWalletStatus(app, staffActor(ctx), ctx.params.id!, status) };
    },
    { ...staff(ADMIN), rateLimit: WRITE_LIMIT },
  );
  r.post(
    '/api/admin/credentials/wallets/:id/default',
    (ctx) => ({ body: credentials.setWalletDefault(app, staffActor(ctx), ctx.params.id!) }),
    { ...staff(ADMIN), rateLimit: WRITE_LIMIT },
  );

  /* ---------- Support inbox ---------- */
  r.get(
    '/api/admin/conversations',
    (ctx) => {
      const q = ctx.query;
      return {
        body: support.inbox(app, ctx.auth!.userId, {
          status: (['open', 'pending', 'resolved'] as const).find((s) => s === q.get('status')) ?? 'all',
          q: q.get('q')?.trim().slice(0, 120) || null,
          assigned: (['me', 'unassigned'] as const).find((x) => x === q.get('assigned')) ?? 'any',
          unread: q.get('unread') === 'true',
          ...pageV(q),
        }),
      };
    },
    staff(),
  );
  r.get('/api/admin/conversations/:id', (ctx) => ({ body: support.getStaffConversation(app, ctx.params.id!) }), staff());
  r.post(
    '/api/admin/conversations/:id/messages',
    (ctx) => {
      const b = parse(
        v.object({ body: v.string({ max: 4000, label: 'a message' }), internal: v.optional(v.bool()), clientMessageId: clientIdV }),
        ctx.body,
      );
      return {
        status: 201,
        body: support.staffReply(app, staffActor(ctx), ctx.params.id!, b.body, b.internal ?? false, b.clientMessageId),
      };
    },
    { ...staff(), rateLimit: WRITE_LIMIT },
  );
  r.post(
    '/api/admin/conversations/:id/status',
    (ctx) => {
      support.setConversationStatus(
        app,
        staffActor(ctx),
        ctx.params.id!,
        parse(v.object({ status: v.enum(['open', 'pending', 'resolved'] as const) }), ctx.body).status,
      );
      return { body: support.getStaffConversation(app, ctx.params.id!) };
    },
    staff(),
  );
  r.post(
    '/api/admin/conversations/:id/assign',
    (ctx) => {
      support.assignConversation(
        app,
        staffActor(ctx),
        ctx.params.id!,
        parse(v.object({ operatorId: v.nullable(v.string({ max: 64 })) }), ctx.body).operatorId,
      );
      return { body: support.getStaffConversation(app, ctx.params.id!) };
    },
    staff(),
  );
  r.post(
    '/api/admin/conversations/:id/read',
    (ctx) => {
      support.markStaffRead(app, ctx.params.id!);
      return { status: 204 };
    },
    staff(),
  );

  /* ---------- Users, audit, system ---------- */
  r.get(
    '/api/admin/users',
    (ctx) => {
      const role = ctx.query.get('role');
      return {
        body: admin.listUsers(app, {
          q: ctx.query.get('q')?.trim().slice(0, 120) || null,
          role: role ? parse(v.enum(['customer', 'support', 'reviewer', 'admin', 'owner'] as const), role) : null,
          ...pageV(ctx.query),
        }),
      };
    },
    staff(ADMIN),
  );
  r.post(
    '/api/admin/users/:id/role',
    (ctx) => {
      const b = parse(
        v.object({
          role: v.enum(['customer', 'support', 'reviewer', 'admin', 'owner'] as const),
          reason: v.string({ min: 4, max: 500, label: 'a reason' }),
        }),
        ctx.body,
      );
      admin.changeRole(app, staffActor(ctx), ctx.params.id!, b.role, b.reason);
      return { status: 204 };
    },
    staff(ADMIN),
  );
  r.post(
    '/api/admin/users/:id/status',
    (ctx) => {
      const b = parse(
        v.object({ status: v.enum(['active', 'disabled'] as const), reason: v.string({ min: 4, max: 500, label: 'a reason' }) }),
        ctx.body,
      );
      admin.setUserStatus(app, staffActor(ctx), ctx.params.id!, b.status, b.reason);
      return { status: 204 };
    },
    staff(ADMIN),
  );
  r.get(
    '/api/admin/audit',
    (ctx) => {
      const q = ctx.query;
      return {
        body: admin.auditLog(app, {
          targetType: q.get('targetType') || null,
          targetId: q.get('targetId') || null,
          actorId: q.get('actorId') || null,
          action: q.get('action') || null,
          ...pageV(q),
        }),
      };
    },
    staff(REVIEWER),
  );
  /* Identity verification review: reviewers and admins only, never support. */
  r.get(
    '/api/admin/kyc',
    (ctx) => {
      const status = parse(
        v.optional(v.enum(['submitted', 'needs_info', 'approved', 'rejected', 'all'] as const, 'status')),
        ctx.query.get('status') ?? undefined,
      );
      return { body: kyc.kycQueue(app, { status: status ?? 'submitted', ...pageV(ctx.query) }) };
    },
    staff(REVIEWER),
  );
  r.get('/api/admin/kyc/:id', (ctx) => ({ body: kyc.kycDetail(app, ctx.params.id!) }), staff(REVIEWER));
  r.get('/api/admin/kyc/:id/files/:fileId', (ctx) => ({ body: kyc.staffFile(app, actorOf(ctx), ctx.params.id!, ctx.params.fileId!) }), {
    ...staff(REVIEWER),
    rateLimit: { bucket: 'kyc-view', max: 300, windowMs: 60 * 60_000 },
  });
  r.post(
    '/api/admin/kyc/:id/decision',
    (ctx) => {
      const b = parse(
        v.object({
          decision: v.enum(['approve', 'needs_info', 'reject'] as const, 'decision'),
          reason: v.string({ min: 4, max: 500, label: 'a reason' }),
        }),
        ctx.body,
      );
      return { body: kyc.decide(app, actorOf(ctx), ctx.params.id!, b.decision, b.reason) };
    },
    { ...staff(REVIEWER), rateLimit: WRITE_LIMIT },
  );
  r.get('/api/admin/webhooks', (ctx) => ({ body: admin.webhookLog(app, pageV(ctx.query).page, pageV(ctx.query).pageSize) }), staff(ADMIN));
  r.get('/api/admin/system', () => ({ body: admin.systemStatus(app) }), staff(ADMIN));
  r.get(
    '/api/admin/large-desk',
    (ctx) => ({ body: admin.largeDeskRequests(app, pageV(ctx.query).page, pageV(ctx.query).pageSize) }),
    staff(),
  );

  /* ---------- Sandbox lab (sandbox mode only; never registered in production) ---------- */
  if (app.config.mode !== 'sandbox') return;
  const lab = (path: string, run: (ctx: Ctx, id: string) => unknown) =>
    r.post(
      `/api/admin/sandbox/orders/:id/${path}`,
      (ctx) => {
        const o = ops.ensureOrder(app, ctx.params.id!);
        const outcome = run(ctx, o.id);
        return { body: { outcome, order: orders.orderView(app, orders.getOrderRow(app, o.id), { internal: true }) } };
      },
      { ...staff(SUPPORT), rateLimit: WRITE_LIMIT },
    );
  lab('deposit', (ctx, id) =>
    sandbox.simulateDeposit(
      app,
      staffActor(ctx),
      id,
      parse(v.object({ scenario: v.enum(['exact', 'short', 'late'] as const) }), ctx.body).scenario,
    ),
  );
  lab('confirmations', (ctx, id) =>
    sandbox.simulateConfirmations(app, staffActor(ctx), id, {
      toFinal: parse(v.object({ toFinal: v.optional(v.bool()) }), ctx.body).toFinal ?? false,
    }),
  );
  lab('payout', (ctx, id) => {
    const b = parse(
      v.object({ outcome: v.enum(['processing', 'completed', 'failed'] as const), reason: v.optional(v.string({ max: 300 })) }),
      ctx.body,
    );
    return sandbox.simulatePayout(app, staffActor(ctx), id, b.outcome, b.reason);
  });
  lab('refund-complete', (ctx, id) => sandbox.simulateRefundCompleted(app, staffActor(ctx), id));
  lab('wire-instructions', (ctx, id) => sandbox.markWireInstructionsIssued(app, staffActor(ctx), id));
  lab('wire-received', (ctx, id) => sandbox.markWireReceived(app, staffActor(ctx), id));
  lab('replay', (ctx, id) => sandbox.replayLastWebhook(app, staffActor(ctx), id));
  lab('expire', (ctx, id) => sandbox.forceExpire(app, staffActor(ctx), id).status);
  r.get('/api/admin/sandbox/notifications', () => ({ body: { notifications: admin.sandboxNotifications(app) } }), staff(SUPPORT));
}
