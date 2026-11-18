import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/auth';
import { resetUserMfa, setUserActive } from '@/lib/user-admin';

const schema = z.union([z.object({ isActive: z.boolean() }).strict(), z.object({ resetMfa: z.literal(true) }).strict()]);
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(req, 'users.manage');
  if ('response' in auth) return auth.response;
  const { id } = await context.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Provide isActive or resetMfa.' }, { status: 400 });
  try {
    if ('resetMfa' in parsed.data) await resetUserMfa(id, auth.user.id);
    else await setUserActive(id, parsed.data.isActive, auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update this account.';
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 409 });
  }
}
