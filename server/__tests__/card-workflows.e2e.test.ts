/**
 * Isolated production-mode E2E for card pay-in (buy) and manual card payout (sell).
 * Does not touch data/arcvale-production.db. No fake card processor.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { LEGAL_DOCUMENTS } from '@/content/legal';
import { createApp, type App } from '../app';
import { loadConfig } from '../config';
import { fixedClock } from '../lib/clock';
import { silentLogger } from '../logger';
import { SANDBOX_BASE_PRICE_MICROS } from '../providers/sandbox';
import { createAccount } from '../services/auth';
import { decrypt } from '../lib/crypto';
import { SANDBOX_PASSWORD, TEST_ETH_ADDRESS } from '../scenarios';
import { T0, type Json } from './helpers';

const KEY = Buffer.alloc(32, 17).toString('base64');
const PAN = '4111111111111111';
const ETH_TX = `0x${'ab'.repeat(32)}`;

const docs = (kind: 'signup' | 'order') =>
  LEGAL_DOCUMENTS.filter((d) => d.acceptance === kind).map((d) => ({ slug: d.slug, version: d.version }));

type Res = { status: number; body: Json; headers: Headers };

class Client {
  cookies = new Map<string, string>();
  csrf: string | null = null;
  constructor(
    private base: string,
    private origin = 'https://arcvale.example',
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
      body: body === undefined ? undefined : JSON.stringify(body),
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
}

function stubRates(app: App, now: () => number) {
  app.ctx.providers.rates = {
    info: () => ({ key: 'rates', label: 'Exchange rates', state: 'configured', detail: 'Isolated test stub' }),
    getReferencePrice: async (asset) => ({
      asset,
      priceMicros: SANDBOX_BASE_PRICE_MICROS[asset],
      asOf: now(),
      source: 'live',
    }),
  };
}

function verifyKyc(app: App, email: string) {
  const u = app.ctx.db.get<{ id: string }>('SELECT id FROM users WHERE email = ?', [email]);
  if (!u) throw new Error(`user ${email} missing`);
  app.ctx.db.run("UPDATE customer_profiles SET kyc_status = 'verified', kyc_level = 'basic', updated_at = ? WHERE user_id = ?", [
    app.ctx.clock.now(),
    u.id,
  ]);
}

async function bootProd() {
  const dir = mkdtempSync(path.join(tmpdir(), 'arcvale-card-e2e-'));
  const clock = fixedClock(T0);
  const cfg = loadConfig({
    NODE_ENV: 'production',
    APP_MODE: 'production',
    PUBLIC_ORIGIN: 'https://arcvale.example',
    CRM_ORIGIN: 'https://crm.arcvale.example',
    SESSION_SECRET: 'y'.repeat(48),
    DATA_ENCRYPTION_KEY: KEY,
    DATABASE_PATH: path.join(dir, 'isolated-card-e2e.db'),
    SERVE_STATIC: 'false',
    REQUIRE_STAFF_MFA: 'false',
    RATES_SOURCE: 'default',
    HOST: '127.0.0.1',
    PORT: '1',
  });
  const app = createApp({ ...cfg, port: 0, host: '127.0.0.1' }, { clock, log: silentLogger });
  stubRates(app, () => clock.now());
  const server = await app.listen();
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    app,
    ctx: app.ctx,
    base,
    client: () => new Client(base),
    close: async () => {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function signup(c: Client, app: App, email: string) {
  expect(
    (
      await c.post('/api/auth/signup', {
        email,
        password: SANDBOX_PASSWORD,
        fullName: 'Card E2E Customer',
        countryOfResidence: 'US',
        stateOfResidence: 'NY',
        notInRestrictedTerritory: true,
        accepted: docs('signup'),
      })
    ).status,
  ).toBe(201);
  verifyKyc(app, email);
}

async function staff(app: App, base: string, email: string) {
  await createAccount(app.ctx, { email, password: SANDBOX_PASSWORD, role: 'owner', fullName: 'Card E2E Owner' });
  const c = new Client(base, 'https://crm.arcvale.example');
  expect((await c.post('/api/auth/signin', { email, password: SANDBOX_PASSWORD, staffOnly: true })).status).toBe(200);
  return c;
}

describe('card workflows E2E (isolated production DB)', () => {
  let env: Awaited<ReturnType<typeof bootProd>>;

  beforeAll(async () => {
    env = await bootProd();
  });
  afterAll(async () => {
    await env.close();
  });

  it('B — sell → USD on card: encrypted PAN, CRM reveal audited, manual payout, no CVV', async () => {
    const c = env.client();
    await signup(c, env.app, 'card-sell@example.test');
    const admin = await staff(env.app, env.base, 'card-sell-owner@arcvale.test');

    expect((await c.post('/api/me/destinations/card', { cardNumber: PAN, cvv: '123', holderName: 'A' })).status).toBe(400);

    const dest = await c.post('/api/me/destinations/card', {
      label: 'Visa payout',
      cardNumber: PAN,
      holderName: 'Ada Lovelace',
    });
    expect(dest.status).toBe(201);
    expect(dest.body.last4).toBe('1111');
    expect(JSON.stringify(dest.body)).not.toMatch(PAN);

    const row = env.ctx.db.get<{ details_enc: string; provider_token: string | null }>(
      'SELECT details_enc, provider_token FROM payout_destinations WHERE id = ?',
      [dest.body.id],
    )!;
    expect(row.provider_token).toBeNull();
    expect(row.details_enc).not.toContain(PAN);
    const plain = JSON.parse(decrypt(env.ctx.config.dataEncryptionKey, row.details_enc)) as { pan: string; holderName: string };
    expect(plain.pan).toBe(PAN);
    expect(plain.holderName).toBe('Ada Lovelace');
    expect(JSON.stringify(plain)).not.toMatch(/cvv|cvc|pin/i);

    const wal = await admin.post('/api/admin/credentials/wallets', {
      name: 'Card E2E USDC',
      asset: 'USDC',
      network: 'ethereum',
      address: '0x3E9c431EEaaD6F41698A137907A93eF63EDD8ff3',
      purpose: 'deposit',
    });
    await admin.post(`/api/admin/credentials/wallets/${wal.body.id}/default`);

    const firm = await c.post('/api/quotes', {
      asset: 'USDC',
      network: 'ethereum',
      amountAtomic: '5000000000',
      payoutMethod: 'instant_debit',
    });
    expect([200, 201]).toContain(firm.status);
    expect(BigInt(firm.body.quote.payoutFeeCents)).toBe((BigInt(firm.body.quote.grossCents) * 300n + 5000n) / 10000n);

    const order = await c.post(
      '/api/orders',
      { quoteId: firm.body.quote.id, destinationId: dest.body.id, accepted: docs('order') },
      { 'idempotency-key': 'card-sell-1' },
    );
    expect(order.status).toBe(201);
    expect(order.body.status).toBe('awaiting_deposit');
    expect(order.body.payout.method).toBe('instant_debit');
    expect(order.body.payout.last4).toBe('1111');
    const id = order.body.id as string;

    // Customer never sees full PAN.
    expect(JSON.stringify(await c.get(`/api/orders/${id}`))).not.toMatch(PAN);

    const other = env.client();
    await signup(other, env.app, 'card-other@example.test');
    expect((await other.get(`/api/orders/${id}`)).status).toBe(404);
    expect((await other.get(`/api/admin/orders/${id}/card-destination`)).status).toBe(403);

    await admin.post(`/api/admin/orders/${id}/assign`, { operatorId: null });
    const reveal = await admin.get(`/api/admin/orders/${id}/card-destination`);
    expect(reveal.status).toBe(200);
    expect(reveal.body.cardNumber).toBe(PAN);
    expect(reveal.body.holderName).toBe('Ada Lovelace');
    const audit = env.ctx.db.get<{ action: string; data: string }>(
      "SELECT action, data FROM audit_events WHERE action = 'destination.card_viewed' AND target_id = ?",
      [id],
    );
    expect(audit).toBeTruthy();
    expect(audit!.data).not.toContain(PAN);

    expect((await c.post(`/api/orders/${id}/payment-confirmation`, { txid: ETH_TX })).status).toBe(201);
    expect((await c.get(`/api/orders/${id}`)).body.status).toBe('awaiting_deposit');

    const confirmed = await admin.post(`/api/admin/orders/${id}/confirm-deposit-manual`, {
      txHash: ETH_TX,
      amountAtomic: '5000000000',
      comment: 'On-chain match to assigned wallet.',
    });
    expect(confirmed.status).toBe(200);
    if (confirmed.body.status === 'compliance_review') {
      await admin.post(`/api/admin/orders/${id}/approve`, { reason: 'Card payout order checks passed.' });
    }
    expect((await admin.get(`/api/admin/orders/${id}`)).body.order.status).toBe('ready_for_payout');
    expect((await admin.get(`/api/admin/orders/${id}`)).body.cardDestinationSummary.last4).toBe('1111');

    const paid = await admin.post(`/api/admin/orders/${id}/record-manual-payout`, {
      reason: 'Pushed to customer card via external desk',
      evidenceRef: 'CARD-PUSH-E2E-9',
      evidenceNote: 'Isolated test',
      amountCents: Number(confirmed.body.quote?.netCents ?? firm.body.quote.netCents),
    });
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('completed');
    expect(paid.body.payout.completionKind).toBe('manual');
    expect((await c.get(`/api/orders/${id}`)).body.status).toBe('completed');
    expect((await admin.post(`/api/admin/orders/${id}/record-manual-payout`, { reason: 'again', evidenceRef: 'X-99' })).status).toBe(409);

    // Persistence after re-fetch.
    expect((await c.get(`/api/orders/${id}`)).body.payout.last4).toBe('1111');
  });

  it('A — buy with card: CRM payment link, customer proof ≠ credit, manual confirm + crypto payout', async () => {
    const c = env.client();
    await signup(c, env.app, 'card-buy@example.test');
    const admin = await staff(env.app, env.base, 'card-buy-owner@arcvale.test');

    const firm = await c.post('/api/quotes', {
      direction: 'buy',
      asset: 'USDC',
      network: 'ethereum',
      cashCents: '100000',
      payIn: 'card',
    });
    expect([200, 201]).toContain(firm.status);
    expect(firm.body.quote.payoutMethod).toBe('instant_debit');
    expect(BigInt(firm.body.quote.payoutFeeCents)).toBe((100000n * 200n + 5000n) / 10000n); // buy: 2%

    const order = await c.post(
      '/api/orders',
      { quoteId: firm.body.quote.id, destinationId: '', receiveAddress: TEST_ETH_ADDRESS, accepted: docs('order') },
      { 'idempotency-key': 'card-buy-1' },
    );
    expect(order.status).toBe(201);
    expect(order.body.status).toBe('created');
    expect(order.body.payIn).toBe('card');
    expect(order.body.cardPayInPending).toBe(true);
    expect(order.body.cardPayInInstructions).toBeNull();
    const id = order.body.id as string;

    expect(
      (
        await admin.post(`/api/admin/orders/${id}/issue-card-payin-instructions`, {
          paymentUrl: 'http://insecure.example/pay',
        })
      ).status,
    ).toBe(400);

    const issued = await admin.post(`/api/admin/orders/${id}/issue-card-payin-instructions`, {
      paymentUrl: 'https://pay.processor.example/session/abc',
      instructions: 'Pay exactly the quoted USD amount. Quote the order number in the merchant reference field.',
      providerRef: 'SESS-ABC',
    });
    expect(issued.status).toBe(200);
    expect(issued.body.status).toBe('awaiting_deposit');
    expect(issued.body.cardPayInInstructions?.paymentUrl).toBe('https://pay.processor.example/session/abc');

    const client = await c.get(`/api/orders/${id}`);
    expect(client.body.cardPayInPending).toBe(false);
    expect(client.body.cardPayInInstructions.paymentUrl).toContain('https://');
    expect(client.body.wireInstructions).toBeNull();

    const proof = await c.post(`/api/orders/${id}/payment-confirmation`, {
      wireReference: 'PROC-PAY-7788',
      comment: 'Paid on processor page',
    });
    expect(proof.status).toBe(201);
    expect((await c.get(`/api/orders/${id}`)).body.status).toBe('awaiting_deposit');
    expect((await c.get(`/api/orders/${id}`)).body.deposit.confirmationKind).toBeNull();

    // Buy deposit matching uses gross USD cents as the quoted "atomic" amount.
    const confirmed = await admin.post(`/api/admin/orders/${id}/confirm-deposit-manual`, {
      txHash: 'PROC-PAY-7788',
      amountAtomic: '100000',
      comment: 'Processor dashboard: settled amount and session match.',
    });
    expect(confirmed.status).toBe(200);
    let status = confirmed.body.status as string;
    if (status === 'compliance_review') {
      const approved = await admin.post(`/api/admin/orders/${id}/approve`, {
        reason: 'Card pay-in verified against processor settlement.',
      });
      expect(approved.status).toBe(200);
      status = approved.body.status as string;
    }
    expect(status).toBe('ready_for_payout');

    const paid = await admin.post(`/api/admin/orders/${id}/record-manual-payout`, {
      reason: 'USDC sent to customer receive address',
      evidenceRef: ETH_TX,
    });
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('completed');
    expect((await c.get(`/api/orders/${id}`)).body.status).toBe('completed');
  });
});
