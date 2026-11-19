import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getClientIp } from '@/lib/security';
import { consumeRateLimit } from '@/lib/rate-limit';
import { getSiteSettings } from '@/lib/settings';
import { recordAnalyticsEvent } from '@/lib/audit';

const schema = z.object({ type: z.enum(['page_view', 'search']), path: z.string().min(3).max(240), language: z.enum(['sw', 'en']) }).strict();
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(',')[0].trim();
    return url.host.toLowerCase() === host.toLowerCase() && (url.protocol === 'https:' || url.protocol === 'http:');
  } catch { return false; }
}
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Same-origin requests only.' }, { status: 403 });
  const ip = getClientIp(req);
  const limit = await consumeRateLimit('analytics-event', ip, 120, 60 * 60);
  if (!limit.allowed) return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid analytics event.' }, { status: 400 });
  const { type, path, language } = parsed.data;
  if (!/^\/(sw|en)(?:\/|$)/.test(path) || /[?#\u0000-\u001f]/.test(path) || path.includes('\\') || path.startsWith('/admin') || path.includes('//')) {
    return NextResponse.json({ error: 'Invalid analytics path.' }, { status: 400 });
  }
  const settings = await getSiteSettings();
  if (settings.analytics.internal_tracking_enabled !== true || req.headers.get('dnt') === '1') {
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }
  await recordAnalyticsEvent({ eventType: type, path, language, ip, userAgent: req.headers.get('user-agent') || '' });
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
