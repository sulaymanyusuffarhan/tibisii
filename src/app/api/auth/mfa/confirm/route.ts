import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { decryptSecret, generateBackupCodes, sha256Hex, verifyTotpCode } from '@/lib/security';
import { logAudit } from '@/lib/audit';

const schema = z.object({ code: z.string().regex(/^\d{6}$/) });
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if ('response' in auth) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter the six-digit code from your authenticator.' }, { status: 400 });
  const db = await getDb();
  const row = await db.query<{ mfa_secret: string | null; mfa_enabled: boolean }>('SELECT mfa_secret,mfa_enabled FROM users WHERE id=$1 AND is_active=TRUE', [auth.user.id]);
  if (!row.rows[0]?.mfa_secret || row.rows[0].mfa_enabled) return NextResponse.json({ error: 'Start MFA setup before confirming.' }, { status: 409 });
  if (!verifyTotpCode(decryptSecret(row.rows[0].mfa_secret), parsed.data.code)) return NextResponse.json({ error: 'That code is invalid or expired. Check your device time and try again.' }, { status: 400 });
  const backupCodes = generateBackupCodes();
  await db.query('UPDATE users SET mfa_enabled=TRUE,mfa_backup_codes=$1::jsonb,updated_at=NOW() WHERE id=$2', [JSON.stringify(backupCodes.map((code) => sha256Hex(code))), auth.user.id]);
  await logAudit({ userId: auth.user.id, userEmail: auth.user.email, userRole: auth.user.roleSlug, action: 'auth.mfa_enabled', summary: 'MFA was enabled; recovery codes were generated.' });
  return NextResponse.json({ ok: true, backupCodes, warning: 'Save these recovery codes somewhere secure. They will not be shown again.' }, { headers: { 'Cache-Control': 'no-store' } });
}
