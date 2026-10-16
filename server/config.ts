/**
 * Environment schema and validation. The server refuses to start with an
 * invalid or unsafe configuration (fail closed). Provider credentials are
 * optional: a provider without them reports NOT_CONFIGURED instead of
 * silently doing something else.
 */
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

export type AppMode = 'sandbox' | 'production';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ProviderCredentials {
  url: string;
  apiKey: string;
  webhookSecret: string | null;
}

export interface AppConfig {
  mode: AppMode;
  nodeEnv: string;
  host: string;
  port: number;
  /** Customer site origin (https://YOUR_DOMAIN). Cookies are host-only for this origin. */
  publicOrigin: string;
  /**
   * CRM origin (https://crm.YOUR_DOMAIN). When set, the SPA serves the admin
   * workspace only on this host; CSRF also accepts this origin. Empty in single-host
   * local/dev mode (customer + /admin on PUBLIC_ORIGIN).
   */
  crmOrigin: string | null;
  /** Origins allowed for unsafe browser requests (CSRF). Always includes publicOrigin; crmOrigin when set. */
  allowedOrigins: string[];
  databasePath: string;
  /**
   * Persistent directory for encrypted order attachments (not served statically).
   * Defaults to `<dir-of-DATABASE_PATH>/files`, or a temp dir when the DB is `:memory:`.
   */
  filesDir: string;
  sessionSecret: string;
  /** 32-byte key for AES-256-GCM encryption of payout details, TOTP secrets and file blobs. */
  dataEncryptionKey: Buffer;
  trustProxy: boolean;
  logLevel: LogLevel;
  staticDir: string | null;
  requireStaffMfa: boolean;
  /** Orders at or above this gross USD value always go to compliance review (cents). Policy placeholder. */
  manualReviewThresholdCents: bigint;
  sessionTtlMs: number;
  sandbox: {
    /** USD micros per whole unit; null = deterministic drifting defaults. */
    rates: Partial<Record<'BTC' | 'ETH' | 'USDT' | 'USDC' | 'XRP' | 'SOL' | 'BNB', bigint>>;
    confirmations: Partial<Record<string, number>>;
    webhookSecret: string;
    /** Return sign-in and reset codes in API responses so QA can run without an inbox. Sandbox only. */
    exposeCodes: boolean;
    /**
     * Demo autopilot: once a customer submits a transaction hash (sell) or the ID for a cash handover (buy),
     * the sandbox simulators move the order one step every this many milliseconds. 0 turns it off.
     */
    autopilotStepMs: number;
  };
  providers: {
    rates: ProviderCredentials | null;
    custody: ProviderCredentials | null;
    identity: ProviderCredentials | null;
    screening: ProviderCredentials | null;
    bankPayout: ProviderCredentials | null;
    cardPayout: ProviderCredentials | null;
    cash: ProviderCredentials | null;
    email: (ProviderCredentials & { from: string }) | null;
  };
  /**
   * RATES_SOURCE=coingecko (default when no RATES_PROVIDER_*): reference prices from CoinGecko in either mode.
   * instead of the sandbox schedule or RATES_PROVIDER. null = not used.
   */
  coingecko: { apiKey: string | null; plan: 'demo' | 'pro'; cacheMs: number } | null;
  /** Non-fatal configuration warnings, logged at startup and shown on the admin system page. */
  warnings: string[];
}

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
  }
}

const SANDBOX_DEFAULT_SECRET = 'sandbox-only-insecure-session-secret-0000000000';
const SANDBOX_DEFAULT_KEY = Buffer.alloc(32, 7);

type Env = Record<string, string | undefined>;

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === '') return fallback;
  if (/^(1|true|yes|on)$/i.test(v)) return true;
  if (/^(0|false|no|off)$/i.test(v)) return false;
  throw new ConfigError([`Expected a boolean, got "${v}"`]);
}

function parseUsdToMicros(raw: string): bigint | null {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(raw.trim());
  if (!m) return null;
  return BigInt(m[1]!) * 1_000_000n + BigInt((m[2] ?? '').padEnd(6, '0'));
}

