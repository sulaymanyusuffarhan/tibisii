import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { getClientIp } from '@/lib/security';
import { getSiteSettings } from '@/lib/settings';
import { recordAnalyticsEvent } from '@/lib/audit';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{4,80}$/.test(id)) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  const db = await getDb();
  const result = await db.query<{ storage_path: string; public_url: string; original_name: string; mime_type: string; media_type: string; is_public: boolean; is_deleted: boolean }>(
    'SELECT storage_path,public_url,original_name,mime_type,media_type,is_public,is_deleted FROM media_assets WHERE id=$1 LIMIT 1', [id]);
  const asset = result.rows[0];
  if (!asset || asset.is_deleted) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  if (!asset.is_public) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!hasPermission(user.permissions, user.roleSlug, 'media.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const root = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './storage/uploads');
  const candidate = path.resolve(root, asset.storage_path);
  if (!candidate.startsWith(`${root}${path.sep}`)) return NextResponse.json({ error: 'Invalid stored path.' }, { status: 404 });
  let bytes: Buffer;
  try {
    const [realRoot, realFile] = await Promise.all([fs.realpath(root), fs.realpath(candidate)]);
    if (!realFile.startsWith(`${realRoot}${path.sep}`) || !(await fs.stat(realFile)).isFile()) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    bytes = await fs.readFile(realFile);
  } catch { return NextResponse.json({ error: 'File not found.' }, { status: 404 }); }
  if (asset.is_public && asset.media_type === 'document') {
    try {
      const settings = await getSiteSettings();
      if (settings.analytics.internal_tracking_enabled && req.headers.get('dnt') !== '1') {
        const publication = await db.query<{ slug: string }>("SELECT slug FROM publications WHERE file_url=$1 AND workflow_status='published' AND status_sw='published' LIMIT 1", [asset.public_url]);
        const refererPath = (() => { try { const ref = req.headers.get('referer'); return ref ? new URL(ref).pathname : ''; } catch { return ''; } })();
        await recordAnalyticsEvent({ eventType: 'publication_download', path: refererPath, entityType: publication.rows[0] ? 'publication' : 'document', entityId: publication.rows[0]?.slug || '', language: refererPath.startsWith('/en/') ? 'en' : 'sw', ip: getClientIp(req), userAgent: req.headers.get('user-agent') || '' });
      }
    } catch { /* analytics must never prevent a public document download */ }
  }
  const inline = asset.media_type === 'image' || asset.media_type === 'video';
  const safeName = asset.original_name.replace(/[\r\n"\\]/g, '_').slice(0, 180);
  const headers = new Headers({
    'Content-Type': asset.mime_type,
    'Content-Length': String(bytes.length),
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': asset.is_public ? 'public, max-age=3600' : 'no-store',
    'Content-Security-Policy': asset.mime_type === 'image/svg+xml' ? "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox" : "default-src 'none'; sandbox",
  });
  return new NextResponse(new Uint8Array(bytes), { status: 200, headers });
}
