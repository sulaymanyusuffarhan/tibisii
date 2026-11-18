import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req, 'dashboard.view');
  if ('response' in auth) return auth.response;
  const db = await getDb();
  const [published, drafts, approvals, publications, media, events, enquiries, testimonials, activity, trend] = await Promise.all([
    db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM articles WHERE workflow_status='published'`),
    db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM articles WHERE workflow_status='draft'`),
    db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM articles WHERE workflow_status IN ('submitted','under_review')`),
    db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM publications WHERE workflow_status='published'`),
    db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM media_assets`),
    db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM events WHERE workflow_status='published'`),
    db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM form_submissions WHERE status IN ('new','in_progress')`),
    db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM testimonials WHERE moderation_status='pending'`),
    db.query(`SELECT id,user_email,user_role,action,summary,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 8`),
    db.query<{ month: string; count: string }>(`SELECT TO_CHAR(date_trunc('month', created_at), 'Mon') AS month, COUNT(*)::text AS count FROM articles WHERE created_at >= NOW() - INTERVAL '6 months' GROUP BY date_trunc('month', created_at) ORDER BY date_trunc('month', created_at)`),
  ]);
  const asNumber = (result: { rows: { count: string }[] }) => Number(result.rows[0]?.count ?? 0);
  return NextResponse.json({
    metrics: {
      publishedArticles: asNumber(published), drafts: asNumber(drafts), pendingReview: asNumber(approvals),
      publications: asNumber(publications), mediaAssets: asNumber(media), publishedEvents: asNumber(events),
      openEnquiries: asNumber(enquiries), pendingTestimonials: asNumber(testimonials),
    },
    activity: activity.rows,
    contentTrend: trend.rows.map((row) => ({ month: row.month, count: Number(row.count) })),
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
