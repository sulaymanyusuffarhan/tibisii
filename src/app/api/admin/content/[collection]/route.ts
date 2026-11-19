import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createId, sanitizeRichHtml, slugify } from '@/lib/security';
import { hasPermission } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

const config = {
  articles: { table: 'articles', view: 'content.view', create: 'content.create', manage: 'content.edit_any', delete: 'content.delete', domain: 'content' },
  pages: { table: 'pages', view: 'pages.view', create: 'pages.manage', manage: 'pages.manage', delete: 'pages.manage', domain: 'pages' },
  events: { table: 'events', view: 'events.view', create: 'events.manage', manage: 'events.manage', delete: 'events.delete', domain: 'events' },
  publications: { table: 'publications', view: 'publications.view', create: 'publications.manage', manage: 'publications.manage', delete: 'publications.delete', domain: 'publications' },
} as const;
type Collection = keyof typeof config;
const assetUrlSchema = z.string().max(1000).refine((value) => {
  if (!value) return true;
  if (value.startsWith('/')) return !value.startsWith('//') && !value.includes('\\') && !value.split('/').includes('..');
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'Use an internal asset path or a secure HTTPS URL.');
const inputSchema = z.object({
  slug: z.string().trim().max(120).optional(),
  titleSw: z.string().trim().min(2).max(240),
  titleEn: z.string().trim().max(240).optional(),
  summarySw: z.string().max(5000).optional(),
  summaryEn: z.string().max(5000).optional(),
  bodySw: z.string().max(200000).optional(),
  bodyEn: z.string().max(200000).optional(),
  categorySlug: z.string().trim().max(80).optional(),
  module: z.string().trim().max(60).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
  publicationDate: z.string().max(20).optional(),
  fileUrl: assetUrlSchema.optional(),
  featuredImageUrl: assetUrlSchema.optional(),
  isFeatured: z.boolean().optional(),
}).strict();

function getCollection(value: string): Collection | null {
  return Object.prototype.hasOwnProperty.call(config, value) ? value as Collection : null;
}
function sanitizeInput<T extends z.infer<typeof inputSchema>>(body: T) {
  return {
    ...body,
    slug: body.slug ? slugify(body.slug) : slugify(body.titleSw),
    bodySw: sanitizeRichHtml(body.bodySw ?? ''),
    bodyEn: sanitizeRichHtml(body.bodyEn ?? ''),
  };
}
function parseDate(input: string | undefined, fallback?: Date) {
  if (!input) return fallback?.toISOString() ?? null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) throw new Error('Enter a valid date and time.');
  return date.toISOString();
}

