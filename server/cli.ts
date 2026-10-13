/**
 * Operations CLI. Run with `pnpm server:cli <command>` in development or
 * `node dist-server/cli.js <command>` in the container.
 *
 *   check-config            Validate the environment and print provider states (no secrets).
 *   migrate                 Apply pending migrations.
 *   migration-status        List applied and pending migrations.
 *   create-user             Create a staff or customer account (reads the password from ARCVALE_NEW_PASSWORD or stdin).
 *   seed                    Sandbox only: staff accounts, a demo customer and orders in several states.
 *   scenarios [name ...]    Sandbox only: run deterministic lifecycle scenarios on a throwaway in-memory database.
 *   backup <file>           Write a consistent copy of the database (VACUUM INTO).
 *   verify-audit            Verify the audit log hash chain.
 */
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { createApp } from './app';
import { ConfigError, loadConfig, type AppConfig } from './config';
import { migrate, migrationStatus, openDatabase } from './db/database';
import type { Role } from './http/router';
import { fixedClock } from './lib/clock';
import { newTotpSecret } from './lib/crypto';
import { silentLogger } from './logger';
import { providerInfos } from './providers/registry';
import { placeOrder, runScenarios, SANDBOX_PASSWORD, sandboxCustomer, sandboxOperator } from './scenarios';
import { verifyAuditChain } from './services/audit';
import { createAccount } from './services/auth';
import * as ops from './services/operations';
import * as sandbox from './services/sandbox';
import { createConversation } from './services/support';

const out = (s = '') => process.stdout.write(s + '\n');
const fail = (s: string, code = 1): never => {
  process.stderr.write(s + '\n');
  process.exit(code);
};

