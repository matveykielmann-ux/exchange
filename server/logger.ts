/**
 * Structured JSON logging to stdout (one object per line), with redaction of
 * secrets and payout details. Container runtimes and journald collect stdout;
 * see README_DEPLOY.md for rotation.
 */
import type { LogLevel } from './config';

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE =
  /pass(word)?|secret|token|authorization|cookie|api[-_]?key|account[-_]?number|routing|totp|otp|mfa[-_]?code|reset[-_]?code|signature/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack?.split('\n').slice(0, 6).join('\n') };
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? '[redacted]' : redact(v, depth + 1);
    return out;
  }
  return value;
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

export function createLogger(
  level: LogLevel,
  base: Record<string, unknown> = {},
  write: (line: string) => void = (l) => process.stdout.write(l + '\n'),
): Logger {
  const log = (lvl: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (ORDER[lvl] < ORDER[level]) return;
    write(JSON.stringify({ time: new Date().toISOString(), level: lvl, msg, ...(redact({ ...base, ...fields }) as object) }));
  };
  return {
    debug: (m, f) => log('debug', m, f),
    info: (m, f) => log('info', m, f),
    warn: (m, f) => log('warn', m, f),
    error: (m, f) => log('error', m, f),
    child: (fields) => createLogger(level, { ...base, ...fields }, write),
  };
}

export const silentLogger: Logger = createLogger('error', {}, () => {});
