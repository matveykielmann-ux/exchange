/** Shared helpers for mock adapters. */

export interface MockOptions {
  /** Artificial latency so loading states are exercised. 0 in tests. */
  latencyMs: number;
  now: () => number;
  random: () => number;
}

export function delay<T>(opts: MockOptions, value: T | (() => T)): Promise<T> {
  const resolve = () => (typeof value === 'function' ? (value as () => T)() : value);
  if (opts.latencyMs <= 0) return Promise.resolve().then(resolve);
  return new Promise((res, rej) =>
    setTimeout(() => {
      try {
        res(resolve());
      } catch (e) {
        rej(e);
      }
    }, opts.latencyMs),
  );
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function mockId(opts: MockOptions, length = 8): string {
  let s = '';
  for (let i = 0; i < length; i++) s += ALPHABET[Math.floor(opts.random() * ALPHABET.length)];
  return s;
}

export class MockServiceError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'MockServiceError';
  }
}
