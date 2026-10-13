import { createApp, type App } from '../app';
import { testConfig, type AppConfig } from '../config';
import { fixedClock } from '../lib/clock';
import { silentLogger } from '../logger';

export const T0 = Date.UTC(2026, 0, 15, 15, 0, 0);

/** A sandbox app over an in-memory database with a controllable clock. */
export function testApp(overrides: Partial<AppConfig> = {}, env: Record<string, string> = {}) {
  const clock = fixedClock(T0);
  const app: App = createApp(testConfig(overrides, env), { clock, log: silentLogger });
  return { app, ctx: app.ctx, clock };
}

/** Response bodies in tests are asserted field by field. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;
