import { readStore, writeStore } from '@/lib/storage';
import type { LargeTransactionDesk, LargeTransactionRequest } from '../types';
import { delay, mockId, type MockOptions } from './util';

const KEY = 'large-requests';

/** Records the request locally. No one is notified — there is no desk yet. */
export function createMockLargeDesk(opts: MockOptions): LargeTransactionDesk {
  return {
    submit(request: LargeTransactionRequest) {
      return delay(opts, () => {
        const reference = `LTD-MOCK-${mockId(opts, 6)}`;
        const list = readStore<Array<LargeTransactionRequest & { reference: string; at: number }>>(KEY, []);
        writeStore(KEY, [{ ...request, reference, at: opts.now() }, ...list]);
        return { reference, source: 'mock' as const };
      });
    },
  };
}
