/**
 * Rate limit headers integration tests — Issue #603
 * Verifies RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset on all responses,
 * and Retry-After on 429 responses.
 */
import request from "supertest";
import express, { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";

function makeApp(max: number): Express {
  const app = express();
  app.set("trust proxy", false);
  app.use(
    rateLimit({
      windowMs: 60_000,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many requests", retryAfter: 60 },
    }),
  );
  app.get("/", (_req: Request, res: Response) => res.json({ ok: true }));
  return app;
}

describe("Rate limit headers — Issue #603", () => {
  describe("successful responses include standard rate limit headers", () => {
    it("includes RateLimit-Limit on 200", async () => {
      const app = makeApp(100);
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty("ratelimit-limit");
    });

    it("includes RateLimit-Remaining on 200", async () => {
      const app = makeApp(100);
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty("ratelimit-remaining");
    });

    it("includes RateLimit-Reset on 200", async () => {
      const app = makeApp(100);
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty("ratelimit-reset");
    });

    it("RateLimit-Limit matches configured max", async () => {
      const app = makeApp(42);
      const res = await request(app).get("/");
      expect(res.headers["ratelimit-limit"]).toBe("42");
    });

    it("RateLimit-Remaining decrements with each request", async () => {
      const app = makeApp(10);
      const res1 = await request(app).get("/");
      const res2 = await request(app).get("/");
      const remaining1 = parseInt(res1.headers["ratelimit-remaining"] as string, 10);
      const remaining2 = parseInt(res2.headers["ratelimit-remaining"] as string, 10);
      expect(remaining2).toBe(remaining1 - 1);
    });
  });

  describe("429 responses include Retry-After header", () => {
    it("includes Retry-After on 429", async () => {
      const app = makeApp(1);
      await request(app).get("/"); // consume limit
      const res = await request(app).get("/");
      expect(res.status).toBe(429);
      expect(res.headers).toHaveProperty("retry-after");
    });

    it("Retry-After is a positive integer (seconds)", async () => {
      const app = makeApp(1);
      await request(app).get("/");
      const res = await request(app).get("/");
      const retryAfter = parseInt(res.headers["retry-after"] as string, 10);
      expect(retryAfter).toBeGreaterThan(0);
    });

    it("429 also includes RateLimit-Remaining = 0", async () => {
      const app = makeApp(1);
      await request(app).get("/");
      const res = await request(app).get("/");
      expect(res.status).toBe(429);
      expect(res.headers["ratelimit-remaining"]).toBe("0");
    });
  });
});
