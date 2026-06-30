import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().regex(/^\d+$/, "PORT must be a valid number").default("3001"),
  RPC_URL: z.string().url("RPC_URL must be a valid URL"),
  CONTRACT_ID: z.string().min(1, "CONTRACT_ID is required"),
  NEXT_PUBLIC_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  // Rate limiting (optional with defaults)
  RATE_LIMIT_AUTH: z.string().regex(/^\d+$/, "RATE_LIMIT_AUTH must be a number").default("10"),
  RATE_LIMIT_READ: z.string().regex(/^\d+$/, "RATE_LIMIT_READ must be a number").default("100"),
  RATE_LIMIT_GLOBAL: z.string().regex(/^\d+$/, "RATE_LIMIT_GLOBAL must be a number").default("60"),
  RATE_LIMIT_WRITE: z.string().regex(/^\d+$/, "RATE_LIMIT_WRITE must be a number").default("10"),
  // Request timeouts in milliseconds
  TIMEOUT_GLOBAL_MS: z.string().regex(/^\d+$/, "TIMEOUT_GLOBAL_MS must be a number").default("10000"),
  TIMEOUT_WRITE_MS: z.string().regex(/^\d+$/, "TIMEOUT_WRITE_MS must be a number").default("15000"),
  /** Timeout for contract submission routes (e.g. loan request, repay, liquidate). @default 30000 */
  TIMEOUT_CONTRACT_MS: z.string().regex(/^\d+$/, "TIMEOUT_CONTRACT_MS must be a number").default("30000"),
  /** Origination fee in basis points. @default 50 (0.5%) */
  ORIG_FEE_BPS: z.string().regex(/^\d+$/, "ORIG_FEE_BPS must be a number").default("50"),
  // Webhook secret
  WEBHOOK_SECRET: z.string().min(16, "WEBHOOK_SECRET must be at least 16 characters").optional(),
  // Admin key for webhook admin endpoints
  ADMIN_API_KEY: z.string().min(8, "ADMIN_API_KEY must be at least 8 characters").optional(),
  // Connection pool size
  POOL_MIN: z.string().regex(/^\d+$/, "POOL_MIN must be a number").default("2"),
  POOL_MAX: z.string().regex(/^\d+$/, "POOL_MAX must be a number").default("10"),
  // Appraisal cache TTL in milliseconds
  APPRAISAL_CACHE_TTL_MS: z.string().regex(/^\d+$/, "APPRAISAL_CACHE_TTL_MS must be a number").default("300000"),
  // JWT secret (min 32 chars recommended)
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters").optional(),
  /** Access token TTL in milliseconds. @default 900000 (15 min) */
  ACCESS_TTL_MS: z.string().regex(/^\d+$/, "ACCESS_TTL_MS must be a number").default("900000"),
  /** Refresh token TTL in milliseconds. @default 604800000 (7 days) */
  REFRESH_TTL_MS: z.string().regex(/^\d+$/, "REFRESH_TTL_MS must be a number").default("604800000"),
  /** Health factor warning threshold (×10_000). Below this fires a warning alert. @default 13000 (1.3) */
  HEALTH_FACTOR_WARN: z.string().regex(/^\d+$/, "HEALTH_FACTOR_WARN must be a number").default("13000"),
  /** Health factor critical threshold (×10_000). Below this fires a critical alert. @default 10000 (1.0) */
  HEALTH_FACTOR_CRIT: z.string().regex(/^\d+$/, "HEALTH_FACTOR_CRIT must be a number").default("10000"),
  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Frontend URL for CORS
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL").optional(),
  // Comma-separated list of allowed CORS origins.
  // Wildcard "*" is rejected in production.
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const isProduction = process.env.NODE_ENV === "production";
        const origins = val.split(",").map((o) => o.trim()).filter(Boolean);
        if (isProduction && origins.includes("*")) return false;
        return origins.every((o) => o === "*" || /^https?:\/\/.+/.test(o));
      },
      {
        message:
          'ALLOWED_ORIGINS must be comma-separated HTTP(S) URLs; wildcard "*" is not allowed in production',
      },
    ),
  /**
   * Graceful shutdown drain timeout in milliseconds.
   * The server waits up to this duration for in-flight requests to complete
   * before forcing exit. Must be at least 1000 ms.
   * @default 10000
   */
  SHUTDOWN_TIMEOUT_MS: z
    .string()
    .regex(/^\d+$/, "SHUTDOWN_TIMEOUT_MS must be a number")
    .default("10000")
    .refine((v) => parseInt(v, 10) >= 1000, {
      message: "SHUTDOWN_TIMEOUT_MS must be at least 1000 ms",
    }),
  // Audit log directory path
  AUDIT_LOG_DIR: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.filter((i) => i.code === "invalid_type" && (i as { received?: string }).received === "undefined");
  const invalid = parsed.error.issues.filter((i) => !(i.code === "invalid_type" && (i as { received?: string }).received === "undefined"));

  const lines: string[] = ["\n❌ Environment validation failed\n"];
  if (missing.length > 0) {
    lines.push("Missing required variables:");
    missing.forEach((i) => lines.push(`  - ${i.path.join(".")}: ${i.message}`));
  }
  if (invalid.length > 0) {
    lines.push("\nInvalid variable values:");
    invalid.forEach((i) => lines.push(`  - ${i.path.join(".")}: ${i.message}`));
  }
  lines.push("\nPlease check your .env file or environment configuration.");
  lines.push("See env.example for reference.\n");
  process.stderr.write(lines.join("\n") + "\n");
  process.exit(1);
}

export const config = parsed.data;
