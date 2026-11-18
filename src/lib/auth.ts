import { cookies, headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from './db';
import { hasPermission, type PermissionKey } from './permissions';
import {
  createId,
  decryptSecret,
  generateSecureToken,
  getClientIp,
  sha256Hex,
  validateSessionSecret,
  verifyTotpCode,
} from './security';
import { logAudit } from './audit';

export const SESSION_COOKIE_NAME = 'tbc_cms_session';
export const LANG_COOKIE_NAME = 'tbc_lang';

let dummyPasswordHashPromise: Promise<string> | undefined;
async function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHashPromise ??= bcrypt.hash('TBC invalid account timing sentinel', 12);
  return dummyPasswordHashPromise;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  department: string;
  roleId: string;
  roleSlug: string;
  roleNameSw: string;
  roleNameEn: string;
  permissions: string[];
  delegatedPublish: boolean;
  mfaEnabled: boolean;
  sessionId: string;
  csrfToken: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function shouldUseSecureCookie(req?: NextRequest | Request): Promise<boolean> {
  const mode = process.env.COOKIE_SECURE?.trim();
  if (mode === 'true') return true;
  if (mode === 'false') return false;
  const proto = req
    ? req.headers.get('x-forwarded-proto')
    : (await headers()).get('x-forwarded-proto');
  if (proto && proto.split(',')[0].trim() === 'https') return true;
  // Production deployments must be HTTPS; fail safely when a proxy omits its forwarded-proto header.
  return process.env.NODE_ENV === 'production';
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  validateSessionSecret();
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken || rawToken.length < 32) return null;

  const tokenHash = sha256Hex(rawToken);
  const db = await getDb();

  const res = await db.query<{
    session_id: string;
    csrf_token: string;
    expires_at: string;
    mfa_verified: boolean;
    user_id: string;
    email: string;
    full_name: string;
    job_title: string;
    department: string;
    is_active: boolean;
    mfa_enabled: boolean;
    delegated_publish: boolean;
    role_id: string;
    role_slug: string;
    role_name_sw: string;
    role_name_en: string;
    permissions: string[];
  }>(
    `SELECT
       s.id AS session_id,
       s.csrf_token,
       s.expires_at,
       s.mfa_verified,
       u.id AS user_id,
       u.email,
       u.full_name,
       u.job_title,
       u.department,
       u.is_active,
       u.mfa_enabled,
       u.delegated_publish,
       r.id AS role_id,
       r.slug AS role_slug,
       r.name_sw AS role_name_sw,
       r.name_en AS role_name_en,
       r.permissions
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE s.token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];

  if (!row.is_active || new Date(row.expires_at) <= new Date()) {
    await db.query('DELETE FROM sessions WHERE id = $1', [row.session_id]);
    return null;
  }

  if (row.mfa_enabled && !row.mfa_verified) {
    return null;
  }

  // Update last_active_at gently
  db.query('UPDATE sessions SET last_active_at = NOW() WHERE id = $1', [row.session_id]).catch(
    () => {}
  );

  return {
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    jobTitle: row.job_title,
    department: row.department,
    roleId: row.role_id,
    roleSlug: row.role_slug,
    roleNameSw: row.role_name_sw,
    roleNameEn: row.role_name_en,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    delegatedPublish: Boolean(row.delegated_publish),
    mfaEnabled: Boolean(row.mfa_enabled),
    sessionId: row.session_id,
    csrfToken: row.csrf_token,
  };
}

export async function requireApiAuth(
  req: NextRequest,
  requiredPermission?: PermissionKey | PermissionKey[],
  options: { skipCsrf?: boolean } = {}
): Promise<{ user: AuthenticatedUser } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json(
        { error: 'Authentication required. Please sign in to the TBC Administration Portal.' },
        { status: 401 }
      ),
    };
  }

  // Enforce CSRF token on all state-mutating requests
  const method = req.method.toUpperCase();
  if (!options.skipCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const providedCsrf = req.headers.get('x-csrf-token') || '';
    if (!providedCsrf || providedCsrf !== user.csrfToken) {
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        userRole: user.roleSlug,
        action: 'security.csrf_rejected',
        summary: `Rejected ${method} request with missing or invalid CSRF token on ${req.nextUrl.pathname}`,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get('user-agent') || '',
      });
      return {
        response: NextResponse.json(
          { error: 'Invalid or missing CSRF security token. Please refresh and try again.' },
          { status: 403 }
        ),
      };
    }
  }

  if (requiredPermission && !hasPermission(user.permissions, user.roleSlug, requiredPermission)) {
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userRole: user.roleSlug,
      action: 'security.unauthorized_access',
      summary: `Blocked unauthorized action on ${req.nextUrl.pathname} (required: ${
        Array.isArray(requiredPermission) ? requiredPermission.join('|') : requiredPermission
      })`,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get('user-agent') || '',
    });
    return {
      response: NextResponse.json(
        { error: 'Forbidden: Your role does not have permission to perform this action.' },
        { status: 403 }
      ),
    };
  }

  return { user };
}

export async function authenticateUserCredentials(params: {
  email: string;
  password: string;
  mfaCode?: string;
  ip: string;
  userAgent: string;
}): Promise<
  | {
      ok: true;
      rawSessionToken: string;
      csrfToken: string;
      expiresAt: Date;
      user: { id: string; email: string; fullName: string; roleSlug: string };
    }
  | { ok: false; status: number; error: string; mfaRequired?: boolean }
> {
  validateSessionSecret();
  const db = await getDb();
  const normalizedEmail = params.email.trim().toLowerCase();
  const maxAttempts = Number(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  const lockoutMinutes = Number(process.env.LOGIN_LOCKOUT_MINUTES) || 15;

  const res = await db.query<{
    id: string;
    email: string;
    full_name: string;
    password_hash: string;
    is_active: boolean;
    mfa_enabled: boolean;
    mfa_secret: string | null;
    mfa_backup_codes: string[];
    failed_login_attempts: number;
    locked_until: string | null;
    mfa_failed_attempts: number;
    mfa_locked_until: string | null;
    role_slug: string;
  }>(
    `SELECT u.id, u.email, u.full_name, u.password_hash, u.is_active,
            u.mfa_enabled, u.mfa_secret, u.mfa_backup_codes,
            u.failed_login_attempts, u.locked_until, u.mfa_failed_attempts, u.mfa_locked_until, r.slug AS role_slug
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE LOWER(u.email) = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  if (res.rows.length === 0) {
    // Constant-time dummy compare to mitigate timing enumeration
    await bcrypt.compare(params.password, await getDummyPasswordHash());
    await logAudit({
      userEmail: normalizedEmail,
      action: 'auth.login_failed',
      summary: `Failed login attempt for unknown email ${normalizedEmail}`,
      ipAddress: params.ip,
      userAgent: params.userAgent,
    });
    return { ok: false, status: 401, error: 'Invalid email address or password.' };
  }

  const user = res.rows[0];

  if (!user.is_active) {
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role_slug,
      action: 'auth.login_deactivated',
      summary: `Blocked login attempt on deactivated account ${user.email}`,
      ipAddress: params.ip,
      userAgent: params.userAgent,
    });
    return {
      ok: false,
      status: 403,
      error: 'This account has been deactivated. Contact the TBC Super Administrator.',
    };
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minsLeft = Math.max(
      1,
      Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60_000)
    );
    return {
      ok: false,
      status: 429,
      error: `Account temporarily locked due to repeated failed sign-in attempts. Try again in ${minsLeft} minute(s).`,
    };
  }

  const passwordValid = await verifyPassword(params.password, user.password_hash);
  if (!passwordValid) {
    const failure = await db.query<{ attempts: number; locked_until: string | null }>(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE
             WHEN failed_login_attempts + 1 >= $1 THEN NOW() + ($2::text || ' minutes')::interval
             ELSE NULL
           END,
           updated_at = NOW()
       WHERE id = $3
       RETURNING failed_login_attempts AS attempts, locked_until`,
      [maxAttempts, lockoutMinutes, user.id]
    );
    const attempts = Number(failure.rows[0]?.attempts ?? maxAttempts);
    const lockUntil = failure.rows[0]?.locked_until ?? null;

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role_slug,
      action: lockUntil ? 'auth.account_locked' : 'auth.login_failed',
      summary: lockUntil
        ? `Account ${user.email} locked for ${lockoutMinutes}m after ${attempts} failed attempts`
        : `Failed password attempt (${attempts}/${maxAttempts}) for ${user.email}`,
      ipAddress: params.ip,
      userAgent: params.userAgent,
    });

    return { ok: false, status: 401, error: 'Invalid email address or password.' };
  }

  // Optional Multi-Factor Authentication verification
  if (user.mfa_enabled && user.mfa_secret && user.mfa_locked_until && new Date(user.mfa_locked_until) > new Date()) {
    const minsLeft = Math.max(1, Math.ceil((new Date(user.mfa_locked_until).getTime() - Date.now()) / 60_000));
    return { ok: false, status: 429, error: `MFA temporarily locked after repeated invalid codes. Try again in ${minsLeft} minute(s).`, mfaRequired: true };
  }
  if (user.mfa_enabled && user.mfa_secret) {
    if (!params.mfaCode?.trim()) {
      return {
        ok: false,
        status: 401,
        error: 'Multi-factor authentication code is required.',
        mfaRequired: true,
      };
    }

    const code = params.mfaCode.trim();
    const totpOk = verifyTotpCode(decryptSecret(user.mfa_secret), code);
    let backupUsed = false;

    if (!totpOk) {
      const codeHash = sha256Hex(code.toUpperCase());
      backupUsed = await db.transaction(async (tx) => {
        const current = await tx.query<{ mfa_backup_codes: string[] }>(
          'SELECT mfa_backup_codes FROM users WHERE id=$1 FOR UPDATE', [user.id]
        );
        const backups = Array.isArray(current.rows[0]?.mfa_backup_codes) ? current.rows[0].mfa_backup_codes : [];
        const idx = backups.indexOf(codeHash);
        if (idx === -1) return false;
        const remaining = backups.filter((_, i) => i !== idx);
        await tx.query('UPDATE users SET mfa_backup_codes=$1::jsonb WHERE id=$2', [JSON.stringify(remaining), user.id]);
        return true;
      });
    }

    if (!totpOk && !backupUsed) {
      const failure = await db.query<{ attempts: number }>(
        `UPDATE users SET mfa_failed_attempts=mfa_failed_attempts+1,
         mfa_locked_until=CASE WHEN mfa_failed_attempts+1 >= $1 THEN NOW()+($2::text || ' minutes')::interval ELSE NULL END,
         updated_at=NOW() WHERE id=$3 RETURNING mfa_failed_attempts AS attempts`,
        [maxAttempts, lockoutMinutes, user.id]
      );
      const attempts = Number(failure.rows[0]?.attempts ?? 0);
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role_slug,
        action: attempts >= maxAttempts ? 'auth.mfa_locked' : 'auth.mfa_failed',
        summary: `Invalid MFA verification code supplied for ${user.email} (${attempts}/${maxAttempts})`,
        ipAddress: params.ip,
        userAgent: params.userAgent,
      });
      return {
        ok: false,
        status: attempts >= maxAttempts ? 429 : 401,
        error: attempts >= maxAttempts ? 'MFA temporarily locked after repeated invalid codes.' : 'Invalid multi-factor authentication code.',
        mfaRequired: true,
      };
    }
  }

  // Create fresh server-side session
  const rawSessionToken = generateSecureToken(32);
  const csrfToken = generateSecureToken(24);
  const ttlHours = Number(process.env.SESSION_TTL_HOURS) || 12;
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000);

  // Clean expired sessions opportunistically
  await db.query('DELETE FROM sessions WHERE expires_at <= NOW()');

  await db.query(
    `INSERT INTO sessions (id, user_id, token_hash, csrf_token, ip_address, user_agent, mfa_verified, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      createId('ses'),
      user.id,
      sha256Hex(rawSessionToken),
      csrfToken,
      params.ip,
      params.userAgent.slice(0, 240),
      Boolean(user.mfa_enabled),
      expiresAt.toISOString(),
    ]
  );

  await db.query(
    `UPDATE users
     SET failed_login_attempts = 0, locked_until = NULL, mfa_failed_attempts = 0, mfa_locked_until = NULL, last_login_at = NOW(), last_login_ip = $1, updated_at = NOW()
     WHERE id = $2`,
    [params.ip, user.id]
  );

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role_slug,
    action: 'auth.login_success',
    summary: `Administrator ${user.email} (${user.role_slug}) signed in successfully`,
    ipAddress: params.ip,
    userAgent: params.userAgent,
  });

  return {
    ok: true,
    rawSessionToken,
    csrfToken,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      roleSlug: user.role_slug,
    },
  };
}

