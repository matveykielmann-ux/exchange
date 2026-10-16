/**
 * Targeted tests for deploy helpers: env idempotency, secret non-overwrite,
 * backup prune-after-verify ordering, and verify-storage behaviour.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createApp } from '../app';
import { loadConfig } from '../config';
import { absoluteFilePath, orderFileExists, readOrderFile, writeOrderFile } from '../services/fileStore';
import { silentLogger } from '../logger';

const ROOT = path.resolve(import.meta.dirname, '../..');
const LIB = path.join(ROOT, 'deploy/lib.sh');

function bash(script: string) {
  return spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env },
    cwd: ROOT,
  });
}

/** Mirror of CLI verify-storage for unit use without dist-server. */
function verifyStorage(app: ReturnType<typeof createApp>) {
  const rows = app.ctx.db.all<{ id: string; sha256: string }>(
    'SELECT id, sha256 FROM order_documents WHERE stored = 1',
  );
  const problems: string[] = [];
  let ok = 0;
  for (const row of rows) {
    if (!orderFileExists(app.ctx, row.id)) {
      problems.push(`${row.id}: missing`);
      continue;
    }
    try {
      const bytes = readOrderFile(app.ctx, row.id);
      const sha = createHash('sha256').update(bytes).digest('hex');
      if (sha !== row.sha256) problems.push(`${row.id}: sha mismatch`);
      else ok++;
    } catch {
      problems.push(`${row.id}: decrypt failed`);
    }
  }
  return { ok, problems, total: rows.length };
}

describe('deploy/lib.sh env helpers', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arcvale-deploy-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('env_set_if_empty does not overwrite a real SESSION_SECRET', () => {
    const file = path.join(dir, '.env.production');
    writeFileSync(file, 'SESSION_SECRET=already-set-secret-value-0123456789abcdef\n', { mode: 0o600 });
    const r = bash(`
      set -euo pipefail
      source "${LIB}"
      env_set_if_empty SESSION_SECRET "should-not-win" "${file}"
      env_get SESSION_SECRET "${file}"
    `);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('already-set-secret-value-0123456789abcdef');
  });

  it('env_set_if_empty fills placeholders and empty keys', () => {
    const file = path.join(dir, '.env.production');
    writeFileSync(file, 'PUBLIC_DOMAIN=YOUR_DOMAIN\nSESSION_SECRET=\n', { mode: 0o600 });
    const r = bash(`
      set -euo pipefail
      source "${LIB}"
      env_set_if_empty PUBLIC_DOMAIN "example.com" "${file}"
      env_set_if_empty SESSION_SECRET "new-secret-aaaaaaaaaaaaaaaaaaaaaaaa" "${file}"
      echo "D=$(env_get PUBLIC_DOMAIN "${file}")"
      echo "S=$(env_get SESSION_SECRET "${file}")"
    `);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('D=example.com');
    expect(r.stdout).toContain('S=new-secret-aaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('env_refuse_overwrite_secret blocks rotation of DATA_ENCRYPTION_KEY', () => {
    const file = path.join(dir, '.env.production');
    const key = Buffer.alloc(32, 5).toString('base64');
    writeFileSync(file, `DATA_ENCRYPTION_KEY=${key}\n`, { mode: 0o600 });
    const r = bash(`
      set -euo pipefail
      source "${LIB}"
      if env_refuse_overwrite_secret DATA_ENCRYPTION_KEY "${file}"; then echo ALLOW; else echo REFUSE; fi
    `);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('REFUSE');
  });

  it('is_placeholder recognises YOUR_DOMAIN tokens and bare example.com', () => {
    const r = bash(`
      set -euo pipefail
      source "${LIB}"
      is_placeholder "YOUR_DOMAIN" && echo yes || echo no
      is_placeholder "https://crm.YOUR_DOMAIN" && echo yes || echo no
      is_placeholder "you@YOUR_DOMAIN" && echo yes || echo no
      is_placeholder "exchange.example.com" && echo yes || echo no
      is_placeholder "ops@example.com" && echo yes || echo no
    `);
    expect(r.status).toBe(0);
    expect(r.stdout.trim().split('\n')).toEqual(['yes', 'yes', 'yes', 'no', 'no']);
  });

  it('install and configure refuse literal YOUR_DOMAIN', () => {
    const r = bash(`
      set -euo pipefail
      source "${LIB}"
      refuse_placeholder PUBLIC_DOMAIN "YOUR_DOMAIN" && echo ok || echo blocked
      refuse_placeholder PUBLIC_DOMAIN "exchange.example.com" && echo ok || echo blocked
    `);
    expect(r.status).toBe(0);
    expect(r.stdout.trim().split('\n')).toEqual(['blocked', 'ok']);
  });
});

