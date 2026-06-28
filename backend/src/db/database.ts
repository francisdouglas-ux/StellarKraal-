/**
 * Database driver abstraction.
 * Switches between SQLite (dev) and PostgreSQL (staging/prod) based on DATABASE_URL.
 *
 * - SQLite: used when DATABASE_URL is unset or starts with "sqlite:"
 * - PostgreSQL: used when DATABASE_URL starts with "postgres://" or "postgresql://"
 */
import logger from "../utils/logger";
import type { Pool as PgPool } from "pg";

export type DbDriver = "sqlite" | "pg";

function resolveDriver(): DbDriver {
  const url = process.env.DATABASE_URL;
  if (url && (url.startsWith("postgres://") || url.startsWith("postgresql://"))) {
    return "pg";
  }
  return "sqlite";
}

export const activeDriver: DbDriver = resolveDriver();

// ── PostgreSQL connection pool ────────────────────────────────────────────────

let pgPool: PgPool | undefined;

if (activeDriver === "pg") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { Pool } = require("pg") as { Pool: new (opts: Record<string, unknown>) => PgPool };
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pgPool.on("error", (err: Error) => {
    logger.error("Unexpected error on idle PostgreSQL client", { error: err.message });
  });

  logger.info("PostgreSQL connection pool initialised", { max: 10 });
}

export { pgPool };

/**
 * Run a single query against the active PostgreSQL pool.
 * Throws if called when the active driver is not 'pg'.
 */
export async function pgQuery<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  if (!pgPool) {
    throw new Error("pgQuery called but driver is not 'pg'");
  }
  const result = await pgPool.query(sql, params);
  return result.rows as T[];
}

/**
 * Returns health information for the active database driver.
 */
export async function dbHealth(): Promise<{ driver: DbDriver; healthy: boolean; detail?: string }> {
  if (activeDriver === "pg" && pgPool) {
    try {
      await pgPool.query("SELECT 1");
      return { driver: "pg", healthy: true };
    } catch (err: any) {
      return { driver: "pg", healthy: false, detail: err.message };
    }
  }
  // SQLite is always considered reachable (in-memory / file)
  return { driver: "sqlite", healthy: true };
}
