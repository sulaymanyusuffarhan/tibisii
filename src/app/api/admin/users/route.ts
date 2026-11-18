import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createAdminUser } from '@/lib/user-admin';

const createSchema = z.object({
  email: z.string().trim().email().max(254),
  fullName: z.string().trim().min(2).max(160),
  roleSlug: z.string().regex(/^[a-z0-9_]{2,64}$/),
  password: z.string().min(12).max(128),
  jobTitle: z.string().max(160).optional(),
  department: z.string().max(160).optional(),
  phone: z.string().max(40).optional(),
  delegatedPublish: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req, 'users.manage');
  if ('response' in auth) return auth.response;
  const db = await getDb();
  const result = await db.query(
    `SELECT u.id,u.email,u.full_name,u.job_title,u.department,u.phone,u.is_active,u.mfa_enabled,
            u.delegated_publish,u.last_login_at,u.created_at,r.slug AS role_slug,r.name_sw AS role_name_sw,r.name_en AS role_name_en
     FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.created_at DESC LIMIT 500`
  );
  return NextResponse.json({ users: result.rows }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req, 'users.manage');
  if ('response' in auth) return auth.response;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check the account details. Passwords must be at least 12 characters.' }, { status: 400 });
  try {
    const user = await createAdminUser(parsed.data, auth.user.id);
    return NextResponse.json({ user }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create this account.';
    const status = /already exists|duplicate key/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: status === 409 ? 'An account with this email already exists.' : message }, { status });
  }
}
