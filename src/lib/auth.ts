import { cookies, headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from './db';
import { hasPermission, type PermissionKey } from './permissions';
import {
  createId,
  generateSecureToken,
  getClientIp,
  sha256Hex,
  verifyTotpCode,
} from './security';
import { logAudit } from './audit';

export const SESSION_COOKIE_NAME = 'tbc_cms_session';
export const LANG_COOKIE_NAME = 'tbc_lang';

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
  return process.env.NODE_ENV === 'production' && Boolean(proto?.includes('https'));
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
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
    role_slug: string;
  }>(
    `SELECT u.id, u.email, u.full_name, u.password_hash, u.is_active,
            u.mfa_enabled, u.mfa_secret, u.mfa_backup_codes,
            u.failed_login_attempts, u.locked_until, r.slug AS role_slug
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE LOWER(u.email) = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  if (res.rows.length === 0) {
    // Constant-time dummy compare to mitigate timing enumeration
    await bcrypt.compare(params.password, '$2a$12$CwTycUXWue0Thq9StjUM0uJ8p1Y5f4Y4z5k7l8m9n0o1p2q3r4s5t');
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
    const attempts = Number(user.failed_login_attempts || 0) + 1;
    const lockUntil =
      attempts >= maxAttempts
        ? new Date(Date.now() + lockoutMinutes * 60_000).toISOString()
        : null;

    await db.query(
      `UPDATE users SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW() WHERE id = $3`,
      [attempts, lockUntil, user.id]
    );

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
    const totpOk = verifyTotpCode(user.mfa_secret, code);
    let backupUsed = false;

    if (!totpOk) {
      const codeHash = sha256Hex(code.toUpperCase());
      const backups = Array.isArray(user.mfa_backup_codes) ? user.mfa_backup_codes : [];
      const idx = backups.indexOf(codeHash);
      if (idx !== -1) {
        backupUsed = true;
        const remaining = backups.filter((_, i) => i !== idx);
        await db.query('UPDATE users SET mfa_backup_codes = $1::jsonb WHERE id = $2', [
          JSON.stringify(remaining),
          user.id,
        ]);
      }
    }

    if (!totpOk && !backupUsed) {
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role_slug,
        action: 'auth.mfa_failed',
        summary: `Invalid MFA verification code supplied for ${user.email}`,
        ipAddress: params.ip,
        userAgent: params.userAgent,
      });
      return {
        ok: false,
        status: 401,
        error: 'Invalid multi-factor authentication code.',
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
     SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = $1, updated_at = NOW()
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
