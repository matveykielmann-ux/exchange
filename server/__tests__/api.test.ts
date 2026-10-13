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
    stateOfResidence: 'NY',
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
      stateOfResidence: 'NY',
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
        stateOfResidence: 'NY',
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

    // "I sent it" is recorded but proves nothing.
    expect((await c.post(`/api/orders/${id}/report-sent`, { txHash: null })).body.status).toBe('awaiting_deposit');

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
