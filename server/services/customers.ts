/**
 * Customer profile, identity verification and payout destinations.
 * Bank and card details are encrypted at rest (AES-256-GCM). Customer APIs
 * return only last4 for bank/card. Full card numbers are revealed only to
 * authorized staff via an audited CRM endpoint. CVV/CVC/PIN are never accepted.
 */
import {
  normalizeCardNumber,
  validateAccountNumber,
  validateCardHolderName,
  validateCardNumber,
  validateRoutingNumber,
} from '@/domain/validation';
import type { PayoutMethodId } from '@/domain/payout';
import {
  courierLabel,
  isoDay,
  normalizeCourierInput,
  validateCourierDelivery,
  zip5,
  type CourierDeliveryInput,
  type CourierWindow,
} from '@/domain/courier';
import type { Actor, AppContext } from '../context';
import { ApiError, badRequest, conflict, notConfigured, notFound } from '../http/errors';
import { newId } from '../lib/clock';
import { decrypt, encrypt } from '../lib/crypto';
import { isUsable } from '../providers/registry';
import { ProviderError, ProviderNotConfiguredError, type PayoutDestinationDetails, type VerificationStatus } from '../providers/types';
import { audit } from './audit';
import { notify } from './notifications';
import { residenceError } from '@/domain/residence';

export interface ProfileRow {
  user_id: string;
  full_name: string;
  phone: string | null;
  country_of_residence: string | null;
  state_of_residence: string | null;
  kyc_status: 'unverified' | 'pending' | 'verified' | 'needs_info' | 'rejected';
  kyc_level: 'none' | 'basic' | 'enhanced';
  created_at: number;
  updated_at: number;
}

export { US_STATES, US_STATES_50 } from '@/domain/usStates';

export function getProfile(ctx: AppContext, userId: string): ProfileRow {
  const p = ctx.db.get<ProfileRow>('SELECT * FROM customer_profiles WHERE user_id = ?', [userId]);
  if (!p) throw notFound('Profile not found.');
  return p;
}

export function profileView(ctx: AppContext, userId: string) {
  const u = ctx.db.get<{ id: string; email: string; role: string; totp_enabled: number; created_at: number }>(
    'SELECT id, email, role, totp_enabled, created_at FROM users WHERE id = ?',
    [userId],
  )!;
  const p = getProfile(ctx, userId);
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    createdAt: u.created_at,
    totpEnabled: u.totp_enabled === 1,
    fullName: p.full_name,
    phone: p.phone,
    countryOfResidence: p.country_of_residence,
    stateOfResidence: p.state_of_residence,
    verification: { status: p.kyc_status, level: p.kyc_level },
  };
}

export function updateProfile(
  ctx: AppContext,
  actor: Actor,
  userId: string,
  patch: { fullName?: string; phone?: string | null; countryOfResidence?: string | null; stateOfResidence?: string | null },
) {
  const p = getProfile(ctx, userId);
  // Primary market is the US: keep country as US when a state is set; do not require a country field.
  const state = patch.stateOfResidence === undefined ? p.state_of_residence : patch.stateOfResidence;
  const country =
    patch.countryOfResidence === undefined
      ? state
        ? 'US'
        : p.country_of_residence
      : patch.countryOfResidence;
  if (state) {
    const residence = residenceError(state);
    if (residence) throw badRequest(residence, { field: 'stateOfResidence' });
  }
  // A verified legal name can only change through re-verification.
  if (patch.fullName !== undefined && patch.fullName !== p.full_name && p.kyc_status === 'verified')
    throw conflict('Your name is verified. Contact support to change it.', 'name_locked');
  ctx.db.tx(() => {
    ctx.db.run(
      'UPDATE customer_profiles SET full_name = ?, phone = ?, country_of_residence = ?, state_of_residence = ?, updated_at = ? WHERE user_id = ?',
      [patch.fullName ?? p.full_name, patch.phone === undefined ? p.phone : patch.phone, country, state, ctx.clock.now(), userId],
    );
    audit(ctx, actor, { action: 'profile.updated', targetType: 'user', targetId: userId, data: { fields: Object.keys(patch) } });
  });
}

const KYC_FROM_PROVIDER: Record<VerificationStatus, ProfileRow['kyc_status']> = {
  pending: 'pending',
  approved: 'verified',
  needs_info: 'needs_info',
  rejected: 'rejected',
};

