import { NextRequest, NextResponse } from 'next/server';
import { revokeSession, SESSION_COOKIE_NAME, shouldUseSecureCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const raw = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  await revokeSession(raw);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: await shouldUseSecureCookie(req),
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
