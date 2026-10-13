import type { CourierProvider } from '../types';
import { delay, type MockOptions } from './util';

/** Courier cash delivery is not offered anywhere. This adapter always says so. */
export function createMockCourier(opts: MockOptions): CourierProvider {
  return {
    checkAvailability() {
      return delay(opts, {
        available: false as const,
        reason:
          'Cash delivery is not offered in any area. It stays disabled until licensing, cash-reporting, insurance and carrier requirements are verified.',
        source: 'mock' as const,
      });
    },
  };
}
