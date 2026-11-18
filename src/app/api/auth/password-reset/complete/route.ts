import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resetPassword } from '@/lib/auth';
import { consumeRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/security';

const schema = z.object({ token: z.string().min(32).max(256), password: z.string().min(12).max(128) });
export async function POST(req: NextRequest) {
  const limit = await consumeRateLimit('password-reset-complete', getClientIp(req), 10, 60 * 60);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'A valid reset link and password of at least 12 characters are required.' }, { status: 400 });
  const success = await resetPassword(parsed.data.token, parsed.data.password);
  if (!success) return NextResponse.json({ error: 'This reset link is invalid, expired, or already used.' }, { status: 400 });
  return NextResponse.json({ ok: true, message: 'Password updated. Sign in with your new password.' }, { headers: { 'Cache-Control': 'no-store' } });
}
