/**
 * Composition root: builds the context, opens and migrates the database,
 * registers routes and returns a request handler plus lifecycle hooks.
 * `main.ts` turns this into a listening server; tests drive it directly.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AppConfig } from './config';
import type { AppContext } from './context';
import { migrate, openDatabase } from './db/database';
import { createRateLimiter } from './http/rateLimit';
import { Router } from './http/router';
import { createStaticHandler, pageHeaders } from './http/static';
import { EventBus } from './lib/bus';
import { systemClock, type Clock } from './lib/clock';
import { createLogger, type Logger } from './logger';
import { createProviders } from './providers/registry';
import { registerRoutes } from './routes';
import { resolveSession, SESSION_COOKIE } from './services/auth';
import { touchSeedWalletTimestamps } from './services/credentials';
import { expireOverdueOrders } from './services/orders';
import { sandboxAutopilotTick } from './services/sandbox';

export interface App {
  ctx: AppContext;
  router: Router;
  handle(req: IncomingMessage, res: ServerResponse): void;
  /** Runs periodic jobs once (deposit-window expiry, session cleanup). */
  runJobs(): void;
  listen(): Promise<Server>;
  close(): Promise<void>;
}

export function createApp(config: AppConfig, opts: { clock?: Clock; log?: Logger } = {}): App {
  const clock = opts.clock ?? systemClock;
  const log = opts.log ?? createLogger(config.logLevel, { service: 'arcvale', mode: config.mode });
  const db = openDatabase(config.databasePath);
  const ran = migrate(db, config.mode, clock.now());
  if (ran.length) log.info('migrations applied', { ids: ran });

  const ctx: AppContext = {
    config,
    db,
    clock,
    log,
    providers: createProviders(config, log, () => clock.now()),
    bus: new EventBus(),
    limiter: createRateLimiter(() => clock.now()),
  };
  touchSeedWalletTimestamps(ctx);
  for (const w of config.warnings) log.warn('configuration warning', { warning: w });

  const router = new Router({
    log,
    publicOrigin: config.publicOrigin,
    trustProxy: config.trustProxy,
    requireStaffMfa: config.requireStaffMfa,
    limiter: ctx.limiter,
    resolveAuth: (token) => resolveSession(ctx, token),
    sessionCookieName: SESSION_COOKIE,
  });
  registerRoutes(router, ctx);

  const https = config.publicOrigin.startsWith('https://');
  const serveStatic = config.staticDir ? createStaticHandler(config.staticDir, https) : null;

  const handle = (req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url ?? '/').split('?')[0]!;
    if (path === '/api' || path.startsWith('/api/')) {
      void router.handle(req, res);
      return;
    }
    if (serveStatic) {
      serveStatic(req, res);
      return;
    }
    res.writeHead(404, { ...pageHeaders(https), 'Content-Type': 'text/plain' }).end('Not found');
  };

  const runJobs = () => {
    try {
      const expired = expireOverdueOrders(ctx);
      if (expired) log.info('expired overdue orders', { count: expired });
      const now = clock.now();
      db.run('DELETE FROM sessions WHERE expires_at <= ?', [now]);
      db.run('DELETE FROM login_challenges WHERE expires_at <= ?', [now]);
      db.run('DELETE FROM idempotency_keys WHERE expires_at <= ?', [now]);
    } catch (e) {
      log.error('background job failed', { err: e });
    }
  };

  const runAutopilot = () => {
    try {
      sandboxAutopilotTick(ctx);
    } catch (e) {
      log.error('sandbox autopilot failed', { err: e });
    }
  };

  let server: Server | null = null;
  let timer: NodeJS.Timeout | null = null;
  let autopilot: NodeJS.Timeout | null = null;
  const sockets = new Set<import('node:net').Socket>();

  return {
    ctx,
    router,
    handle,
    runJobs,
    listen() {
      return new Promise((resolve, reject) => {
        server = createServer(handle);
        server.headersTimeout = 20_000;
        server.requestTimeout = 30_000;
        server.keepAliveTimeout = 5_000;
        server.on('connection', (s) => {
          sockets.add(s);
          s.on('close', () => sockets.delete(s));
        });
        server.once('error', reject);
        server.listen(config.port, config.host, () => {
          timer = setInterval(runJobs, 30_000);
          timer.unref();
          if (config.mode === 'sandbox' && config.sandbox.autopilotStepMs) {
            autopilot = setInterval(runAutopilot, Math.min(1000, config.sandbox.autopilotStepMs));
            autopilot.unref();
          }
          runJobs();
          log.info('listening', { host: config.host, port: config.port, origin: config.publicOrigin });
          resolve(server!);
        });
      });
    },
    async close() {
      if (timer) clearInterval(timer);
      if (autopilot) clearInterval(autopilot);
      if (server) {
        const s = server;
        server = null;
        await new Promise<void>((resolve) => {
          s.close(() => resolve());
          // Idle keep-alive and SSE connections would hold the server open.
          s.closeIdleConnections();
          setTimeout(() => {
            for (const sock of sockets) sock.destroy();
          }, 5_000).unref();
        });
      }
      db.close();
    },
  };
}
