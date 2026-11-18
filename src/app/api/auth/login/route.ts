import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateUserCredentials, SESSION_COOKIE_NAME, shouldUseSecureCookie } from '@/lib/auth';
import { getClientIp } from '@/lib/security';
import { consumeRateLimit } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
  mfaCode: z.string().max(32).optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await consumeRateLimit('auth-login', ip, 20, 15 * 60);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many sign-in attempts. Please try again later.' }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON request.' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address and password.' }, { status: 400 });

  const result = await authenticateUserCredentials({
    ...parsed.data,
    ip,
    userAgent: (req.headers.get('user-agent') || '').slice(0, 240),
  });
  if (!result.ok) return NextResponse.json({ error: result.error, mfaRequired: result.mfaRequired ?? false }, { status: result.status });

  const response = NextResponse.json({ ok: true, user: result.user, csrfToken: result.csrfToken });
  response.cookies.set(SESSION_COOKIE_NAME, result.rawSessionToken, {
    httpOnly: true,
    secure: await shouldUseSecureCookie(req),
    sameSite: 'strict',
    path: '/',
    expires: result.expiresAt,
    priority: 'high',
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
