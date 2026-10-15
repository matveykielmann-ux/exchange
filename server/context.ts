import type { AppConfig } from './config';
import type { Db } from './db/database';
import type { RateLimiter } from './http/rateLimit';
import type { EventBus } from './lib/bus';
import type { Clock } from './lib/clock';
import type { Logger } from './logger';
import type { Providers } from './providers/types';

/** Everything a service needs. Built once in app.ts; tests build their own with a fixed clock and in-memory database. */
export interface AppContext {
  config: AppConfig;
  db: Db;
  clock: Clock;
  log: Logger;
  providers: Providers;
  bus: EventBus;
  limiter: RateLimiter;
}

/** Who is acting, for authorization, the order state machine and the audit trail. */
export interface Actor {
  type: 'customer' | 'operator' | 'provider' | 'system' | 'sandbox';
  id: string | null;
  role: string | null;
  ip: string | null;
}

export const SYSTEM: Actor = { type: 'system', id: null, role: null, ip: null };
