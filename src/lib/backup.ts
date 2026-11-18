import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb, type DbAdapter } from './db';

// Ordered in strict foreign-key dependency order for clean backup & restore
export const BACKUP_TABLES = [
  'roles',
  'users',
  'site_settings',
  'menu_items',
  'homepage_sections',
  'categories',
  'tags',
  'media_assets',
  'pages',
  'articles',
  'events',
  'publications',
  'leadership_profiles',
  'broadcast_channels',
  'broadcast_programmes',
  'personnel_profiles',
  'testimonials',
  'regional_offices',
  'faqs',
  'form_submissions',
  'workflow_history',
  'audit_logs',
  'analytics_events',
] as const;

export interface BackupSnapshot {
  format: 'tbc-corporate-cms-backup-v1';
  createdAt: string;
  createdBy: string;
  driver: 'pg' | 'pglite';
  rowCounts: Record<string, number>;
  checksum: string;
  tables: Record<string, Record<string, unknown>[]>;
}

export function getBackupDir(): string {
  const dir = path.resolve(process.cwd(), process.env.BACKUP_DIR || './storage/backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function createDatabaseBackup(
  createdBy = 'system',
  customDb?: DbAdapter
): Promise<{ filename: string; filePath: string; sizeBytes: number; totalRows: number; createdAt: string }> {
  const db = customDb || (await getDb());
  const tables: Record<string, Record<string, unknown>[]> = {};
  const rowCounts: Record<string, number> = {};
  let totalRows = 0;

  for (const table of BACKUP_TABLES) {
    // For menu_items self-FK, export parent rows (parent_id IS NULL) before children
    const orderClause =
      table === 'menu_items' ? ' ORDER BY (parent_id IS NOT NULL) ASC, sort_order ASC' : '';
    const res = await db.query<Record<string, unknown>>(`SELECT * FROM ${table}${orderClause}`);
    tables[table] = res.rows;
    rowCounts[table] = res.rows.length;
    totalRows += res.rows.length;
  }

  const tablesSerialized = JSON.stringify(tables);
  const checksum = crypto.createHash('sha256').update(tablesSerialized).digest('hex');
  const createdAt = new Date().toISOString();

  const snapshot: BackupSnapshot = {
    format: 'tbc-corporate-cms-backup-v1',
    createdAt,
    createdBy,
    driver: db.driver,
    rowCounts,
    checksum,
    tables,
  };

  const stamp = createdAt.replace(/[:.]/g, '-');
  const filename = `tbc-backup-${stamp}.json`;
  const filePath = path.join(getBackupDir(), filename);
  const content = JSON.stringify(snapshot, null, 2);
  fs.writeFileSync(filePath, content, { encoding: 'utf8', mode: 0o600 });

  return {
    filename,
    filePath,
    sizeBytes: Buffer.byteLength(content, 'utf8'),
    totalRows,
    createdAt,
  };
}

export function listDatabaseBackups(): Array<{
  filename: string;
  sizeBytes: number;
  createdAt: string;
}> {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^tbc-backup-[a-zA-Z0-9._-]+\.json$/.test(f))
    .map((filename) => {
      const st = fs.statSync(path.join(dir, filename));
      return {
        filename,
        sizeBytes: st.size,
        createdAt: st.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function restoreDatabaseBackup(
  snapshot: BackupSnapshot,
  options: { preserveCurrentSession?: boolean; customDb?: DbAdapter } = {}
): Promise<{ restoredTables: number; restoredRows: number }> {
  if (!snapshot || snapshot.format !== 'tbc-corporate-cms-backup-v1' || !snapshot.tables) {
    throw new Error('Invalid backup archive format.');
  }

  // Verify SHA-256 integrity checksum
  const computed = crypto.createHash('sha256').update(JSON.stringify(snapshot.tables)).digest('hex');
  if (snapshot.checksum && computed !== snapshot.checksum) {
    throw new Error('Backup integrity check failed: SHA-256 checksum mismatch.');
  }

  const db = options.customDb || (await getDb());
  let restoredRows = 0;
  let restoredTables = 0;

  await db.transaction(async (tx) => {
    // Save active sessions if requested so logged-in super admin remains authenticated if user still exists
    const activeSessions = options.preserveCurrentSession
      ? (await tx.query<Record<string, unknown>>('SELECT * FROM sessions WHERE expires_at > NOW()')).rows
      : [];

    // Delete in reverse dependency order
    const reverse = [...BACKUP_TABLES].reverse();
    await tx.exec('DELETE FROM password_reset_tokens');
    await tx.exec('DELETE FROM sessions');
    for (const table of reverse) {
      await tx.exec(`DELETE FROM ${table}`);
    }

    // Re-insert in forward dependency order with parameterized queries
    for (const table of BACKUP_TABLES) {
      const rows = snapshot.tables[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      restoredTables += 1;

      const sortedRows =
        table === 'menu_items'
          ? [...rows].sort((a, b) => Number(Boolean(a.parent_id)) - Number(Boolean(b.parent_id)))
          : rows;

      for (const row of sortedRows) {
        const cols = Object.keys(row).filter((c) => /^[a-z_][a-z0-9_]*$/.test(c));
        if (cols.length === 0) continue;
        const vals = cols.map((c) => {
          const v = row[c];
          if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
            return JSON.stringify(v);
          }
          return v;
        });
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        await tx.query(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
          vals
        );
        restoredRows += 1;
      }
    }

    // Restore surviving sessions whose user still exists
    if (activeSessions.length > 0) {
      const validUsers = new Set(
        (await tx.query<{ id: string }>('SELECT id FROM users WHERE is_active = TRUE')).rows.map(
          (u) => u.id
        )
      );
      for (const s of activeSessions) {
        if (!validUsers.has(String(s.user_id))) continue;
        await tx.query(
          `INSERT INTO sessions (id, user_id, token_hash, csrf_token, ip_address, user_agent, mfa_verified, expires_at, last_active_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
          [
            s.id, s.user_id, s.token_hash, s.csrf_token, s.ip_address,
            s.user_agent, s.mfa_verified, s.expires_at, s.last_active_at, s.created_at,
          ]
        );
      }
    }
  });

  return { restoredTables, restoredRows };
}
