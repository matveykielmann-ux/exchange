/**
 * Persistent encrypted order-file storage (FILES_DIR).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { LEGAL_DOCUMENTS } from '@/content/legal';
import { createApp } from '../app';
import { ConfigError, loadConfig } from '../config';
import { openDatabase } from '../db/database';
import { createAccount } from '../services/auth';
import { absoluteFilePath, readOrderFile, writeOrderFile } from '../services/fileStore';
import { SANDBOX_PASSWORD } from '../scenarios';
import { silentLogger } from '../logger';
import { fixedClock } from '../lib/clock';
import { testApp, T0 } from './helpers';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 2)]);
const pngB64 = PNG.toString('base64');

const signupDocs = () =>
  LEGAL_DOCUMENTS.filter((d) => d.acceptance === 'signup').map((d) => ({ slug: d.slug, version: d.version }));

describe('FILES_DIR configuration', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arcvale-cfg-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('defaults FILES_DIR next to the database file', () => {
    const db = path.join(dir, 'arcvale-sandbox.db');
    const cfg = loadConfig({
      APP_MODE: 'sandbox',
      DATABASE_PATH: db,
      SERVE_STATIC: 'false',
      PUBLIC_ORIGIN: 'http://localhost:5173',
      RATES_SOURCE: 'default',
    });
    expect(cfg.filesDir).toBe(path.join(dir, 'files'));
  });

  it('rejects production FILES_DIR under a temporary directory', () => {
    try {
      loadConfig({
        NODE_ENV: 'production',
        APP_MODE: 'production',
        PUBLIC_ORIGIN: 'https://example.com',
        CRM_ORIGIN: 'https://crm.example.com',
        SESSION_SECRET: 'x'.repeat(48),
        DATA_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
        DATABASE_PATH: path.join(dir, 'arcvale-production.db'),
        FILES_DIR: path.join(tmpdir(), 'ephemeral-files'),
        SERVE_STATIC: 'false',
        RATES_SOURCE: 'default',
      });
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).problems.some((p) => p.includes('FILES_DIR must be a persistent path'))).toBe(true);
    }
  });
});

describe('encrypted order file blobs', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arcvale-blob-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes ciphertext that is not the plaintext payload and round-trips', () => {
    const filesDir = path.join(dir, 'files');
    const app = createApp(
      {
        ...loadConfig({
          APP_MODE: 'sandbox',
          DATABASE_PATH: ':memory:',
          SERVE_STATIC: 'false',
          PUBLIC_ORIGIN: 'http://localhost:5173',
          RATES_SOURCE: 'default',
        }),
        databasePath: ':memory:',
        filesDir,
      },
      { log: silentLogger },
    );
    try {
      writeOrderFile(app.ctx, 'doc_testfile000001', PNG);
      const onDisk = absoluteFilePath(app.ctx, 'doc_testfile000001');
      expect(existsSync(onDisk)).toBe(true);
      const raw = readFileSync(onDisk, 'utf8');
      expect(raw.startsWith('v1:')).toBe(true);
      expect(raw.includes(pngB64)).toBe(false);
      expect(Buffer.compare(readOrderFile(app.ctx, 'doc_testfile000001'), PNG)).toBe(0);
    } finally {
      void app.close();
    }
  });
});

describe('order document HTTP persistence', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arcvale-http-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('stores a courier ID upload and enforces download ACL', async () => {
    const filesDir = path.join(dir, 'files');
    const t = testApp({ filesDir, port: 0, host: '127.0.0.1' });
    const server = await t.app.listen();
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const jar = new Map<string, string>();
    let csrf: string | null = null;
    const req = async (method: string, p: string, body?: unknown, origin = 'http://localhost:5173') => {
      const headers: Record<string, string> = {};
      if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
      if (method !== 'GET') {
        headers.origin = origin;
        if (csrf) headers['x-csrf-token'] = csrf;
        headers['content-type'] = 'application/json';
      }
      const res = await fetch(base + p, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const i = pair!.indexOf('=');
        jar.set(pair!.slice(0, i), pair!.slice(i + 1));
      }
      const text = await res.text();
      const parsed = text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
      if (parsed && typeof parsed === 'object' && parsed.csrfToken) csrf = parsed.csrfToken;
      return { status: res.status, body: parsed as Record<string, unknown> & { documents?: Array<{ id: string; stored: boolean }>; dataBase64?: string; error?: { code: string } } };
    };

    try {
      expect(
        (
          await req('POST', '/api/auth/signup', {
            email: 'persist@example.test',
            password: SANDBOX_PASSWORD,
            fullName: 'Persist Owner',
            countryOfResidence: 'US',
            stateOfResidence: 'NY',
            notInRestrictedTerritory: true,
            accepted: signupDocs(),
          })
        ).status,
      ).toBe(201);
      await req('POST', '/api/me/verification');

      const tomorrow = new Date(t.ctx.clock.now() + 86_400_000).toISOString().slice(0, 10);
      const courier = await req('POST', '/api/me/destinations/courier', {
        phone: '(212) 555-0142',
        line1: '200 Example Street',
        line2: '',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        window: 'any',
        preferredDate: tomorrow,
        instructions: '',
      });
      if (courier.status !== 201) {
        throw new Error(`courier destination failed: ${JSON.stringify(courier.body)}`);
      }

      const q = await req('POST', '/api/quotes', {
        direction: 'buy',
        asset: 'USDT',
        network: 'tron',
        cashCents: '100000',
      });
      expect(q.status).toBe(201);

      const order = await req('POST', '/api/orders', {
        quoteId: (q.body as { quote: { id: string } }).quote.id,
        destinationId: (courier.body as { id: string }).id,
        receiveAddress: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
        accepted: LEGAL_DOCUMENTS.filter((d) => d.acceptance === 'order').map((d) => ({ slug: d.slug, version: d.version })),
      });
      expect(order.status).toBe(201);
      const orderId = (order.body as { id: string }).id;

      const up = await req('POST', `/api/orders/${orderId}/documents`, {
        kind: 'id_document',
        fileName: 'id.png',
        contentType: 'image/png',
        dataBase64: pngB64,
      });
      expect(up.status).toBe(201);
      const doc = up.body.documents![0]!;
      expect(doc.stored).toBe(true);
      expect(existsSync(absoluteFilePath(t.ctx, doc.id))).toBe(true);

      const dl = await req('GET', `/api/orders/${orderId}/documents/${doc.id}`);
      expect(dl.status).toBe(200);
      expect(dl.body.dataBase64).toBe(pngB64);

      // Second customer cannot read the file.
      const jar2 = new Map<string, string>();
      let csrf2: string | null = null;
      const req2 = async (method: string, p: string, body?: unknown) => {
        const headers: Record<string, string> = {};
        if (jar2.size) headers.cookie = [...jar2].map(([k, v]) => `${k}=${v}`).join('; ');
        if (method !== 'GET') {
          headers.origin = 'http://localhost:5173';
          if (csrf2) headers['x-csrf-token'] = csrf2;
          headers['content-type'] = 'application/json';
        }
        const res = await fetch(base + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
        for (const c of res.headers.getSetCookie()) {
          const [pair] = c.split(';');
          const i = pair!.indexOf('=');
          jar2.set(pair!.slice(0, i), pair!.slice(i + 1));
        }
        const text = await res.text();
        const parsed = text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
        if (parsed && typeof parsed === 'object' && parsed.csrfToken) csrf2 = parsed.csrfToken;
        return { status: res.status, body: parsed };
      };
      await req2('POST', '/api/auth/signup', {
        email: 'nosnoop@example.test',
        password: SANDBOX_PASSWORD,
        fullName: 'Other',
        countryOfResidence: 'US',
        stateOfResidence: 'NY',
        notInRestrictedTerritory: true,
        accepted: signupDocs(),
      });
      expect((await req2('GET', `/api/orders/${orderId}/documents/${doc.id}`)).status).toBe(404);

      await createAccount(t.ctx, {
        email: 'persist-admin@arcvale.test',
        password: SANDBOX_PASSWORD,
        role: 'admin',
        fullName: 'Admin',
      });
      const adminJar = new Map<string, string>();
      let adminCsrf: string | null = null;
      const adminReq = async (method: string, p: string, body?: unknown) => {
        const headers: Record<string, string> = {};
        if (adminJar.size) headers.cookie = [...adminJar].map(([k, v]) => `${k}=${v}`).join('; ');
        if (method !== 'GET') {
          headers.origin = 'http://localhost:5173';
          if (adminCsrf) headers['x-csrf-token'] = adminCsrf;
          headers['content-type'] = 'application/json';
        }
        const res = await fetch(base + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
        for (const c of res.headers.getSetCookie()) {
          const [pair] = c.split(';');
          const i = pair!.indexOf('=');
          adminJar.set(pair!.slice(0, i), pair!.slice(i + 1));
        }
        const text = await res.text();
        const parsed = text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
        if (parsed && typeof parsed === 'object' && parsed.csrfToken) adminCsrf = parsed.csrfToken;
        return { status: res.status, body: parsed as { dataBase64?: string } };
      };
      await adminReq('POST', '/api/auth/signin', {
        email: 'persist-admin@arcvale.test',
        password: SANDBOX_PASSWORD,
        staffOnly: true,
      });
      const staffDl = await adminReq('GET', `/api/admin/orders/${orderId}/documents/${doc.id}`);
      expect(staffDl.status).toBe(200);
      expect(staffDl.body.dataBase64).toBe(pngB64);

      // Anonymous denied.
      expect((await fetch(`${base}/api/orders/${orderId}/documents/${doc.id}`)).status).toBe(401);
    } finally {
      await t.app.close();
    }
  });
});

describe('isolated SQLite + FILES_DIR backup/restore', () => {
  let liveDir: string;
  let restoreDir: string;
  let backupDir: string;

  beforeEach(() => {
    liveDir = mkdtempSync(path.join(tmpdir(), 'arcvale-live-'));
    restoreDir = mkdtempSync(path.join(tmpdir(), 'arcvale-restore-'));
    backupDir = mkdtempSync(path.join(tmpdir(), 'arcvale-bak-'));
  });
  afterEach(() => {
    rmSync(liveDir, { recursive: true, force: true });
    rmSync(restoreDir, { recursive: true, force: true });
    rmSync(backupDir, { recursive: true, force: true });
  });

  it('restores DB metadata, encrypted blobs, and order document links', async () => {
    const encKey = Buffer.alloc(32, 9).toString('base64');
    const liveDb = path.join(liveDir, 'arcvale-sandbox.db');
    const liveFiles = path.join(liveDir, 'files');
    const clock = fixedClock(T0);

    const liveApp = createApp(
      {
        ...loadConfig({
          APP_MODE: 'sandbox',
          DATABASE_PATH: liveDb,
          FILES_DIR: liveFiles,
          DATA_ENCRYPTION_KEY: encKey,
          SERVE_STATIC: 'false',
          PUBLIC_ORIGIN: 'http://localhost:5173',
          RATES_SOURCE: 'default',
          SANDBOX_WEBHOOK_SECRET: 'test-webhook-secret-test-webhook-secret',
          SANDBOX_AUTOPILOT_STEP_MS: '0',
        }),
        port: 0,
        host: '127.0.0.1',
      },
      { clock, log: silentLogger },
    );
    const server = await liveApp.listen();
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const jar = new Map<string, string>();
    let csrf: string | null = null;
    const req = async (method: string, p: string, body?: unknown) => {
      const headers: Record<string, string> = {};
      if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
      if (method !== 'GET') {
        headers.origin = 'http://localhost:5173';
        if (csrf) headers['x-csrf-token'] = csrf;
        headers['content-type'] = 'application/json';
      }
      const res = await fetch(base + p, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const i = pair!.indexOf('=');
        jar.set(pair!.slice(0, i), pair!.slice(i + 1));
      }
      const text = await res.text();
      const parsed = text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
      if (parsed && typeof parsed === 'object' && parsed.csrfToken) csrf = parsed.csrfToken;
      return { status: res.status, body: parsed as Record<string, unknown> };
    };

    let orderId!: string;
    let docId!: string;
    try {
      expect(
        (
          await req('POST', '/api/auth/signup', {
            email: 'backup-restore@example.test',
            password: SANDBOX_PASSWORD,
            fullName: 'Backup Owner',
            countryOfResidence: 'US',
            stateOfResidence: 'NY',
            notInRestrictedTerritory: true,
            accepted: signupDocs(),
          })
        ).status,
      ).toBe(201);
      await req('POST', '/api/me/verification');

      const tomorrow = new Date(T0 + 86_400_000).toISOString().slice(0, 10);
      const courier = await req('POST', '/api/me/destinations/courier', {
        phone: '(212) 555-0199',
        line1: '100 Backup Lane',
        line2: '',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        window: 'any',
        preferredDate: tomorrow,
        instructions: '',
      });
      expect(courier.status).toBe(201);

      const q = await req('POST', '/api/quotes', {
        direction: 'buy',
        asset: 'USDT',
        network: 'tron',
        cashCents: '100000',
      });
      expect(q.status).toBe(201);

      const order = await req('POST', '/api/orders', {
        quoteId: (q.body as { quote: { id: string } }).quote.id,
        destinationId: (courier.body as { id: string }).id,
        receiveAddress: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
        accepted: LEGAL_DOCUMENTS.filter((d) => d.acceptance === 'order').map((d) => ({ slug: d.slug, version: d.version })),
      });
      expect(order.status).toBe(201);
      orderId = (order.body as { id: string }).id;

      const up = await req('POST', `/api/orders/${orderId}/documents`, {
        kind: 'id_document',
        fileName: 'id.png',
        contentType: 'image/png',
        dataBase64: pngB64,
      });
      expect(up.status).toBe(201);
      docId = (up.body as { documents: Array<{ id: string }> }).documents[0]!.id;
      expect(existsSync(path.join(liveFiles, 'order', `${docId}.enc`))).toBe(true);
    } finally {
      await liveApp.close();
    }

    // Mirror backup.sh: VACUUM INTO + tar of FILES_DIR (isolated; does not touch any real VPS volume).
    const backupDb = path.join(backupDir, 'arcvale-test.db');
    const filesTar = path.join(backupDir, 'arcvale-test-files.tar.gz');
    const db = openDatabase(liveDb);
    db.raw.prepare('VACUUM INTO ?').run(backupDb);
    db.close();
    execFileSync('tar', ['-czf', filesTar, '-C', liveDir, 'files']);

    // Wipe live data so a successful restore cannot be reading leftovers.
    rmSync(liveDir, { recursive: true, force: true });
    mkdirSync(liveDir, { recursive: true });

    mkdirSync(restoreDir, { recursive: true });
    const restoreDb = path.join(restoreDir, 'arcvale-sandbox.db');
    execFileSync('cp', [backupDb, restoreDb]);
    execFileSync('tar', ['-xzf', filesTar, '-C', restoreDir]);
    const restoreFiles = path.join(restoreDir, 'files');
    expect(existsSync(path.join(restoreFiles, 'order', `${docId}.enc`))).toBe(true);

    const restoredApp = createApp(
      {
        ...loadConfig({
          APP_MODE: 'sandbox',
          DATABASE_PATH: restoreDb,
          FILES_DIR: restoreFiles,
          DATA_ENCRYPTION_KEY: encKey,
          SERVE_STATIC: 'false',
          PUBLIC_ORIGIN: 'http://localhost:5173',
          RATES_SOURCE: 'default',
          SANDBOX_WEBHOOK_SECRET: 'test-webhook-secret-test-webhook-secret',
          SANDBOX_AUTOPILOT_STEP_MS: '0',
        }),
        port: 0,
        host: '127.0.0.1',
      },
      { clock: fixedClock(T0), log: silentLogger },
    );
    try {
      const row = restoredApp.ctx.db.get<{ id: string; order_id: string; stored: number; file_name: string }>(
        'SELECT id, order_id, stored, file_name FROM order_documents WHERE id = ?',
        [docId],
      );
      expect(row).toMatchObject({ id: docId, order_id: orderId, stored: 1, file_name: 'id.png' });
      expect(Buffer.compare(readOrderFile(restoredApp.ctx, docId), PNG)).toBe(0);

      const server2 = await restoredApp.listen();
      const base2 = `http://127.0.0.1:${(server2.address() as AddressInfo).port}`;
      const jar2 = new Map<string, string>();
      let csrf2: string | null = null;
      const req2 = async (method: string, p: string, body?: unknown) => {
        const headers: Record<string, string> = {};
        if (jar2.size) headers.cookie = [...jar2].map(([k, v]) => `${k}=${v}`).join('; ');
        if (method !== 'GET') {
          headers.origin = 'http://localhost:5173';
          if (csrf2) headers['x-csrf-token'] = csrf2;
          headers['content-type'] = 'application/json';
        }
        const res = await fetch(base2 + p, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        for (const c of res.headers.getSetCookie()) {
          const [pair] = c.split(';');
          const i = pair!.indexOf('=');
          jar2.set(pair!.slice(0, i), pair!.slice(i + 1));
        }
        const text = await res.text();
        const parsed = text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
        if (parsed && typeof parsed === 'object' && parsed.csrfToken) csrf2 = parsed.csrfToken;
        return { status: res.status, body: parsed as { dataBase64?: string } };
      };
      await req2('POST', '/api/auth/signin', {
        email: 'backup-restore@example.test',
        password: SANDBOX_PASSWORD,
      });
      const dl = await req2('GET', `/api/orders/${orderId}/documents/${docId}`);
      expect(dl.status).toBe(200);
      expect(dl.body.dataBase64).toBe(pngB64);
    } finally {
      await restoredApp.close();
    }
  });
});
