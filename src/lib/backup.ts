import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, type DbAdapter } from './db';

export const BACKUP_TABLES = [
  'roles', 'users', 'site_settings', 'menu_items', 'homepage_sections', 'categories', 'tags',
  'media_assets', 'pages', 'articles', 'events', 'publications', 'leadership_profiles',
  'broadcast_channels', 'broadcast_programmes', 'personnel_profiles', 'testimonials',
  'regional_offices', 'faqs', 'form_submissions', 'workflow_history', 'audit_logs', 'analytics_events',
] as const;
export interface BackupMediaFile { relativePath: string; sha256: string; sizeBytes: number; encrypted: boolean; iv?: string; tag?: string }
export interface BackupSnapshot {
  format: 'tbc-corporate-cms-backup-v1';
  createdAt: string;
  createdBy: string;
  driver: 'pg' | 'pglite';
  rowCounts: Record<string, number>;
  checksum: string;
  tables: Record<string, Record<string, unknown>[]>;
  mediaFiles?: BackupMediaFile[];
}
type EncryptedArchive = { format: 'tbc-corporate-cms-encrypted-backup-v1'; algorithm: 'aes-256-gcm'; iv: string; tag: string; ciphertext: string };
function encryptionKey(): Buffer | null {
  const secret = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') throw new Error('BACKUP_ENCRYPTION_KEY is required for production backups and restores.');
    return null;
  }
  if (secret.length < 32) throw new Error('BACKUP_ENCRYPTION_KEY must contain at least 32 characters (generate with openssl rand -hex 32).');
  return crypto.createHash('sha256').update(secret).digest();
}
function encryptMedia(bytes: Buffer, key: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { ciphertext, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}
function decryptMedia(bytes: Buffer, entry: BackupMediaFile, key: Buffer | null) {
  if (!entry.encrypted) return bytes;
  if (!key || !entry.iv || !entry.tag) throw new Error('BACKUP_ENCRYPTION_KEY is required to restore encrypted media files.');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(entry.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(entry.tag, 'base64'));
    return Buffer.concat([decipher.update(bytes), decipher.final()]);
  } catch { throw new Error(`Media decryption/authentication failed for ${entry.relativePath}.`); }
}
function encodeSnapshot(snapshot: BackupSnapshot, key: Buffer | null): string {
  const plain = JSON.stringify(snapshot, null, 2);
  if (!key) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const envelope: EncryptedArchive = {
    format: 'tbc-corporate-cms-encrypted-backup-v1', algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64'),
  };
  return JSON.stringify(envelope);
}
export function decodeBackupArchive(raw: string): BackupSnapshot {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('Backup archive is not valid JSON.'); }
  if (parsed && typeof parsed === 'object' && (parsed as EncryptedArchive).format === 'tbc-corporate-cms-encrypted-backup-v1') {
    const envelope = parsed as EncryptedArchive;
    if (envelope.algorithm !== 'aes-256-gcm' || !envelope.iv || !envelope.tag || !envelope.ciphertext) throw new Error('Encrypted backup envelope is malformed.');
    const key = encryptionKey();
    if (!key) throw new Error('Set BACKUP_ENCRYPTION_KEY to decrypt this backup.');
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const plain = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8');
      parsed = JSON.parse(plain);
    } catch { throw new Error('Backup decryption or authentication failed; verify BACKUP_ENCRYPTION_KEY and archive integrity.'); }
  }
  const snapshot = parsed as BackupSnapshot;
  validateSnapshot(snapshot);
  return snapshot;
}
function validateSnapshot(snapshot: BackupSnapshot) {
  if (!snapshot || snapshot.format !== 'tbc-corporate-cms-backup-v1' || !snapshot.tables || typeof snapshot.tables !== 'object') throw new Error('Invalid backup archive format.');
  for (const table of Object.keys(snapshot.tables)) {
    if (!(BACKUP_TABLES as readonly string[]).includes(table)) throw new Error(`Backup contains unsupported table: ${table}`);
    if (!Array.isArray(snapshot.tables[table])) throw new Error(`Backup table ${table} is malformed.`);
    for (const row of snapshot.tables[table]) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some((column) => !/^[a-z_][a-z0-9_]*$/.test(column))) throw new Error(`Backup table ${table} contains an invalid row.`);
    }
  }
  if (Object.keys(snapshot.tables).length !== BACKUP_TABLES.length || BACKUP_TABLES.some((table) => !Array.isArray(snapshot.tables[table]))) throw new Error('Backup does not contain the full supported table set.');
  const computed = crypto.createHash('sha256').update(JSON.stringify(snapshot.tables)).digest('hex');
  if (!snapshot.checksum || computed !== snapshot.checksum) throw new Error('Backup integrity check failed: SHA-256 checksum mismatch.');
  if (snapshot.mediaFiles !== undefined) {
    if (!Array.isArray(snapshot.mediaFiles)) throw new Error('Backup media manifest is malformed.');
    const seen = new Set<string>();
    for (const entry of snapshot.mediaFiles) {
      if (!entry || typeof entry.relativePath !== 'string' || !/^files\/[a-zA-Z0-9_-]+\.[a-z0-9]{1,12}$/.test(entry.relativePath) || seen.has(entry.relativePath) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 0 || typeof entry.encrypted !== 'boolean') throw new Error('Backup media manifest contains an invalid entry.');
      if (entry.encrypted && (!entry.iv || !entry.tag)) throw new Error('Encrypted media manifest entry is missing authentication data.');
      seen.add(entry.relativePath);
    }
  }
}
export function getBackupDir(): string {
  const dir = path.resolve(process.cwd(), process.env.BACKUP_DIR || './storage/backups');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch { /* retain platform defaults where chmod is unavailable */ }
  return dir;
}
export async function createDatabaseBackup(createdBy = 'system', customDb?: DbAdapter) {
  const db = customDb || await getDb();
  const tables: Record<string, Record<string, unknown>[]> = {};
  const rowCounts: Record<string, number> = {};
  let totalRows = 0;
  await db.transaction(async (tx) => {
    await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    for (const table of BACKUP_TABLES) {
      const order = table === 'menu_items' ? ' ORDER BY (parent_id IS NOT NULL) ASC, sort_order ASC' : '';
      const result = await tx.query<Record<string, unknown>>(`SELECT * FROM ${table}${order}`);
      tables[table] = result.rows;
      rowCounts[table] = result.rows.length;
      totalRows += result.rows.length;
    }
  });
  const createdAt = new Date().toISOString();
  const key = encryptionKey();
  const stamp = createdAt.replace(/[:.]/g, '-');
  const filename = `tbc-backup-${stamp}-${crypto.randomBytes(3).toString('hex')}.json${key ? '.enc' : ''}`;
  const filePath = path.join(getBackupDir(), filename);
  const mediaFinalDir = `${filePath}.media`;
  const mediaStageDir = `${mediaFinalDir}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const mediaFiles: BackupMediaFile[] = [];
  try {
    const mediaRows = tables.media_assets || [];
    if (mediaRows.length) {
      const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './storage/uploads');
      const realUploadRoot = fs.realpathSync(uploadRoot);
      fs.mkdirSync(mediaStageDir, { recursive: true, mode: 0o700 });
      for (const row of mediaRows) {
        const relativePath = row.storage_path;
        if (typeof relativePath !== 'string' || !/^files\/[a-zA-Z0-9_-]+\.[a-z0-9]{1,12}$/.test(relativePath)) throw new Error('A media asset has an unsafe storage path; backup stopped.');
        const sourcePath = path.resolve(uploadRoot, relativePath);
        const realSource = fs.realpathSync(sourcePath);
        if (!realSource.startsWith(`${realUploadRoot}${path.sep}`) || !fs.statSync(realSource).isFile()) throw new Error(`Media asset ${relativePath} is missing or outside the upload directory.`);
        const plain = fs.readFileSync(realSource);
        const sha256 = crypto.createHash('sha256').update(plain).digest('hex');
        const encrypted = key ? encryptMedia(plain, key) : null;
        const destinationRelative = `${relativePath}${encrypted ? '.enc' : ''}`;
        const destination = path.join(mediaStageDir, destinationRelative);
        fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
        fs.writeFileSync(destination, encrypted?.ciphertext || plain, { mode: 0o600, flag: 'wx' });
        mediaFiles.push({ relativePath, sha256, sizeBytes: plain.length, encrypted: Boolean(encrypted), ...(encrypted ? { iv: encrypted.iv, tag: encrypted.tag } : {}) });
      }
      fs.renameSync(mediaStageDir, mediaFinalDir);
    }
    const snapshot: BackupSnapshot = {
      format: 'tbc-corporate-cms-backup-v1', createdAt, createdBy: createdBy.slice(0, 160), driver: db.driver,
      rowCounts, checksum: crypto.createHash('sha256').update(JSON.stringify(tables)).digest('hex'), tables, mediaFiles,
    };
    const content = encodeSnapshot(snapshot, key);
    const temporaryPath = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      fs.renameSync(temporaryPath, filePath);
    } catch (error) {
      try { fs.unlinkSync(temporaryPath); } catch { /* no temporary file */ }
      throw error;
    }
    return { filename, filePath, sizeBytes: Buffer.byteLength(content, 'utf8'), totalRows, createdAt, encrypted: Boolean(key), mediaFiles: mediaFiles.length };
  } catch (error) {
    fs.rmSync(mediaStageDir, { recursive: true, force: true });
    fs.rmSync(mediaFinalDir, { recursive: true, force: true });
    throw error;
  }
}
export function listDatabaseBackups() {
  const dir = getBackupDir();
  return fs.readdirSync(dir)
    .filter((name) => /^tbc-backup-[a-zA-Z0-9._-]+\.json(?:\.enc)?$/.test(name))
    .map((filename) => {
      const fullPath = path.join(dir, filename);
      const stat = fs.lstatSync(fullPath);
      return stat.isFile() ? { filename, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function readDatabaseBackup(filename: string): BackupSnapshot {
  if (path.basename(filename) !== filename || !/^tbc-backup-[a-zA-Z0-9._-]+\.json(?:\.enc)?$/.test(filename)) throw new Error('Invalid backup filename.');
  const fullPath = path.join(getBackupDir(), filename);
  if (!fs.lstatSync(fullPath).isFile()) throw new Error('Backup file not found.');
  return decodeBackupArchive(fs.readFileSync(fullPath, 'utf8'));
}
export async function restoreDatabaseBackup(snapshot: BackupSnapshot, options: { preserveCurrentSession?: boolean; customDb?: DbAdapter; uploadsBackupDir?: string } = {}) {
  validateSnapshot(snapshot);
  const db = options.customDb || await getDb();
  let restoredRows = 0;
  let restoredTables = 0;
  const stagedMedia: Array<{ from: string; to: string }> = [];
  let mediaStage = '';
  const entries = snapshot.mediaFiles || [];
  try {
    if (entries.length) {
      if (!options.uploadsBackupDir) throw new Error('This backup has media files; provide its sibling .media directory to restore the uploads.');
      const mediaDir = path.resolve(options.uploadsBackupDir);
      if (!fs.lstatSync(mediaDir).isDirectory()) throw new Error('Backup media directory is missing or unsafe.');
      const realMediaDir = fs.realpathSync(mediaDir);
      const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './storage/uploads');
      fs.mkdirSync(uploadRoot, { recursive: true, mode: 0o750 });
      const realUploadRoot = fs.realpathSync(uploadRoot);
      mediaStage = path.join(realUploadRoot, `.restore-${crypto.randomBytes(8).toString('hex')}`);
      fs.mkdirSync(mediaStage, { mode: 0o700 });
      const key = entries.some((entry) => entry.encrypted) ? encryptionKey() : null;
      for (const entry of entries) {
        const backupFile = path.join(mediaDir, `${entry.relativePath}${entry.encrypted ? '.enc' : ''}`);
        if (!backupFile.startsWith(`${mediaDir}${path.sep}`) || !fs.lstatSync(backupFile).isFile()) throw new Error(`Backup media file missing: ${entry.relativePath}`);
        const realBackupFile = fs.realpathSync(backupFile);
        if (!realBackupFile.startsWith(`${realMediaDir}${path.sep}`)) throw new Error('Backup media symlink escapes its archive directory.');
        const bytes = decryptMedia(fs.readFileSync(realBackupFile), entry, key);
        if (bytes.length !== entry.sizeBytes || crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Backup media integrity check failed for ${entry.relativePath}.`);
        const stagedFile = path.join(mediaStage, entry.relativePath);
        const finalFile = path.resolve(realUploadRoot, entry.relativePath);
        if (!finalFile.startsWith(`${realUploadRoot}${path.sep}`)) throw new Error('Backup media path escapes the upload directory.');
        fs.mkdirSync(path.dirname(stagedFile), { recursive: true, mode: 0o700 });
        fs.mkdirSync(path.dirname(finalFile), { recursive: true, mode: 0o750 });
        const realDestinationDir = fs.realpathSync(path.dirname(finalFile));
        if (!realDestinationDir.startsWith(`${realUploadRoot}${path.sep}`)) throw new Error('A symlinked upload path escapes the upload directory.');
        fs.writeFileSync(stagedFile, bytes, { mode: 0o600, flag: 'wx' });
        stagedMedia.push({ from: stagedFile, to: finalFile });
      }
    }
    await db.transaction(async (tx) => {
      const activeSessions = options.preserveCurrentSession ? (await tx.query<Record<string, unknown>>('SELECT * FROM sessions WHERE expires_at > NOW()')).rows : [];
      await tx.exec('DELETE FROM password_reset_tokens');
      await tx.exec('DELETE FROM sessions');
      for (const table of [...BACKUP_TABLES].reverse()) await tx.exec(`DELETE FROM ${table}`);
      for (const table of BACKUP_TABLES) {
        const rows = snapshot.tables[table];
        if (!rows.length) continue;
        restoredTables += 1;
        const orderedRows = table === 'menu_items' ? [...rows].sort((a, b) => Number(Boolean(a.parent_id)) - Number(Boolean(b.parent_id))) : rows;
        for (const row of orderedRows) {
          const columns = Object.keys(row);
          const values = columns.map((column) => {
            const value = row[column];
            return value !== null && typeof value === 'object' && !(value instanceof Date) ? JSON.stringify(value) : value;
          });
          await tx.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`, values);
          restoredRows += 1;
        }
      }
      if (activeSessions.length) {
        const activeUsers = new Set((await tx.query<{ id: string }>('SELECT id FROM users WHERE is_active=TRUE')).rows.map((user) => user.id));
        for (const session of activeSessions) {
          if (!activeUsers.has(String(session.user_id))) continue;
          await tx.query(`INSERT INTO sessions (id,user_id,token_hash,csrf_token,ip_address,user_agent,mfa_verified,expires_at,last_active_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`, [session.id,session.user_id,session.token_hash,session.csrf_token,session.ip_address,session.user_agent,session.mfa_verified,session.expires_at,session.last_active_at,session.created_at]);
        }
      }
    });
    for (const file of stagedMedia) fs.renameSync(file.from, file.to);
    return { restoredTables, restoredRows, restoredMediaFiles: stagedMedia.length };
  } finally {
    if (mediaStage) fs.rmSync(mediaStage, { recursive: true, force: true });
  }
}
