/**
 * Migration 13: rewrite historical alphanumeric public order numbers to 10 digits
 * without dropping rows; add payout_tx_hash. Isolated temp DB only.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../db/database';
import { MIGRATIONS } from '../db/migrations';
import { T0 } from './helpers';

function applyOne(db: Db, mode: 'production' | 'sandbox', now: number, id: number) {
  const m = MIGRATIONS.find((x) => x.id === id);
  if (!m) throw new Error(`missing migration ${id}`);
  if (m.disableForeignKeys) db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.tx(() => {
      db.exec(m.sql);
      if (m.run) m.run(db);
      if (m.disableForeignKeys) {
        const broken = db.all('PRAGMA foreign_key_check');
        if (broken.length) throw new Error(`Migration ${m.id} would break FKs`);
      }
      db.run('INSERT INTO schema_migrations (id, name, checksum, applied_at) VALUES (?, ?, ?, ?)', [
        m.id,
        m.name,
        'test',
        now,
      ]);
      if (m.id === 1) db.run("INSERT INTO app_meta (key, value) VALUES ('mode', ?)", [mode]);
    });
  } finally {
    if (m.disableForeignKeys) db.exec('PRAGMA foreign_keys = ON');
  }
}

describe('digit order reference migration', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('rewrites CBX-style references idempotently and keeps primary keys', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'arcvale-digit-ref-'));
    dirs.push(dir);
    const db = openDatabase(path.join(dir, 'm.db'));
    const now = T0;

    db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)',
    );
    for (const m of MIGRATIONS.filter((x) => x.id <= 12)) applyOne(db, 'production', now, m.id);

    const userId = 'usr_digitref_test';
    const quoteId = 'quo_digitref_test';
    const orderId = 'ord_digitref_test01';
    db.run(
      `INSERT INTO users (id, email, password_hash, role, status, created_at, updated_at)
       VALUES (?, 'digit-ref@example.test', ?, 'customer', 'active', ?, ?)`,
      [userId, createHash('sha256').update('x').digest('hex'), now, now],
    );
    // Buy/wire needs no payout_destination_id (customer receive address is refund_address).
    db.run(
      `INSERT INTO quotes (
         id, user_id, source, asset, network, payout_method, amount_atomic, reference_price_micros, price_as_of,
         gross_cents, spread_bps, spread_cents, payout_fee_cents, net_cents, effective_rate_micros,
         expires_at, issues, created_at, direction
       ) VALUES (?, ?, 'live', 'USDC', 'ethereum', 'wire', '1000000', '1000000', ?, 10000, 0, 0, 3200, 6800, '1000000', ?, '[]', ?, 'buy')`,
      [quoteId, userId, now, now + 60_000, now],
    );
    db.run(
      `INSERT INTO orders (
         id, reference, user_id, quote_id, status, source, asset, network, amount_atomic, reference_price_micros,
         gross_cents, spread_bps, spread_cents, payout_fee_cents, net_cents, payout_method, payout_destination_id,
         payout_label, payout_last4, refund_address, deposit_deadline, confirmations_required, created_at, updated_at, direction
       ) VALUES (?, 'CBX-RXJFKX5W', ?, ?, 'created', 'live', 'USDC', 'ethereum', '1000000', '1000000',
         10000, 0, 0, 3200, 6800, 'wire', NULL, 'Wire', 'wire', '0x3E9c431EEaaD6F41698A137907A93eF63EDD8ff3', ?, 12, ?, ?, 'buy')`,
      [orderId, userId, quoteId, now + 1_800_000, now, now],
    );

    expect(db.get<{ reference: string }>('SELECT reference FROM orders WHERE id = ?', [orderId])?.reference).toBe('CBX-RXJFKX5W');

    applyOne(db, 'production', now + 1, 13);

    const after = db.get<{ id: string; reference: string }>('SELECT id, reference FROM orders WHERE id = ?', [orderId]);
    expect(after?.id).toBe(orderId);
    expect(after?.reference).toMatch(/^\d{10}$/);
    expect(after?.reference).not.toBe('CBX-RXJFKX5W');

    // Re-run remap logic alone (idempotent): drop trigger, call run with no non-digit rows, restore.
    const m13 = MIGRATIONS.find((m) => m.id === 13)!;
    db.exec('DROP TRIGGER IF EXISTS orders_snapshot_immutable');
    m13.run?.(db);
    expect(db.get<{ reference: string }>('SELECT reference FROM orders WHERE id = ?', [orderId])?.reference).toBe(after?.reference);

    const cols = db.all<{ name: string }>('PRAGMA table_info(payout_instructions)');
    expect(cols.some((c) => c.name === 'payout_tx_hash')).toBe(true);

    expect(() => db.run('UPDATE orders SET reference = ? WHERE id = ?', ['1111111111', orderId])).toThrow(/immutable/);

    db.close();
  });
});
