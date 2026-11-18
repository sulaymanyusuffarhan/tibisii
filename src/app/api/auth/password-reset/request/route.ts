import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset } from '@/lib/auth';
import { getClientIp } from '@/lib/security';
import { consumeRateLimit } from '@/lib/rate-limit';

const schema = z.object({ email: z.string().trim().email().max(254) });
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await consumeRateLimit('password-reset', ip, 5, 60 * 60);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  try {
    const data = schema.parse(await req.json());
    await requestPasswordReset(data.email, ip);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    throw error;
  }
  return NextResponse.json({ ok: true, message: 'If an active account matches this address, reset instructions will be sent when email delivery is configured.' }, { headers: { 'Cache-Control': 'no-store' } });
}
