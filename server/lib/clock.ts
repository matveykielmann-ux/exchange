import { randomBytes } from 'node:crypto';

/** Injected time source so tests and sandbox scenarios are deterministic. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** A controllable clock for tests and the scenario runner. */
export function fixedClock(start: number): Clock & { advance(ms: number): void; set(ms: number): void } {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
    set: (ms) => {
      t = ms;
    },
  };
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Random identifier from an unambiguous alphabet (no 0/O, 1/I). */
export function randomId(length = 16): string {
  const bytes = randomBytes(length);
  let s = '';
  for (let i = 0; i < length; i++) s += ALPHABET[bytes[i]! % ALPHABET.length];
  return s;
}

/** Prefixed id, e.g. ord_7K2M9Q… */
export const newId = (prefix: string, length = 16) => `${prefix}_${randomId(length).toLowerCase()}`;
