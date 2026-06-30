/**
 * Integration tests for CORS middleware — ALLOWED_ORIGINS env var behaviour.
 */
import request from "supertest";
import express from "express";
import { parseAllowedOrigins, corsMiddleware } from "./cors";

const PROD_ENV = "production";
const DEV_ENV = "development";

describe("parseAllowedOrigins", () => {
  const origEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = origEnv; });

  // ── allowed origins parsing ────────────────────────────────────────────
  it("returns null when env var is undefined", () => {
    expect(parseAllowedOrigins(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseAllowedOrigins("")).toBeNull();
  });

  it("parses a single origin", () => {
    expect(parseAllowedOrigins("https://app.example.com")).toEqual([
      "https://app.example.com",
    ]);
  });

  it("parses comma-separated origins", () => {
    process.env.NODE_ENV = DEV_ENV;
    expect(
      parseAllowedOrigins(
        "https://app.example.com,https://staging.example.com",
      ),
    ).toEqual(["https://app.example.com", "https://staging.example.com"]);
  });

  it("trims whitespace around each origin", () => {
    process.env.NODE_ENV = DEV_ENV;
    expect(
      parseAllowedOrigins(" https://a.com , https://b.com "),
    ).toEqual(["https://a.com", "https://b.com"]);
  });

  it("allows wildcard in non-production", () => {
    process.env.NODE_ENV = DEV_ENV;
    expect(parseAllowedOrigins("*")).toEqual(["*"]);
  });

  // ── production wildcard rejection ─────────────────────────────────────
  it("throws when wildcard is used in production", () => {
    process.env.NODE_ENV = PROD_ENV;
    expect(() => parseAllowedOrigins("*")).toThrow(/wildcard.*not permitted in production/i);
  });

  it("throws when wildcard is mixed with origins in production", () => {
    process.env.NODE_ENV = PROD_ENV;
    expect(() =>
      parseAllowedOrigins("https://app.example.com,*"),
    ).toThrow(/wildcard.*not permitted in production/i);
  });

  // ── invalid pattern rejection ──────────────────────────────────────────
  it("throws for an invalid origin pattern (no scheme)", () => {
    process.env.NODE_ENV = DEV_ENV;
    expect(() => parseAllowedOrigins("not-a-url")).toThrow(/invalid origin pattern/i);
  });

  it("throws for ftp:// scheme (only http/https allowed)", () => {
    process.env.NODE_ENV = DEV_ENV;
    expect(() => parseAllowedOrigins("ftp://example.com")).toThrow(/invalid origin pattern/i);
  });

  it("does not throw for valid http:// in non-production", () => {
    process.env.NODE_ENV = DEV_ENV;
    expect(() => parseAllowedOrigins("http://localhost:3000")).not.toThrow();
  });

  it("does not throw for valid https:// in production", () => {
    process.env.NODE_ENV = PROD_ENV;
    expect(() =>
      parseAllowedOrigins("https://app.example.com,https://api.example.com"),
    ).not.toThrow();
  });

  // ── multiple origins in production ────────────────────────────────────
  it("accepts multiple HTTPS origins in production", () => {
    process.env.NODE_ENV = PROD_ENV;
    const result = parseAllowedOrigins(
      "https://app.example.com,https://staging.example.com",
    );
    expect(result).toEqual([
      "https://app.example.com",
      "https://staging.example.com",
    ]);
  });
});

describe("corsMiddleware preflight caching", () => {
  it("sets Access-Control-Max-Age to 600 on OPTIONS preflight", async () => {
    const app = express();
    app.use(corsMiddleware);
    app.get("/api/test", (_req, res) => res.json({ ok: true }));

    const res = await request(app)
      .options("/api/test")
      .set("Origin", "https://example.com")
      .set("Access-Control-Request-Method", "GET");

    expect(res.headers["access-control-max-age"]).toBe("600");
  });
});