/** Applies a verification result, whether it came back synchronously or by webhook. */
export function applyVerificationResult(
  ctx: AppContext,
  providerRef: string,
  status: VerificationStatus,
  detail: string | null,
  actor: Actor,
) {
  const v = ctx.db.get<{ id: string; user_id: string; level: 'basic' | 'enhanced'; status: string }>(
    'SELECT * FROM identity_verifications WHERE provider_ref = ?',
    [providerRef],
  );
  if (!v) throw notFound('Unknown verification reference.');
  ctx.db.tx(() => {
    ctx.db.run('UPDATE identity_verifications SET status = ?, result_detail = ?, updated_at = ? WHERE id = ?', [
      status,
      detail,
      ctx.clock.now(),
      v.id,
    ]);
    ctx.db.run('UPDATE customer_profiles SET kyc_status = ?, kyc_level = ?, updated_at = ? WHERE user_id = ?', [
      KYC_FROM_PROVIDER[status],
      status === 'approved' ? v.level : 'none',
      ctx.clock.now(),
      v.user_id,
    ]);
    audit(ctx, actor, { action: 'kyc.result', targetType: 'user', targetId: v.user_id, data: { status, providerRef } });
    const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [v.user_id])!.email;
    notify(ctx, {
      userId: v.user_id,
      to: email,
      template: 'verification_updated',
      vars: { status: KYC_FROM_PROVIDER[status].replace('_', ' ') },
    });
  });
}

export async function startVerification(ctx: AppContext, actor: Actor, userId: string) {
  const p = getProfile(ctx, userId);
  if (p.kyc_status === 'verified') throw conflict('Your identity is already verified.');
  if (p.kyc_status === 'pending') throw conflict('Your verification is in progress.');
  const residence = residenceError(p.state_of_residence);
  if (residence) throw badRequest(`${residence} Add it on your account page first.`, { field: 'countryOfResidence' });
  if (!isUsable(ctx.providers.identity.info()) || !isUsable(ctx.providers.screening.info())) throw notConfigured('Identity verification');
  const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [userId])!.email;
  const id = newId('kyc');
  try {
    const screen = await ctx.providers.screening.screenCustomer({ fullName: p.full_name, email, stateOfResidence: p.state_of_residence });
    const result = await ctx.providers.identity.startVerification({
      userId,
      email,
      fullName: p.full_name,
      level: 'basic',
      idempotencyKey: id,
    });
    const finalStatus: VerificationStatus =
      screen.result === 'blocked' ? 'rejected' : screen.result === 'review' && result.status === 'approved' ? 'needs_info' : result.status;
    ctx.db.run(
      'INSERT INTO identity_verifications (id, user_id, provider, provider_ref, level, status, result_detail, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        userId,
        ctx.providers.identity.info().state === 'sandbox' ? 'sandbox' : 'identity',
        result.providerRef,
        'basic',
        'pending',
        null,
        ctx.clock.now(),
        ctx.clock.now(),
      ],
    );
    ctx.db.run("UPDATE customer_profiles SET kyc_status = 'pending', updated_at = ? WHERE user_id = ?", [ctx.clock.now(), userId]);
    audit(ctx, actor, { action: 'kyc.started', targetType: 'user', targetId: userId, data: { providerRef: result.providerRef } });
    if (finalStatus !== 'pending')
      applyVerificationResult(ctx, result.providerRef, finalStatus, screen.result !== 'clear' ? screen.note : null, {
        type: 'provider',
        id: 'identity',
        role: null,
        ip: null,
      });
    return { status: KYC_FROM_PROVIDER[finalStatus], hostedUrl: result.hostedUrl };
  } catch (e) {
    if (e instanceof ProviderNotConfiguredError) throw notConfigured('Identity verification');
    if (e instanceof ProviderError)
      throw new ApiError(503, 'provider_unavailable', 'Identity verification is temporarily unavailable. Try again later.');
    throw e;
  }
}

/* ---------- Payout destinations ---------- */

export interface DestinationRow {
  id: string;
  user_id: string;
  kind: 'bank' | 'card' | 'courier';
  label: string;
  last4: string;
  methods: string;
  details_enc: string;
  provider_token: string | null;
  status: 'active' | 'removed';
  created_at: number;
}

