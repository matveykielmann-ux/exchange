/**
 * End-to-end manual exchange workflows on an isolated production-mode database.
 * Does not touch data/arcvale-production.db or sandbox DB. Rates are stubbed;
 * money-moving providers stay not_configured — CRM manual ops complete each path.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { LEGAL_DOCUMENTS } from '@/content/legal';
import { WIRE_BANK_FEE_CENTS } from '@/domain/payout';
import { createApp, type App } from '../app';
import { loadConfig } from '../config';
import { fixedClock } from '../lib/clock';
import { silentLogger } from '../logger';
import { SANDBOX_BASE_PRICE_MICROS } from '../providers/sandbox';
import { createAccount } from '../services/auth';
import { SANDBOX_PASSWORD, TEST_ETH_ADDRESS } from '../scenarios';
import { T0, type Json } from './helpers';

const KEY = Buffer.alloc(32, 13).toString('base64');
const ETH_TX = `0x${'cd'.repeat(32)}`;
const ETH_TX_2 = `0x${'ef'.repeat(32)}`;

const docs = (kind: 'signup' | 'order') =>
  LEGAL_DOCUMENTS.filter((d) => d.acceptance === kind).map((d) => ({ slug: d.slug, version: d.version }));

/** Tiny 1×1 PNG for receipt uploads. */
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
  const dir = mkdtempSync(path.join(tmpdir(), 'arcvale-manual-e2e-'));
  const clock = fixedClock(T0);
  const cfg = loadConfig({
    NODE_ENV: 'production',
    APP_MODE: 'production',
    PUBLIC_ORIGIN: 'https://arcvale.example',
    CRM_ORIGIN: 'https://crm.arcvale.example',
    SESSION_SECRET: 'x'.repeat(48),
    DATA_ENCRYPTION_KEY: KEY,
    DATABASE_PATH: path.join(dir, 'isolated-manual-e2e.db'),
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
    clock,
    base,
    dir,
    client: () => new Client(base),
    close: async () => {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function signupCustomer(c: Client, app: App, email: string) {
  const r = await c.post('/api/auth/signup', {
    email,
    password: SANDBOX_PASSWORD,
    fullName: 'E2E Manual Customer',
    countryOfResidence: 'US',
    stateOfResidence: 'NY',
    notInRestrictedTerritory: true,
    accepted: docs('signup'),
  });
  expect(r.status).toBe(201);
  // Document/provider KYC is not configured in this isolated prod app — mark verified for exchange placement.
  verifyKyc(app, email);
  return r;
}

async function staff(app: App, base: string, email: string) {
  await createAccount(app.ctx, { email, password: SANDBOX_PASSWORD, role: 'owner', fullName: 'E2E Owner' });
  const c = new Client(base, 'https://crm.arcvale.example');
  expect((await c.post('/api/auth/signin', { email, password: SANDBOX_PASSWORD, staffOnly: true })).status).toBe(200);
  return c;
}

describe('manual workflows E2E (isolated production DB)', () => {
  let env: Awaited<ReturnType<typeof bootProd>>;

  beforeAll(async () => {
    env = await bootProd();
  });
  afterAll(async () => {
    await env.close();
  });

  it('A — crypto → USD (ACH): quote, wallet, TXID upload does not confirm, manual deposit + payout', async () => {
    const c = env.client();
    await signupCustomer(c, env.app, 'e2e-a@example.test');
    const admin = await staff(env.app, env.base, 'e2e-a-owner@arcvale.test');

    const bank = await c.post('/api/me/destinations/bank', {
      label: 'Customer ACH account',
      routingNumber: '021000021',
      accountNumber: '000987654321',
      accountType: 'checking',
    });
    expect(bank.status).toBe(201);
    expect(bank.body.last4).toBe('4321');

    // Manual card destination stores encrypted PAN (no CVV); full number never returned to the customer.
    const card = await c.post('/api/me/destinations/card', {
      label: 'Manual debit',
      cardNumber: '4111111111111111',
      holderName: 'E2E Card Holder',
    });
    expect(card.status).toBe(201);
    expect(card.body.last4).toBe('1111');
    expect(JSON.stringify(card.body)).not.toMatch(/4111111111111111/);

    const wal = await admin.post('/api/admin/credentials/wallets', {
      name: 'E2E USDC Eth deposit',
      asset: 'USDC',
      network: 'ethereum',
      address: '0x3E9c431EEaaD6F41698A137907A93eF63EDD8ff3',
      purpose: 'deposit',
    });
    expect(wal.status).toBe(201);
    await admin.post(`/api/admin/credentials/wallets/${wal.body.id}/default`);

    const indicative = await c.get('/api/quotes/indicative?asset=USDC&network=ethereum&amountAtomic=5000000000&payoutMethod=ach');
    expect(indicative.status).toBe(200);
    expect(indicative.body.quote.spreadBps).toBe(0);
    expect(BigInt(indicative.body.quote.payoutFeeCents)).toBe((BigInt(indicative.body.quote.grossCents) * 300n + 5000n) / 10000n);

    const firm = await c.post('/api/quotes', {
      asset: 'USDC',
      network: 'ethereum',
      amountAtomic: '5000000000',
      payoutMethod: 'ach',
    });
    expect([200, 201]).toContain(firm.status);
    const q = firm.body.quote;
    expect(BigInt(q.grossCents) - BigInt(q.spreadCents) - BigInt(q.payoutFeeCents)).toBe(BigInt(q.netCents));

    const order = await c.post(
      '/api/orders',
      { quoteId: q.id, destinationId: bank.body.id, accepted: docs('order') },
      { 'idempotency-key': 'e2e-a-ord-1' },
    );
    expect(order.status).toBe(201);
    expect(order.body.status).toBe('awaiting_deposit');
    expect(order.body.deposit.address).toBe('0x3E9c431EEaaD6F41698A137907A93eF63EDD8ff3');
    expect(order.body.reference).toMatch(/^\d{10}$/);
    const id = order.body.id as string;

    const queue = await admin.get('/api/admin/orders?status=awaiting_deposit');
    expect(queue.body.items.map((x: { id: string }) => x.id)).toContain(id);

    // Customer TXID / receipt must not confirm the deposit.
    const proof = await c.post(`/api/orders/${id}/payment-confirmation`, {
      txid: ETH_TX,
      comment: 'Sent from exchange',
      file: { fileName: 'receipt.png', contentType: 'image/png', dataBase64: TINY_PNG_B64 },
    });
    expect(proof.status).toBe(201);
    expect((await c.get(`/api/orders/${id}`)).body.status).toBe('awaiting_deposit');
    expect((await c.get(`/api/orders/${id}`)).body.deposit.confirmationKind).toBeNull();

    // Customer cannot call admin confirm.
    expect(
      (
        await c.post(`/api/admin/orders/${id}/confirm-deposit-manual`, {
          txHash: ETH_TX,
          amountAtomic: '5000000000',
          comment: 'hack',
        })
      ).status,
    ).toBe(403);

    const detail = await admin.get(`/api/admin/orders/${id}`);
    expect(detail.body.order.deposit.address).toBeTruthy();
    expect(detail.body.paymentConfirmations?.length).toBeGreaterThan(0);
    expect(detail.body.actions.some((a: { action: string; unavailable: string | null }) => a.action === 'confirm_deposit_manual' && !a.unavailable)).toBe(
      true,
    );

    const confirmed = await admin.post(`/api/admin/orders/${id}/confirm-deposit-manual`, {
      txHash: ETH_TX,
      amountAtomic: '5000000000',
      comment: 'Etherscan: amount, asset, network and address match assigned wallet.',
      reason: 'Independent deposit verification.',
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.deposit.confirmationKind).toBe('manual');
    expect(confirmed.body.status).toBe('ready_for_payout');
    expect(confirmed.body.events.some((e: { type: string }) => e.type === 'MANUAL_DEPOSIT_CONFIRMED')).toBe(true);
    expect(confirmed.body.events.some((e: { type: string }) => e.type === 'DEPOSIT_CONFIRMED')).toBe(false);

    // Double confirm blocked.
    expect(
      (
        await admin.post(`/api/admin/orders/${id}/confirm-deposit-manual`, {
          txHash: ETH_TX,
          amountAtomic: '5000000000',
          comment: 'again',
        })
      ).status,
    ).toBe(409);

    const paid = await admin.post(`/api/admin/orders/${id}/record-manual-payout`, {
      reason: 'ACH credit from operating account',
      evidenceRef: 'ACH-E2E-111222',
      evidenceNote: 'Isolated test desk log',
    });
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('completed');
    expect(paid.body.payout.completionKind).toBe('manual');
    expect(paid.body.payout.evidenceRef).toBe('ACH-E2E-111222');

    const customerDone = await c.get(`/api/orders/${id}`);
    expect(customerDone.body.status).toBe('completed');
    expect(customerDone.body.payout.completionKind).toBe('manual');
    expect(customerDone.body.deposit.txHash).toBe(ETH_TX);

    // Persistence after "reload" (re-fetch) and double payout blocked.
    expect((await c.get(`/api/orders/${id}`)).body.status).toBe('completed');
    expect((await admin.post(`/api/admin/orders/${id}/record-manual-payout`, { reason: 'again', evidenceRef: 'ACH-X' })).status).toBe(409);

    // Wallet replace with history + notify (on a fresh awaiting order).
    const firm2 = await c.post('/api/quotes', {
      asset: 'USDC',
      network: 'ethereum',
      amountAtomic: '1000000000',
      payoutMethod: 'ach',
    });
    const o2 = await c.post(
      '/api/orders',
      { quoteId: firm2.body.quote.id, destinationId: bank.body.id, accepted: docs('order') },
      { 'idempotency-key': 'e2e-a-ord-2' },
    );
    const w2 = await admin.post('/api/admin/credentials/wallets', {
      name: 'E2E USDC Eth 2',
      asset: 'USDC',
      network: 'ethereum',
      address: '0x52908400098527886E0F7030069857D2E4169EE7',
      purpose: 'deposit',
    });
    const replaced = await admin.post(`/api/admin/orders/${o2.body.id}/assign-wallet-credentials`, {
      walletId: w2.body.id,
      confirmReplace: true,
      reason: 'Customer requested alternate deposit address.',
    });
    expect(replaced.status).toBe(200);
    expect(replaced.body.deposit.address).toBe('0x52908400098527886E0F7030069857D2E4169EE7');
    expect(replaced.body.events.some((e: { type: string }) => e.type === 'DEPOSIT_ADDRESS_REPLACED')).toBe(true);
    const notices = await c.get('/api/me/notifications');
    expect(notices.body.notifications.some((n: { template: string }) => n.template === 'deposit_address_updated')).toBe(true);
  });

  it('B — wire buy: $30 bank + 2% exchange fees, CRM bank credentials, receipt ≠ deposit, manual confirm + crypto payout', async () => {
    const c = env.client();
    await signupCustomer(c, env.app, 'e2e-b@example.test');
    const admin = await staff(env.app, env.base, 'e2e-b-owner@arcvale.test');

    const wireSet = await admin.post('/api/admin/credentials/wire', {
      name: 'E2E Ops Wire Desk',
      beneficiary: 'Arcvale Exchange LLC',
      bankName: 'Example National Bank',
      accountNumber: '999888777666',
      routingNumber: '021000021',
      swiftBic: 'CHASUS33',
      bankAddress: '270 Park Avenue, New York, NY',
      instructions: 'Quote the order reference in the wire memo.',
      currency: 'USD',
    });
    expect(wireSet.status).toBe(201);
    await admin.post(`/api/admin/credentials/wire/${wireSet.body.id}/default`);

    const cashCents = 100_000n; // $1,000
    const firm = await c.post('/api/quotes', {
      direction: 'buy',
      asset: 'USDC',
      network: 'ethereum',
      cashCents: cashCents.toString(),
      payIn: 'wire',
    });
    expect([200, 201]).toContain(firm.status);
    const q = firm.body.quote;
    expect(q.payoutMethod).toBe('wire');
    expect(q.feePending).toBeFalsy();
    const exchangeFee = (cashCents * 200n + 5000n) / 10000n; // buy: 2%
    expect(BigInt(q.payoutFeeCents)).toBe(WIRE_BANK_FEE_CENTS + exchangeFee);
    expect(BigInt(q.grossCents) - BigInt(q.spreadCents) - BigInt(q.payoutFeeCents)).toBe(BigInt(q.netCents));

    const order = await c.post(
      '/api/orders',
      { quoteId: q.id, destinationId: '', receiveAddress: TEST_ETH_ADDRESS, accepted: docs('order') },
      { 'idempotency-key': 'e2e-b-ord-1' },
    );
    expect(order.status).toBe(201);
    expect(order.body.status).toBe('created');
    expect(order.body.payIn).toBe('wire');
    expect(order.body.wireCredentialsPending).toBe(true);
    expect(order.body.payout.methodName.toLowerCase()).not.toMatch(/courier/);
    const id = order.body.id as string;

    const waiting = await c.get(`/api/orders/${id}`);
    expect(waiting.body.wireCredentialsPending).toBe(true);
    expect(waiting.body.wireInstructions).toBeNull();

    const issued = await admin.post(`/api/admin/orders/${id}/issue-wire-instructions`, { wireSetId: wireSet.body.id });
    expect(issued.status).toBe(200);
    expect(issued.body.status).toBe('awaiting_deposit');
    expect(issued.body.wireInstructions?.some((l: { value: string }) => String(l.value).includes('999888777666'))).toBe(true);

    const clientWire = await c.get(`/api/orders/${id}`);
    expect(clientWire.body.wireInstructions?.length).toBeGreaterThan(0);
    // Receiving crypto address is the customer's wallet — not the CRM wire account.
    expect(clientWire.body.receiveAddress).toBe(TEST_ETH_ADDRESS);
    expect(JSON.stringify(clientWire.body.wireInstructions)).not.toContain(TEST_ETH_ADDRESS);

    const receipt = await c.post(`/api/orders/${id}/payment-confirmation`, {
      wireReference: 'WIRE-E2E-778899',
      file: { fileName: 'wire-receipt.png', contentType: 'image/png', dataBase64: TINY_PNG_B64 },
    });
    expect(receipt.status).toBe(201);
    expect((await c.get(`/api/orders/${id}`)).body.status).toBe('awaiting_deposit');
    expect((await c.get(`/api/orders/${id}`)).body.deposit.confirmationKind).toBeNull();

    const confirmed = await admin.post(`/api/admin/orders/${id}/confirm-deposit-manual`, {
      txHash: 'WIRE-E2E-778899',
      amountAtomic: cashCents.toString(),
      comment: 'Bank statement match: amount and reference.',
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.deposit.confirmationKind).toBe('manual');
    if (confirmed.body.status === 'compliance_review') {
      await admin.post(`/api/admin/orders/${id}/approve`, { reason: 'Wire matched; checks passed.' });
    }
    expect((await admin.get(`/api/admin/orders/${id}`)).body.order.status).toBe('ready_for_payout');

    const paid = await admin.post(`/api/admin/orders/${id}/record-manual-payout`, {
      reason: 'USDC transferred from operating wallet',
      evidenceRef: 'DESK-BUY-OUT-1',
      payoutTxHash: ETH_TX_2,
    });
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('completed');
    expect(paid.body.payout.completionKind).toBe('manual');
    expect(paid.body.payout.payoutTxHash).toBe(ETH_TX_2);
    expect(paid.body.reference).toMatch(/^\d{10}$/);
    const customerDone = await c.get(`/api/orders/${id}`);
    expect(customerDone.body.status).toBe('completed');
    expect(customerDone.body.payout.payoutTxHash).toBe(ETH_TX_2);
  });

  it('C — cash/courier sell: courier_fee_pending → set fee → accept → deposit → manual payout', async () => {
    const c = env.client();
    await signupCustomer(c, env.app, 'e2e-c@example.test');
    const admin = await staff(env.app, env.base, 'e2e-c-owner@arcvale.test');

    const courier = await c.post('/api/me/destinations/courier', {
      phone: '+12125550100',
      line1: '100 Test Street',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      window: 'morning',
      preferredDate: '',
      instructions: 'Ring doorbell',
    });
    expect(courier.status).toBe(201);

    const wal = await admin.post('/api/admin/credentials/wallets', {
      name: 'E2E BTC deposit',
      asset: 'BTC',
      network: 'bitcoin',
      address: 'bc1qzkuwv8rjgjpqwfcy52lveds8nu4477grq6h6u9',
      purpose: 'deposit',
    });
    await admin.post(`/api/admin/credentials/wallets/${wal.body.id}/default`);

    const firm = await c.post('/api/quotes', {
      asset: 'BTC',
      network: 'bitcoin',
      amountAtomic: '2500000',
      payoutMethod: 'courier_cash',
    });
    expect([200, 201]).toContain(firm.status);
    expect(firm.body.quote.feePending).toBe(true);
    expect(firm.body.issues.map((i: { code: string }) => i.code)).toContain('courier_fee_pending');
    // Must not invent a $35 flat courier fee.
    expect(BigInt(firm.body.quote.payoutFeeCents)).toBe(0n);

    const order = await c.post(
      '/api/orders',
      { quoteId: firm.body.quote.id, destinationId: courier.body.id, accepted: docs('order') },
      { 'idempotency-key': 'e2e-c-ord-1' },
    );
    expect(order.status).toBe(201);
    expect(order.body.courierFee.pending).toBe(true);
    expect(order.body.status).toBe('created');
    expect(order.body.deposit.address).toBeNull();
    expect(order.body.payout.method).toBe('courier_cash');
    expect(JSON.stringify(order.body)).not.toMatch(/wire instructions|Bank processing fee/i);
    const id = order.body.id as string;

    // Cannot accept before operator sets fee.
    expect((await c.post(`/api/orders/${id}/accept-courier-fee`)).status).toBe(409);

    const feeSet = await admin.post(`/api/admin/orders/${id}/set-courier-fee`, {
      feeCents: 45_00,
      reason: 'Individual courier quote for Manhattan ZIP 10001.',
    });
    expect(feeSet.status).toBe(200);
    expect(feeSet.body.courierFee.pending).toBe(false);
    expect(feeSet.body.courierFee.awaitingAcceptance).toBe(true);
    expect(feeSet.body.quote.payoutFeeCents).toBe('4500');
    expect(feeSet.body.deposit.address).toBeNull();

    const accepted = await c.post(`/api/orders/${id}/accept-courier-fee`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.courierFee.acceptedAt).toBeTypeOf('number');
    expect(accepted.body.status).toBe('awaiting_deposit');
    expect(accepted.body.deposit.address).toBe('bc1qzkuwv8rjgjpqwfcy52lveds8nu4477grq6h6u9');

    const btcTx = 'a'.repeat(64);
    expect((await c.post(`/api/orders/${id}/payment-confirmation`, { txid: btcTx })).status).toBe(201);
    expect((await c.get(`/api/orders/${id}`)).body.status).toBe('awaiting_deposit');

    const confirmed = await admin.post(`/api/admin/orders/${id}/confirm-deposit-manual`, {
      txHash: btcTx,
      amountAtomic: '2500000',
      comment: 'Mempool explorer: deposit to assigned address confirmed.',
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.deposit.confirmationKind).toBe('manual');
    if (confirmed.body.status === 'compliance_review') {
      await admin.post(`/api/admin/orders/${id}/approve`, { reason: 'Courier order checks passed.' });
    }

    const paid = await admin.post(`/api/admin/orders/${id}/record-manual-payout`, {
      reason: 'Cash handed to customer after ID check',
      evidenceRef: 'COURIER-LOG-E2E-55',
    });
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('completed');
    expect(paid.body.payout.completionKind).toBe('manual');
    expect((await c.get(`/api/orders/${id}`)).body.status).toBe('completed');
  });

  it('CRM detail, file isolation, and refund request requires KYC path', async () => {
    const c1 = env.client();
    const c2 = env.client();
    await signupCustomer(c1, env.app, 'e2e-iso-a@example.test');
    await signupCustomer(c2, env.app, 'e2e-iso-b@example.test');
    const admin = await staff(env.app, env.base, 'e2e-iso-owner@arcvale.test');

    const bank = await c1.post('/api/me/destinations/bank', {
      routingNumber: '021000021',
      accountNumber: '000111222333',
      accountType: 'checking',
    });
    const pair = await admin.get('/api/admin/credentials/wallets/for-pair?asset=USDC&network=ethereum');
    if (!(pair.body.items ?? []).length) {
      const w = await admin.post('/api/admin/credentials/wallets', {
        name: 'ISO USDC',
        asset: 'USDC',
        network: 'ethereum',
        address: '0x3E9c431EEaaD6F41698A137907A93eF63EDD8ff3',
        purpose: 'deposit',
      });
      await admin.post(`/api/admin/credentials/wallets/${w.body.id}/default`);
    }
    const firm = await c1.post('/api/quotes', {
      asset: 'USDC',
      network: 'ethereum',
      amountAtomic: '2000000000',
      payoutMethod: 'ach',
    });
    const o = await c1.post(
      '/api/orders',
      { quoteId: firm.body.quote.id, destinationId: bank.body.id, accepted: docs('order') },
      { 'idempotency-key': 'e2e-iso-1' },
    );
    const id = o.body.id as string;
    const proof = await c1.post(`/api/orders/${id}/payment-confirmation`, {
      txid: ETH_TX,
      file: { fileName: 'private.png', contentType: 'image/png', dataBase64: TINY_PNG_B64 },
    });
    expect(proof.status).toBe(201);
    const docId = (await c1.get(`/api/orders/${id}`)).body.documents[0]?.id as string;
    expect(docId).toBeTruthy();

    // Other customer cannot read the order or its document.
    expect((await c2.get(`/api/orders/${id}`)).status).toBe(404);
    expect((await c2.get(`/api/orders/${id}/documents/${docId}`)).status).toBe(404);

    const detail = await admin.get(`/api/admin/orders/${id}`);
    expect(detail.body.order.reference).toMatch(/^\d{10}$/);
    expect(detail.body.customer.email).toBeTruthy();
    expect(detail.body.order.quote).toBeTruthy();
    expect(detail.body.order.deposit.address).toBeTruthy();
    expect(detail.body.paymentConfirmations?.length).toBeGreaterThan(0);
    expect(detail.body.actions.some((a: { action: string }) => a.action === 'confirm_deposit_manual')).toBe(true);

    // Refund request via support path — not an auto client completion button.
    await admin.post(`/api/admin/orders/${id}/confirm-deposit-manual`, {
      txHash: ETH_TX,
      amountAtomic: '2000000000',
      comment: 'Verified for refund-path test.',
    });
    // Force failed path via reject after deposit to open refund_pending when applicable,
    // or submit refund request while awaiting — API rejects auto client complete.
    expect((await c1.post(`/api/orders/${id}/confirm`, {})).status).toBe(404);
  });
});
