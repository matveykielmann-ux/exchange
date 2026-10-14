/**
 * Thin fetch wrapper for the exchange API: same-origin cookies, JSON bodies,
 * the per-session CSRF token on every state-changing request, and typed
 * errors that carry the server's code and message. The browser never decides
 * whether something succeeded; it reports what the server said.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get field(): string | undefined {
    const f = this.details?.field;
    return typeof f === 'string' ? f : undefined;
  }
}

export interface HttpOptions {
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface Http {
  get<T>(path: string, opts?: HttpOptions): Promise<T>;
  post<T>(path: string, body?: unknown, opts?: HttpOptions): Promise<T>;
  put<T>(path: string, body?: unknown, opts?: HttpOptions): Promise<T>;
  delete<T>(path: string, opts?: HttpOptions): Promise<T>;
  setCsrf(token: string | null): void;
  /** Called when the server reports the session is gone (401 on an authenticated call). */
  onUnauthenticated(listener: () => void): void;
}

export function createHttp(base = ''): Http {
  let csrf: string | null = null;
  const unauthListeners = new Set<() => void>();

  async function request<T>(method: string, path: string, body: unknown, opts: HttpOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && csrf) headers['X-CSRF-Token'] = csrf;
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    let res: Response;
    try {
      res = await fetch(base + path, {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
        signal: opts.signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      throw new ApiError(0, 'network', 'We could not reach the server. Check your connection and try again.');
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string; details?: Record<string, unknown>; requestId?: string } } | null)
        ?.error;
      if (res.status === 401) unauthListeners.forEach((l) => l());
      throw new ApiError(
        res.status,
        err?.code ?? 'http_error',
        err?.message ?? (res.status >= 500 ? 'Something went wrong on our side. Try again.' : 'The request could not be completed.'),
        err?.details,
        err?.requestId,
      );
    }
    return data as T;
  }

  return {
    get: (p, o) => request('GET', p, undefined, o),
    post: (p, b = {}, o) => request('POST', p, b, o),
    put: (p, b = {}, o) => request('PUT', p, b, o),
    delete: (p, o) => request('DELETE', p, undefined, o),
    setCsrf: (t) => {
      csrf = t;
    },
    onUnauthenticated: (l) => {
      unauthListeners.add(l);
    },
  };
}

/** Random id for idempotency keys and optimistic chat messages. */
export function clientId(prefix = 'c'): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