/** Stored (encrypted) for a courier destination. The recipient is always the verified account holder. */
interface CourierDetails {
  holderName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  window: CourierWindow;
  preferredDate: string | null;
  instructions: string;
}

const readCourier = (ctx: AppContext, d: DestinationRow) =>
  JSON.parse(decrypt(ctx.config.dataEncryptionKey, d.details_enc)) as CourierDetails;

/** The owner's view of a destination. Courier addresses are shown in full to their owner (they typed them). */
export function destinationView(ctx: AppContext, d: DestinationRow) {
  const base = {
    id: d.id,
    kind: d.kind,
    label: d.label,
    last4: d.last4,
    methods: JSON.parse(d.methods) as PayoutMethodId[],
    createdAt: d.created_at,
  };
  if (d.kind !== 'courier') return base;
  const c = readCourier(ctx, d);
  return {
    ...base,
    courier: {
      phone: c.phone,
      line1: c.line1,
      line2: c.line2,
      city: c.city,
      state: c.state,
      zip: c.zip,
      window: c.window,
      preferredDate: c.preferredDate,
      instructions: c.instructions,
    },
  };
}

export function listDestinations(ctx: AppContext, userId: string) {
  return ctx.db
    .all<DestinationRow>("SELECT * FROM payout_destinations WHERE user_id = ? AND status = 'active' ORDER BY created_at", [userId])
    .map((d) => destinationView(ctx, d));
}

/**
 * Saves a courier delivery address. The ZIP is checked with the carrier
 * first, so we never collect an address it cannot serve.
 */
export async function addCourierAddress(ctx: AppContext, actor: Actor, userId: string, raw: CourierDeliveryInput) {
  const input = normalizeCourierInput(raw);
  const errors = validateCourierDelivery(input, isoDay(ctx.clock.now()));
  const first = Object.entries(errors)[0];
  if (first) throw badRequest(first[1], { field: first[0] });
  const count = ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM payout_destinations WHERE user_id = ? AND status = 'active'", [
    userId,
  ])!.n;
  if (count >= 10) throw conflict('You can save up to 10 payout destinations. Remove one first.');
  // When a cash provider is configured, check coverage. Without one, the owner
  // handles collection manually — still allow saving the address.
  if (isUsable(ctx.providers.cash.info())) {
    let availability;
    try {
      availability = await ctx.providers.cash.checkAvailability(zip5(input.zip));
    } catch (e) {
      if (e instanceof ProviderNotConfiguredError) {
        /* fall through to manual path */
      } else {
        throw new ApiError(503, 'provider_unavailable', 'We couldn’t check courier availability. Try again shortly.');
      }
      availability = null;
    }
    if (availability && !availability.available)
      throw badRequest(`Cash delivery isn’t available in ${zip5(input.zip)}. ${availability.reason}`.trim(), { field: 'zip' });
  }

  const id = newId('dst');
  const details: CourierDetails = {
    holderName: getProfile(ctx, userId).full_name,
    phone: input.phone,
    line1: input.line1,
    line2: input.line2,
    city: input.city,
    state: input.state,
    zip: input.zip,
    window: input.window,
    preferredDate: input.preferredDate || null,
    instructions: input.instructions,
  };
  ctx.db.tx(() => {
    ctx.db.run(
      "INSERT INTO payout_destinations (id, user_id, kind, label, last4, methods, details_enc, created_at) VALUES (?, ?, 'courier', ?, '', ?, ?, ?)",
      [
        id,
        userId,
        courierLabel(input.city, input.state, input.zip),
        JSON.stringify(['courier_cash']),
        encrypt(ctx.config.dataEncryptionKey, JSON.stringify(details)),
        ctx.clock.now(),
      ],
    );
    audit(ctx, actor, {
      action: 'destination.added',
      targetType: 'destination',
      targetId: id,
      data: { kind: 'courier', state: input.state, zip: zip5(input.zip) },
    });
  });
  return destinationView(ctx, ctx.db.get<DestinationRow>('SELECT * FROM payout_destinations WHERE id = ?', [id])!);
}

