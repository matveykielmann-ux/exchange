import { describe, expect, it } from 'vitest';
import { REAL_MONEY_ENABLED, resolveServiceMode } from '@/config/runtime';
import { isValidAddress, NETWORKS, type NetworkId } from '@/domain/assets';
import { calculateQuote } from '@/domain/quote';
import { createMockServices } from '../mock';
import { isPreviewDepositAddress } from '@/domain/transaction';
import { MOCK_MFA_CODE } from '../mock/auth';

let clock = 1_700_000_000_000;
const services = () => createMockServices({ latencyMs: 0, now: () => clock, random: Math.random });

async function signedUp(s = services(), email = 'jordan@example.com') {
  await s.auth.signUp({ name: 'Jordan Rivera', email, password: 'correct-horse-battery' });
  await s.kyc.startVerification(email, 'verified');
  const dest = await s.payouts.addBankAccount(email, { nickname: 'Checking', routingNumber: '011000015', accountNumber: '000123456789' });
  return { s, email, dest };
}

describe('runtime safety', () => {
  it('keeps real money disabled and fails closed on unknown modes', () => {
    expect(REAL_MONEY_ENABLED).toBe(false);
    expect(resolveServiceMode(undefined)).toBe('mock');
    expect(() => resolveServiceMode('production')).toThrow(/Only "mock" is implemented/);
  });
});

