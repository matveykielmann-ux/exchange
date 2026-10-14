/**
 * HTTP API tests against a real listening server (sandbox mode, in-memory
 * database, fixed clock). Covers authentication, CSRF, RBAC, idempotency,
 * webhook signatures and duplicates, the sandbox lifecycle through the API,
 * support chat, and validation.
 */
import type { AddressInfo } from 'node:net';
import { LEGAL_DOCUMENTS } from '@/content/legal';
import type { App } from '../app';
import { totpCode } from '../lib/crypto';
import { signWebhook } from '../providers/signature';
import { createAccount } from '../services/auth';
import { SANDBOX_PASSWORD, TEST_ETH_ADDRESS } from '../scenarios';
import { deliver, sandboxAutopilotTick } from '../services/sandbox';
import { testApp, type Json } from './helpers';

const docs = (kind: 'signup' | 'order') =>
  LEGAL_DOCUMENTS.filter((d) => d.acceptance === kind).map((d) => ({ slug: d.slug, version: d.version }));

type Res = { status: number; body: Json; headers: Headers };

class Client {
  cookies = new Map<string, string>();
  csrf: string | null = null;
  constructor(
    private base: string,
    private origin = 'http://localhost:5173',
  ) {}
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
    const h: Record<string, string> = { ...headers };
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (method !== 'GET') {
      if (!('origin' in h)) h.origin = this.origin;
      if (this.csrf && !('x-csrf-token' in h)) h['x-csrf-token'] = this.csrf;
      if (body !== undefined) h['content-type'] ??= 'application/json';
    }
    const res = await fetch(this.base + path, {
      method,
      headers: h,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair!.indexOf('=');
      const k = pair!.slice(0, i);
      const v = pair!.slice(i + 1);
      if (/Max-Age=0/.test(c) || v === '') this.cookies.delete(k);
      else this.cookies.set(k, v);
    }
    const text = await res.text();
    const parsed = text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
    if (parsed && typeof parsed === 'object' && 'csrfToken' in parsed && parsed.csrfToken) this.csrf = parsed.csrfToken;
    return { status: res.status, body: parsed, headers: res.headers };
  }
  get = (p: string) => this.req('GET', p);
  post = (p: string, b: unknown = {}, h?: Record<string, string>) => this.req('POST', p, b, h);
  put = (p: string, b: unknown = {}) => this.req('PUT', p, b);
}

async function boot(overrides = {}) {
  const t = testApp({ port: 0, host: '127.0.0.1', ...overrides });
  const server = await t.app.listen();
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { ...t, base, client: () => new Client(base) };
}

async function customer(c: Client, email: string, fullName = 'Alex Morgan') {
  const r = await c.post('/api/auth/signup', {
    email,
    password: SANDBOX_PASSWORD,
    fullName,
    countryOfResidence: 'US',
    stateOfResidence: 'NY',
    notInRestrictedTerritory: true,
    accepted: docs('signup'),
  });
  expect(r.status).toBe(201);
  expect((await c.post('/api/me/verification')).body.status).toBe('verified');
  const bank = await c.post('/api/me/destinations/bank', {
    routingNumber: '021000021',
    accountNumber: '000123456789',
    accountType: 'checking',
  });
  expect(bank.status).toBe(201);
  return { bankId: bank.body.id as string };
}

async function order(c: Client, bankId: string, amountAtomic = '2500000000', key = `key-${Math.random().toString(36).slice(2)}`) {
  const q = await c.post('/api/quotes', { asset: 'USDC', network: 'ethereum', amountAtomic, payoutMethod: 'ach' });
  expect(q.status).toBe(201);
  const body = { quoteId: q.body.quote.id, destinationId: bankId, refundAddress: TEST_ETH_ADDRESS, accepted: docs('order') };
  const o = await c.post('/api/orders', body, { 'idempotency-key': key });
  return { q, o, body, key };
}

async function staff(app: App, base: string, role: 'support' | 'reviewer' | 'admin' | 'owner', email = `${role}@arcvale.test`) {
  await createAccount(app.ctx, { email, password: SANDBOX_PASSWORD, role, fullName: `Test ${role}` });
  const c = new Client(base);
  const r = await c.post('/api/auth/signin', { email, password: SANDBOX_PASSWORD });
  expect(r.status).toBe(200);
  return c;
}