export function addBankAccount(
  ctx: AppContext,
  actor: Actor,
  userId: string,
  input: { label: string; routingNumber: string; accountNumber: string; accountType: 'checking' | 'savings' },
) {
  // Bank destinations are used for ACH/wire payouts — including owner-managed
  // manual payouts when no bank payout provider is connected.
  const routing = input.routingNumber.replace(/\s/g, '');
  const account = input.accountNumber.replace(/\s/g, '');
  const err = validateRoutingNumber(routing) ?? validateAccountNumber(account);
  if (err) throw badRequest(err, { field: validateRoutingNumber(routing) ? 'routingNumber' : 'accountNumber' });
  const count = ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM payout_destinations WHERE user_id = ? AND status = 'active'", [
    userId,
  ])!.n;
  if (count >= 10) throw conflict('You can save up to 10 payout destinations. Remove one first.');
  const id = newId('dst');
  const holder = getProfile(ctx, userId).full_name;
  const details = encrypt(
    ctx.config.dataEncryptionKey,
    JSON.stringify({ routingNumber: routing, accountNumber: account, accountType: input.accountType, holderName: holder }),
  );
  ctx.db.tx(() => {
    ctx.db.run(
      "INSERT INTO payout_destinations (id, user_id, kind, label, last4, methods, details_enc, created_at) VALUES (?, ?, 'bank', ?, ?, ?, ?, ?)",
      [id, userId, input.label || 'Bank account', account.slice(-4), JSON.stringify(['ach', 'wire']), details, ctx.clock.now()],
    );
    audit(ctx, actor, {
      action: 'destination.added',
      targetType: 'destination',
      targetId: id,
      data: { kind: 'bank', last4: account.slice(-4) },
    });
  });
  return destinationView(ctx, ctx.db.get<DestinationRow>('SELECT * FROM payout_destinations WHERE id = ?', [id])!);
}

interface CardDetailsEnc {
  /** Full PAN when stored for manual CRM payouts. Absent for token-only sandbox cards. */
  pan?: string;
  holderName: string;
}

/**
 * Adds a debit-card payout destination for manual CRM payouts.
 * Accepts PAN + cardholder name; rejects CVV/CVC/PIN. Optionally uses a sandbox
 * tokenizer when no PAN is supplied in sandbox mode (legacy test path).
 */
export async function addCard(
  ctx: AppContext,
  actor: Actor,
  userId: string,
  input: { label?: string; cardNumber?: string; holderName?: string; cvv?: unknown; cvc?: unknown; pin?: unknown },
) {
  if (input.cvv !== undefined || input.cvc !== undefined || input.pin !== undefined)
    throw badRequest('Card security codes (CVV/CVC) and PINs are never collected or stored.', { field: 'cvv' });

  const count = ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM payout_destinations WHERE user_id = ? AND status = 'active'", [
    userId,
  ])!.n;
  if (count >= 10) throw conflict('You can save up to 10 payout destinations. Remove one first.');

  const profileHolder = getProfile(ctx, userId).full_name;
  const panRaw = input.cardNumber?.trim() ?? '';
  const id = newId('dst');

  // Manual path: encrypted PAN for owner-operated card payouts (production and sandbox).
  if (panRaw) {
    const panErr = validateCardNumber(panRaw);
    if (panErr) throw badRequest(panErr, { field: 'cardNumber' });
    const holder = (input.holderName ?? '').trim() || profileHolder;
    const holderErr = validateCardHolderName(holder);
    if (holderErr) throw badRequest(holderErr, { field: 'holderName' });
    const pan = normalizeCardNumber(panRaw);
    const last4 = pan.slice(-4);
    const details: CardDetailsEnc = { pan, holderName: holder };
    ctx.db.tx(() => {
      ctx.db.run(
        "INSERT INTO payout_destinations (id, user_id, kind, label, last4, methods, details_enc, provider_token, created_at) VALUES (?, ?, 'card', ?, ?, ?, ?, NULL, ?)",
        [
          id,
          userId,
          input.label?.trim() || `Card •••• ${last4}`,
          last4,
          JSON.stringify(['instant_debit']),
          encrypt(ctx.config.dataEncryptionKey, JSON.stringify(details)),
          ctx.clock.now(),
        ],
      );
      audit(ctx, actor, {
        action: 'destination.added',
        targetType: 'destination',
        targetId: id,
        data: { kind: 'card', last4, storage: 'encrypted_pan' },
      });
    });
    return destinationView(ctx, ctx.db.get<DestinationRow>('SELECT * FROM payout_destinations WHERE id = ?', [id])!);
  }

  // Legacy sandbox tokenizer when no PAN is provided.
  const tokenizer = ctx.providers.cardPayout.createSandboxToken;
  if (ctx.config.mode !== 'sandbox' || !tokenizer)
    throw badRequest('Enter the bank card number for a manual card payout destination.', { field: 'cardNumber' });
  const holder = (input.holderName ?? '').trim() || profileHolder;
  const { providerToken, last4 } = await tokenizer(holder);
  ctx.db.tx(() => {
    ctx.db.run(
      "INSERT INTO payout_destinations (id, user_id, kind, label, last4, methods, details_enc, provider_token, created_at) VALUES (?, ?, 'card', ?, ?, ?, ?, ?, ?)",
      [
        id,
        userId,
        input.label?.trim() || 'Test debit card',
        last4,
        JSON.stringify(['instant_debit']),
        encrypt(ctx.config.dataEncryptionKey, JSON.stringify({ holderName: holder } satisfies CardDetailsEnc)),
        providerToken,
        ctx.clock.now(),
      ],
    );
    audit(ctx, actor, {
      action: 'destination.added',
      targetType: 'destination',
      targetId: id,
      data: { kind: 'card', last4, storage: 'provider_token' },
    });
  });
  return destinationView(ctx, ctx.db.get<DestinationRow>('SELECT * FROM payout_destinations WHERE id = ?', [id])!);
}

