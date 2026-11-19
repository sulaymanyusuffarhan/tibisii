import { createDatabaseBackup } from '../src/lib/backup';
import { getDb, closeDb } from '../src/lib/db';
import { logAudit } from '../src/lib/audit';
import { logger } from '../src/lib/logger';

async function main() {
  const db = await getDb();
  try {
    const result = await createDatabaseBackup(process.env.BACKUP_CREATED_BY || 'scheduled-operator', db);
    await logAudit({ action: 'backup.created', summary: `Database backup ${result.filename} created (${result.totalRows} rows, ${result.mediaFiles} media files, encrypted=${result.encrypted}).` });
    logger.info('backup.created', { filename: result.filename, sizeBytes: result.sizeBytes, rows: result.totalRows, mediaFiles: result.mediaFiles, encrypted: result.encrypted });
  } finally { await closeDb(); }
}
main().catch((error) => { logger.error('backup.failed', error); process.exitCode = 1; });