describe('API', () => {
  let env: Awaited<ReturnType<typeof boot>>;
  beforeEach(async () => {
    env = await boot();
  });
  afterEach(async () => {
    await env.app.close();
  });

  it('reports health, readiness and sandbox configuration', async () => {
    const c = env.client();
    expect((await c.get('/api/health')).body).toEqual({ status: 'ok', mode: 'sandbox' });
    const ready = await c.get('/api/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.ready).toBe(true);
    const cfg = await c.get('/api/config');
    expect(cfg.body.mode).toBe('sandbox');
    expect(cfg.body.realMoneyEnabled).toBe(false);
    expect(cfg.headers.get('cache-control')).toBe('no-store');
    expect(cfg.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('requires legal acceptance at sign-up and sets a hardened session cookie', async () => {
    const c = env.client();
    const missing = await c.post('/api/auth/signup', {
      email: 'a@example.test',
      password: SANDBOX_PASSWORD,
      fullName: 'A B',
      countryOfResidence: 'US',
      stateOfResidence: 'NY',
      notInRestrictedTerritory: true,
      accepted: [],
    });
    expect(missing.status).toBe(422);
    expect(missing.body.error.code).toBe('acceptance_required');
    const res = await fetch(env.base + '/api/auth/signup', {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'a@example.test',
        password: SANDBOX_PASSWORD,
        fullName: 'A B',
        countryOfResidence: 'US',
        stateOfResidence: 'NY',
        notInRestrictedTerritory: true,
        accepted: docs('signup'),
      }),
    });
    expect(res.status).toBe(201);
    const session = res.headers.getSetCookie().find((x) => x.startsWith('arcvale_session='))!;
    expect(session).toMatch(/HttpOnly/);
    expect(session).toMatch(/SameSite=Lax/);
    const stored = env.ctx.db.get<{ n: number }>('SELECT count(*) AS n FROM legal_acceptances WHERE context = ?', ['signup'])!.n;
    expect(stored).toBe(docs('signup').length);
  });

  it('rejects state-changing requests without a matching Origin or CSRF token', async () => {
    const c = env.client();
    await customer(c, 'csrf@example.test');
    expect((await c.post('/api/me/destinations/card', {}, { origin: 'https://evil.example' })).status).toBe(403);
    const noToken = await c.post('/api/me/destinations/card', {}, { 'x-csrf-token': '' });
    expect(noToken.status).toBe(403);
    expect(noToken.body.error.code).toBe('csrf_failed');
    expect((await c.post('/api/me/destinations/card', {})).status).toBe(201);
  });

  it('denies customers and anonymous callers on admin APIs', async () => {
    const anon = env.client();
    expect((await anon.get('/api/admin/overview')).status).toBe(401);
    const c = env.client();
    await customer(c, 'nosy@example.test');
    for (const p of ['/api/admin/overview', '/api/admin/orders', '/api/admin/users', '/api/admin/audit', '/api/admin/conversations'])
      expect((await c.get(p)).status, p).toBe(403);
    expect((await c.post('/api/admin/sandbox/orders/ord_x/deposit', { scenario: 'exact' })).status).toBe(403);
  });

  it('enforces role permissions between staff roles', async () => {
    const support = await staff(env.app, env.base, 'support');
    expect((await support.get('/api/admin/orders')).status).toBe(200);
    expect((await support.get('/api/admin/users')).status).toBe(403);
    expect((await support.get('/api/admin/audit')).status).toBe(403);
    const admin = await staff(env.app, env.base, 'admin');
    const users = await admin.get('/api/admin/users');
    expect(users.status).toBe(200);
    // Only an owner may grant admin.
    const supportId = users.body.items.find((u: { email: string }) => u.email.startsWith('s'))?.id;
    const grant = await admin.post(`/api/admin/users/${supportId}/role`, { role: 'admin', reason: 'Promotion test' });
    expect(grant.status).toBe(403);
  });

  it('runs the full sandbox lifecycle through the API with persisted, event-built timelines', async () => {
    const c = env.client();
    const { bankId } = await customer(c, 'flow@example.test');
    const { o, body, key } = await order(c, bankId);
    expect(o.status).toBe(201);
    expect(o.body.status).toBe('awaiting_deposit');
    expect(o.body.deposit.address).toMatch(/^MOCK-USDC-ETHEREUM-[0-9A-F]+-DO-NOT-SEND$/);
    const id = o.body.id as string;

    // Idempotency: same key and body replays; same key with a different body is refused.
    const again = await c.post('/api/orders', body, { 'idempotency-key': key });
    expect(again.status).toBe(201);
    expect(again.body.id).toBe(id);
    expect((await c.post('/api/orders', { ...body, refundAddress: '0x' + '1'.repeat(40) }, { 'idempotency-key': key })).status).toBe(422);
    expect(env.ctx.db.get<{ n: number }>('SELECT count(*) AS n FROM orders')!.n).toBe(1);

    // A submitted tx hash is recorded for review but proves nothing. It must be shaped like a hash for the network.
    expect((await c.post(`/api/orders/${id}/report-sent`, { txHash: null })).status).toBe(400);
    expect((await c.post(`/api/orders/${id}/report-sent`, { txHash: 'abc123' })).body.error.details.field).toBe('txHash');
    const sent = await c.post(`/api/orders/${id}/report-sent`, { txHash: '0x' + 'ab'.repeat(32) });
    expect(sent.body.status).toBe('awaiting_deposit');
    expect(sent.body.deposit.customerReportedSentAt).toBeTypeOf('number');

    // The browser cannot confirm a deposit: no such customer route exists beyond the sandbox simulator.
    expect((await c.post(`/api/orders/${id}/confirm`, {})).status).toBe(404);

    expect((await c.post(`/api/sandbox/orders/${id}/deposit`, { scenario: 'exact' })).body.order.status).toBe('deposit_observed');
    expect((await c.post(`/api/sandbox/orders/${id}/confirmations`, { toFinal: true })).body.order.status).toBe('ready_for_payout');

    const admin = await staff(env.app, env.base, 'admin');
    const queue = await admin.get('/api/admin/orders?status=ready_for_payout');
    expect(queue.body.items.map((x: { id: string }) => x.id)).toContain(id);
    const detail = await admin.get(`/api/admin/orders/${id}`);
    expect(detail.body.customer.email).toBe('fl••@example.test');
    expect(JSON.stringify(detail.body)).not.toContain('000123456789');

    expect((await admin.post(`/api/admin/orders/${id}/authorize-payout`, { reason: '' })).status).toBe(400);
    const auth = await admin.post(`/api/admin/orders/${id}/authorize-payout`, { reason: 'All checks passed.' });
    expect(auth.status).toBe(200);
    expect(auth.body.status).toBe('payout_submitted');
    // An operator click cannot complete a payout: only the provider event can.
    expect((await c.get(`/api/orders/${id}`)).body.status).toBe('payout_submitted');
    expect((await admin.post(`/api/admin/sandbox/orders/${id}/payout`, { outcome: 'completed' })).body.order.status).toBe('completed');

    const done = await c.get(`/api/orders/${id}`);
    expect(done.body.status).toBe('completed');
    const types = done.body.events.map((e: { type: string }) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(['ORDER_CREATED', 'DEPOSIT_OBSERVED', 'DEPOSIT_CONFIRMED', 'PAYOUT_SUBMITTED', 'PAYOUT_COMPLETED']),
    );
    expect(types).not.toContain('PAYOUT_AUTHORIZED'); // internal event
    const persisted = env.ctx.db.get<{ n: number }>('SELECT count(*) AS n FROM order_events WHERE order_id = ?', [id])!.n;
    expect(persisted).toBeGreaterThanOrEqual(types.length);

    // Audit trail records the operator's authorization with its reason.
    const audit = await admin.get(`/api/admin/audit?targetId=${id}`);
    expect(
      audit.body.items.some(
        (a: { action: string; reason: string | null }) => a.action === 'order.payout_authorized' && a.reason === 'All checks passed.',
      ),
    ).toBe(true);
  });

  it('runs the master CRM: staff-only sign-in, stages, hold, messages and customer notifications', async () => {
    const c = env.client();
    const { bankId } = await customer(c, 'crm@example.test');
    const { o } = await order(c, bankId);
    const id = o.body.id as string;
    expect(o.body.stage).toBe('awaiting_payment');

    // The staff entrance refuses customer accounts with the same answer as a wrong password.
    const asStaff = await env.client().post('/api/auth/signin', { email: 'crm@example.test', password: SANDBOX_PASSWORD, staffOnly: true });
    expect(asStaff.status).toBe(401);
    expect(asStaff.body.error.code).toBe('invalid_credentials');
    await createAccount(env.app.ctx, { email: 'master@arcvale.test', password: SANDBOX_PASSWORD, role: 'owner', fullName: 'Master' });
    const master = env.client();
    expect(
      (await master.post('/api/auth/signin', { email: 'master@arcvale.test', password: SANDBOX_PASSWORD, staffOnly: true })).status,
    ).toBe(200);

    const byStage = await master.get('/api/admin/orders?stage=awaiting_payment');
    expect(byStage.body.items.map((x: { id: string }) => x.id)).toContain(id);
    expect((await master.get('/api/admin/orders?stage=bogus')).status).toBe(400);

    // Hold: recorded as an event, shown as a stage, and it blocks payout progress until released.
    expect((await master.post(`/api/admin/orders/${id}/hold`, { reason: 'Checking the customer' })).body.onHold).toBe(true);
    expect((await master.get('/api/admin/orders?stage=on_hold')).body.items[0].id).toBe(id);
    expect((await c.post(`/api/sandbox/orders/${id}/deposit`, { scenario: 'exact' })).body.order.status).toBe('deposit_observed');
    const confirmed = await c.post(`/api/sandbox/orders/${id}/confirmations`, { toFinal: true });
    // The deposit is a provider fact and is recorded; clearing it for payout waits for the hold to be released.
    expect(confirmed.body.order.status).toBe('deposit_confirmed');
    expect((await c.get(`/api/orders/${id}`)).body.stage).toBe('on_hold');
    expect((await master.post(`/api/admin/orders/${id}/hold`, { reason: 'Again' })).status).toBe(409);
    expect((await master.post(`/api/admin/orders/${id}/authorize-payout`, { reason: 'Too early' })).status).toBe(409);
    const released = await master.post(`/api/admin/orders/${id}/release-hold`, { reason: 'Checks done' });
    expect(released.body.onHold).toBe(false);
    expect(released.body.status).toBe('ready_for_payout');

    // Messages go to the order's conversation, and the customer is notified in their account.
    expect((await master.post(`/api/admin/orders/${id}/message`, { message: 'Hello from the team' })).status).toBe(200);
    expect((await master.post(`/api/admin/orders/${id}/request-info`, { message: 'Please confirm the source of funds.' })).status).toBe(
      200,
    );
    const convs = await c.get('/api/support/conversations');
    expect(convs.body.conversations.some((x: { order: { id: string } | null }) => x.order?.id === id)).toBe(true);

    const n = await c.get('/api/me/notifications');
    const templates = n.body.notifications.map((x: { template: string }) => x.template);
    expect(templates).toEqual(expect.arrayContaining(['status_changed', 'staff_message', 'info_requested']));
    expect(n.body.unread).toBeGreaterThan(0);
    expect(n.body.notifications.find((x: { template: string }) => x.template === 'status_changed').orderId).toBe(id);
    expect((await c.post('/api/me/notifications/read', {})).body.unread).toBe(0);

    // A second operator acting on a stale screen is refused instead of acting on the new status.
    const stale = await master.post(`/api/admin/orders/${id}/reject`, { reason: 'Looks wrong', expectedStatus: 'compliance_review' });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('stale_status');
    expect((await c.get(`/api/orders/${id}`)).body.status).toBe('ready_for_payout');

    // Orders waiting on a person come first and can be filtered on their own.
    const attention = await master.get('/api/admin/orders?attention=true&sort=attention');
    expect(attention.body.items.map((x: { id: string }) => x.id)).toEqual([id]);
    expect(Number(attention.body.items[0].grossCents)).toBeGreaterThan(240_000);
    expect((await master.get('/api/admin/overview')).body.totals.needsAction).toBe(1);

    const detail = await master.get(`/api/admin/orders/${id}`);
    expect(detail.body.order.stage).toBe('processing');
    expect(detail.body.notifications.length).toBeGreaterThan(2);
    const events = detail.body.order.events.map((e: { type: string }) => e.type);
    expect(events).toEqual(expect.arrayContaining(['HOLD_PLACED', 'HOLD_RELEASED']));
  });

  it('delivers cash by courier: validated address, carrier area check, masked staff view, signed courier webhooks', async () => {
    const c = env.client();
    await customer(c, 'courier@example.test');
    const tomorrow = new Date(env.ctx.clock.now() + 86_400_000).toISOString().slice(0, 10);
    const address = {
      phone: '(212) 555-0142',
      line1: '200 Example Street',
      line2: 'Apt 4B',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      window: 'afternoon',
      preferredDate: tomorrow,
      instructions: 'Ring the buzzer for 4B.',
    };
    // Validation: PO boxes, past dates and areas the courier does not serve are refused.
    expect((await c.post('/api/me/destinations/courier', { ...address, line1: 'PO Box 12' })).status).toBe(400);
    expect((await c.post('/api/me/destinations/courier', { ...address, preferredDate: '2020-01-01' })).status).toBe(400);
    const outside = await c.post('/api/me/destinations/courier', { ...address, zip: '99950' });
    expect(outside.status).toBe(400);
    expect(outside.body.error.details.field).toBe('zip');

    const saved = await c.post('/api/me/destinations/courier', address);
    expect(saved.status).toBe(201);
    expect(saved.body).toMatchObject({ kind: 'courier', last4: '', methods: ['courier_cash'], label: 'Courier to New York, NY 10001' });
    expect(saved.body.courier.line1).toBe('200 Example Street');
    // Encrypted at rest.
    const row = env.ctx.db.get<{ details_enc: string }>('SELECT details_enc FROM payout_destinations WHERE id = ?', [saved.body.id]);
    expect(row!.details_enc).not.toContain('Example Street');

    const q = await c.post('/api/quotes', { asset: 'USDC', network: 'ethereum', amountAtomic: '2500000000', payoutMethod: 'courier_cash' });
    expect(q.status).toBe(201);
    expect(q.body.issues).toEqual([]);
    const o = await c.post(
      '/api/orders',
      { quoteId: q.body.quote.id, destinationId: saved.body.id, refundAddress: TEST_ETH_ADDRESS, accepted: docs('order') },
      { 'idempotency-key': 'courier-1' },
    );
    expect(o.status).toBe(201);
    const id = o.body.id as string;
    expect(o.body.payout.delivery).toMatchObject({ recipient: 'Alex Morgan', line1: '200 Example Street', window: 'afternoon' });

    await c.post(`/api/sandbox/orders/${id}/deposit`, { scenario: 'exact' });
    expect((await c.post(`/api/sandbox/orders/${id}/confirmations`, { toFinal: true })).body.order.status).toBe('ready_for_payout');

    const support = await staff(env.app, env.base, 'support');
    const masked = (await support.get(`/api/admin/orders/${id}`)).body.courierDelivery;
    expect(masked).toMatchObject({ masked: true, line1: '•••', city: 'New York', zip: '10001', phone: '••• ••• 0142' });
    expect(JSON.stringify(masked)).not.toContain('Example Street');

    const admin = await staff(env.app, env.base, 'admin');
    expect((await admin.get(`/api/admin/orders/${id}`)).body.courierDelivery).toMatchObject({ masked: false, line1: '200 Example Street' });
    const auth = await admin.post(`/api/admin/orders/${id}/authorize-payout`, { reason: 'Courier delivery approved.' });
    expect(auth.body.status).toBe('payout_submitted');
    const pi = env.ctx.db.get<{ provider: string; provider_ref: string }>(
      'SELECT provider, provider_ref FROM payout_instructions WHERE order_id = ?',
      [id],
    );
    expect(pi).toMatchObject({ provider: 'cash' });
    expect(pi!.provider_ref).toMatch(/^sbx_cash_/);
    expect((await admin.post(`/api/admin/sandbox/orders/${id}/payout`, { outcome: 'completed' })).body.order.status).toBe('completed');

    // Once the order is finished the address can be removed.
    expect((await c.req('DELETE', `/api/me/destinations/${saved.body.id}`)).status).toBe(204);
  });

  it('buys crypto with cash: buy quote, courier collection, ID upload, autopilot via signed cash and custody webhooks', async () => {
    const c = env.client();
    await customer(c, 'buyer@example.test');
    const tomorrow = new Date(env.ctx.clock.now() + 86_400_000).toISOString().slice(0, 10);
    const dest = await c.post('/api/me/destinations/courier', {
      phone: '(212) 555-0142',
      line1: '200 Example Street',
      line2: '',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      window: 'any',
      preferredDate: tomorrow,
      instructions: '',
    });
    expect(dest.status).toBe(201);

    const indicative = await c.get('/api/quotes/indicative?direction=buy&asset=USDT&network=tron&cashCents=100000');
    expect(indicative.status).toBe(200);
    expect(indicative.body.quote).toMatchObject({ direction: 'buy', grossCents: '100000', payoutMethod: 'courier_cash' });
    expect(BigInt(indicative.body.quote.amountAtomic)).toBeGreaterThan(0n);
    expect(indicative.body.issues).toEqual([]);

    const q = await c.post('/api/quotes', { direction: 'buy', asset: 'USDT', network: 'tron', cashCents: '100000' });
    expect(q.status).toBe(201);
    const wallet = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE';
    const body = { quoteId: q.body.quote.id, destinationId: dest.body.id, receiveAddress: wallet, accepted: docs('order') };
    // The receiving wallet must be valid for the network.
    const badWallet = await c.post('/api/orders', { ...body, receiveAddress: TEST_ETH_ADDRESS }, { 'idempotency-key': 'buy-order-bad' });
    expect(badWallet.status).toBe(400);
    expect(badWallet.body.error.details.field).toBe('receiveAddress');
    const o = await c.post('/api/orders', body, { 'idempotency-key': 'buy-order-1' });
    expect(o.status).toBe(201);
    expect(o.body).toMatchObject({ direction: 'buy', status: 'awaiting_deposit', refundAddress: null, receiveAddress: wallet });
    expect(o.body.reference).toMatch(/^CBX-/);
    expect(o.body.deposit.address).toBeNull();
    const id = o.body.id as string;
    // A retried confirm returns the same order.
    expect((await c.post('/api/orders', body, { 'idempotency-key': 'buy-order-1' })).body.id).toBe(id);
    expect(env.ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM orders WHERE direction = 'buy'")!.n).toBe(1);

    // A buy has no transaction hash to submit.
    expect((await c.post(`/api/orders/${id}/report-sent`, { txHash: 'ab'.repeat(32) })).status).toBe(409);

    // ID upload: the declared type must match the bytes; the file is checked, fingerprinted and discarded.
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]).toString('base64');
    const upload = (contentType: string, dataBase64: string) =>
      c.post(`/api/orders/${id}/documents`, { kind: 'id_document', fileName: '../id photo.png', contentType, dataBase64 });
    expect((await upload('application/pdf', png)).status).toBe(415);
    expect((await upload('image/png', 'not base64!')).status).toBe(400);
    expect((await upload('image/gif', png)).status).toBe(400);
    const up = await upload('image/png', png);
    expect(up.status).toBe(201);
    expect(up.body.documents).toHaveLength(1);
    expect(up.body.documents[0]).toMatchObject({ fileName: 'id photo.png', contentType: 'image/png', stored: false, sizeBytes: 72 });

    // Deposit events for a buy must come from the cash provider, not custody.
    const wrong = deliver(env.ctx, 'custody', {
      id: 'sbx_wrong_1',
      type: 'deposit.observed',
      data: { orderId: id, txHash: 'x', amountAtomic: '100000', confirmations: 0 },
    });
    expect(wrong.status).toBe('rejected');

    // The demo autopilot moves the order one signed event at a time once the ID is uploaded; operators still decide.
    (env.ctx.config.sandbox as { autopilotStepMs: number }).autopilotStepMs = 3000;
    const tick = () => {
      env.clock.advance(3001);
      return sandboxAutopilotTick(env.ctx);
    };
    const status = async () => (await c.get(`/api/orders/${id}`)).body.status;
    expect(sandboxAutopilotTick(env.ctx)).toBe(0); // not due yet
    expect(tick()).toBe(1);
    expect(await status()).toBe('deposit_observed');
    tick();
    expect(await status()).toBe('ready_for_payout');
    expect(tick()).toBe(0); // waits for an operator

    const admin = await staff(env.app, env.base, 'admin');
    const detail = (await admin.get(`/api/admin/orders/${id}`)).body.order;
    expect(detail).toMatchObject({ direction: 'buy', receiveAddress: wallet });
    expect(detail.documents).toHaveLength(1);
    expect((await admin.post(`/api/admin/orders/${id}/authorize-payout`, { reason: 'Cash verified; sending crypto.' })).body.status).toBe(
      'payout_submitted',
    );
    expect(
      env.ctx.db.get<{ provider: string; method: string }>('SELECT provider, method FROM payout_instructions WHERE order_id = ?', [id]),
    ).toMatchObject({ provider: 'custody', method: 'crypto_transfer' });
    tick();
    expect(await status()).toBe('payout_processing');
    tick();
    const done = (await c.get(`/api/orders/${id}`)).body;
    expect(done.status).toBe('completed');
    expect(done.steps.every((s: { state: string }) => s.state === 'done')).toBe(true);
    const sources = env.ctx.db
      .all<{ provider: string; event_type: string }>("SELECT provider, event_type FROM provider_webhook_events WHERE status = 'processed'")
      .map((r) => `${r.provider}:${r.event_type}`);
    expect(sources).toEqual(
      expect.arrayContaining(['cash:deposit.observed', 'cash:deposit.confirmed', 'custody:payout.processing', 'custody:payout.completed']),
    );
    const audit = await admin.get(`/api/admin/audit?targetId=${id}`);
    expect(audit.body.items.map((a: { action: string }) => a.action)).toEqual(
      expect.arrayContaining(['order.document_uploaded', 'order.payout_authorized']),
    );
  });

  it('asks for the country of residence and the clause 8.5 confirmation at sign-up', async () => {
    const c = env.client();
    const base = { password: SANDBOX_PASSWORD, fullName: 'Kim Lee', accepted: docs('signup') };
    const r1 = await c.post('/api/auth/signup', {
      ...base,
      email: 'r1@example.test',
      countryOfResidence: 'DE',
      notInRestrictedTerritory: false,
    });
    expect(r1.status).toBe(400);
    const r2 = await c.post('/api/auth/signup', {
      ...base,
      email: 'r2@example.test',
      countryOfResidence: 'US',
      notInRestrictedTerritory: true,
    });
    expect(r2.status).toBe(400); // a US resident also gives a state
    const ok = await c.post('/api/auth/signup', {
      ...base,
      email: 'r3@example.test',
      countryOfResidence: 'DE',
      notInRestrictedTerritory: true,
    });
    expect(ok.status).toBe(201);
    expect((await c.get('/api/me')).body).toMatchObject({ countryOfResidence: 'DE', stateOfResidence: null });
  });

  it('isolates customers from each other', async () => {
    const a = env.client();
    const { bankId } = await customer(a, 'a1@example.test');
    const { o } = await order(a, bankId);
    const b = env.client();
    await customer(b, 'b1@example.test');
    expect((await b.get(`/api/orders/${o.body.id}`)).status).toBe(404);
    expect((await b.post(`/api/sandbox/orders/${o.body.id}/deposit`, { scenario: 'exact' })).status).toBe(404);
    expect((await b.post(`/api/orders/${o.body.id}/cancel`)).status).toBe(404);
  });

  it('authenticates webhooks and ignores duplicate deliveries', async () => {
    const c = env.client();
    const { bankId } = await customer(c, 'hook@example.test');
    const { o } = await order(c, bankId);
    const payload = JSON.stringify({
      id: 'evt_test_deposit_1',
      type: 'deposit.observed',
      created: Math.floor(env.clock.now() / 1000),
      data: { orderId: o.body.id, txHash: '0xabc', amountAtomic: '2500000000', confirmations: 0 },
    });
    const post = (sig: string | undefined) =>
      fetch(env.base + '/api/webhooks/custody', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(sig ? { 'x-arcvale-signature': sig } : {}) },
        body: payload,
      });
    expect((await post(undefined)).status).toBe(401);
    expect((await post(signWebhook('wrong-secret-wrong-secret-wrong-secret', payload, env.clock.now()))).status).toBe(401);
    expect((await post(signWebhook(env.ctx.config.sandbox.webhookSecret, payload, env.clock.now() - 10 * 60_000))).status).toBe(401);
    const good = signWebhook(env.ctx.config.sandbox.webhookSecret, payload, env.clock.now());
    expect(await (await post(good)).json()).toMatchObject({ status: 'processed' });
    expect(await (await post(good)).json()).toMatchObject({ status: 'duplicate' });
    expect(env.ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM order_events WHERE type = 'DEPOSIT_OBSERVED'")!.n).toBe(1);
    expect((await c.get(`/api/orders/${o.body.id}`)).body.status).toBe('deposit_observed');
  });

  it('persists support chat, hides internal notes from customers and tracks unread', async () => {
    const c = env.client();
    await customer(c, 'chat@example.test');
    const conv = await c.post('/api/support/conversations', {
      subject: 'Wire timing',
      body: 'When will it arrive?',
      orderId: null,
      clientMessageId: 'cm-00000001',
    });
    expect(conv.status).toBe(201);
    const id = conv.body.id as string;
    // Retrying the same client message id does not duplicate it.
    await c.post(`/api/support/conversations/${id}/messages`, { body: 'Following up', clientMessageId: 'cm-00000002' });
    await c.post(`/api/support/conversations/${id}/messages`, { body: 'Following up', clientMessageId: 'cm-00000002' });

    env.clock.advance(1_000);
    const agent = await staff(env.app, env.base, 'support');
    const inbox = await agent.get('/api/admin/conversations?unread=true');
    expect(inbox.body.items[0].id).toBe(id);
    expect(inbox.body.items[0].unread).toBe(2);
    await agent.post(`/api/admin/conversations/${id}/messages`, {
      body: 'Customer seems anxious; check wire cutoff.',
      internal: true,
      clientMessageId: 'sm-00000001',
    });
    await agent.post(`/api/admin/conversations/${id}/messages`, {
      body: 'Estimated next business day.',
      internal: false,
      clientMessageId: 'sm-00000002',
    });

    const view = await c.get(`/api/support/conversations/${id}`);
    const bodies = view.body.messages.map((m: { body: string }) => m.body);
    expect(bodies).toEqual(['When will it arrive?', 'Following up', 'Estimated next business day.']);
    expect(JSON.stringify(view.body)).not.toContain('anxious');
    const list = await c.get('/api/support/conversations');
    expect(list.body.conversations[0].unread).toBe(1);
    env.clock.advance(1_000);
    await c.post(`/api/support/conversations/${id}/read`);
    expect((await c.get('/api/support/conversations')).body.conversations[0].unread).toBe(0);
    expect(env.ctx.db.get<{ n: number }>('SELECT count(*) AS n FROM support_messages WHERE conversation_id = ?', [id])!.n).toBe(4);
  });

  it('validates input and content type, and never leaks internals on errors', async () => {
    const c = env.client();
    const { bankId } = await customer(c, 'val@example.test');
    expect((await c.post('/api/quotes', { asset: 'USDC', network: 'ethereum', amountAtomic: '-5', payoutMethod: 'ach' })).status).toBe(400);
    expect((await c.post('/api/quotes', { asset: 'DOGE', network: 'ethereum', amountAtomic: '5', payoutMethod: 'ach' })).status).toBe(400);
    expect((await c.post('/api/quotes', '{not json')).status).toBe(400);
    expect((await c.req('POST', '/api/quotes', 'a=b', { 'content-type': 'application/x-www-form-urlencoded' })).status).toBe(415);
    const { o } = await order(c, bankId, '2500000000');
    expect(o.status).toBe(201);
    const unknown = await c.get('/api/orders/ord_doesnotexist');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.requestId).toBeTruthy();
    expect(JSON.stringify(unknown.body)).not.toMatch(/stack|sqlite/i);
  });

  it('locks an account after repeated failed sign-ins', async () => {
    await createAccount(env.ctx, { email: 'lock@example.test', password: SANDBOX_PASSWORD, role: 'customer', fullName: 'Lock Test' });
    const c = env.client();
    for (let i = 0; i < 5; i++)
      expect((await c.post('/api/auth/signin', { email: 'lock@example.test', password: 'wrong-password-123' })).status).toBe(401);
    const locked = await c.post('/api/auth/signin', { email: 'lock@example.test', password: SANDBOX_PASSWORD });
    expect(locked.status).toBe(429);
  });
});