/**
 * Reveals the full card number for an order's payout destination to authorized staff.
 * Audits the view without recording the PAN. Never returned on customer APIs.
 */
export function revealOrderCardDestination(ctx: AppContext, actor: Actor, orderId: string) {
  if (!actor.role || !['admin', 'owner'].includes(actor.role))
    throw new ApiError(403, 'forbidden', 'Only admins can view full card numbers.');
  const o = ctx.db.get<{ id: string; user_id: string; payout_method: string; payout_destination_id: string | null }>(
    'SELECT id, user_id, payout_method, payout_destination_id FROM orders WHERE id = ?',
    [orderId],
  );
  if (!o) throw notFound('Order not found.');
  if (o.payout_method !== 'instant_debit' || !o.payout_destination_id)
    throw conflict('This order has no card payout destination.', 'not_card_payout');
  const d = ctx.db.get<DestinationRow>('SELECT * FROM payout_destinations WHERE id = ?', [o.payout_destination_id]);
  if (!d || d.kind !== 'card') throw notFound('Card destination not found.');
  const plain = JSON.parse(decrypt(ctx.config.dataEncryptionKey, d.details_enc)) as CardDetailsEnc;
  if (!plain.pan)
    throw conflict(
      'This card was saved as a provider token only. Full card numbers are available for destinations saved with a card number.',
      'token_only',
    );
  audit(ctx, actor, {
    action: 'destination.card_viewed',
    targetType: 'order',
    targetId: orderId,
    data: { destinationId: d.id, last4: d.last4 },
  });
  return {
    destinationId: d.id,
    last4: d.last4,
    cardNumber: plain.pan,
    holderName: plain.holderName,
    currency: 'USD',
  };
}

/**
 * Reveals full bank account details for an order's ACH/wire payout destination.
 * Audits the view without recording the account number. Never returned on customer APIs.
 */
export function revealOrderBankDestination(ctx: AppContext, actor: Actor, orderId: string) {
  if (!actor.role || !['support', 'reviewer', 'admin', 'owner'].includes(actor.role))
    throw new ApiError(403, 'forbidden', 'Only staff can view full bank account details.');
  const o = ctx.db.get<{ id: string; direction: string; payout_method: string; payout_destination_id: string | null }>(
    'SELECT id, direction, payout_method, payout_destination_id FROM orders WHERE id = ?',
    [orderId],
  );
  if (!o) throw notFound('Order not found.');
  if (o.direction !== 'sell' || (o.payout_method !== 'ach' && o.payout_method !== 'wire') || !o.payout_destination_id)
    throw conflict('This order has no bank payout destination.', 'not_bank_payout');
  const d = ctx.db.get<DestinationRow>('SELECT * FROM payout_destinations WHERE id = ?', [o.payout_destination_id]);
  if (!d || d.kind !== 'bank') throw notFound('Bank destination not found.');
  const plain = JSON.parse(decrypt(ctx.config.dataEncryptionKey, d.details_enc)) as {
    routingNumber?: string;
    accountNumber?: string;
    accountType?: string;
    holderName?: string;
  };
  if (!plain.routingNumber || !plain.accountNumber)
    throw conflict('This bank destination has incomplete account details.', 'incomplete_bank');
  audit(ctx, actor, {
    action: 'destination.bank_viewed',
    targetType: 'order',
    targetId: orderId,
    data: { destinationId: d.id, last4: d.last4 },
  });
  return {
    destinationId: d.id,
    last4: d.last4,
    label: d.label,
    routingNumber: plain.routingNumber,
    accountNumber: plain.accountNumber,
    accountType: plain.accountType === 'savings' ? 'savings' : 'checking',
    holderName: plain.holderName ?? '',
  };
}