describe('deploy/configure-env.sh idempotency', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arcvale-cfgenv-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('generates secrets once and leaves them alone on re-run', () => {
    const work = dir;
    mkdirSync(path.join(work, 'deploy'), { recursive: true });
    mkdirSync(path.join(work, 'secrets'), { recursive: true });
    execFileSync('cp', [path.join(ROOT, '.env.example'), path.join(work, '.env.example')]);
    execFileSync('cp', [path.join(ROOT, 'deploy/lib.sh'), path.join(work, 'deploy/lib.sh')]);
    execFileSync('cp', [path.join(ROOT, 'deploy/configure-env.sh'), path.join(work, 'deploy/configure-env.sh')]);
    chmodSync(path.join(work, 'deploy/configure-env.sh'), 0o755);

    const run = () =>
      spawnSync('bash', ['./deploy/configure-env.sh', '--domain', 'example.test', '--email', 'ops@example.test'], {
        cwd: work,
        encoding: 'utf8',
        env: { ...process.env },
      });

    const first = run();
    expect(first.status).toBe(0);
    const env1 = readFileSync(path.join(work, '.env.production'), 'utf8');
    const secret1 = env1.match(/^SESSION_SECRET=(.*)$/m)?.[1];
    const key1 = env1.match(/^DATA_ENCRYPTION_KEY=(.*)$/m)?.[1];
    expect(secret1?.length).toBeGreaterThanOrEqual(32);
    expect(key1).toBeTruthy();
    expect(existsSync(path.join(work, 'secrets/DATA_ENCRYPTION_KEY.offline'))).toBe(true);
    expect(readFileSync(path.join(work, 'secrets/DATA_ENCRYPTION_KEY.offline'), 'utf8').trim()).toBe(key1);

    const second = run();
    expect(second.status).toBe(0);
    expect(second.stdout).toMatch(/DATA_ENCRYPTION_KEY already set/i);
    const env2 = readFileSync(path.join(work, '.env.production'), 'utf8');
    expect(env2.match(/^SESSION_SECRET=(.*)$/m)?.[1]).toBe(secret1);
    expect(env2.match(/^DATA_ENCRYPTION_KEY=(.*)$/m)?.[1]).toBe(key1);
  });

  it('rejects --force-new-secrets', () => {
    const r = spawnSync('bash', [path.join(ROOT, 'deploy/configure-env.sh'), '--force-new-secrets'], {
      encoding: 'utf8',
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/Refusing --force-new-secrets/);
  });
});

describe('backup prune-after-verify', () => {
  it('backup.sh verifies checksums before prune (script structure)', () => {
    const src = readFileSync(path.join(ROOT, 'deploy/scripts/backup.sh'), 'utf8');
    const verifyAt = src.indexOf('sha256sum -c');
    const pruneAt = src.indexOf("find backups -name 'arcvale-*.db.gz'");
    expect(verifyAt).toBeGreaterThan(0);
    expect(pruneAt).toBeGreaterThan(verifyAt);
  });
});

