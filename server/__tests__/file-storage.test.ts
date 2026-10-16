/**
 * Persistent encrypted order-file storage (FILES_DIR).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { LEGAL_DOCUMENTS } from '@/content/legal';
import { createApp } from '../app';
import { ConfigError, loadConfig } from '../config';
import { createAccount } from '../services/auth';
import { absoluteFilePath, readOrderFile, writeOrderFile } from '../services/fileStore';
import { SANDBOX_PASSWORD } from '../scenarios';
import { silentLogger } from '../logger';
import { testApp } from './helpers';

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
