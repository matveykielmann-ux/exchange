import { calculateQuote } from '@/domain/quote';
import type { PricingProvider, QuoteService } from '../types';
import type { MockOptions } from './util';

export function createMockQuotes(pricing: PricingProvider, opts: MockOptions): QuoteService {
  return {
    async getQuote(input) {
      const price = await pricing.getReferencePrice(input.asset);
      const result = calculateQuote({ ...input, referencePriceMicros: price.priceMicros, now: opts.now() });
      return { ...result, price };
    },
  };
}