/** Revoke the current server-side session. */
export async function revokeSession(rawToken: string | undefined): Promise<void> {
  if (!rawToken || rawToken.length < 32) return;
  const db = await getDb();
  const result = await db.query<{ user_id: string }>(
    'DELETE FROM sessions WHERE token_hash = $1 RETURNING user_id',
    [sha256Hex(rawToken)]
  );
  if (result.rows[0]) {
    const user = await db.query<{ email: string; role_slug: string }>(
      'SELECT u.email, r.slug AS role_slug FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',
      [result.rows[0].user_id]
    );
    await logAudit({ userId: result.rows[0].user_id, userEmail: user.rows[0]?.email, userRole: user.rows[0]?.role_slug, action: 'auth.logout', summary: 'Administrator signed out.' });
  }
}

/** Always returns a generic response to avoid disclosing whether an account exists. */
export async function requestPasswordReset(email: string, ip: string): Promise<void> {
  const { sendSystemEmail } = await import('./email');
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  const found = await db.query<{ id: string; email: string; full_name: string; is_active: boolean }>(
    'SELECT id,email,full_name,is_active FROM users WHERE LOWER(email)=$1 LIMIT 1', [normalized]
  );
  if (!found.rows[0]?.is_active) return;

  const rawToken = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + 30 * 60_000);
  await db.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [found.rows[0].id]);
  await db.query(
    `INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at,requested_ip)
     VALUES ($1,$2,$3,$4,$5)`,
    [createId('rst'), found.rows[0].id, sha256Hex(rawToken), expiresAt.toISOString(), ip.slice(0,64)]
  );
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const resetUrl = `${baseUrl}/admin/reset-password?token=${encodeURIComponent(rawToken)}`;
  const delivery = await sendSystemEmail({
    to: found.rows[0].email,
    subject: 'TBC Corporate CMS password reset',
    text: `Hello ${found.rows[0].full_name},\n\nUse this one-time link to reset your password. It expires in 30 minutes:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  });
  await logAudit({ userId: found.rows[0].id, userEmail: found.rows[0].email, action: 'auth.password_reset_requested', summary: `Password reset requested; mail status: ${delivery.status}`, ipAddress: ip });
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<boolean> {
  if (newPassword.length < 12 || newPassword.length > 128) throw new Error('Password must be between 12 and 128 characters.');
  const db = await getDb();
  const tokenHash = sha256Hex(rawToken);
  const passwordHash = await hashPassword(newPassword);
  const user = await db.transaction(async (tx) => {
    const token = await tx.query<{ id: string; user_id: string; email: string }>(
      `SELECT pr.id,pr.user_id,u.email FROM password_reset_tokens pr
       JOIN users u ON u.id=pr.user_id
       WHERE pr.token_hash=$1 AND pr.used_at IS NULL AND pr.expires_at>NOW() AND u.is_active=TRUE
       FOR UPDATE`, [tokenHash]
    );
    if (!token.rows[0]) return null;
    await tx.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE id=$1', [token.rows[0].id]);
    await tx.query('UPDATE users SET password_hash=$1,password_changed_at=NOW(),failed_login_attempts=0,locked_until=NULL,mfa_failed_attempts=0,mfa_locked_until=NULL,updated_at=NOW() WHERE id=$2', [passwordHash, token.rows[0].user_id]);
    await tx.query('DELETE FROM sessions WHERE user_id=$1', [token.rows[0].user_id]);
    return token.rows[0];
  });
  if (!user) return false;
  await logAudit({ userId: user.user_id, userEmail: user.email, action: 'auth.password_reset_completed', summary: 'Password changed through a single-use reset link.' });
  return true;
}
