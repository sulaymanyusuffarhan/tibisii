import { getRawDb, runMigrations, closeDb } from '../src/lib/db';
import { seedDatabase } from '../src/lib/seed-data';
import { hashPassword } from '../src/lib/auth';
import { createId, validateSessionSecret } from '../src/lib/security';

async function main() {
  validateSessionSecret();
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.INITIAL_ADMIN_NAME?.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !name || !password || email.includes('.example')) {
    throw new Error('Set INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_NAME, and a unique INITIAL_ADMIN_PASSWORD in your private environment before running admin:init.');
  }
  if (password.length < 16 || password.length > 128 || password === 'TbcAdmin!2026#Staging') {
    throw new Error('Bootstrap password must be 16–128 characters and must not be the sample password.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INITIAL_ADMIN_EMAIL must be a valid email address.');

  const db = await getRawDb();
  try {
    await runMigrations(db);
    await seedDatabase(db);
    const exists = await db.query<{ id: string }>('SELECT id FROM users WHERE LOWER(email)=$1', [email]);
    if (exists.rows.length) throw new Error('An account already uses INITIAL_ADMIN_EMAIL; bootstrap will not modify or reset it.');
    const role = await db.query<{ id: string }>("SELECT id FROM roles WHERE slug='super_admin'");
    if (!role.rows[0]) throw new Error('Super Administrator role was not seeded.');
    await db.query(
      `INSERT INTO users (id,email,full_name,job_title,department,password_hash,role_id)
       VALUES ($1,$2,$3,'System Administrator','TBC ICT',$4,$5)`,
      [createId('usr'), email, name, await hashPassword(password), role.rows[0].id]
    );
    console.log(`Initial Super Administrator created for ${email}. Sign in and configure MFA; remove bootstrap secrets from the deployment environment.`);
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error('Administrator bootstrap failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
