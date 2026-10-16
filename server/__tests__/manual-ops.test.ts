/**
 * Owner-managed manual exchange operations: CRM deposit confirmation, wallet
 * assignment, wire credentials, manual payout/refund — without automatic
 * money-moving providers claiming outcomes.
 */
import type { AddressInfo } from 'node:net';
import { LEGAL_DOCUMENTS } from '@/content/legal';
import type { App } from '../app';
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
}

async function boot() {
  const t = testApp({ port: 0, host: '127.0.0.1' });
  const server = await t.app.listen();
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { ...t, base, client: () => new Client(base) };
}

async function customer(c: Client, email: string) {
  const r = await c.post('/api/auth/signup', {
    email,
    password: SANDBOX_PASSWORD,
    fullName: 'Manual Ops Customer',
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

async function staff(app: App, base: string, role: 'admin' | 'owner' = 'admin', email = `${role}-manual@arcvale.test`) {
  await createAccount(app.ctx, { email, password: SANDBOX_PASSWORD, role, fullName: `Test ${role}` });
  const c = new Client(base);
  expect((await c.post('/api/auth/signin', { email, password: SANDBOX_PASSWORD, staffOnly: true })).status).toBe(200);
  return c;
}

const ETH_TX = `0x${'ab'.repeat(32)}`;

describe('manual exchange operations', () => {
  let env: Awaited<ReturnType<typeof boot>>;
  beforeAll(async () => {
    env = await boot();
  });
  afterAll(() => env.app.close());

  it('confirms a crypto deposit manually with audit, blocks customer self-confirm, and prevents double confirm', async () => {
    const c = env.client();
    const { bankId } = await customer(c, 'manual-dep@example.test');
    const admin = await staff(env.app, env.base, 'admin', 'manual-dep-admin@arcvale.test');

    const wal = await admin.post('/api/admin/credentials/wallets', {
      name: 'Manual USDC Eth',
      asset: 'USDC',
      network: 'ethereum',
      address: '0x3E9c431EEaaD6F41698A137907A93eF63EDD8ff3',
      purpose: 'deposit',
    });
    expect(wal.status).toBe(201);
    await admin.post(`/api/admin/credentials/wallets/${wal.body.id}/default`);

    const q = await c.post('/api/quotes', {
      asset: 'USDC',
      network: 'ethereum',
      amountAtomic: '2500000000',
      payoutMethod: 'ach',
    });
    const o = await c.post(
      '/api/orders',
      { quoteId: q.body.quote.id, destinationId: bankId, refundAddress: TEST_ETH_ADDRESS, accepted: docs('order') },
      { 'idempotency-key': 'manual-dep-1' },
    );
    expect(o.status).toBe(201);
    expect(o.body.status).toBe('awaiting_deposit');
    expect(o.body.deposit.address).toBe('0x3E9c431EEaaD6F41698A137907A93eF63EDD8ff3');
    const id = o.body.id as string;

    // Customer cannot confirm their own deposit.
    expect((await c.post(`/api/orders/${id}/confirm`, {})).status).toBe(404);
    expect((await c.post(`/api/admin/orders/${id}/confirm-deposit-manual`, { txHash: ETH_TX, amountAtomic: '2500000000', comment: 'ok' }))
      .status).toBe(403);

    const confirmed = await admin.post(`/api/admin/orders/${id}/confirm-deposit-manual`, {
      txHash: ETH_TX,
      amountAtomic: '2500000000',
      comment: 'Checked Etherscan: amount and address match.',
      reason: 'Independent verification complete.',
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe('ready_for_payout');
    expect(confirmed.body.deposit.confirmationKind).toBe('manual');
    expect(confirmed.body.deposit.txHash).toBe(ETH_TX);
    expect(confirmed.body.events.some((e: { type: string }) => e.type === 'MANUAL_DEPOSIT_CONFIRMED')).toBe(true);
    expect(confirmed.body.events.some((e: { type: string }) => e.type === 'DEPOSIT_CONFIRMED')).toBe(false);

    const customerView = await c.get(`/api/orders/${id}`);
    expect(customerView.body.deposit.confirmationKind).toBe('manual');
    expect(customerView.body.status).toBe('ready_for_payout');

    // Idempotent / double confirm refused.
    expect(
      (
        await admin.post(`/api/admin/orders/${id}/confirm-deposit-manual`, {
          txHash: ETH_TX,
          amountAtomic: '2500000000',
          comment: 'Checked again.',
        })
      ).status,
    ).toBe(409);

    const audit = await admin.get(`/api/admin/audit?targetId=${id}`);
    expect(
      audit.body.items.some(
        (a: { action: string }) => a.action === 'order.deposit_confirmed_manual' || a.action === 'order.manual_deposit_confirmed',
      ),
    ).toBe(true);

    // Manual payout without provider completion.
    const paid = await admin.post(`/api/admin/orders/${id}/record-manual-payout`, {
      reason: 'ACH sent from operating account',
      evidenceRef: 'ACH-TRACE-998877',
      evidenceNote: 'Desk log 2026-10-16',
    });
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('completed');
    expect(paid.body.payout.completionKind).toBe('manual');
    expect(paid.body.payout.evidenceRef).toBe('ACH-TRACE-998877');
    expect((await admin.post(`/api/admin/orders/${id}/record-manual-payout`, { reason: 'again', evidenceRef: 'ACH-2' })).status).toBe(409);
  });

  it('replaces a deposit wallet with history and notifies the customer', async () => {
    const c = env.client();
    const { bankId } = await customer(c, 'manual-wal@example.test');
    const admin = await staff(env.app, env.base, 'admin', 'manual-wal-admin@arcvale.test');

    const w1 = await admin.post('/api/admin/credentials/wallets', {
      name: 'BTC A',
      asset: 'BTC',
      network: 'bitcoin',
      address: 'bc1qzkuwv8rjgjpqwfcy52lveds8nu4477grq6h6u9',
      purpose: 'deposit',
    });
    await admin.post(`/api/admin/credentials/wallets/${w1.body.id}/default`);
    const w2 = await admin.post('/api/admin/credentials/wallets', {
      name: 'BTC B',
      asset: 'BTC',
      network: 'bitcoin',
      address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      purpose: 'deposit',
    });

    const q = await c.post('/api/quotes', { asset: 'BTC', network: 'bitcoin', amountAtomic: '100000', payoutMethod: 'ach' });
    const o = await c.post(
      '/api/orders',
      { quoteId: q.body.quote.id, destinationId: bankId, accepted: docs('order') },
      { 'idempotency-key': 'manual-wal-1' },
    );
    expect(o.body.deposit.address).toBe('bc1qzkuwv8rjgjpqwfcy52lveds8nu4477grq6h6u9');

    const replaced = await admin.post(`/api/admin/orders/${o.body.id}/assign-wallet-credentials`, {
      walletId: w2.body.id,
      confirmReplace: true,
      reason: 'Customer requested alternate address.',
    });
    expect(replaced.status).toBe(200);
    expect(replaced.body.deposit.address).toBe('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
    expect(replaced.body.events.some((e: { type: string }) => e.type === 'DEPOSIT_ADDRESS_REPLACED')).toBe(true);

    const notices = await c.get('/api/me/notifications');
    expect(
      (notices.body.notifications ?? notices.body.items ?? []).some(
        (n: { template?: string; subject?: string }) =>
          n.template === 'deposit_address_updated' || /deposit address updated/i.test(n.subject ?? ''),
      ),
    ).toBe(true);
  });

  it('runs a wire buy with CRM bank credentials and manual deposit + crypto payout recording', async () => {
    const c = env.client();
    await customer(c, 'manual-wire@example.test');
    const admin = await staff(env.app, env.base, 'admin', 'manual-wire-admin@arcvale.test');

    const wireSet = await admin.post('/api/admin/credentials/wire', {
      name: 'Ops Wire Desk',
      beneficiary: 'Arcvale Exchange LLC',
      bankName: 'Example National Bank',
      accountNumber: '123456789012',
      routingNumber: '021000021',
      swiftBic: 'CHASUS33',
      bankAddress: '270 Park Avenue, New York, NY',
      instructions: 'Quote the order reference.',
      currency: 'USD',
    });
    expect(wireSet.status).toBe(201);
    await admin.post(`/api/admin/credentials/wire/${wireSet.body.id}/default`);

    const q = await c.post('/api/quotes', {
      direction: 'buy',
      asset: 'USDC',
      network: 'ethereum',
      cashCents: '50000',
      payIn: 'wire',
    });
    expect([200, 201]).toContain(q.status);
    const o = await c.post(
      '/api/orders',
      {
        quoteId: q.body.quote.id,
        destinationId: '',
        receiveAddress: TEST_ETH_ADDRESS,
        accepted: docs('order'),
      },
      { 'idempotency-key': 'manual-wire-1' },
    );
    expect(o.status).toBe(201);
    expect(o.body.status).toBe('created');
    expect(o.body.wireCredentialsPending).toBe(true);

    const issued = await admin.post(`/api/admin/orders/${o.body.id}/issue-wire-instructions`, { wireSetId: wireSet.body.id });
    expect(issued.status).toBe(200);
    expect(issued.body.status).toBe('awaiting_deposit');
    expect(issued.body.wireInstructions?.length).toBeGreaterThan(0);

    const customerOrder = await c.get(`/api/orders/${o.body.id}`);
    expect(customerOrder.body.wireInstructions).toBeTruthy();

    const confirmed = await admin.post(`/api/admin/orders/${o.body.id}/confirm-deposit-manual`, {
      txHash: 'WIRE-REF-445566',
      amountAtomic: '50000',
      comment: 'Matched incoming wire on bank statement to order reference.',
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.deposit.confirmationKind).toBe('manual');
    expect(['ready_for_payout', 'compliance_review']).toContain(confirmed.body.status);

    if (confirmed.body.status === 'compliance_review') {
      await admin.post(`/api/admin/orders/${o.body.id}/approve`, { reason: 'Wire matched; checks passed.' });
    }

    const paid = await admin.post(`/api/admin/orders/${o.body.id}/record-manual-payout`, {
      reason: 'USDC sent from hot wallet',
      evidenceRef: ETH_TX,
      evidenceNote: 'Broadcast confirmed',
    });
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('completed');
    expect(paid.body.payout.completionKind).toBe('manual');
  });

  it('lists confirm_deposit_manual and record_manual_payout when automatic providers are not required', async () => {
    const c = env.client();
    const { bankId } = await customer(c, 'manual-actions@example.test');
    const admin = await staff(env.app, env.base, 'admin', 'manual-actions-admin@arcvale.test');

    const q = await c.post('/api/quotes', {
      asset: 'USDC',
      network: 'ethereum',
      amountAtomic: '1000000000',
      payoutMethod: 'ach',
    });
    // Ensure a wallet exists for the pair (seed may already provide one).
    const pair = await admin.get('/api/admin/credentials/wallets/for-pair?asset=USDC&network=ethereum');
    if (!(pair.body.items ?? []).some((w: { isDefault: boolean }) => w.isDefault)) {
      const w = await admin.post('/api/admin/credentials/wallets', {
        name: 'Actions USDC',
        asset: 'USDC',
        network: 'ethereum',
        address: '0x52908400098527886E0F7030069857D2E4169EE7',
        purpose: 'deposit',
      });
      await admin.post(`/api/admin/credentials/wallets/${w.body.id}/default`);
    }

    const o = await c.post(
      '/api/orders',
      { quoteId: q.body.quote.id, destinationId: bankId, accepted: docs('order') },
      { 'idempotency-key': 'manual-actions-1' },
    );
    expect(o.status).toBe(201);
    const detail = await admin.get(`/api/admin/orders/${o.body.id}`);
    const avail = Object.fromEntries(
      (detail.body.actions as { action: string; unavailable: string | null }[]).map((a) => [a.action, a.unavailable]),
    );
    expect(avail.confirm_deposit_manual).toBeNull();
    expect(avail.record_manual_payout).toBeTruthy(); // not ready yet
  });
});