describe('mock services', () => {
  it('signs in with a second factor and never stores the password', async () => {
    const s = services();
    await s.auth.signUp({ name: 'A B', email: 'ab@example.com', password: 'correct-horse-battery' });
    s.auth.signOut();
    const { challengeId } = await s.auth.signIn({ email: 'AB@example.com', password: 'anything-goes-here' });
    await expect(s.auth.verifyMfa({ challengeId, code: '123456' })).rejects.toThrow(/not correct/);
    const user = await s.auth.verifyMfa({ challengeId, code: MOCK_MFA_CODE });
    expect(user.email).toBe('ab@example.com');
    expect(JSON.stringify({ ...localStorage })).not.toContain('correct-horse-battery');
  });

  it('stores only the last four digits of bank accounts', async () => {
    const { dest } = await signedUp();
    expect(dest.last4).toBe('6789');
    const dump = JSON.stringify({ ...localStorage });
    expect(dump).not.toContain('000123456789');
    expect(dump).not.toContain('011000015');
  });

  it('issues deposit addresses that are invalid on every network', () => {
    const s = services();
    for (const network of Object.keys(NETWORKS) as NetworkId[]) {
      const addr = s.deposits.createDepositAddress('USDC', network);
      expect(isPreviewDepositAddress(addr)).toBe(true);
      for (const n of Object.keys(NETWORKS) as NetworkId[]) expect(isValidAddress(n, addr)).toBe(false);
    }
  });

  it('creates a transaction from a valid quote and runs it to completion', async () => {
    const { s, email, dest } = await signedUp();
    const q = await s.quotes.getQuote({ asset: 'BTC', network: 'bitcoin', amountAtomic: 5_000_000n, payoutMethod: 'ach' });
    let tx = await s.transactions.create({
      quoteResult: q,
      destinationId: dest.id,
      refundAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      customerEmail: email,
    });
    expect(tx.status).toBe('awaiting_deposit');
    for (let i = 0; i < 10; i++) {
      const next = s.simulator!.nextEvent(tx);
      if (!next) break;
      tx = await s.transactions.dispatch(tx.id, email, next);
    }
    expect(tx.status).toBe('completed');
    expect(await s.transactions.list(email)).toHaveLength(1);
  });

  it('refuses expired and tampered quotes', async () => {
    const { s, email, dest } = await signedUp();
    const q = await s.quotes.getQuote({ asset: 'BTC', network: 'bitcoin', amountAtomic: 5_000_000n, payoutMethod: 'ach' });
    const refundAddress = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
    const tampered = { ...q, quote: { ...q.quote, netCents: q.quote.netCents + 100_00n } };
    await expect(
      s.transactions.create({ quoteResult: tampered, destinationId: dest.id, refundAddress, customerEmail: email }),
    ).rejects.toThrow(/verification failed/);
    // A self-consistent quote at a forged price is also rejected: the price is looked up independently.
    const forged = calculateQuote({ ...q.quote, referencePriceMicros: q.quote.referencePriceMicros * 5n, now: q.quote.createdAt });
    forged.quote.id = 'forged';
    await expect(
      s.transactions.create({ quoteResult: forged, destinationId: dest.id, refundAddress, customerEmail: email }),
    ).rejects.toThrow(/verification failed/);
    // Client-supplied issues are ignored: an over-limit quote with its issues stripped is refused.
    const big = await s.quotes.getQuote({ asset: 'BTC', network: 'bitcoin', amountAtomic: 100_000_000n, payoutMethod: 'ach' });
    await expect(
      s.transactions.create({ quoteResult: { ...big, issues: [] }, destinationId: dest.id, refundAddress, customerEmail: email }),
    ).rejects.toThrow(/cannot be confirmed/);
    // A quote can be used once.
    await s.transactions.create({ quoteResult: q, destinationId: dest.id, refundAddress, customerEmail: email });
    await expect(s.transactions.create({ quoteResult: q, destinationId: dest.id, refundAddress, customerEmail: email })).rejects.toThrow(
      /already been used/,
    );
    clock += 61_000;
    await expect(s.transactions.create({ quoteResult: q, destinationId: dest.id, refundAddress, customerEmail: email })).rejects.toThrow(
      /expired/,
    );
  });

  it('requires verification and a destination the customer owns', async () => {
    const s = services();
    await s.auth.signUp({ name: 'New User', email: 'new@example.com', password: 'correct-horse-battery' });
    const q = await s.quotes.getQuote({ asset: 'BTC', network: 'bitcoin', amountAtomic: 5_000_000n, payoutMethod: 'ach' });
    const refundAddress = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
    await expect(
      s.transactions.create({ quoteResult: q, destinationId: 'x', refundAddress, customerEmail: 'new@example.com' }),
    ).rejects.toThrow(/Verify your identity/);
    const other = await signedUp(s, 'other@example.com');
    await s.kyc.startVerification('new@example.com', 'verified');
    await expect(
      s.transactions.create({ quoteResult: q, destinationId: other.dest.id, refundAddress, customerEmail: 'new@example.com' }),
    ).rejects.toThrow(/saved payout destination/);
  });

  it('expires unpaid transactions after the deposit window and refunds late deposits', async () => {
    const { s, email, dest } = await signedUp();
    const q = await s.quotes.getQuote({ asset: 'BTC', network: 'bitcoin', amountAtomic: 5_000_000n, payoutMethod: 'ach' });
    const tx = await s.transactions.create({
      quoteResult: q,
      destinationId: dest.id,
      refundAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      customerEmail: email,
    });
    clock = tx.depositDeadline + 1;
    const expired = await s.transactions.get(tx.id, email);
    expect(expired?.status).toBe('expired');
    const late = await s.transactions.dispatch(tx.id, email, {
      type: 'DEPOSIT_DETECTED',
      txHash: 'h',
      amountAtomic: tx.quote.amountAtomic,
    });
    expect(late.status).toBe('refund_pending');
  });

  it('enforces ownership on reads and writes', async () => {
    const { s, email, dest } = await signedUp();
    const q = await s.quotes.getQuote({ asset: 'BTC', network: 'bitcoin', amountAtomic: 5_000_000n, payoutMethod: 'ach' });
    const tx = await s.transactions.create({
      quoteResult: q,
      destinationId: dest.id,
      refundAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      customerEmail: email,
    });
    expect(await s.transactions.get(tx.id, 'someone@else.com')).toBeNull();
    await expect(s.transactions.dispatch(tx.id, 'someone@else.com', { type: 'CUSTOMER_CANCELLED' })).rejects.toThrow(/not found/);
  });

  it('routes flagged refund addresses through compliance review before payout', async () => {
    const { s, email, dest } = await signedUp();
    const q = await s.quotes.getQuote({ asset: 'ETH', network: 'ethereum', amountAtomic: 10n ** 17n, payoutMethod: 'ach' });
    let tx = await s.transactions.create({
      quoteResult: q,
      destinationId: dest.id,
      refundAddress: '0x000000000000000000000000000000000000dEaD',
      customerEmail: email,
    });
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      const next = s.simulator!.nextEvent(tx);
      if (!next) break;
      tx = await s.transactions.dispatch(tx.id, email, next);
      seen.push(tx.status);
    }
    expect(seen).toContain('compliance_review');
    expect(tx.status).toBe('completed');
  });

  it('reports courier delivery as unavailable everywhere', async () => {
    const res = await services().courier.checkAvailability('10001');
    expect(res.available).toBe(false);
  });
});