export async function GET(req: NextRequest, context: { params: Promise<{ collection: string }> }) {
  const { collection: raw } = await context.params;
  const collection = getCollection(raw);
  if (!collection) return NextResponse.json({ error: 'Unknown content type.' }, { status: 404 });
  const auth = await requireApiAuth(req, config[collection].view);
  if ('response' in auth) return auth.response;
  const db = await getDb();
  const q = req.nextUrl.searchParams.get('q')?.trim().slice(0, 120) ?? '';
  const status = req.nextUrl.searchParams.get('status')?.trim() ?? '';
  const values: unknown[] = [];
  const where: string[] = [];
  if (q) {
    values.push(`%${q}%`);
    where.push(`(title_sw ILIKE $${values.length} OR title_en ILIKE $${values.length} OR slug ILIKE $${values.length})`);
  }
  if (status) {
    values.push(status);
    where.push(`workflow_status=$${values.length}`);
  }
  if (collection === 'articles' && !hasPermission(auth.user.permissions, auth.user.roleSlug, 'content.edit_any')) {
    values.push(auth.user.id);
    where.push(`created_by=$${values.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT id,slug,title_sw,title_en,workflow_status,created_by,updated_at,created_at,
            ${collection === 'articles' ? 'module AS content_kind,category_slug' : collection === 'pages' ? 'section_group AS content_kind,section_group AS category_slug' : collection === 'events' ? "'event' AS content_kind,category_slug" : "'publication' AS content_kind,category_slug"},
            ${collection === 'events' ? 'start_date AS content_date' : collection === 'publications' ? 'publication_date AS content_date' : 'published_at AS content_date'}
     FROM ${config[collection].table} ${whereSql}
     ORDER BY updated_at DESC LIMIT 250`, values
  );
  return NextResponse.json({ items: result.rows }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest, context: { params: Promise<{ collection: string }> }) {
  const { collection: raw } = await context.params;
  const collection = getCollection(raw);
  if (!collection) return NextResponse.json({ error: 'Unknown content type.' }, { status: 404 });
  const auth = await requireApiAuth(req, config[collection].create);
  if ('response' in auth) return auth.response;
  const parsed = inputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check the required title and content fields.', issues: parsed.error.issues }, { status: 400 });
  const input = sanitizeInput(parsed.data);
  const id = createId(collection.slice(0, 3));
  const db = await getDb();
  try {
    if (collection === 'articles') {
      await db.query(
        `INSERT INTO articles (id,slug,module,content_format,category_slug,title_sw,title_en,excerpt_sw,excerpt_en,body_sw,body_en,featured_image_url,workflow_status,status_sw,status_en,created_by,updated_by,is_featured)
         VALUES ($1,$2,$3,'article',$4,$5,$6,$7,$8,$9,$10,$11,'draft','draft','draft',$12,$12,$13)`,
        [id,input.slug,input.module || 'announcement',input.categorySlug || 'general',input.titleSw,input.titleEn || '',input.summarySw || '',input.summaryEn || '',input.bodySw,input.bodyEn,input.featuredImageUrl||'',auth.user.id,Boolean(input.isFeatured)]
      );
    } else if (collection === 'pages') {
      await db.query(
        `INSERT INTO pages (id,slug,section_group,title_sw,title_en,summary_sw,summary_en,body_sw,body_en,hero_image_url,workflow_status,status_sw,status_en,created_by,updated_by)
         VALUES ($1,$2,'custom',$3,$4,$5,$6,$7,$8,$9,'draft','draft','draft',$10,$10)`,
        [id,input.slug,input.titleSw,input.titleEn || '',input.summarySw || '',input.summaryEn || '',input.bodySw,input.bodyEn,input.featuredImageUrl||'',auth.user.id]
      );
    } else if (collection === 'events') {
      const startDate = parseDate(input.startDate, new Date());
      const endDate = parseDate(input.endDate);
      await db.query(
        `INSERT INTO events (id,slug,category_slug,title_sw,title_en,summary_sw,summary_en,description_sw,description_en,start_date,end_date,featured_image_url,workflow_status,status_sw,status_en,created_by,updated_by,is_featured)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft','draft','draft',$13,$13,$14)`,
        [id,input.slug,input.categorySlug || 'corporate_activity',input.titleSw,input.titleEn || '',input.summarySw || '',input.summaryEn || '',input.bodySw,input.bodyEn,startDate,endDate,input.featuredImageUrl || '',auth.user.id,Boolean(input.isFeatured)]
      );
    } else {
      const publicationDate = input.publicationDate || new Date().toISOString().slice(0,10);
      await db.query(
        `INSERT INTO publications (id,slug,category_slug,publication_date,title_sw,title_en,description_sw,description_en,file_url,workflow_status,status_sw,status_en,created_by,updated_by,is_featured)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft','draft','draft',$10,$10,$11)`,
        [id,input.slug,input.categorySlug || 'general',publicationDate,input.titleSw,input.titleEn || '',input.summarySw || '',input.summaryEn || '',input.fileUrl || '',auth.user.id,Boolean(input.isFeatured)]
      );
    }
    await logAudit({ userId: auth.user.id, userEmail: auth.user.email, userRole: auth.user.roleSlug, action: `${collection}.created`, entityType: collection, entityId: id, summary: `Created draft ${collection.slice(0,-1)} “${input.titleSw}”.` });
    return NextResponse.json({ id, slug: input.slug, workflowStatus: 'draft' }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key')) return NextResponse.json({ error: 'That URL slug is already in use. Choose a different one.' }, { status: 409 });
    if (error instanceof Error && /date/i.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
