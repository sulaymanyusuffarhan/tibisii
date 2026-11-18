import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { buildOtpAuthUri, createId, encryptSecret, generateTotpSecret } from '@/lib/security';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if ('response' in auth) return auth.response;
  const db = await getDb();
  const state = await db.query<{ mfa_enabled: boolean }>('SELECT mfa_enabled FROM users WHERE id=$1', [auth.user.id]);
  if (state.rows[0]?.mfa_enabled) return NextResponse.json({ error: 'MFA is already enabled. Contact a Super Administrator to reset it.' }, { status: 409 });
  const secret = generateTotpSecret();
  await db.query('UPDATE users SET mfa_secret=$1,updated_at=NOW() WHERE id=$2', [encryptSecret(secret), auth.user.id]);
  await logAudit({ userId: auth.user.id, userEmail: auth.user.email, userRole: auth.user.roleSlug, action: 'auth.mfa_setup_started', summary: 'MFA enrollment started.' });
  return NextResponse.json({ secret, otpauthUri: buildOtpAuthUri(auth.user.email, secret), message: 'Scan this secret in an authenticator app, then confirm with a current six-digit code. It is shown only for this setup response.' }, { headers: { 'Cache-Control': 'no-store' } });
}
