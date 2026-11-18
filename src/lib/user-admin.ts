import { getDb } from './db';
import { logAudit } from './audit';
import { createId } from './security';
import { hashPassword } from './auth';
import { ALL_PERMISSIONS, DEFAULT_ROLES } from './permissions';

export interface CreateAdminUserInput {
  email: string;
  fullName: string;
  roleSlug: string;
  password: string;
  jobTitle?: string;
  department?: string;
  phone?: string;
  delegatedPublish?: boolean;
}

export async function createAdminUser(input: CreateAdminUserInput, actorId: string) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email address is required.');
  if (input.fullName.trim().length < 2) throw new Error('Full name must contain at least two characters.');
  if (input.password.length < 12 || input.password.length > 128) throw new Error('Password must be between 12 and 128 characters.');

  const db = await getDb();
  const role = await db.query<{ id: string; slug: string }>('SELECT id, slug FROM roles WHERE slug = $1', [input.roleSlug]);
  if (!role.rows[0]) throw new Error('Selected role does not exist.');
  if (input.roleSlug === 'super_admin') {
    const actor = await db.query<{ slug: string }>(
      'SELECT r.slug FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND u.is_active = TRUE',
      [actorId]
    );
    if (actor.rows[0]?.slug !== 'super_admin') throw new Error('Only a Super Administrator can assign the Super Administrator role.');
  }

  const id = createId('usr');
  const passwordHash = await hashPassword(input.password);
  await db.query(
    `INSERT INTO users (id,email,full_name,job_title,department,phone,password_hash,role_id,delegated_publish)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, email, input.fullName.trim(), input.jobTitle?.trim() ?? '', input.department?.trim() ?? '', input.phone?.trim() ?? '', passwordHash, role.rows[0].id, Boolean(input.delegatedPublish)]
  );
  await logAudit({ userId: actorId, action: 'users.created', entityType: 'user', entityId: id, summary: `Created ${input.roleSlug} account ${email}` });
  return { id, email, fullName: input.fullName.trim(), roleSlug: input.roleSlug };
}

export async function createCustomRole(input: { slug: string; nameSw: string; nameEn: string; descriptionSw?: string; descriptionEn?: string; permissions: string[] }, actorId: string) {
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(input.slug) || input.slug === 'super_admin') throw new Error('Role ID must start with a letter and contain only lowercase letters, digits, or underscores.');
  if (input.nameSw.trim().length < 2 || input.nameEn.trim().length < 2) throw new Error('Role names are required in Kiswahili and English.');
  const known = new Set(ALL_PERMISSIONS.map(({ key }) => key));
  if (input.permissions.some((permission) => !known.has(permission as never))) throw new Error('Role contains an unknown permission.');
  const db = await getDb();
  const id = createId('role');
  await db.query(
    `INSERT INTO roles (id,slug,name_sw,name_en,description_sw,description_en,permissions,is_system)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,FALSE)`,
    [id,input.slug,input.nameSw.trim(),input.nameEn.trim(),input.descriptionSw?.trim() ?? '',input.descriptionEn?.trim() ?? '',JSON.stringify([...new Set(input.permissions)])]
  );
  await logAudit({ userId: actorId, action: 'roles.created', entityType: 'role', entityId: id, summary: `Created custom role ${input.slug}` });
  return { id, slug: input.slug };
}

export async function updateRolePermissions(roleSlug: string, requested: string[], actorId: string) {
  const allowed = new Set(ALL_PERMISSIONS.map(({ key }) => key));
  const unknown = requested.filter((permission) => !allowed.has(permission as never));
  if (unknown.length) throw new Error(`Unknown permission key(s): ${unknown.join(', ')}`);
  if (roleSlug === 'super_admin') throw new Error('Built-in Super Administrator permissions are immutable.');
  const db = await getDb();
  const role = await db.query<{ id: string; is_system: boolean }>('SELECT id, is_system FROM roles WHERE slug = $1', [roleSlug]);
  if (!role.rows[0]) throw new Error('Role not found.');
  await db.query('UPDATE roles SET permissions = $1::jsonb, updated_at = NOW() WHERE id = $2', [JSON.stringify([...new Set(requested)]), role.rows[0].id]);
  await logAudit({ userId: actorId, action: 'roles.permissions_updated', entityType: 'role', entityId: role.rows[0].id, summary: `Updated permissions for role ${roleSlug}`, details: { permissionCount: requested.length } });
}

export async function setUserActive(userId: string, active: boolean, actorId: string) {
  const db = await getDb();
  if (userId === actorId && !active) throw new Error('You cannot deactivate your own account.');
  const target = await db.transaction(async (tx) => {
    const found = await tx.query<{ email: string; role_slug: string; is_active: boolean }>(
      'SELECT u.email,u.is_active,r.slug AS role_slug FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 FOR UPDATE', [userId]
    );
    if (!found.rows[0]) return null;
    if (!active && found.rows[0].role_slug === 'super_admin' && found.rows[0].is_active) {
      const locked = await tx.query<{ id: string }>(
        `SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.slug='super_admin' AND u.is_active=TRUE FOR UPDATE`
      );
      if (locked.rows.length <= 1) throw new Error('The final active Super Administrator cannot be deactivated.');
    }
    await tx.query('UPDATE users SET is_active=$1,updated_at=NOW() WHERE id=$2', [active, userId]);
    if (!active) await tx.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
    return found.rows[0];
  });
  if (!target) throw new Error('User not found.');
  await logAudit({ userId: actorId, action: active ? 'users.activated' : 'users.deactivated', entityType: 'user', entityId: userId, summary: `${active ? 'Activated' : 'Deactivated'} account ${target.email}` });
}

export async function listSystemRoles() {
  const db = await getDb();
  const result = await db.query<{
    id: string; slug: string; name_sw: string; name_en: string;
    description_sw: string; description_en: string; permissions: string[]; is_system: boolean;
  }>('SELECT id,slug,name_sw,name_en,description_sw,description_en,permissions,is_system FROM roles ORDER BY slug');
  return result.rows;
}

export async function ensureBootstrapRoleDefinitions() {
  const db = await getDb();
  for (const role of DEFAULT_ROLES) {
    await db.query(
      `INSERT INTO roles (id,slug,name_sw,name_en,description_sw,description_en,permissions,is_system)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) ON CONFLICT (slug) DO NOTHING`,
      [role.id, role.slug, role.name_sw, role.name_en, role.description_sw, role.description_en, JSON.stringify(role.permissions), role.is_system]
    );
  }
}

export async function resetUserMfa(userId: string, actorId: string) {
  const db = await getDb();
  const actor = await db.query<{ slug: string }>('SELECT r.slug FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 AND u.is_active=TRUE', [actorId]);
  if (actor.rows[0]?.slug !== 'super_admin') throw new Error('Only an active Super Administrator may reset another account’s MFA.');
  const target = await db.query<{ email: string }>('SELECT email FROM users WHERE id=$1', [userId]);
  if (!target.rows[0]) throw new Error('User not found.');
  await db.transaction(async (tx) => {
    await tx.query(`UPDATE users SET mfa_enabled=FALSE,mfa_secret=NULL,mfa_backup_codes='[]'::jsonb,mfa_failed_attempts=0,mfa_locked_until=NULL,updated_at=NOW() WHERE id=$1`, [userId]);
    await tx.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
  });
  await logAudit({ userId: actorId, action: 'users.mfa_reset', entityType: 'user', entityId: userId, summary: `Reset MFA enrollment for ${target.rows[0].email}; active sessions revoked.` });
}
