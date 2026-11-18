import { getRawDb, runMigrations, closeDb } from '../src/lib/db';
import { seedDatabase } from '../src/lib/seed-data';

async function main() {
  const db = await getRawDb();
  try {
    await runMigrations(db);
    await seedDatabase(db);
    console.log('System roles, baseline settings, and content categories are seeded. No user accounts were created.');
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error('Database seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
