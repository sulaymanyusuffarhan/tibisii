import { getDb } from './db';
import { sha256Hex } from './security';

/** PostgreSQL-backed fixed-window limiter; safe across app instances. */
export async function consumeRateLimit(namespace: string, identifier: string, max: number, windowSeconds: number) {
  const db = await getDb();
  const key = `${namespace}:${sha256Hex(identifier).slice(0,48)}`;
  const result = await db.query<{ count: number; reset_at: string }>(
    `INSERT INTO rate_limits (key,count,reset_at)
     VALUES ($1,1,NOW() + ($2::text || ' seconds')::interval)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.reset_at <= NOW() THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= NOW() THEN NOW() + ($2::text || ' seconds')::interval ELSE rate_limits.reset_at END
     RETURNING count,reset_at`, [key, windowSeconds]
  );
  await db.query('DELETE FROM rate_limits WHERE reset_at <= NOW()').catch(() => {});
  const row = result.rows[0];
  return { allowed: Number(row.count) <= max, remaining: Math.max(0, max - Number(row.count)), resetAt: new Date(row.reset_at) };
}
