/**
 * SQLite through Node's built-in node:sqlite (no native add-on to compile).
 * WAL journal, foreign keys on, busy timeout, and an explicit transaction
 * helper. One process owns the file; see README_DEPLOY.md.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { MIGRATIONS, type Migration } from './migrations';
import type { AppMode } from '../config';

export type Params = Record<string, SQLInputValue> | SQLInputValue[];
export type Row = Record<string, unknown>;

export class Db {
  readonly raw: DatabaseSync;
  private cache = new Map<string, StatementSync>();
  private depth = 0;
  private pending: (() => void)[] = [];

  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
    this.raw = new DatabaseSync(file);
    this.raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  }

  private stmt(sql: string): StatementSync {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.raw.prepare(sql);
      this.cache.set(sql, s);
    }
    return s;
  }

  private bind(s: StatementSync, params: Params | undefined, op: 'get' | 'all' | 'run') {
    if (params === undefined) return s[op]();
    if (Array.isArray(params)) return s[op](...params);
    return s[op](params);
  }

  get<T = Row>(sql: string, params?: Params): T | undefined {
    return this.bind(this.stmt(sql), params, 'get') as T | undefined;
  }

  all<T = Row>(sql: string, params?: Params): T[] {
    return this.bind(this.stmt(sql), params, 'all') as T[];
  }

  run(sql: string, params?: Params): { changes: number; lastInsertRowid: number | bigint } {
    return this.bind(this.stmt(sql), params, 'run') as { changes: number; lastInsertRowid: number | bigint };
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  /**
   * Runs `fn` after the current transaction commits (dropped on rollback), or
   * on the next tick when no transaction is open. Used for live-update
   * publishing and outbound provider calls that must not precede the commit.
   */
  afterCommit(fn: () => void): void {
    if (this.depth > 0) this.pending.push(fn);
    else setImmediate(fn);
  }

  private flush(run: boolean) {
    const queue = this.pending;
    this.pending = [];
    if (run) for (const fn of queue) setImmediate(fn);
  }

  /**
   * Runs `fn` in one transaction (BEGIN IMMEDIATE takes the write lock up
   * front). Nested calls join the outer transaction via savepoints.
   */
  tx<T>(fn: () => T): T {
    if (this.depth > 0) {
      const name = `sp_${this.depth}`;
      const mark = this.pending.length;
      this.raw.exec(`SAVEPOINT ${name}`);
      this.depth++;
      try {
        const out = fn();
        this.raw.exec(`RELEASE ${name}`);
        return out;
      } catch (e) {
        this.raw.exec(`ROLLBACK TO ${name}; RELEASE ${name}`);
        this.pending.length = mark;
        throw e;
      } finally {
        this.depth--;
      }
    }
    // A previous failed transaction can leave the connection busy while depth is
    // already 0 (node:sqlite). Always try to clear before beginning again.
    try {
      this.raw.exec('ROLLBACK');
    } catch {
      /* no open transaction */
    }
    this.raw.exec('BEGIN IMMEDIATE');
    this.depth = 1;
    try {
      const out = fn();
      this.raw.exec('COMMIT');
      this.depth = 0;
      this.flush(true);
      return out;
    } catch (e) {
      try {
        this.raw.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      this.depth = 0;
      this.flush(false);
      throw e;
    }
  }

  close(): void {
    this.cache.clear();
    if (this.raw.isOpen) this.raw.close();
  }
}

/** Checksum of a migration. Migrations without `run` keep the historical sha256(sql) form. */
const checksum = (m: Migration) => {
  const h = createHash('sha256').update(m.sql);
  if (m.run) h.update('\0').update(m.run.toString());
  return h.digest('hex');
};

export interface MigrationStatus {
  applied: { id: number; name: string; appliedAt: number }[];
  pending: { id: number; name: string }[];
}

export function migrationStatus(db: Db): MigrationStatus {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)',
  );
  const applied = db.all<{ id: number; name: string; checksum: string; applied_at: number }>('SELECT * FROM schema_migrations ORDER BY id');
  for (const a of applied) {
    const m = MIGRATIONS.find((x) => x.id === a.id);
    if (!m) throw new Error(`Database has migration ${a.id} (${a.name}) that this build does not know. Refusing to run an older build.`);
    if (checksum(m) !== a.checksum) throw new Error(`Migration ${a.id} (${a.name}) was edited after it was applied.`);
  }
  return {
    applied: applied.map((a) => ({ id: a.id, name: a.name, appliedAt: a.applied_at })),
    pending: MIGRATIONS.filter((m) => !applied.some((a) => a.id === m.id)).map((m) => ({ id: m.id, name: m.name })),
  };
}

/** Applies pending migrations in order, each in its own transaction. */
export function migrate(db: Db, mode: AppMode, now: number): number[] {
  const { pending } = migrationStatus(db);
  const ran: number[] = [];
  for (const p of pending) {
    const m = MIGRATIONS.find((x) => x.id === p.id)!;
    // PRAGMA foreign_keys is a no-op inside a transaction, so it is switched outside it.
    if (m.disableForeignKeys) db.exec('PRAGMA foreign_keys = OFF');
    try {
      db.tx(() => {
        db.exec(m.sql);
        if (m.run) m.run(db);
        if (m.disableForeignKeys) {
          const broken = db.all('PRAGMA foreign_key_check');
          if (broken.length) throw new Error(`Migration ${m.id} (${m.name}) would break ${broken.length} foreign key reference(s).`);
        }
        db.run('INSERT INTO schema_migrations (id, name, checksum, applied_at) VALUES (?, ?, ?, ?)', [m.id, m.name, checksum(m), now]);
        if (m.id === 1) db.run("INSERT INTO app_meta (key, value) VALUES ('mode', ?)", [mode]);
      });
    } finally {
      if (m.disableForeignKeys) db.exec('PRAGMA foreign_keys = ON');
    }
    ran.push(m.id);
  }
  assertDatabaseMode(db, mode);
  return ran;
}

/** Sandbox and production data never share a database file. */
export function assertDatabaseMode(db: Db, mode: AppMode): void {
  const row = db.get<{ value: string }>("SELECT value FROM app_meta WHERE key = 'mode'");
  if (row && row.value !== mode)
    throw new Error(`This database belongs to ${row.value} mode and cannot be opened in ${mode} mode. Use a separate DATABASE_PATH.`);
}

export function openDatabase(file: string): Db {
  return new Db(file);
}
