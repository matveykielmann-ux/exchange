/** Schema guarantees: migrations, append-only tables, immutable quote snapshots, the audit hash chain, money constraints. */
import { migrate, migrationStatus, openDatabase } from '../db/database';
import { MIGRATIONS } from '../db/migrations';
import { placeOrder, sandboxCustomer, sandboxOperator } from '../scenarios';
import { verifyAuditChain } from '../services/audit';
import * as sandbox from '../services/sandbox';
import { testApp } from './helpers';

describe('database', () => {
  it('applies migrations once and records checksums', () => {
    const db = openDatabase(':memory:');
    expect(migrate(db, 'sandbox', 1)).toEqual(MIGRATIONS.map((m) => m.id));
    expect(migrate(db, 'sandbox', 2)).toEqual([]);
    expect(migrationStatus(db).pending).toEqual([]);
    db.run("UPDATE schema_migrations SET checksum = 'tampered' WHERE id = 1");
    expect(() => migrationStatus(db)).toThrow(/edited after it was applied/);
    db.close();
  });

  it('enforces append-only history, immutable snapshots and exact money columns', async () => {
    const { ctx, app } = testApp();
    const c = await sandboxCustomer(ctx, 'db@example.test');
    const op = await sandboxOperator(ctx, 'dbop@example.test');
    const o = await placeOrder(ctx, c);
    sandbox.simulateDeposit(ctx, op, o.id, 'exact');

    expect(() => ctx.db.run('UPDATE order_events SET detail = ? WHERE order_id = ?', ['x', o.id])).toThrow(/append-only/);
    expect(() => ctx.db.run('DELETE FROM order_events WHERE order_id = ?', [o.id])).toThrow(/append-only/);
    expect(() => ctx.db.run('DELETE FROM audit_events')).toThrow(/append-only/);
    expect(() => ctx.db.run('UPDATE deposit_observations SET amount_atomic = ?', ['1'])).toThrow(/append-only/);
    expect(() => ctx.db.run('UPDATE orders SET net_cents = net_cents + 100 WHERE id = ?', [o.id])).toThrow(/immutable/);
    expect(() => ctx.db.run('UPDATE orders SET reference_price_micros = ? WHERE id = ?', ['1', o.id])).toThrow(/immutable/);
    // Gross − spread − fee must equal net for any stored quote.
    expect(() =>
      ctx.db.run(
        `INSERT INTO quotes (id, user_id, source, asset, network, payout_method, amount_atomic, reference_price_micros, price_as_of, gross_cents, spread_bps,
          spread_cents, payout_fee_cents, net_cents, effective_rate_micros, issues, created_at, expires_at)
         VALUES ('qte_bad', ?, 'sandbox', 'BTC', 'bitcoin', 'ach', '1', '1', 1, 1000, 100, 10, 0, 999, '1', '[]', 1, 2)`,
        [c.userId],
      ),
    ).toThrow(/CHECK/);
    expect(verifyAuditChain(ctx).ok).toBe(true);
    await app.close();
  });

  it('detects tampering with the audit chain', async () => {
    const { ctx, app } = testApp();
    await sandboxCustomer(ctx, 'chain@example.test');
    ctx.db.exec('DROP TRIGGER audit_events_no_update');
    ctx.db.run("UPDATE audit_events SET action = 'tampered' WHERE id = 2");
    const r = verifyAuditChain(ctx);
    expect(r.ok).toBe(false);
    await app.close();
  });
});