export function removeDestination(ctx: AppContext, actor: Actor, userId: string, id: string) {
  const d = ctx.db.get<DestinationRow>("SELECT * FROM payout_destinations WHERE id = ? AND user_id = ? AND status = 'active'", [
    id,
    userId,
  ]);
  if (!d) throw notFound('Payout destination not found.');
  const inUse = ctx.db.get(
    "SELECT 1 FROM orders WHERE payout_destination_id = ? AND status NOT IN ('completed','rejected','cancelled','expired','refunded','failed')",
    [id],
  );
  if (inUse) throw conflict('This destination is used by an open order. Remove it once the order is finished.');
  ctx.db.tx(() => {
    ctx.db.run("UPDATE payout_destinations SET status = 'removed', removed_at = ? WHERE id = ?", [ctx.clock.now(), id]);
    audit(ctx, actor, { action: 'destination.removed', targetType: 'destination', targetId: id });
  });
}

/**
 * Courier delivery details of an order's destination, or null for other kinds.
 * `masked` (support staff) keeps only the area, window and the phone's last
 * four digits; the owner and reviewers and above see the full address.
 */
export function courierDelivery(ctx: AppContext, destinationId: string, { masked = false }: { masked?: boolean } = {}) {
  const d = ctx.db.get<DestinationRow>('SELECT * FROM payout_destinations WHERE id = ?', [destinationId]);
  if (!d || d.kind !== 'courier') return null;
  const c = readCourier(ctx, d);
  const phoneDigits = c.phone.replace(/\D/g, '');
  return {
    recipient: c.holderName,
    phone: masked ? `••• ••• ${phoneDigits.slice(-4)}` : c.phone,
    line1: masked ? '•••' : c.line1,
    line2: masked ? '' : c.line2,
    city: c.city,
    state: c.state,
    zip: masked ? zip5(c.zip) : c.zip,
    window: c.window,
    preferredDate: c.preferredDate,
    instructions: masked ? '' : c.instructions,
    masked,
  };
}

/** Decrypts destination details for a payout submission. Never returned to any client. */
export function payoutDetails(ctx: AppContext, destinationId: string): PayoutDestinationDetails {
  const d = ctx.db.get<DestinationRow>('SELECT * FROM payout_destinations WHERE id = ?', [destinationId]);
  if (!d) throw notFound('Payout destination not found.');
  if (d.kind === 'courier') {
    const c = readCourier(ctx, d);
    return {
      kind: 'courier',
      holderName: c.holderName,
      phone: c.phone,
      address: { line1: c.line1, line2: c.line2, city: c.city, state: c.state, zip: c.zip },
      window: c.window,
      preferredDate: c.preferredDate,
      instructions: c.instructions,
    };
  }
  const plain = JSON.parse(decrypt(ctx.config.dataEncryptionKey, d.details_enc)) as CardDetailsEnc & Record<string, string>;
  if (d.kind === 'card') {
    if (d.provider_token) return { kind: 'card', providerToken: d.provider_token, holderName: plain.holderName ?? '' };
    if (plain.pan) return { kind: 'card', pan: plain.pan, holderName: plain.holderName ?? '' };
    throw new ApiError(409, 'destination_invalid', 'This card has no payout details.');
  }
  return {
    kind: 'bank',
    routingNumber: plain.routingNumber!,
    accountNumber: plain.accountNumber!,
    accountType: plain.accountType === 'savings' ? 'savings' : 'checking',
    holderName: plain.holderName ?? '',
  };
}
