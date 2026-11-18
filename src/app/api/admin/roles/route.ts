import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/auth';
import { ALL_PERMISSIONS } from '@/lib/permissions';
import { createCustomRole, listSystemRoles, updateRolePermissions } from '@/lib/user-admin';

const schema = z.object({ roleSlug: z.string().regex(/^[a-z0-9_]{2,64}$/), permissions: z.array(z.string()).max(ALL_PERMISSIONS.length) });
const createSchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  nameSw: z.string().trim().min(2).max(120), nameEn: z.string().trim().min(2).max(120),
  descriptionSw: z.string().max(500).optional(), descriptionEn: z.string().max(500).optional(),
  permissions: z.array(z.string()).max(ALL_PERMISSIONS.length),
});
export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req, 'roles.manage');
  if ('response' in auth) return auth.response;
  return NextResponse.json({ roles: await listSystemRoles(), permissions: ALL_PERMISSIONS }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req, 'roles.manage');
  if ('response' in auth) return auth.response;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Provide a role ID, both language names, and a valid permission list.' }, { status: 400 });
  try {
    const role = await createCustomRole(parsed.data, auth.user.id);
    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create this role.';
    return NextResponse.json({ error: /duplicate key|already exists/i.test(message) ? 'That role ID already exists.' : message }, { status: /duplicate key|already exists/i.test(message) ? 409 : 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiAuth(req, 'roles.manage');
  if ('response' in auth) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Provide a role and a permission list.' }, { status: 400 });
  try {
    await updateRolePermissions(parsed.data.roleSlug, parsed.data.permissions, auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update role permissions.';
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 });
  }
}
