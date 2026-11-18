import assert from 'node:assert/strict';
import { getDb, closeDb, runMigrations } from '../src/lib/db';
import { seedDatabase } from '../src/lib/seed-data';
import { authenticateUserCredentials, hashPassword, resetPassword, revokeSession } from '../src/lib/auth';
import { createId, encryptSecret, generateSecureToken, generateTotpSecret, sha256Hex, computeTotpCode, verifyTotpCode } from '../src/lib/security';
import { hasPermission, DEFAULT_ROLES } from '../src/lib/permissions';
import { createAdminUser, createCustomRole, setUserActive, updateRolePermissions } from '../src/lib/user-admin';

function statusOf(result: Awaited<ReturnType<typeof authenticateUserCredentials>>) {
  return result.ok ? 200 : result.status;
}

async function main() {
  process.env.DATABASE_URL = 'pglite://memory://';
  process.env.AUTO_INIT_DB = 'false';
  process.env.SESSION_SECRET = 'test-only-session-secret-'.padEnd(40, 'x');
  process.env.MAX_LOGIN_ATTEMPTS = '3';
  const db = await getDb();
  try {
    assert.equal(db.driver, 'pglite');
    assert.equal((await runMigrations(db)).length, 3);
    await seedDatabase(db);
    assert.equal((await runMigrations(db)).length, 0, 'migrations are idempotently tracked');
    assert.equal(DEFAULT_ROLES.length, 7);
    assert.equal(hasPermission([], 'super_admin', 'users.manage'), true);
    assert.equal(hasPermission([], 'readonly_admin', 'content.publish'), false);
    assert.equal(hasPermission(['content.view'], 'editor', 'content.view'), true);

    const role = await db.query<{ id: string }>("SELECT id FROM roles WHERE slug='super_admin'");
    const userId = createId('testusr');
    const email = 'phase2-test@example.invalid';
    await db.query(
      `INSERT INTO users (id,email,full_name,password_hash,role_id) VALUES ($1,$2,$3,$4,$5)`,
      [userId, email, 'Phase Two Test', await hashPassword('a-unique-test-password-2026'), role.rows[0].id]
    );

    await createCustomRole({ slug: 'phase2_test_role', nameSw: 'Jukumu la Jaribio', nameEn: 'Test Role', permissions: ['content.view'] }, userId);
    await updateRolePermissions('phase2_test_role', ['content.view', 'content.create'], userId);
    const createdUser = await createAdminUser({ email: 'phase2-editor@example.invalid', fullName: 'Phase Two Editor', roleSlug: 'phase2_test_role', password: 'another-unique-test-password-2026' }, userId);
    await setUserActive(createdUser.id, false, userId);
    const disabledLogin = await authenticateUserCredentials({ email: createdUser.email, password: 'another-unique-test-password-2026', ip: '127.0.0.1', userAgent: 'phase2-test' });
    assert.equal(statusOf(disabledLogin), 403, 'deactivated accounts cannot sign in');
    await setUserActive(createdUser.id, true, userId);

    const wrong = await authenticateUserCredentials({ email, password: 'wrong-password', ip: '127.0.0.1', userAgent: 'phase2-test' });
    assert.equal(wrong.ok, false);
    const authenticated = await authenticateUserCredentials({ email, password: 'a-unique-test-password-2026', ip: '127.0.0.1', userAgent: 'phase2-test' });
    assert.equal(authenticated.ok, true);
    if (!authenticated.ok) throw new Error('Expected login success.');
    const storedSession = await db.query<{ token_hash: string }>('SELECT token_hash FROM sessions WHERE user_id=$1', [userId]);
    assert.equal(storedSession.rows[0].token_hash, sha256Hex(authenticated.rawSessionToken), 'only a session token hash is stored');
    assert.equal((await db.query('SELECT id FROM sessions WHERE token_hash=$1', [authenticated.rawSessionToken])).rows.length, 0);

    await revokeSession(authenticated.rawSessionToken);
    assert.equal((await db.query('SELECT id FROM sessions WHERE user_id=$1', [userId])).rows.length, 0, 'logout revokes server-side session');

    const totpSecret = generateTotpSecret();
    const encrypted = encryptSecret(totpSecret);
    assert.notEqual(encrypted, totpSecret);
    const { decryptSecret } = await import('../src/lib/security');
    assert.equal(decryptSecret(encrypted), totpSecret);
    await db.query('UPDATE users SET mfa_enabled=TRUE,mfa_secret=$1 WHERE id=$2', [encrypted, userId]);
    let badMfaCode = '000000';
    while (verifyTotpCode(totpSecret, badMfaCode)) badMfaCode = String((Number(badMfaCode) + 1) % 1_000_000).padStart(6, '0');
    assert.equal(statusOf(await authenticateUserCredentials({ email, password: 'a-unique-test-password-2026', mfaCode: badMfaCode, ip: '127.0.0.1', userAgent: 'phase2-test' })), 401);
    assert.equal(statusOf(await authenticateUserCredentials({ email, password: 'a-unique-test-password-2026', mfaCode: badMfaCode, ip: '127.0.0.1', userAgent: 'phase2-test' })), 401);
    assert.equal(statusOf(await authenticateUserCredentials({ email, password: 'a-unique-test-password-2026', mfaCode: badMfaCode, ip: '127.0.0.1', userAgent: 'phase2-test' })), 429, 'repeated MFA failures trigger lockout');
    await db.query('UPDATE users SET mfa_failed_attempts=0,mfa_locked_until=NULL WHERE id=$1', [userId]);
    const mfaLogin = await authenticateUserCredentials({ email, password: 'a-unique-test-password-2026', mfaCode: computeTotpCode(totpSecret), ip: '127.0.0.1', userAgent: 'phase2-test' });
    assert.equal(mfaLogin.ok, true, 'TOTP MFA authentication works');
    if (mfaLogin.ok) await revokeSession(mfaLogin.rawSessionToken);

    const resetToken = generateSecureToken(32);
    await db.query('INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at) VALUES ($1,$2,$3,NOW()+INTERVAL \'10 minutes\')', [createId('rst'), userId, sha256Hex(resetToken)]);
    assert.equal(await resetPassword(resetToken, 'a-new-test-password-2026'), true);
    assert.equal(await resetPassword(resetToken, 'another-new-password-2026'), false, 'reset token is single-use');
    const afterReset = await authenticateUserCredentials({ email, password: 'a-new-test-password-2026', mfaCode: computeTotpCode(totpSecret), ip: '127.0.0.1', userAgent: 'phase2-test' });
    assert.equal(afterReset.ok, true, 'password reset updates credentials');
    if (afterReset.ok) await revokeSession(afterReset.rawSessionToken);

    console.log('Phase 2 checks passed: migrations, seed data, configurable RBAC, user creation/deactivation, password login, hashed sessions/logout, encrypted TOTP MFA lockout, and single-use password reset.');
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error('Phase 2 test failed:', error);
  process.exitCode = 1;
});
