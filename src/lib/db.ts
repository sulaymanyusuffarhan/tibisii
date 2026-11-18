import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { Pool, type QueryResultRow } from 'pg';

export interface DbQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface DbAdapter {
  driver: 'pg' | 'pglite';
  query<T extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<DbQueryResult<T>>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface DbClient {
  query<T extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<DbQueryResult<T>>;
  exec(sql: string): Promise<void>;
}

declare global {
  // eslint-disable-next-line no-var
  var __tbcDbAdapter: DbAdapter | undefined;
  // eslint-disable-next-line no-var
  var __tbcDbInitPromise: Promise<DbAdapter> | undefined;
  // eslint-disable-next-line no-var
  var __tbcLastScheduledCheck: number | undefined;
}

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || 'pglite://./storage/pgdata';
}

export function isExternalPostgres(): boolean {
  const url = getDatabaseUrl();
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

async function createAdapter(): Promise<DbAdapter> {
  const dbUrl = getDatabaseUrl();

  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    const sslEnabled =
      process.env.DATABASE_SSL === 'true' || dbUrl.includes('sslmode=require');
    const pool = new Pool({
      connectionString: dbUrl,
      max: 15,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: sslEnabled ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
    });

    return {
      driver: 'pg',
      async query<T extends QueryResultRow = Record<string, unknown>>(sql: string, params: unknown[] = []) {
        const res = await pool.query<T>(sql, params);
        return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
      },
      async exec(sql: string) {
        await pool.query(sql);
      },
      async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const tx: DbClient = {
            async query<R extends QueryResultRow = Record<string, unknown>>(s: string, p: unknown[] = []) {
              const r = await client.query<R>(s, p);
              return { rows: r.rows, rowCount: r.rowCount ?? r.rows.length };
            },
            async exec(s: string) {
              await client.query(s);
            },
          };
          const out = await fn(tx);
          await client.query('COMMIT');
          return out;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
      async close() {
        await pool.end();
      },
    };
  }

  // Embedded PostgreSQL (PGlite) — ideal for instant local development & sandbox staging
  let dataDir = dbUrl.replace(/^pglite:\/\//, '');
  if (dataDir !== 'memory://') {
    dataDir = path.resolve(process.cwd(), dataDir || './storage/pgdata');
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const pglite = dataDir === 'memory://' ? new PGlite() : new PGlite(dataDir);
  await pglite.waitReady;

  return {
    driver: 'pglite',
    async query<T extends QueryResultRow = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const res = await pglite.query<T>(sql, params);
      return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
    },
    async exec(sql: string) {
      await pglite.exec(sql);
    },
    async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
      return pglite.transaction(async (pgTx) => {
        const tx: DbClient = {
          async query<R extends QueryResultRow = Record<string, unknown>>(s: string, p: unknown[] = []) {
            const r = await pgTx.query<R>(s, p);
            return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
          },
          async exec(s: string) {
            await pgTx.exec(s);
          },
        };
        return fn(tx);
      });
    },
    async close() {
      await pglite.close();
    },
  };
}

export async function runMigrations(adapter: DbAdapter): Promise<string[]> {
  await adapter.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
  if (!fs.existsSync(migrationsDir)) return [];

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const existing = await adapter.query<{ version: string }>(
    'SELECT version FROM schema_migrations'
  );
  const appliedSet = new Set(existing.rows.map((r) => r.version));
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await adapter.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [
        file,
      ]);
    });
    newlyApplied.push(file);
  }

  return newlyApplied;
}

export async function getRawDb(): Promise<DbAdapter> {
  if (globalThis.__tbcDbAdapter) return globalThis.__tbcDbAdapter;
  const adapter = await createAdapter();
  globalThis.__tbcDbAdapter = adapter;
  return adapter;
}

export async function getDb(): Promise<DbAdapter> {
  if (globalThis.__tbcDbAdapter && !globalThis.__tbcDbInitPromise) {
    // Periodically promote due scheduled publications (every 30s max)
    const now = Date.now();
    if (!globalThis.__tbcLastScheduledCheck || now - globalThis.__tbcLastScheduledCheck > 30_000) {
      globalThis.__tbcLastScheduledCheck = now;
      promoteScheduledContent(globalThis.__tbcDbAdapter).catch(() => {});
    }
    return globalThis.__tbcDbAdapter;
  }

  if (!globalThis.__tbcDbInitPromise) {
    globalThis.__tbcDbInitPromise = (async () => {
      const adapter = await getRawDb();
      if (process.env.AUTO_INIT_DB !== 'false') {
        await runMigrations(adapter);
        const roleCount = await adapter.query<{ c: string }>(
          'SELECT COUNT(*)::text AS c FROM roles'
        );
        if (Number(roleCount.rows[0]?.c || '0') === 0) {
          const { seedDatabase } = await import('./seed-data');
          await seedDatabase(adapter);
        }
      }
      await promoteScheduledContent(adapter).catch(() => {});
      globalThis.__tbcLastScheduledCheck = Date.now();
      return adapter;
    })();
  }

  try {
    const ready = await globalThis.__tbcDbInitPromise;
    globalThis.__tbcDbInitPromise = undefined;
    return ready;
  } catch (err) {
    globalThis.__tbcDbInitPromise = undefined;
    throw err;
  }
}

export async function promoteScheduledContent(adapter: DbAdapter): Promise<number> {
  let promoted = 0;
  const tables = ['articles', 'publications', 'events', 'pages'] as const;
  for (const tbl of tables) {
    const res = await adapter.query<{ id: string }>(
      `UPDATE ${tbl}
       SET workflow_status = 'published',
           published_at = COALESCE(scheduled_at, NOW()),
           updated_at = NOW()
       WHERE workflow_status = 'scheduled'
         AND scheduled_at IS NOT NULL
         AND scheduled_at <= NOW()
       RETURNING id`
    );
    promoted += res.rows.length;
  }
  return promoted;
}

export async function closeDb(): Promise<void> {
  if (globalThis.__tbcDbAdapter) {
    await globalThis.__tbcDbAdapter.close();
    globalThis.__tbcDbAdapter = undefined;
    globalThis.__tbcDbInitPromise = undefined;
  }
}
