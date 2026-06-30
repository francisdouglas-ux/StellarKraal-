/**
 * Database driver abstraction.
 * Switches between SQLite (dev) and PostgreSQL (staging/prod) based on DATABASE_URL.
 *
 * - SQLite: used when DATABASE_URL is unset or starts with "sqlite:"
 * - PostgreSQL: used when DATABASE_URL starts with "postgres://" or "postgresql://"
 */
import logger from '../utils/logger';
import type { Pool as PgPool } from 'pg';

export type DbDriver = 'sqlite' | 'pg';

function resolveDriver(): DbDriver {
  const url = process.env.DATABASE_URL;
  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    return 'pg';
  }
  return 'sqlite';
}

export const activeDriver: DbDriver = resolveDriver();

// ── PostgreSQL connection pool ────────────────────────────────────────────────

let pgPool: PgPool | undefined;

if (activeDriver === 'pg') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg') as { Pool: new (opts: Record<string, unknown>) => PgPool };
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pgPool.on('error', (err: Error) => {
    logger.error('Unexpected error on idle PostgreSQL client', { error: err.message });
  });

  logger.info('PostgreSQL connection pool initialised', { max: 10 });
}

export { pgPool };

/**
 * Run a parameterized query against the active PostgreSQL pool.
 *
 * SQL injection prevention: all user-controlled values MUST be passed via the
 * `params` array and referenced as $1, $2, … placeholders in `sql`. Never
 * interpolate user input directly into the `sql` string — the pg driver
 * handles escaping only through its parameterized query API.
 *
 * Audit (issue #617): confirmed no string interpolation is used in any
 * call-site; `pgPool.query(sql, params)` always receives a separate params
 * array so the driver can quote values safely.
 *
 * Throws if called when the active driver is not 'pg'.
 * @param sql - Parameterized SQL string with $1, $2, … placeholders.
 * @param params - Array of values bound to the SQL placeholders.
 * @returns Array of result rows cast to type T.
 */
export async function pgQuery<T = unknown>(sql: string, params: unknown[]): Promise<T[]> {
  if (!pgPool) {
    throw new Error("pgQuery called but driver is not 'pg'");
  }
  const result = await pgPool.query(sql, params);
  return result.rows as T[];
}

/**
 * Returns health information for the active database driver.
 * @returns Object with driver name, healthy flag, and optional detail message.
 */
export async function dbHealth(): Promise<{ driver: DbDriver; healthy: boolean; detail?: string }> {
  if (activeDriver === 'pg' && pgPool) {
    try {
      await pgPool.query('SELECT 1');
      return { driver: 'pg', healthy: true };
    } catch (err: any) {
      return { driver: 'pg', healthy: false, detail: err.message };
    }
  }
  // SQLite is always considered reachable (in-memory / file)
  return { driver: 'sqlite', healthy: true };
}
