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
 *   verify-storage          Check FILES_DIR blobs decrypt and match order_documents hashes.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { BRAND } from '@/config/brand';
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
import { createAccount, normalizeEmail } from './services/auth';
import { absoluteFilePath, orderFileExists, readOrderFile } from './services/fileStore';
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
    out(`crm origin: ${c.crmOrigin ?? '(same host as PUBLIC_ORIGIN — local/dev only)'}`);
    out(`allowed origins: ${c.allowedOrigins.join(', ')}`);
    out(`database: ${c.databasePath}`);
    out(`files dir: ${c.filesDir}`);
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
    const app = createApp(c, { log: silentLogger });
    try {
      const existing = app.ctx.db.get<{ id: string; role: string }>('SELECT id, role FROM users WHERE email = ?', [
        normalizeEmail(email),
      ]);
      if (existing) {
        if (existing.role === role) {
          out(`Account already exists: ${role} ${email} (${existing.id}). No changes made.`);
          return;
        }
        fail(`Email ${email} already exists with role ${existing.role}. Refusing to change or reset it.`);
      }
      const password = await readPassword();
      const staff = role !== 'customer';
      const totpSecret = staff && c.requireStaffMfa ? newTotpSecret() : undefined;
      const id = await createAccount(app.ctx, { email, password, role, fullName: name, totpSecret });
      out(`Created ${role} ${email} (${id}).`);
      if (totpSecret) {
        out('Staff sign-in requires an authenticator app. Add this secret now; it is not shown again:');
        out(
          `  otpauth://totp/${encodeURIComponent(`${BRAND.name}:${email}`)}?secret=${totpSecret}&issuer=${encodeURIComponent(BRAND.name)}&digits=6&period=30`,
        );
      }
      if (staff && c.crmOrigin) out(`Sign in at ${c.crmOrigin}/admin/login`);
      else if (staff) out('Sign in at /admin/login on PUBLIC_ORIGIN');
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

      // Like the web app, seeded orders have no refund address until a refund needs one.
      const waiting = await placeOrder(ctx, cust, { refundAddress: null });
      const review = await placeOrder(ctx, cust, { amountAtomic: 12_000_000_000n, method: 'wire', refundAddress: null });
      sandbox.simulateDeposit(ctx, owner, review.id, 'exact');
      sandbox.simulateConfirmations(ctx, owner, review.id, { toFinal: true });
      const done = await placeOrder(ctx, cust, { amountAtomic: 750_000_000n, refundAddress: null });
      sandbox.simulateDeposit(ctx, owner, done.id, 'exact');
      sandbox.simulateConfirmations(ctx, owner, done.id, { toFinal: true });
      await ops.authorizePayout(ctx, owner, done.id, 'Seed: checks passed.');
      sandbox.simulatePayout(ctx, owner, done.id, 'completed');
      const confirming = await placeOrder(ctx, cust, { amountAtomic: 1_200_000_000n, refundAddress: null });
      sandbox.simulateDeposit(ctx, owner, confirming.id, 'exact');
      sandbox.simulateConfirmations(ctx, owner, confirming.id);
      const refund = await placeOrder(ctx, cust, { amountAtomic: 900_000_000n, refundAddress: null });
      sandbox.simulateDeposit(ctx, owner, refund.id, 'short');
      sandbox.simulateConfirmations(ctx, owner, refund.id, { toFinal: true });
      await ops.rejectOrder(ctx, owner, refund.id, 'Seed: the amount received does not match the order.');
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
        `Orders: ${waiting.reference} (awaiting deposit), ${review.reference} (compliance review), ${confirming.reference} (confirming), ${done.reference} (completed), ${refund.reference} (refund waiting for the refund address)`,
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

  /**
   * Ops check after backup/restore: every stored order attachment must exist under
   * FILES_DIR, decrypt with DATA_ENCRYPTION_KEY, and match sha256. Does not print
   * file contents or secrets.
   */
  'verify-storage'() {
    const c = config();
    const app = createApp(c, { log: silentLogger });
    try {
      const rows = app.ctx.db.all<{ id: string; order_id: string; sha256: string; stored: number }>(
        'SELECT id, order_id, sha256, stored FROM order_documents WHERE stored = 1',
      );
      let ok = 0;
      const problems: string[] = [];
      for (const row of rows) {
        if (!orderFileExists(app.ctx, row.id)) {
          problems.push(`${row.id}: missing file at ${absoluteFilePath(app.ctx, row.id)}`);
          continue;
        }
        try {
          const bytes = readOrderFile(app.ctx, row.id);
          const sha = createHash('sha256').update(bytes).digest('hex');
          if (sha !== row.sha256) problems.push(`${row.id}: sha256 mismatch after decrypt`);
          else ok++;
        } catch (e) {
          problems.push(`${row.id}: decrypt failed (${e instanceof Error ? e.message : 'error'})`);
        }
      }
      out(`FILES_DIR=${c.filesDir}`);
      out(`Stored order documents: ${rows.length}; verified: ${ok}; failed: ${problems.length}`);
      for (const p of problems) out(`  FAIL ${p}`);
      if (problems.length) return fail('verify-storage found problems.', 1);
      out('Storage verification ok.');
    } finally {
      void app.close();
    }
  },
};

const name = process.argv[2];
const cmd = name ? commands[name] : undefined;
if (!cmd) {
  out('Usage: cli <command>\nCommands: ' + Object.keys(commands).join(', '));
  process.exit(name ? 1 : 0);
}
await cmd();
