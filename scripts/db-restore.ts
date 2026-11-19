import { readDatabaseBackup, restoreDatabaseBackup } from '../src/lib/backup';
import { getDb, closeDb } from '../src/lib/db';
import path from 'node:path';
import { logAudit } from '../src/lib/audit';
import { logger } from '../src/lib/logger';
import { runMigrations } from '../src/lib/db';

async function main() {
  const filename = process.argv[2];
  if (!filename) throw new Error('Usage: npm run db:restore -- <backup-filename>');
  const db = await getDb();
  try {
    await runMigrations(db);
    const snapshot = readDatabaseBackup(filename);
    const result = await restoreDatabaseBackup(snapshot, { customDb: db, uploadsBackupDir: path.join(process.cwd(), process.env.BACKUP_DIR || './storage/backups', `${filename}.media`) });
    await logAudit({ action: 'backup.restored', summary: `Restored ${filename}: ${result.restoredRows} rows across ${result.restoredTables} tables.` });
    logger.info('backup.restored', { filename, restoredRows: result.restoredRows, restoredTables: result.restoredTables });
  } finally { await closeDb(); }
}
main().catch((error) => { logger.error('backup.restore_failed', error); process.exitCode = 1; });