function config(): AppConfig {
  try {
    return loadConfig(process.env);
  } catch (e) {
    if (e instanceof ConfigError) return fail(e.message, 78);
    throw e;
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function readPassword(): Promise<string> {
  if (process.env.ARCVALE_NEW_PASSWORD) return process.env.ARCVALE_NEW_PASSWORD;
  if (!process.stdin.isTTY) {
    let data = '';
    for await (const chunk of process.stdin) data += chunk;
    return data.trim();
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const p = await rl.question('Password (min 12 characters): ');
  rl.close();
  return p.trim();
}

const commands: Record<string, () => Promise<void> | void> = {
  'check-config'() {
    const c = config();
    const app = createApp({ ...c, databasePath: ':memory:' }, { log: silentLogger });
    out(`mode: ${c.mode}`);
    out(`public origin: ${c.publicOrigin}`);
    out(`database: ${c.databasePath}`);
    out(`staff MFA required: ${c.requireStaffMfa}`);
    out('providers:');
    for (const p of providerInfos(app.ctx.providers)) out(`  ${p.key.padEnd(11)} ${p.state.padEnd(18)} ${p.detail}`);
    for (const w of c.warnings) out(`warning: ${w}`);
    void app.close();
  },

  migrate() {
    const c = config();
    const db = openDatabase(c.databasePath);
    const ran = migrate(db, c.mode, Date.now());
    out(ran.length ? `Applied migrations: ${ran.join(', ')}` : 'Database is up to date.');
    db.close();
  },

  'migration-status'() {
    const c = config();
    if (!existsSync(c.databasePath)) fail(`No database at ${c.databasePath}.`);
    const db = openDatabase(c.databasePath);
    const s = migrationStatus(db);
    for (const a of s.applied) out(`applied  ${a.id} ${a.name} (${new Date(a.appliedAt).toISOString()})`);
    for (const p of s.pending) out(`pending  ${p.id} ${p.name}`);
    db.close();
  },

  async 'create-user'() {
    const c = config();
    const email = arg('email') ?? fail('--email is required');
    const role = (arg('role') ?? 'customer') as Role;
    if (!['customer', 'support', 'reviewer', 'admin', 'owner'].includes(role))
      fail('--role must be customer, support, reviewer, admin or owner');
    const name = arg('name') ?? email;
    const password = await readPassword();
    const staff = role !== 'customer';
    const totpSecret = staff && c.requireStaffMfa ? newTotpSecret() : undefined;
    const app = createApp(c, { log: silentLogger });
    try {
      const id = await createAccount(app.ctx, { email, password, role, fullName: name, totpSecret });
      out(`Created ${role} ${email} (${id}).`);
      if (totpSecret) {
        out('Staff sign-in requires an authenticator app. Add this secret now; it is not shown again:');
        out(`  otpauth://totp/Arcvale:${encodeURIComponent(email)}?secret=${totpSecret}&issuer=Arcvale&digits=6&period=30`);
      }
    } finally {
      await app.close();
    }
  },

  async seed() {
    const c = config();
    if (c.mode !== 'sandbox') fail('seed is available only in sandbox mode (APP_MODE=sandbox). It never runs in production.');
    const app = createApp(c, { log: silentLogger });
    const ctx = app.ctx;
    try {
      if (ctx.db.get("SELECT 1 FROM users WHERE email = 'owner@arcvale.test'")) {
        out('Sandbox data already seeded.');
        return;
      }
      const owner = await sandboxOperator(ctx, 'owner@arcvale.test', 'owner');
      await sandboxOperator(ctx, 'admin@arcvale.test', 'admin');
      await sandboxOperator(ctx, 'reviewer@arcvale.test', 'reviewer');
      await sandboxOperator(ctx, 'support@arcvale.test', 'support');
      const cust = await sandboxCustomer(ctx, 'customer@arcvale.test', 'Alex Morgan');

      const waiting = await placeOrder(ctx, cust);
      const review = await placeOrder(ctx, cust, { amountAtomic: 12_000_000_000n, method: 'wire' });
      sandbox.simulateDeposit(ctx, owner, review.id, 'exact');
      sandbox.simulateConfirmations(ctx, owner, review.id, { toFinal: true });
      const done = await placeOrder(ctx, cust, { amountAtomic: 750_000_000n });
      sandbox.simulateDeposit(ctx, owner, done.id, 'exact');
      sandbox.simulateConfirmations(ctx, owner, done.id, { toFinal: true });
      await ops.authorizePayout(ctx, owner, done.id, 'Seed: checks passed.');
      sandbox.simulatePayout(ctx, owner, done.id, 'completed');
      const confirming = await placeOrder(ctx, cust, { amountAtomic: 1_200_000_000n });
      sandbox.simulateDeposit(ctx, owner, confirming.id, 'exact');
      sandbox.simulateConfirmations(ctx, owner, confirming.id);
      createConversation(ctx, cust.actor, cust.userId, {
        subject: 'Question about my wire',
        body: 'Hi, how long does the review take for a larger exchange?',
        orderId: review.id,
        clientMessageId: null,
      });
      out(`Seeded sandbox data. Every account below uses the password: ${SANDBOX_PASSWORD}`);
      out('(These accounts exist only in this sandbox database.)');
      for (const e of ['owner', 'admin', 'reviewer', 'support', 'customer']) out(`  ${e}@arcvale.test`);
      out(
        `Orders: ${waiting.reference} (awaiting deposit), ${review.reference} (compliance review), ${confirming.reference} (confirming), ${done.reference} (completed)`,
      );
    } finally {
      await app.close();
    }
  },

  async scenarios() {
    const c = config();
    if (c.mode !== 'sandbox') fail('scenarios run only in sandbox mode.');
    // Always a throwaway in-memory database with a fixed clock: deterministic, and never touches real data.
    const app = createApp({ ...c, databasePath: ':memory:' }, { log: silentLogger, clock: fixedClock(Date.UTC(2026, 0, 15, 15)) });
    const only = process.argv.slice(3).filter((a) => !a.startsWith('--'));
    const results = await runScenarios(app.ctx, only);
    let failed = 0;
    for (const r of results) {
      out(
        `${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(24)} expected ${String(r.expected).padEnd(16)} got ${r.finalStatus ?? (r.ok ? 'ok' : '-')}`,
      );
      for (const s of r.steps) out(`        ${s}`);
      if (r.error) out(`        error: ${r.error}`);
      if (!r.ok) failed++;
    }
    out(`\n${results.length - failed}/${results.length} passed`);
    await app.close();
    if (failed) process.exit(1);
  },

  backup() {
    const c = config();
    const dest = process.argv[3] ?? fail('Usage: backup <destination-file>');
    if (existsSync(dest)) fail(`${dest} already exists.`);
    const db = openDatabase(c.databasePath);
    db.raw.prepare('VACUUM INTO ?').run(dest);
    db.close();
    out(`Backup written to ${dest}`);
  },

  'verify-audit'() {
    const c = config();
    const db = openDatabase(c.databasePath);
    const r = verifyAuditChain({ db });
    db.close();
    if (!r.ok) return fail(`Audit chain broken at event ${r.brokenAtId}.`);
    out(`Audit chain intact (${r.count} events).`);
  },
};

const name = process.argv[2];
const cmd = name ? commands[name] : undefined;
if (!cmd) {
  out('Usage: cli <command>\nCommands: ' + Object.keys(commands).join(', '));
  process.exit(name ? 1 : 0);
}
await cmd();
