/**
 * Integration tests for helmet middleware — security headers.
 */
import express from "express";
import request from "supertest";
import { helmetMiddleware } from "./helmet";

function makeApp() {
  const app = express();
  app.use(helmetMiddleware);
  app.get("/test", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("helmetMiddleware — security headers", () => {
  const app = makeApp();

  it("sets Content-Security-Policy with same-origin script-src", async () => {
    const res = await request(app).get("/test");
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeDefined();
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/script-src 'self'/);
  });

  it("sets Strict-Transport-Security with max-age=31536000", async () => {
    const res = await request(app).get("/test");
    const hsts = res.headers["strict-transport-security"];
    expect(hsts).toBeDefined();
    expect(hsts).toMatch(/max-age=31536000/);
  });

  it("sets X-Frame-Options: DENY", async () => {
    const res = await request(app).get("/test");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });

  it("sets X-Content-Type-Options: nosniff", async () => {
    const res = await request(app).get("/test");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
