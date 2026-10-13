/**
 * Minimal runtime validation for request bodies and query strings. Every
 * handler validates its input with these before touching business logic;
 * unknown fields are dropped.
 */
import { badRequest } from './errors';

export type Validator<T> = (value: unknown, path: string) => T;
export type Infer<V> = V extends Validator<infer T> ? T : never;

const fail = (path: string, message: string): never => {
  throw badRequest(message, { field: path });
};

export const v = {
  string(opts: { min?: number; max?: number; pattern?: RegExp; trim?: boolean; label?: string } = {}): Validator<string> {
    const { min = 1, max = 500, pattern, trim = true, label } = opts;
    return (value, path) => {
      if (typeof value !== 'string') return fail(path, `${label ?? path} must be text.`);
      const s = trim ? value.trim() : value;
      if (s.length < min) return fail(path, min <= 1 ? `Enter ${label ?? path}.` : `${label ?? path} must be at least ${min} characters.`);
      if (s.length > max) return fail(path, `${label ?? path} must be at most ${max} characters.`);
      if (pattern && !pattern.test(s)) return fail(path, `${label ?? path} is not in the expected format.`);
      return s;
    };
  },
  enum<const T extends string>(values: readonly T[], label?: string): Validator<T> {
    return (value, path) =>
      typeof value === 'string' && (values as readonly string[]).includes(value)
        ? (value as T)
        : fail(path, `${label ?? path} must be one of ${values.join(', ')}.`);
  },
  int(opts: { min?: number; max?: number } = {}): Validator<number> {
    const { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = opts;
    return (value, path) => {
      const n = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
      if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max)
        return fail(path, `${path} must be a whole number between ${min} and ${max}.`);
      return n;
    };
  },
  /** A non-negative integer amount sent as a decimal string, e.g. "1250000". */
  bigintString(opts: { max?: bigint } = {}): Validator<bigint> {
    return (value, path) => {
      if (typeof value !== 'string' || !/^\d{1,40}$/.test(value)) return fail(path, `${path} must be a whole-number string.`);
      const b = BigInt(value);
      if (opts.max !== undefined && b > opts.max) return fail(path, `${path} is too large.`);
      return b;
    };
  },
  bool(): Validator<boolean> {
    return (value, path) =>
      typeof value === 'boolean'
        ? value
        : value === 'true'
          ? true
          : value === 'false'
            ? false
            : fail(path, `${path} must be true or false.`);
  },
  literal<const T>(expected: T): Validator<T> {
    return (value, path) => (value === expected ? expected : fail(path, `${path} must be ${String(expected)}.`));
  },
  optional<T>(inner: Validator<T>): Validator<T | undefined> {
    return (value, path) => (value === undefined || value === null || value === '' ? undefined : inner(value, path));
  },
  nullable<T>(inner: Validator<T>): Validator<T | null> {
    return (value, path) => (value === null || value === undefined || value === '' ? null : inner(value, path));
  },
  array<T>(inner: Validator<T>, opts: { max?: number } = {}): Validator<T[]> {
    return (value, path) => {
      if (!Array.isArray(value)) return fail(path, `${path} must be a list.`);
      if (value.length > (opts.max ?? 100)) return fail(path, `${path} has too many items.`);
      return value.map((x, i) => inner(x, `${path}[${i}]`));
    };
  },
  object<S extends Record<string, Validator<unknown>>>(shape: S): Validator<{ [K in keyof S]: Infer<S[K]> }> {
    return (value, path) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path || 'body', 'Expected a JSON object.');
      const out: Record<string, unknown> = {};
      for (const [k, validator] of Object.entries(shape))
        out[k] = validator((value as Record<string, unknown>)[k], path ? `${path}.${k}` : k);
      return out as { [K in keyof S]: Infer<S[K]> };
    };
  },
};

export function parse<T>(validator: Validator<T>, value: unknown): T {
  return validator(value, '');
}

export function queryObject(q: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of q) out[k] = val;
  return out;
}