describe('verify-storage semantics', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arcvale-vstore-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('passes when there are no stored documents', () => {
    const app = createApp(
      loadConfig({
        APP_MODE: 'sandbox',
        DATABASE_PATH: path.join(dir, 'arcvale-sandbox.db'),
        FILES_DIR: path.join(dir, 'files'),
        DATA_ENCRYPTION_KEY: Buffer.alloc(32, 11).toString('base64'),
        SERVE_STATIC: 'false',
        PUBLIC_ORIGIN: 'http://localhost:5173',
        RATES_SOURCE: 'default',
        SANDBOX_WEBHOOK_SECRET: 'test-webhook-secret-test-webhook-secret',
        SANDBOX_AUTOPILOT_STEP_MS: '0',
      }),
      { log: silentLogger },
    );
    try {
      expect(verifyStorage(app)).toEqual({ ok: 0, problems: [], total: 0 });
    } finally {
      void app.close();
    }
  });

  it('reports decrypt failure when the encryption key does not match', () => {
    const keyA = Buffer.alloc(32, 11).toString('base64');
    const keyB = Buffer.alloc(32, 12).toString('base64');
    const dbPath = path.join(dir, 'arcvale-sandbox.db');
    const filesDir = path.join(dir, 'files');
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 1)]);

    const writer = createApp(
      loadConfig({
        APP_MODE: 'sandbox',
        DATABASE_PATH: dbPath,
        FILES_DIR: filesDir,
        DATA_ENCRYPTION_KEY: keyA,
        SERVE_STATIC: 'false',
        PUBLIC_ORIGIN: 'http://localhost:5173',
        RATES_SOURCE: 'default',
        SANDBOX_WEBHOOK_SECRET: 'test-webhook-secret-test-webhook-secret',
        SANDBOX_AUTOPILOT_STEP_MS: '0',
      }),
      { log: silentLogger },
    );
    const docId = 'doc_verifystorage0001';
    try {
      writeOrderFile(writer.ctx, docId, png);
      expect(existsSync(absoluteFilePath(writer.ctx, docId))).toBe(true);
      // Bypass FK: insert metadata row with deferred checks off for this isolated assertion.
      writer.ctx.db.exec('PRAGMA foreign_keys = OFF');
      writer.ctx.db.run(
        `INSERT INTO order_documents
          (id, order_id, user_id, kind, file_name, content_type, size_bytes, sha256, stored, created_at, visibility)
         VALUES (?, 'ord_x', 'usr_x', 'id_document', 'id.png', 'image/png', ?, ?, 1, ?, 'owner_staff')`,
        [docId, png.length, createHash('sha256').update(png).digest('hex'), Date.now()],
      );
    } finally {
      void writer.close();
    }

    const reader = createApp(
      loadConfig({
        APP_MODE: 'sandbox',
        DATABASE_PATH: dbPath,
        FILES_DIR: filesDir,
        DATA_ENCRYPTION_KEY: keyB,
        SERVE_STATIC: 'false',
        PUBLIC_ORIGIN: 'http://localhost:5173',
        RATES_SOURCE: 'default',
        SANDBOX_WEBHOOK_SECRET: 'test-webhook-secret-test-webhook-secret',
        SANDBOX_AUTOPILOT_STEP_MS: '0',
      }),
      { log: silentLogger },
    );
    try {
      const result = verifyStorage(reader);
      expect(result.total).toBe(1);
      expect(result.ok).toBe(0);
      expect(result.problems.some((p) => p.includes('decrypt failed'))).toBe(true);
    } finally {
      void reader.close();
    }
  });
});

describe('install.sh safety', () => {
  it('documents non-destructive re-run and does not contain destructive DB wipes', () => {
    const src = readFileSync(path.join(ROOT, 'deploy/install.sh'), 'utf8');
    expect(src).toMatch(/Never deletes SQLite data/);
    expect(src).not.toMatch(/docker volume rm/);
    expect(src).not.toMatch(/rm -rf .*arcvale-data/);
    expect(src).toMatch(/--dry-run/);
    expect(src).toMatch(/refuse_placeholder/);
  });
});

describe('create-owner.sh password handling', () => {
  it('prefers interactive hidden entry and never puts password on argv', () => {
    const src = readFileSync(path.join(ROOT, 'deploy/create-owner.sh'), 'utf8');
    expect(src).toMatch(/read -r -s -p "Password:/);
    expect(src).toMatch(/Confirm password/);
    expect(src).toMatch(/-e ARCVALE_NEW_PASSWORD=/);
    expect(src).not.toMatch(/--password/);
    expect(src).toMatch(/idempotent/);
  });
});

describe('preflight readiness layers', () => {
  it('summary reports five separate readiness layers', () => {
    const lib = readFileSync(path.join(ROOT, 'deploy/lib.sh'), 'utf8');
    expect(lib).toMatch(/Application \(tech\)/);
    expect(lib).toMatch(/DNS \/ TLS/);
    expect(lib).toMatch(/Backups:/);
    expect(lib).toMatch(/Integrations:/);
    expect(lib).toMatch(/Real-money clearance/);
  });
});
