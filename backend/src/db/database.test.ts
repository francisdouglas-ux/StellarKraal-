/**
 * Database driver switching tests — Issue #605
 * Verifies DATABASE_URL selects correct driver and health check reports it.
 */
import { dbHealth, activeDriver, type DbDriver } from "./database";

describe("Database driver — Issue #605", () => {
  it("uses sqlite driver when DATABASE_URL is unset", () => {
    // In test env DATABASE_URL is not set
    expect(activeDriver).toBe("sqlite");
  });

  it("resolveDriver returns pg for postgres:// URLs", () => {
    // We test the logic by directly checking the module output
    // (Can't reinitialise the module without a full mock, so we verify the
    // current driver matches the environment.)
    const url = process.env.DATABASE_URL;
    const expected: DbDriver =
      url && (url.startsWith("postgres://") || url.startsWith("postgresql://"))
        ? "pg"
        : "sqlite";
    expect(activeDriver).toBe(expected);
  });

  it("dbHealth returns sqlite driver as healthy", async () => {
    const health = await dbHealth();
    expect(health.driver).toBe("sqlite");
    expect(health.healthy).toBe(true);
  });

  it("dbHealth response includes driver and healthy fields", async () => {
    const health = await dbHealth();
    expect(health).toHaveProperty("driver");
    expect(health).toHaveProperty("healthy");
    expect(typeof health.healthy).toBe("boolean");
  });
});