describe('staff MFA', () => {
  it('requires an authenticator code for staff when enabled', async () => {
    const env = await boot({ requireStaffMfa: true });
    try {
      // Without TOTP enrolled, a staff session cannot use admin APIs.
      const noMfa = await staff(env.app, env.base, 'admin', 'nomfa@arcvale.test');
      const denied = await noMfa.get('/api/admin/overview');
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe('mfa_required');

      const secret = 'JBSWY3DPEHPK3PXP';
      await createAccount(env.ctx, {
        email: 'mfa@arcvale.test',
        password: SANDBOX_PASSWORD,
        role: 'admin',
        fullName: 'MFA Admin',
        totpSecret: secret,
      });
      const c = new Client(env.base);
      const step1 = await c.post('/api/auth/signin', { email: 'mfa@arcvale.test', password: SANDBOX_PASSWORD });
      expect(step1.body.mfaRequired).toBe(true);
      expect((await c.post('/api/auth/mfa', { challengeId: step1.body.challengeId, code: '000000' })).status).toBe(401);
      const ok = await c.post('/api/auth/mfa', { challengeId: step1.body.challengeId, code: totpCode(secret, env.clock.now()) });
      expect(ok.status).toBe(200);
      expect((await c.get('/api/admin/overview')).status).toBe(200);
    } finally {
      await env.app.close();
    }
  });
});

describe('behind a reverse proxy', () => {
  it('rate-limits by the hop the proxy appended, so a forged X-Forwarded-For cannot dodge the limit', async () => {
    const env = await boot({ trustProxy: true });
    try {
      const c = env.client();
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++) {
        const r = await c.post(
          '/api/auth/signin',
          { email: `nobody${i}@example.test`, password: 'wrong-password-123' },
          // The client controls the first entry; the proxy appends the real address last.
          { 'x-forwarded-for': `10.0.0.${i}, 203.0.113.7` },
        );
        statuses.push(r.status);
      }
      expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
      expect(statuses.slice(10)).toEqual([429, 429]);
    } finally {
      await env.app.close();
    }
  });
});
