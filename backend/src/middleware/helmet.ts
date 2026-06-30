import helmet from "helmet";

/**
 * Helmet middleware pre-configured with recommended security headers.
 *
 * - Content-Security-Policy: allows only same-origin scripts (default-src 'self')
 * - Strict-Transport-Security: max-age=31536000 (1 year)
 * - X-Frame-Options: DENY
 * - Plus other helmet defaults (XSS protection, noSniff, etc.)
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  frameguard: { action: "deny" },
});
