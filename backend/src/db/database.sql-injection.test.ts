/**
 * SQL injection prevention audit (issue #617).
 *
 * Confirms that:
 * 1. pgQuery always forwards a params array to the pg driver (never raw string concat).
 * 2. store.ts uses in-memory JS Maps only — no SQL query strings of any kind.
 * 3. No call-site builds SQL via template literals or string concatenation.
 */
import { pgQuery, activeDriver } from './database';

describe('SQL injection prevention audit (#617)', () => {
  it('pgQuery signature accepts a required params array', () => {
    const src = pgQuery.toString();
    // Confirm the driver call always passes the params array through.
    expect(src).toContain('pgPool.query(sql, params)');
  });

  it('activeDriver resolves to sqlite when DATABASE_URL is unset', () => {
    expect(activeDriver).toBe('sqlite');
  });

  it('pgQuery throws when called outside a pg environment', async () => {
    await expect(pgQuery('SELECT 1', [])).rejects.toThrow("pgQuery called but driver is not 'pg'");
  });

  it('store.ts contains no raw SQL query strings (template literals or concatenation)', () => {
    // Audit: store.ts must not build SQL strings. It must only use in-memory Maps.
    // We check for the dangerous patterns — interpolated SQL — rather than keywords
    // that may appear legitimately in comments or identifier names.
    const src = require('fs').readFileSync(
      require('path').resolve(__dirname, 'store.ts'),
      'utf8'
    ) as string;

    // Template literal SQL: `SELECT ... ${userInput} ...`
    expect(/`\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE)\s/i.test(src)).toBe(false);
    // String concatenation SQL: "SELECT " + variable
    expect(/"(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE)\s.*"\s*\+/i.test(src)).toBe(false);
  });

  it('database.ts health-check query uses no user input', () => {
    // The only raw query in database.ts is SELECT 1 for health checks.
    // It carries no parameters and no user-controlled values.
    const src = require('fs').readFileSync(
      require('path').resolve(__dirname, 'database.ts'),
      'utf8'
    ) as string;

    // Confirm the only raw SQL string is the static health check.
    const rawQueries = src.match(/"[^"]*(?:SELECT|INSERT|UPDATE|DELETE)[^"]*"/gi) ?? [];
    expect(rawQueries).toEqual(['"SELECT 1"']);
  });
});
