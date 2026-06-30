import {
  getAppraisal,
  setAppraisal,
  invalidateAppraisal,
  invalidateAll,
  configureCacheTTL,
  _cacheSize,
} from "./appraisalCache";

// Silence logger output during tests
jest.mock("./logger", () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
import loggerMock from "./logger";
const mockLogger = loggerMock as any;

beforeEach(() => {
  invalidateAll();
  configureCacheTTL(5 * 60 * 1000); // reset to default 5-minute TTL
  jest.clearAllMocks();
});

describe("appraisalCache — cache hit / miss", () => {
  it("returns null on cache miss", () => {
    expect(getAppraisal("col-1")).toBeNull();
  });

  it("logs a cache miss", () => {
    getAppraisal("col-miss");
    expect(mockLogger.debug).toHaveBeenCalledWith("appraisal_cache_miss", {
      collateralId: "col-miss",
    });
  });

  it("returns cached value on hit", () => {
    setAppraisal("col-1", 1000);
    const entry = getAppraisal("col-1");
    expect(entry).not.toBeNull();
    expect(entry!.value).toBe(1000);
    expect(entry!.stale).toBe(false);
  });

  it("logs a cache hit", () => {
    setAppraisal("col-hit", 500);
    getAppraisal("col-hit");
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "appraisal_cache_hit",
      expect.objectContaining({ collateralId: "col-hit" }),
    );
  });
});

describe("appraisalCache — TTL and stale flag", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("entry is retrievable before TTL expires", () => {
    configureCacheTTL(5_000);
    setAppraisal("col-fresh", 999);
    jest.advanceTimersByTime(4_999);
    const entry = getAppraisal("col-fresh");
    expect(entry).not.toBeNull();
    expect(entry!.stale).toBe(false);
    expect(entry!.value).toBe(999);
  });

  it("entry returns undefined (null) after TTL expires", () => {
    configureCacheTTL(5_000);
    setAppraisal("col-expired", 500);
    jest.advanceTimersByTime(5_001);
    const entry = getAppraisal("col-expired");
    expect(entry).not.toBeNull(); // still present but stale
    expect(entry!.stale).toBe(true);
  });

  it("configureCacheTTL changes expiry for subsequent entries", () => {
    // Set a long TTL and store an entry
    configureCacheTTL(60_000);
    setAppraisal("col-a", 100);
    // Entry is fresh immediately
    expect(getAppraisal("col-a")!.stale).toBe(false);

    // Advance time but stay within TTL
    jest.advanceTimersByTime(5_000);
    expect(getAppraisal("col-a")!.stale).toBe(false);

    // Shorten TTL — new entries use the new TTL, and existing reads now use the shorter TTL too
    configureCacheTTL(1_000);
    setAppraisal("col-b", 200);
    // col-b is fresh immediately
    expect(getAppraisal("col-b")!.stale).toBe(false);

    // Advance past the new TTL
    jest.advanceTimersByTime(1_001);
    // col-b (set after TTL change) is now stale
    expect(getAppraisal("col-b")!.stale).toBe(true);
  });

  it("logs a stale cache access", () => {
    configureCacheTTL(1_000);
    setAppraisal("col-stale-log", 200);
    jest.advanceTimersByTime(1_001);
    getAppraisal("col-stale-log");
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "appraisal_cache_stale",
      expect.objectContaining({ collateralId: "col-stale-log" }),
    );
  });

  it("does not mutate the stored entry when returning stale", () => {
    configureCacheTTL(1_000);
    setAppraisal("col-immutable", 300);
    jest.advanceTimersByTime(1_001);
    const first = getAppraisal("col-immutable");
    const second = getAppraisal("col-immutable");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(_cacheSize()).toBe(1);
  });
});

describe("appraisalCache — cache invalidation on oracle price update", () => {
  it("invalidates a specific entry", () => {
    setAppraisal("col-3", 200);
    invalidateAppraisal("col-3");
    expect(getAppraisal("col-3")).toBeNull();
  });

  it("logs invalidation of a specific entry", () => {
    setAppraisal("col-log-inv", 100);
    invalidateAppraisal("col-log-inv");
    expect(mockLogger.info).toHaveBeenCalledWith("appraisal_cache_invalidated", {
      collateralId: "col-log-inv",
    });
  });

  it("does not throw when invalidating a non-existent key", () => {
    expect(() => invalidateAppraisal("does-not-exist")).not.toThrow();
  });

  it("does not log when invalidating a non-existent key", () => {
    invalidateAppraisal("ghost-key");
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      "appraisal_cache_invalidated",
      expect.anything(),
    );
  });

  it("invalidateAll clears all entries", () => {
    setAppraisal("col-4", 100);
    setAppraisal("col-5", 200);
    invalidateAll();
    expect(_cacheSize()).toBe(0);
  });

  it("invalidateAll logs the count of cleared entries", () => {
    setAppraisal("col-a", 10);
    setAppraisal("col-b", 20);
    invalidateAll();
    expect(mockLogger.info).toHaveBeenCalledWith(
      "appraisal_cache_invalidated_all",
      { count: 2 },
    );
  });

  it("invalidateAll on empty cache logs count 0", () => {
    invalidateAll(); // cache already empty from beforeEach
    expect(mockLogger.info).toHaveBeenCalledWith(
      "appraisal_cache_invalidated_all",
      { count: 0 },
    );
  });

  it("after invalidateAll, new entries can be cached again", () => {
    setAppraisal("col-6", 300);
    invalidateAll();
    setAppraisal("col-6", 400);
    const entry = getAppraisal("col-6");
    expect(entry).not.toBeNull();
    expect(entry!.value).toBe(400);
    expect(entry!.stale).toBe(false);
  });
});

describe("appraisalCache — stale: true in response shape", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returned entry includes stale: false when fresh", () => {
    setAppraisal("col-resp", 1500);
    const entry = getAppraisal("col-resp");
    expect(entry).toMatchObject({ value: 1500, stale: false });
  });

  it("returned entry includes stale: true when expired", () => {
    jest.useFakeTimers();
    configureCacheTTL(5_000);
    setAppraisal("col-resp-stale", 1500);
    jest.advanceTimersByTime(5_001);
    const entry = getAppraisal("col-resp-stale");
    expect(entry).toMatchObject({ value: 1500, stale: true });
  });
});
