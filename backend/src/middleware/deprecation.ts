import { Request, RequestHandler, Response } from "express";

export interface DeprecationOptions {
  /** RFC 7231 HTTP-date when the endpoint will be removed */
  sunset: Date;
  /** Human-readable guidance (RFC 7234 Warning header) */
  warning: string;
  /** Optional Link header value, e.g. '</api/v1/loans>; rel="successor-version"' */
  link?: string;
}

/**
 * Writes Deprecation, Sunset, Warning, and optional Link headers on a response.
 * @param res - Express response object.
 * @param options - Deprecation metadata.
 */
export function applyDeprecationHeaders(res: Response, options: DeprecationOptions): void {
  res.setHeader("Deprecation", "true");
  res.setHeader("Sunset", options.sunset.toUTCString());
  res.setHeader("Warning", `299 - "${options.warning}"`);
  if (options.link) {
    res.setHeader("Link", options.link);
  }
}

/**
 * Sets Deprecation, Sunset, and Warning headers on responses from deprecated endpoints.
 * Use as route-level middleware before the handler.
 * @param options - Deprecation metadata.
 * @returns Express middleware that applies deprecation headers.
 */
export function deprecationHeaders(options: DeprecationOptions): RequestHandler {
  return (_req, res, next) => {
    applyDeprecationHeaders(res, options);
    next();
  };
}

/**
 * Conditionally applies deprecation headers when predicate returns true.
 * @param predicate - Returns true when the request should receive deprecation headers.
 * @param options - Deprecation metadata.
 * @returns Express middleware that conditionally applies deprecation headers.
 */
export function deprecationHeadersWhen(
  predicate: (req: Request) => boolean,
  options: DeprecationOptions
): RequestHandler {
  return (req, res, next) => {
    if (predicate(req)) {
      applyDeprecationHeaders(res, options);
    }
    next();
  };
}
