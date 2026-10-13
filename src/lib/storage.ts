/**
 * Browser storage with bigint-safe JSON. Used only by mock adapters to keep the
 * preview's simulated data on this device. Every access is wrapped because
 * storage can be unavailable (private mode, blocked site data).
 */

const PREFIX = 'settlewell.mock.v1.';

function replacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? { $bigint: value.toString() } : value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && '$bigint' in value) {
    const raw = (value as { $bigint: unknown }).$bigint;
    if (typeof raw === 'string' && /^-?\d+$/.test(raw)) return BigInt(raw);
  }
  return value;
}

export function serialize(value: unknown): string {
  return JSON.stringify(value, replacer);
}

export function deserialize<T>(raw: string): T {
  return JSON.parse(raw, reviver) as T;
}

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? deserialize<T>(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStore(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, serialize(value));
  } catch {
    // Storage unavailable — the preview keeps working in memory for this visit.
  }
}

export function removeStore(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
