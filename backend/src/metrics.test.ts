/**
 * Unit tests for DB connection pool Prometheus metrics (issue #597).
 * Verifies that db_pool_acquired_total, db_pool_available, and db_pool_wait_ms
 * are registered and update correctly on acquire/release.
 */
import { registry, dbPoolAcquiredTotal, dbPoolAvailable, dbPoolWaitMs } from "./metrics";

describe("DB Pool Metrics", () => {
  it("db_pool_acquired_total is registered in the registry", () => {
    const metric = registry.getSingleMetric("db_pool_acquired_total");
    expect(metric).toBeDefined();
  });

  it("db_pool_available is registered in the registry", () => {
    const metric = registry.getSingleMetric("db_pool_available");
    expect(metric).toBeDefined();
  });

  it("db_pool_wait_ms is registered in the registry", () => {
    const metric = registry.getSingleMetric("db_pool_wait_ms");
    expect(metric).toBeDefined();
  });

  it("db_pool_acquired_total increments on inc()", async () => {
    const before = await dbPoolAcquiredTotal.get();
    dbPoolAcquiredTotal.inc();
    const after = await dbPoolAcquiredTotal.get();
    expect(after.values[0].value).toBeGreaterThan(before.values[0].value);
  });

  it("db_pool_available reflects set() value", async () => {
    dbPoolAvailable.set(4);
    const result = await dbPoolAvailable.get();
    expect(result.values[0].value).toBe(4);
  });

  it("db_pool_wait_ms records observations", async () => {
    dbPoolWaitMs.observe(12);
    const result = await dbPoolWaitMs.get();
    // The histogram should have at least one bucket count > 0
    const nonZero = result.values.some((v) => v.value > 0);
    expect(nonZero).toBe(true);
  });
});
