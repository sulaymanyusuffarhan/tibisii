import fs from 'node:fs';
import path from 'node:path';
import { getDb, closeDb } from '../src/lib/db';
import { getSiteSettings } from '../src/lib/settings';
import { getBackupDir, listDatabaseBackups } from '../src/lib/backup';
import { logger } from '../src/lib/logger';

async function main() {
  const db = await getDb();
  try {
    const settings = await getSiteSettings();
    const enquiryDays = Math.min(3650, Math.max(30, Number(settings.workflow.enquiry_retention_days) || 730));
    const auditDays = Math.min(3650, Math.max(30, Number(settings.workflow.audit_retention_days) || 1095));
    const analyticsDays = Math.min(3650, Math.max(30, Number(process.env.ANALYTICS_RETENTION_DAYS) || 395));
    const backupDays = Math.min(3650, Math.max(7, Number(process.env.BACKUP_RETENTION_DAYS) || 90));
    const [enquiries, audit, analytics, limits, sessions, resets] = await Promise.all([
      db.query(`DELETE FROM form_submissions WHERE retention_until IS NOT NULL AND retention_until < NOW()`),
      db.query('DELETE FROM audit_logs WHERE created_at < NOW() - ($1::text || \' days\')::interval', [auditDays]),
      db.query('DELETE FROM analytics_events WHERE created_at < NOW() - ($1::text || \' days\')::interval', [analyticsDays]),
      db.query('DELETE FROM rate_limits WHERE reset_at <= NOW()'),
      db.query('DELETE FROM sessions WHERE expires_at <= NOW()'),
      db.query('DELETE FROM password_reset_tokens WHERE expires_at <= NOW() OR used_at IS NOT NULL'),
    ]);
    const backups = listDatabaseBackups();
    const keepNewest = backups[0]?.filename;
    let backupsRemoved = 0;
    const cutoff = Date.now() - backupDays * 24 * 60 * 60 * 1000;
    for (const backup of backups) {
      if (backup.filename === keepNewest || new Date(backup.createdAt).getTime() >= cutoff) continue;
      fs.rmSync(path.join(getBackupDir(), backup.filename), { force: true });
      fs.rmSync(path.join(getBackupDir(), `${backup.filename}.media`), { recursive: true, force: true });
      backupsRemoved += 1;
    }
    const removed = { enquiries: enquiries.rowCount, audit: audit.rowCount, analytics: analytics.rowCount, rateLimits: limits.rowCount, sessions: sessions.rowCount, resetTokens: resets.rowCount, backups: backupsRemoved };
    logger.info('maintenance.completed', removed);
    console.log(`Retention maintenance completed: ${JSON.stringify(removed)}`);
  } finally { await closeDb(); }
}
main().catch((error) => { logger.error('maintenance.failed', error); process.exitCode = 1; });