function provider(env: Env, prefix: string, problems: string[], { webhook }: { webhook: boolean }): ProviderCredentials | null {
  const url = env[`${prefix}_URL`]?.trim();
  const apiKey = env[`${prefix}_API_KEY`]?.trim();
  const webhookSecret = env[`${prefix}_WEBHOOK_SECRET`]?.trim() || null;
  if (!url && !apiKey) return null;
  if (!url || !apiKey) {
    problems.push(`${prefix}_URL and ${prefix}_API_KEY must be set together.`);
    return null;
  }
  if (!/^https:\/\//.test(url)) problems.push(`${prefix}_URL must use https.`);
  if (webhook && !webhookSecret) problems.push(`${prefix}_WEBHOOK_SECRET is required when ${prefix} is configured.`);
  if (webhookSecret && webhookSecret.length < 32) problems.push(`${prefix}_WEBHOOK_SECRET must be at least 32 characters.`);
  return { url, apiKey, webhookSecret };
}

export function loadConfig(env: Env = process.env): AppConfig {
  const problems: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = env.NODE_ENV ?? 'development';

  const rawMode = env.APP_MODE?.trim();
  if (!rawMode && nodeEnv === 'production') problems.push('APP_MODE must be set explicitly when NODE_ENV=production.');
  const mode = (rawMode || 'sandbox') as AppMode;
  if (mode !== 'sandbox' && mode !== 'production') problems.push(`APP_MODE must be "sandbox" or "production", got "${rawMode}".`);
  const production = mode === 'production';

  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push('PORT must be an integer between 1 and 65535.');

  const publicOrigin = (env.PUBLIC_ORIGIN ?? `http://localhost:${env.WEB_PORT ?? 5173}`).replace(/\/$/, '');
  if (!/^https?:\/\/[^/]+$/.test(publicOrigin)) problems.push('PUBLIC_ORIGIN must be an origin like https://example.com (no path).');
  if (production && !publicOrigin.startsWith('https://')) problems.push('PUBLIC_ORIGIN must use https in production.');

  const rawCrmOrigin = (env.CRM_ORIGIN ?? '').trim().replace(/\/$/, '');
  let crmOrigin: string | null = null;
  if (rawCrmOrigin) {
    if (!/^https?:\/\/[^/]+$/.test(rawCrmOrigin)) problems.push('CRM_ORIGIN must be an origin like https://crm.example.com (no path).');
    else if (rawCrmOrigin === publicOrigin) problems.push('CRM_ORIGIN must differ from PUBLIC_ORIGIN.');
    else {
      crmOrigin = rawCrmOrigin;
      if (production && !crmOrigin.startsWith('https://')) problems.push('CRM_ORIGIN must use https in production.');
    }
  } else if (production) {
    problems.push('CRM_ORIGIN is required in production (e.g. https://crm.example.com).');
  }

  const allowedOrigins = [publicOrigin, ...(crmOrigin ? [crmOrigin] : [])];

  let sessionSecret = env.SESSION_SECRET ?? '';
  if (!sessionSecret) {
    if (production) problems.push('SESSION_SECRET is required in production.');
    else {
      sessionSecret = SANDBOX_DEFAULT_SECRET;
      warnings.push('SESSION_SECRET is not set; using an insecure sandbox default.');
    }
  } else if (sessionSecret.length < 32) problems.push('SESSION_SECRET must be at least 32 characters.');
  if (production && sessionSecret === SANDBOX_DEFAULT_SECRET)
    problems.push('SESSION_SECRET must not be the sandbox default in production.');

  let dataEncryptionKey = SANDBOX_DEFAULT_KEY;
  if (env.DATA_ENCRYPTION_KEY) {
    const key = Buffer.from(env.DATA_ENCRYPTION_KEY, 'base64');
    if (key.length !== 32) problems.push('DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).');
    else dataEncryptionKey = key;
  } else if (production) problems.push('DATA_ENCRYPTION_KEY is required in production.');
  else warnings.push('DATA_ENCRYPTION_KEY is not set; using an insecure sandbox default key.');
  if (production && dataEncryptionKey.equals(SANDBOX_DEFAULT_KEY))
    problems.push('DATA_ENCRYPTION_KEY must not be the sandbox default in production.');

  const databasePath =
    env.DATABASE_PATH === ':memory:'
      ? ':memory:'
      : path.resolve(env.DATABASE_PATH ?? `./data/arcvale-${production ? 'production' : 'sandbox'}.db`);
  if (production && databasePath === ':memory:') problems.push('An in-memory database is not allowed in production.');
  if (!production && /production/i.test(path.basename(databasePath)))
    problems.push('A sandbox server must not open a database file named for production.');

  const defaultFilesDir =
    databasePath === ':memory:'
      ? path.join(tmpdir(), 'arcvale-files-memory')
      : path.join(path.dirname(databasePath), 'files');
  const filesDirExplicit = !!(env.FILES_DIR && env.FILES_DIR.trim());
  const filesDir = path.resolve(filesDirExplicit ? env.FILES_DIR!.trim() : defaultFilesDir);
  // Reject an explicitly configured temp path in production (defaults next to DATABASE_PATH are fine for tests).
  const tmpRoot = path.resolve(tmpdir());
  if (
    production &&
    filesDirExplicit &&
    (filesDir === tmpRoot || filesDir.startsWith(tmpRoot + path.sep) || filesDir === '/tmp' || filesDir.startsWith('/tmp/'))
  )
    problems.push('FILES_DIR must be a persistent path in production (not a temporary directory).');
  // Keep uploads on the data volume: refuse paths that look like the build output.
  if (/[/\\]dist([/\\]|$)/.test(filesDir) || /[/\\]node_modules([/\\]|$)/.test(filesDir))
    problems.push('FILES_DIR must not be inside dist/ or node_modules/.');

  const logLevel = (env.LOG_LEVEL ?? 'info') as LogLevel;
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) problems.push('LOG_LEVEL must be debug, info, warn or error.');

  const thresholdUsd = env.MANUAL_REVIEW_THRESHOLD_USD ?? '10000';
  if (!/^\d+$/.test(thresholdUsd)) problems.push('MANUAL_REVIEW_THRESHOLD_USD must be a whole number of dollars.');

  // Sandbox settings are rejected outright in production so test behaviour can't leak into a live deploy.
  const sandboxKeys = Object.keys(env).filter((k) => k.startsWith('SANDBOX_') && env[k]);
  if (production && sandboxKeys.length) problems.push(`Sandbox settings are not allowed in production: ${sandboxKeys.join(', ')}.`);

  const rates: AppConfig['sandbox']['rates'] = {};
  for (const pair of (env.SANDBOX_RATES ?? '').split(',').filter(Boolean)) {
    const [code, value] = pair.split('=');
    const micros = value ? parseUsdToMicros(value) : null;
    if (!code || !['BTC', 'ETH', 'USDT', 'USDC', 'XRP', 'SOL', 'BNB'].includes(code.trim()) || micros === null || micros <= 0n)
      problems.push(`SANDBOX_RATES entry "${pair}" must look like BTC=68420.15.`);
    else rates[code.trim() as 'BTC'] = micros;
  }
  const confirmations: Record<string, number> = {};
  for (const pair of (env.SANDBOX_CONFIRMATIONS ?? '').split(',').filter(Boolean)) {
    const [network, value] = pair.split('=');
    const n = Number(value);
    if (!network || !Number.isInteger(n) || n < 1 || n > 1000)
      problems.push(`SANDBOX_CONFIRMATIONS entry "${pair}" must look like bitcoin=2.`);
    else confirmations[network.trim()] = n;
  }

  // Off by default: customer-facing sandbox simulation must not auto-advance orders.
  // Tests and visual QA opt in explicitly. Never runs in production mode.
  const autopilotStepMs = Number(env.SANDBOX_AUTOPILOT_STEP_MS ?? 0);
  if (!Number.isInteger(autopilotStepMs) || autopilotStepMs < 0 || autopilotStepMs > 600_000)
    problems.push('SANDBOX_AUTOPILOT_STEP_MS must be a whole number of milliseconds between 0 and 600000.');

  const sandboxWebhookSecret = env.SANDBOX_WEBHOOK_SECRET || (production ? '' : randomBytes(32).toString('hex'));

  // Market prices default to CoinGecko. Use RATES_SOURCE=default only for offline/tests
  // (sandbox schedule or RATES_PROVIDER). Never invent prices when CoinGecko fails.
  const rawRatesSource = (env.RATES_SOURCE ?? '').trim().toLowerCase();
  const ratesSource =
    rawRatesSource || (env.RATES_PROVIDER_URL || env.RATES_PROVIDER_API_KEY ? 'default' : 'coingecko');
  if (!['default', 'coingecko'].includes(ratesSource))
    problems.push('RATES_SOURCE must be empty, "coingecko", or "default".');
  const coingeckoPlan = (env.COINGECKO_API_PLAN ?? '').trim().toLowerCase() || 'demo';
  if (!['demo', 'pro'].includes(coingeckoPlan)) problems.push('COINGECKO_API_PLAN must be demo or pro.');
  const coingeckoKey = env.COINGECKO_API_KEY?.trim() || null;
  if (coingeckoPlan === 'pro' && !coingeckoKey && ratesSource === 'coingecko')
    problems.push('COINGECKO_API_PLAN=pro needs COINGECKO_API_KEY.');
  const coingeckoCacheS = Number(env.COINGECKO_CACHE_SECONDS ?? 30);
  if (!Number.isInteger(coingeckoCacheS) || coingeckoCacheS < 10 || coingeckoCacheS > 55)
    problems.push('COINGECKO_CACHE_SECONDS must be a whole number between 10 and 55.');
  if (ratesSource === 'coingecko' && (env.RATES_PROVIDER_URL || env.RATES_PROVIDER_API_KEY))
    problems.push('Set either RATES_SOURCE=coingecko or RATES_PROVIDER_URL/RATES_PROVIDER_API_KEY, not both.');
  if (ratesSource === 'coingecko' && !production && env.SANDBOX_RATES)
    problems.push('SANDBOX_RATES has no effect with RATES_SOURCE=coingecko; remove one of them.');

  const email = provider(env, 'EMAIL_PROVIDER', problems, { webhook: false });
  const emailFrom = env.EMAIL_FROM?.trim();
  if (email && !emailFrom) problems.push('EMAIL_FROM is required when EMAIL_PROVIDER is configured.');

  const config: AppConfig = {
    mode,
    nodeEnv,
    host: env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1'),
    port,
    publicOrigin,
    crmOrigin,
    allowedOrigins,
    databasePath,
    filesDir,
    sessionSecret,
    dataEncryptionKey,
    trustProxy: bool(env.TRUST_PROXY, false),
    logLevel,
    staticDir: bool(env.SERVE_STATIC, true) ? path.resolve(env.STATIC_DIR ?? './dist') : null,
    // Off by default (owner-operated CRM uses password + role checks). Set REQUIRE_STAFF_MFA=true to force TOTP.
    requireStaffMfa: bool(env.REQUIRE_STAFF_MFA, false),
    manualReviewThresholdCents: BigInt(/^\d+$/.test(thresholdUsd) ? thresholdUsd : '0') * 100n,
    sessionTtlMs: Number(env.SESSION_TTL_HOURS ?? 12) * 3_600_000,
    sandbox: {
      rates,
      confirmations,
      webhookSecret: sandboxWebhookSecret,
      exposeCodes: !production && bool(env.SANDBOX_EXPOSE_CODES, true),
      autopilotStepMs: production ? 0 : autopilotStepMs,
    },
    providers: {
      rates: provider(env, 'RATES_PROVIDER', problems, { webhook: false }),
      custody: provider(env, 'CUSTODY_PROVIDER', problems, { webhook: true }),
      identity: provider(env, 'KYC_PROVIDER', problems, { webhook: true }),
      screening: provider(env, 'SCREENING_PROVIDER', problems, { webhook: false }),
      bankPayout: provider(env, 'BANK_PAYOUT_PROVIDER', problems, { webhook: true }),
      cardPayout: provider(env, 'CARD_PAYOUT_PROVIDER', problems, { webhook: true }),
      cash: provider(env, 'CASH_PROVIDER', problems, { webhook: true }),
      email: email && emailFrom ? { ...email, from: emailFrom } : null,
    },
    coingecko:
      ratesSource === 'coingecko' ? { apiKey: coingeckoKey, plan: coingeckoPlan as 'demo' | 'pro', cacheMs: coingeckoCacheS * 1000 } : null,
    warnings,
  };
  if (!Number.isFinite(config.sessionTtlMs) || config.sessionTtlMs < 600_000) problems.push('SESSION_TTL_HOURS must be a number ≥ 0.2.');
  if (production && !config.trustProxy)
    warnings.push('TRUST_PROXY is off: client IPs for rate limiting will be the reverse proxy address.');

  if (problems.length) throw new ConfigError(problems);
  return config;
}

/** A config for tests: sandbox mode, in-memory database, fixed secrets. */
export function testConfig(overrides: Partial<AppConfig> = {}, env: Env = {}): AppConfig {
  const base = loadConfig({
    APP_MODE: 'sandbox',
    DATABASE_PATH: ':memory:',
    SERVE_STATIC: 'false',
    SANDBOX_WEBHOOK_SECRET: 'test-webhook-secret-test-webhook-secret',
    // Tests drive the demo autopilot explicitly (sandboxAutopilotTick), never on a timer.
    SANDBOX_AUTOPILOT_STEP_MS: '0',
    // Offline by default: deterministic sandbox schedule. Opt into CoinGecko with RATES_SOURCE=coingecko.
    RATES_SOURCE: 'default',
    ...env,
  });
  return { ...base, databasePath: ':memory:', ...overrides };
}
