import type { Services } from '../types';
import { createMockAuth } from './auth';
import { createMockCourier } from './courier';
import { createMockDeposits } from './deposits';
import { createMockKyc } from './kyc';
import { createMockLargeDesk } from './largeDesk';
import { createMockPayouts } from './payouts';
import { createMockPricing } from './pricing';
import { createMockQuotes } from './quotes';
import { createMockScreening } from './screening';
import { createMockTransactions } from './transactions';
import type { MockOptions } from './util';

export function createMockServices(overrides: Partial<MockOptions> = {}): Services {
  const opts: MockOptions = { latencyMs: 350, now: () => Date.now(), random: Math.random, ...overrides };
  const pricing = createMockPricing(opts);
  const auth = createMockAuth(opts);
  const deposits = createMockDeposits(opts);
  const screening = createMockScreening(opts);
  return {
    mode: 'mock',
    pricing,
    quotes: createMockQuotes(pricing, opts),
    auth,
    kyc: createMockKyc(opts, (email, level) => auth.setVerification(email, level)),
    screening,
    payouts: createMockPayouts(opts),
    deposits,
    transactions: createMockTransactions(opts, { deposits, screening }),
    largeDesk: createMockLargeDesk(opts),
    courier: createMockCourier(opts),
  };
}
