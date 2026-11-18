import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { sanitizeRichHtml, slugify } from '@/lib/security';

const config = {
  articles: { table: 'articles', view: 'content.view', manage: 'content.edit_any', own: 'content.edit_own', remove: 'content.delete', domain: 'content' },
  pages: { table: 'pages', view: 'pages.view', manage: 'pages.manage', own: '', remove: 'pages.manage', domain: 'pages' },
  events: { table: 'events', view: 'events.view', manage: 'events.manage', own: '', remove: 'events.delete', domain: 'events' },
  publications: { table: 'publications', view: 'publications.view', manage: 'publications.manage', own: '', remove: 'publications.delete', domain: 'publications' },
} as const;
type Collection = keyof typeof config;
const assetUrlSchema = z.string().max(1000).refine((value) => {
  if (!value) return true;
  if (value.startsWith('/')) return !value.startsWith('//') && !value.includes('\\') && !value.split('/').includes('..');
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'Use an internal asset path or a secure HTTPS URL.');
const schema = z.object({
  slug: z.string().trim().max(120).optional(), titleSw: z.string().trim().min(2).max(240).optional(), titleEn: z.string().trim().max(240).optional(),
  summarySw: z.string().max(5000).optional(), summaryEn: z.string().max(5000).optional(), bodySw: z.string().max(200000).optional(), bodyEn: z.string().max(200000).optional(),
  categorySlug: z.string().trim().max(80).optional(), module: z.string().trim().max(60).optional(), startDate: z.string().max(40).optional(), endDate: z.string().max(40).optional(),
  publicationDate: z.string().max(20).optional(), fileUrl: assetUrlSchema.optional(), featuredImageUrl: assetUrlSchema.optional(), isFeatured: z.boolean().optional(),
}).strict().partial();
function getCollection(value: string): Collection | null { return Object.prototype.hasOwnProperty.call(config, value) ? value as Collection : null; }

export async function GET(req: NextRequest, context: { params: Promise<{ collection: string; id: string }> }) {
  const { collection: raw, id } = await context.params;
  const collection = getCollection(raw);
  if (!collection) return NextResponse.json({ error: 'Unknown content type.' }, { status: 404 });
  const auth = await requireApiAuth(req, config[collection].view);
  if ('response' in auth) return auth.response;
  const db = await getDb();
  const result = await db.query(`SELECT * FROM ${config[collection].table} WHERE id=$1`, [id]);
  const row = result.rows[0];
  if (!row) return NextResponse.json({ error: 'Content not found.' }, { status: 404 });
  if (collection === 'articles' && !hasPermission(auth.user.permissions, auth.user.roleSlug, 'content.edit_any') && row.created_by !== auth.user.id) return NextResponse.json({ error: 'Content not found.' }, { status: 404 });
  return NextResponse.json({ item: row }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ collection: string; id: string }> }) {
  const { collection: raw, id } = await context.params;
  const collection = getCollection(raw);
  if (!collection) return NextResponse.json({ error: 'Unknown content type.' }, { status: 404 });
  const auth = await requireApiAuth(req, config[collection].view);
  if ('response' in auth) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data ?? {}).length) return NextResponse.json({ error: 'Provide at least one valid field to update.' }, { status: 400 });
  const db = await getDb();
  const current = await db.query<{ id: string; created_by: string | null; workflow_status: string; title_sw: string }>(`SELECT id,created_by,workflow_status,title_sw FROM ${config[collection].table} WHERE id=$1`, [id]);
  if (!current.rows[0]) return NextResponse.json({ error: 'Content not found.' }, { status: 404 });
  const canManage = hasPermission(auth.user.permissions, auth.user.roleSlug, config[collection].manage as never);
  const isOwner = current.rows[0].created_by === auth.user.id;
  const canOwn = collection === 'articles' && isOwner && hasPermission(auth.user.permissions, auth.user.roleSlug, 'content.edit_own') && ['draft','changes_requested','rejected'].includes(current.rows[0].workflow_status);
  if (!canManage && !canOwn) return NextResponse.json({ error: 'You may only edit your own drafts or content permitted by your role.' }, { status: 403 });
  const input = parsed.data;
  const values: unknown[] = [];
  const sets: string[] = [];
  const set = (column: string, value: unknown) => { values.push(value); sets.push(`${column}=$${values.length}`); };
  if (input.slug !== undefined) set('slug', slugify(input.slug));
  if (input.titleSw !== undefined) set('title_sw', input.titleSw);
  if (input.titleEn !== undefined) set('title_en', input.titleEn);
  if (input.summarySw !== undefined) set(collection === 'articles' ? 'excerpt_sw' : collection === 'events' ? 'summary_sw' : collection === 'pages' ? 'summary_sw' : 'description_sw', input.summarySw);
  if (input.summaryEn !== undefined) set(collection === 'articles' ? 'excerpt_en' : collection === 'events' ? 'summary_en' : collection === 'pages' ? 'summary_en' : 'description_en', input.summaryEn);
  if (input.bodySw !== undefined) set(collection === 'articles' ? 'body_sw' : collection === 'pages' ? 'body_sw' : 'description_sw', sanitizeRichHtml(input.bodySw));
  if (input.bodyEn !== undefined) set(collection === 'articles' ? 'body_en' : collection === 'pages' ? 'body_en' : 'description_en', sanitizeRichHtml(input.bodyEn));
  if (input.categorySlug !== undefined && ['articles','events','publications'].includes(collection)) set('category_slug', input.categorySlug);
  if (input.module !== undefined && collection === 'articles') set('module', input.module);
  if (input.startDate !== undefined && collection === 'events') {
    const date = new Date(input.startDate); if (Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Enter a valid event date.' }, { status: 400 });
    set('start_date', date.toISOString());
  }
  if (input.endDate !== undefined && collection === 'events') {
    const date = input.endDate ? new Date(input.endDate) : null;
    if (date && Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Enter a valid event end date.' }, { status: 400 });
    set('end_date', date?.toISOString() ?? null);
  }
  if (input.publicationDate !== undefined && collection === 'publications') set('publication_date', input.publicationDate);
  if (input.fileUrl !== undefined && collection === 'publications') set('file_url', input.fileUrl);
  if (input.featuredImageUrl !== undefined && collection === 'events') set('featured_image_url', input.featuredImageUrl);
  if (input.isFeatured !== undefined && ['articles','events','publications'].includes(collection)) set('is_featured', input.isFeatured);
  if (!sets.length) return NextResponse.json({ error: 'The submitted fields do not apply to this content type.' }, { status: 400 });
  // Any edit after submission invalidates prior review/approval and unpublishes the public version.
  if (current.rows[0].workflow_status !== 'draft') {
    sets.push("workflow_status='draft'","status_sw='draft'","status_en='draft'","scheduled_at=NULL","published_at=NULL","published_by=NULL","approved_by=NULL","review_notes='Content was edited; submit it for review again.'");
  }
  values.push(auth.user.id); sets.push(`updated_by=$${values.length}`);
  values.push(id);
  try {
    await db.query(`UPDATE ${config[collection].table} SET ${sets.join(',')},updated_at=NOW() WHERE id=$${values.length}`, values);
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key')) return NextResponse.json({ error: 'That URL slug is already in use.' }, { status: 409 });
    throw error;
  }
  await logAudit({ userId: auth.user.id, userEmail: auth.user.email, userRole: auth.user.roleSlug, action: `${collection}.updated`, entityType: collection, entityId: id, summary: `Updated ${collection.slice(0,-1)} “${input.titleSw ?? current.rows[0].title_sw}”.` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ collection: string; id: string }> }) {
  const { collection: raw, id } = await context.params;
  const collection = getCollection(raw);
  if (!collection) return NextResponse.json({ error: 'Unknown content type.' }, { status: 404 });
  const auth = await requireApiAuth(req, config[collection].remove as never);
  if ('response' in auth) return auth.response;
  const db = await getDb();
  const result = await db.query<{ title_sw: string }>(`DELETE FROM ${config[collection].table} WHERE id=$1 RETURNING title_sw`, [id]);
  if (!result.rows[0]) return NextResponse.json({ error: 'Content not found.' }, { status: 404 });
  await logAudit({ userId: auth.user.id, userEmail: auth.user.email, userRole: auth.user.roleSlug, action: `${collection}.deleted`, entityType: collection, entityId: id, summary: `Deleted ${collection.slice(0,-1)} “${result.rows[0].title_sw}”.` });
  return NextResponse.json({ ok: true });
}
