/**
 * JSON-over-HTTPS client for production provider adapters: per-request
 * timeout, bounded retries with exponential backoff for retryable failures
 * (network errors, 408/429/5xx), an Idempotency-Key on every write so a retry
 * can't execute twice, and structured logs without secrets or bodies.
 */
import type { Logger } from '../logger';
import { ProviderError, type ProviderKey } from './types';

export interface HttpClientOptions {
  provider: ProviderKey;
  baseUrl: string;
  apiKey: string;
  log: Logger;
  timeoutMs?: number;
  maxAttempts?: number;
  /** Base backoff; attempt n waits base * 2^(n-1). */
  backoffMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface HttpClient {
  request<T>(method: 'GET' | 'POST', path: string, opts?: { body?: unknown; idempotencyKey?: string }): Promise<T>;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function createHttpClient(o: HttpClientOptions): HttpClient {
  const timeoutMs = o.timeoutMs ?? 10_000;
  const maxAttempts = Math.min(o.maxAttempts ?? 3, 5);
  const backoffMs = o.backoffMs ?? 300;
  const doFetch = o.fetchImpl ?? fetch;
  const sleep = o.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  return {
    async request<T>(method: 'GET' | 'POST', path: string, opts: { body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
      if (method !== 'GET' && !opts.idempotencyKey) throw new Error('Writes to providers require an idempotency key.');
      const url = new URL(path, o.baseUrl.endsWith('/') ? o.baseUrl : o.baseUrl + '/');
      let lastError: ProviderError | null = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const started = Date.now();
        try {
          const res = await doFetch(url, {
            method,
            headers: {
              Authorization: `Bearer ${o.apiKey}`,
              Accept: 'application/json',
              ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
              ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
            },
            body: opts.body !== undefined ? JSON.stringify(opts.body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)) : undefined,
            signal: AbortSignal.timeout(timeoutMs),
            redirect: 'error',
          });
          o.log.info('provider request', {
            provider: o.provider,
            method,
            path: url.pathname,
            status: res.status,
            attempt,
            ms: Date.now() - started,
          });
          if (res.ok) return (await res.json()) as T;
          const retryable = RETRYABLE_STATUS.has(res.status);
          lastError = new ProviderError(o.provider, `Provider responded ${res.status}.`, retryable, res.status);
          if (!retryable) throw lastError;
        } catch (e) {
          if (e instanceof ProviderError && !e.retryable) throw e;
          if (!(e instanceof ProviderError)) {
            const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
            lastError = new ProviderError(o.provider, timeout ? 'Provider request timed out.' : 'Provider could not be reached.', true);
            o.log.warn('provider request failed', { provider: o.provider, method, path: url.pathname, attempt, error: lastError.message });
          }
        }
        if (attempt < maxAttempts) await sleep(backoffMs * 2 ** (attempt - 1));
      }
      throw lastError ?? new ProviderError(o.provider, 'Provider request failed.', true);
    },
  };
}
