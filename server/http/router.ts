/**
 * A small HTTP router over node:http. Each route declares who may call it
 * (`auth`, `roles`), whether it changes state (CSRF and Origin checks apply
 * to every unsafe method), and an optional rate limit. Responses are JSON with
 * bigint values serialized as decimal strings.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Logger } from '../logger';
import { ApiError, badRequest, forbidden, unauthenticated } from './errors';
import type { RateLimiter } from './rateLimit';

export type Role = 'customer' | 'support' | 'reviewer' | 'admin' | 'owner';
export const STAFF_ROLES: readonly Role[] = ['support', 'reviewer', 'admin', 'owner'];

export interface AuthContext {
  userId: string;
  email: string;
  role: Role;
  sessionId: string;
  csrfToken: string;
  mfaVerified: boolean;
  totpEnabled: boolean;
}

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  url: URL;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  ip: string;
  userAgent: string | null;
  requestId: string;
  cookies: Record<string, string>;
  auth: AuthContext | null;
  log: Logger;
  /** Parsed JSON body (validated by the handler). */
  body: unknown;
  /** Raw body bytes, for webhook signature verification. */
  rawBody: Buffer;
  setCookie(cookie: string): void;
}

export interface Reply {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Returned by handlers that wrote the response themselves (e.g. server-sent events). */
export const HANDLED = Symbol('handled');

export type Handler = (ctx: Ctx) => Promise<Reply | typeof HANDLED> | Reply | typeof HANDLED;

export interface RouteOptions {
  /** 'public': anyone; 'user': any signed-in user; 'staff': any staff role. Defaults to 'public'. */
  auth?: 'public' | 'user' | 'staff';
  /** Further restricts to these roles (owner always passes). */
  roles?: readonly Role[];
  /** Skip CSRF/Origin checks: only for provider webhooks, which are authenticated by signature. */
  csrfExempt?: boolean;
  rateLimit?: { bucket: string; max: number; windowMs: number; key?: (ctx: Ctx) => string };
  maxBodyBytes?: number;
}

interface Route extends RouteOptions {
  method: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
}

export interface RouterDeps {
  log: Logger;
  publicOrigin: string;
  trustProxy: boolean;
  requireStaffMfa: boolean;
  limiter: RateLimiter;
  /** Resolves the session cookie to an auth context (and touches the session). */
  resolveAuth(token: string | undefined, ctx: Pick<Ctx, 'ip' | 'userAgent'>): AuthContext | null;
  sessionCookieName: string;
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function jsonStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || k in out) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* malformed cookie value */
    }
  }
  return out;
}

function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const fwd = req.headers['x-forwarded-for'];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new ApiError(413, 'payload_too_large', 'Request body is too large.');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const API_SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};

export class Router {
  private routes: Route[] = [];
  constructor(private deps: RouterDeps) {}

  add(method: string, pattern: string, handler: Handler, options: RouteOptions = {}): void {
    const keys: string[] = [];
    const regex = new RegExp(
      '^' +
        pattern.replace(/\/:([a-zA-Z]+)/g, (_m, k: string) => {
          keys.push(k);
          return '/([^/]+)';
        }) +
        '$',
    );
    this.routes.push({ method, regex, keys, handler, ...options });
  }

  get = (p: string, h: Handler, o?: RouteOptions) => this.add('GET', p, h, o);
  post = (p: string, h: Handler, o?: RouteOptions) => this.add('POST', p, h, o);
  put = (p: string, h: Handler, o?: RouteOptions) => this.add('PUT', p, h, o);
  delete = (p: string, h: Handler, o?: RouteOptions) => this.add('DELETE', p, h, o);

