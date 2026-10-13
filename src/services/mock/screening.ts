/**
 * Simulated sanctions / blockchain-risk screening. Addresses containing
 * "dead" (case-insensitive) return "review" so the held-for-review path can be
 * demonstrated. A production adapter calls a blockchain analytics provider.
 */
import type { ScreeningProvider } from '../types';
import { delay, type MockOptions } from './util';

export function createMockScreening(opts: MockOptions): ScreeningProvider {
  return {
    screenAddress(_network, address) {
      return delay(opts, () =>
        /dead/i.test(address)
          ? { result: 'review' as const, source: 'mock' as const, note: 'Simulated: address flagged for manual review.' }
          : { result: 'clear' as const, source: 'mock' as const, note: 'Simulated: no matches.' },
      );
    },
  };
}
