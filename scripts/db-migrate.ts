import { getRawDb, runMigrations, closeDb } from '../src/lib/db';

async function main() {
  const db = await getRawDb();
  try {
    const applied = await runMigrations(db);
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database schema is up to date.');
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error('Database migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
