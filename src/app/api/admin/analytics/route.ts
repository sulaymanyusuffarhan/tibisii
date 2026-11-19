import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req, 'analytics.view');
  if ('response' in auth) return auth.response;
  const db = await getDb();
  const [summary, pages, searches, downloads] = await Promise.all([
    db.query<{ views: string; visitors: string; searches: string; downloads: string }>(`SELECT
      COUNT(*) FILTER (WHERE event_type='page_view')::text AS views,
      COUNT(DISTINCT session_hash) FILTER (WHERE event_type='page_view')::text AS visitors,
      COUNT(*) FILTER (WHERE event_type='search')::text AS searches,
      COUNT(*) FILTER (WHERE event_type='publication_download')::text AS downloads
      FROM analytics_events WHERE created_at >= NOW() - INTERVAL '30 days'`),
    db.query<{ path: string; views: string }>(`SELECT path,COUNT(*)::text AS views FROM analytics_events WHERE event_type='page_view' AND created_at >= NOW()-INTERVAL '30 days' GROUP BY path ORDER BY COUNT(*) DESC LIMIT 10`),
    db.query<{ day: string; count: string }>(`SELECT TO_CHAR(date_trunc('day',created_at),'YYYY-MM-DD') AS day,COUNT(*)::text AS count FROM analytics_events WHERE event_type='search' AND created_at >= NOW()-INTERVAL '30 days' GROUP BY date_trunc('day',created_at) ORDER BY date_trunc('day',created_at)`),
    db.query<{ entity_type: string; count: string }>(`SELECT entity_type,COUNT(*)::text AS count FROM analytics_events WHERE event_type='publication_download' AND created_at >= NOW()-INTERVAL '30 days' GROUP BY entity_type ORDER BY COUNT(*) DESC LIMIT 10`),
  ]);
  const row = summary.rows[0] || { views: '0', visitors: '0', searches: '0', downloads: '0' };
  return NextResponse.json({
    periodDays: 30,
    summary: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])),
    topPages: pages.rows.map((item) => ({ path: item.path, views: Number(item.views) })),
    searchesByDay: searches.rows.map((item) => ({ day: item.day, count: Number(item.count) })),
    downloadsByType: downloads.rows.map((item) => ({ type: item.entity_type, count: Number(item.count) })),
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