  /** Returns true when the request matched an /api route (handled or errored). */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = performance.now();
    const requestId =
      typeof req.headers['x-request-id'] === 'string' && /^[\w-]{8,64}$/.test(req.headers['x-request-id'])
        ? req.headers['x-request-id']
        : randomUUID();
    const url = new URL(req.url ?? '/', 'http://internal');
    const method = (req.method ?? 'GET').toUpperCase();
    const ip = clientIp(req, this.deps.trustProxy);
    const log = this.deps.log.child({ requestId });
    const setCookies: string[] = [];
    const ctx: Ctx = {
      req,
      res,
      method,
      url,
      path: url.pathname,
      params: {},
      query: url.searchParams,
      ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 256) : null,
      requestId,
      cookies: parseCookies(req.headers.cookie),
      auth: null,
      log,
      body: undefined,
      rawBody: Buffer.alloc(0),
      setCookie: (c) => setCookies.push(c),
    };

    let status = 500;
    try {
      const candidates = this.routes.filter((r) => r.regex.test(ctx.path));
      const route = candidates.find((r) => r.method === method || (method === 'HEAD' && r.method === 'GET'));
      if (!route) {
        if (candidates.length) throw new ApiError(405, 'method_not_allowed', 'Method not allowed.');
        throw new ApiError(404, 'not_found', 'No such endpoint.');
      }
      const m = route.regex.exec(ctx.path)!;
      route.keys.forEach((k, i) => {
        ctx.params[k] = decodeURIComponent(m[i + 1]!);
      });

      if (route.rateLimit) {
        const rl = route.rateLimit;
        const key = `${rl.bucket}:${rl.key ? rl.key(ctx) : ip}`;
        if (!this.deps.limiter.take(key, rl.max, rl.windowMs))
          throw new ApiError(429, 'rate_limited', 'Too many requests. Wait a moment and try again.');
      }
      if (!this.deps.limiter.take(`global:${ip}`, 600, 60_000))
        throw new ApiError(429, 'rate_limited', 'Too many requests. Wait a moment and try again.');

      ctx.auth = this.deps.resolveAuth(ctx.cookies[this.deps.sessionCookieName], ctx);

      if (UNSAFE.has(method) && !route.csrfExempt) this.checkCsrf(ctx);

      const auth = route.auth ?? 'public';
      if (auth !== 'public') {
        if (!ctx.auth) throw unauthenticated();
        if (auth === 'staff') {
          if (!STAFF_ROLES.includes(ctx.auth.role)) throw forbidden();
          if (this.deps.requireStaffMfa && !ctx.auth.mfaVerified)
            throw new ApiError(403, 'mfa_required', 'Staff accounts must sign in with an authenticator code.');
        }
        if (route.roles && ctx.auth.role !== 'owner' && !route.roles.includes(ctx.auth.role)) throw forbidden();
      }

      if (UNSAFE.has(method)) {
        ctx.rawBody = await readBody(req, route.maxBodyBytes ?? 64 * 1024);
        if (ctx.rawBody.length) {
          const type = req.headers['content-type'] ?? '';
          if (!type.startsWith('application/json')) throw new ApiError(415, 'unsupported_media_type', 'Send JSON.');
          try {
            ctx.body = JSON.parse(ctx.rawBody.toString('utf8'));
          } catch {
            throw badRequest('Malformed JSON.');
          }
        } else ctx.body = {};
      }

      const out = await route.handler(ctx);
      if (out === HANDLED) {
        status = res.statusCode;
        return;
      }
      status = out.status ?? 200;
      this.send(res, status, out.body ?? null, { ...out.headers }, setCookies, method === 'HEAD');
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : e && typeof e === 'object' && 'code' in e && (e as { code: unknown }).code === 'invalid_transition'
            ? new ApiError(409, 'invalid_transition', (e as unknown as Error).message)
            : null;
      if (err) {
        status = err.status;
        this.send(
          res,
          err.status,
          { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}), requestId } },
          {},
          setCookies,
          false,
        );
      } else {
        status = 500;
        log.error('unhandled error', { err: e, path: ctx.path, method });
        this.send(
          res,
          500,
          { error: { code: 'internal', message: 'Something went wrong on our side. Try again.', requestId } },
          {},
          [],
          false,
        );
      }
    } finally {
      log.info('request', {
        method,
        path: ctx.path,
        status,
        ms: Math.round(performance.now() - started),
        ip,
        userId: ctx.auth?.userId ?? null,
      });
    }
  }

  private checkCsrf(ctx: Ctx) {
    const origin = ctx.req.headers.origin;
    const referer = ctx.req.headers.referer;
    const sourceOrigin = origin ?? (referer ? safeOrigin(referer) : null);
    if (sourceOrigin !== this.deps.publicOrigin) throw new ApiError(403, 'csrf_failed', 'Request origin not allowed.');
    if (ctx.auth) {
      const header = ctx.req.headers['x-csrf-token'];
      if (typeof header !== 'string' || !timingSafeEqualStr(header, ctx.auth.csrfToken))
        throw new ApiError(403, 'csrf_failed', 'Your session token is missing or out of date. Reload the page and try again.');
    }
  }

  private send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string>, cookies: string[], head: boolean) {
    if (res.headersSent) return;
    const payload = body === null && status === 204 ? '' : jsonStringify(body);
    res.writeHead(status, {
      ...API_SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      ...(cookies.length ? { 'Set-Cookie': cookies } : {}),
      ...headers,
    });
    res.end(head ? undefined : payload);
  }
}

function safeOrigin(u: string): string | null {
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
}
