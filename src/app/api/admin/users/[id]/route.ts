import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/auth';
import { setUserActive } from '@/lib/user-admin';

const schema = z.object({ isActive: z.boolean() });
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(req, 'users.manage');
  if ('response' in auth) return auth.response;
  const { id } = await context.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Provide isActive as true or false.' }, { status: 400 });
  try {
    await setUserActive(id, parsed.data.isActive, auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update this account.';
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 409 });
  }
}
