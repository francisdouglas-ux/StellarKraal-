import { Request, Response } from "express";
import {
  applyDeprecationHeaders,
  deprecationHeaders,
  deprecationHeadersWhen,
} from "./deprecation";

describe("deprecation middleware", () => {
  const options = {
    sunset: new Date("2026-12-31T23:59:59Z"),
    warning: "Use the paginated endpoint instead.",
    link: '</api/v1/loans?page=1>; rel="successor-version"',
  };

  function mockRes() {
    const headers: Record<string, string> = {};
    return {
      setHeader: jest.fn((key: string, value: string) => {
        headers[key] = value;
      }),
      headers,
    } as unknown as Response & { headers: Record<string, string> };
  }

  it("applyDeprecationHeaders sets Deprecation, Sunset, Warning, and Link", () => {
    const res = mockRes();
    applyDeprecationHeaders(res, options);

    expect(res.setHeader).toHaveBeenCalledWith("Deprecation", "true");
    expect(res.setHeader).toHaveBeenCalledWith("Sunset", options.sunset.toUTCString());
    expect(res.setHeader).toHaveBeenCalledWith("Warning", `299 - "${options.warning}"`);
    expect(res.setHeader).toHaveBeenCalledWith("Link", options.link);
  });

  it("deprecationHeaders middleware always applies headers", () => {
    const res = mockRes();
    const next = jest.fn();
    deprecationHeaders(options)({} as Request, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("Deprecation", "true");
    expect(next).toHaveBeenCalled();
  });

  it("deprecationHeadersWhen applies headers only when predicate is true", () => {
    const res = mockRes();
    const next = jest.fn();
    const middleware = deprecationHeadersWhen((req) => req.query.page === undefined, options);

    middleware({ query: {} } as unknown as Request, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("Deprecation", "true");

    const res2 = mockRes();
    middleware({ query: { page: "1" } } as unknown as Request, res2, next);
    expect(res2.setHeader).not.toHaveBeenCalledWith("Deprecation", "true");
  });
});
