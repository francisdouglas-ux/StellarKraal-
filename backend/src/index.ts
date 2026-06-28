import "./config"; // validate env at startup
import { config } from "./config";
import express, { Request, Response, NextFunction } from "express";
import { runMigrations as runDbMigrations, checkDbHealth, getMigrationStatus } from "./db/migrationRunner";
import { errorHandler } from "./middleware/errorHandler";
import {
  insertCollateral,
  getCollateral,
  getCollateralIncludingDeleted,
  listCollateral,
  updateCollateral,
  softDeleteCollateral,
  restoreCollateral,
  listDeletedCollateral,
  isCollateralPledged,
  getLoanSummaryForBorrower,
  insertLoan,
  getLoan,
  listLoans,
  updateLoan,
  softDeleteLoan,
  restoreLoan,
  listDeletedLoans,
  insertTransaction,
  listTransactions,
  getTransaction,
  updateCollateral,
  insertAuditEntry,
  listAuditEntries,
  type TransactionType,
  type CollateralStatus,
  type TransactionStatus,
} from "./db/store";
import { corsMiddleware } from "./middleware/cors";
import { correlationMiddleware } from "./middleware/correlation";
import { loggingMiddleware } from "./middleware/logging";
import { getIdempotencyEntry, setIdempotencyEntry } from "./middleware/idempotency";
import {
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import logger, { createRequestLogger } from "./utils/logger";
import { pool, PoolExhaustedError } from "./utils/connectionPool";
import { auditMiddleware, redact, auditLogger } from "./middleware/audit";
import { authRouter, jwtMiddleware } from "./middleware/auth";
import { timeoutMiddleware } from "./middleware/timeout";
import {
  getAppraisal,
  setAppraisal,
  invalidateAll,
  configureCacheTTL,
} from "./utils/appraisalCache";
import {
  responseCacheMiddleware,
  invalidateCache,
  createResponseCacheMiddleware,
} from "./utils/responseCache";
import { randomUUID } from "crypto";
import path from "path";
import { mkdirSync } from "fs";
import multer from "multer";
import { z } from "zod";
import { globalLimiter, authLimiter, readLimiter, writeLimiter } from "./middleware/rateLimit";
import { asyncHandler } from "./utils/asyncHandler";
import { validate } from "./middleware/validate";
import { stellarPublicKeySchema } from "./validators/stellar";
import {
  createCollateralSchema,
  updateCollateralSchema,
  type CreateCollateralInput,
  type UpdateCollateralInput,
} from "./validators/collateral";
import rpcClient from "./utils/rpcClient";
import { registerWebhook, getWebhooks, getDeliveryLogs, fireWebhooks } from "./webhooks";
import { scheduleHealthFactorJob } from "./jobs/healthFactorJob";
import { httpActiveConnections, httpRequestDurationSeconds, httpRequestsTotal } from "./metrics";
import { fireAlert } from "./utils/alerting";
import { rules } from "./utils/alertRules";
import { healthRouter } from "./routes/health";

// ── 5xx spike tracking (rolling 60s window) ───────────────────────────────────
const fivexxTimestamps: number[] = [];
const FIVEXX_WINDOW_MS = 60_000;
const FIVEXX_THRESHOLD = 10;

function track5xx() {
  const now = Date.now();
  fivexxTimestamps.push(now);
  // evict old entries
  while (fivexxTimestamps.length && fivexxTimestamps[0] < now - FIVEXX_WINDOW_MS) {
    fivexxTimestamps.shift();
  }
  if (fivexxTimestamps.length >= FIVEXX_THRESHOLD) {
    fireAlert(rules.fivexxSpike, `${fivexxTimestamps.length} 5xx errors in the last 60s`, {
      count: fivexxTimestamps.length,
      window: "60s",
    });
  }
}

const CONTRACT_ID = process.env.CONTRACT_ID || "";
const NETWORK_PASSPHRASE =
  config.NEXT_PUBLIC_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
const APP_VERSION = process.env.npm_package_version || "1.0.0";
const startTime = Date.now();

const app = express();

// Startup warning for CORS misconfiguration
app.use(corsMiddleware);
app.use(express.json());

// ── Health check — excluded from rate limiting and JWT ────────────────────────
// GET /api/health
app.get("/api/health", async (_req: Request, res: Response) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const dbHealthy = await checkDbHealth();
  let rpcReachable = false;
  try {
    await pool.run((server) => server.getHealth());
    rpcReachable = true;
  } catch (error) {
    logger.warn("RPC health check failed", { error: (error as Error).message });
  }
  const status = dbHealthy && rpcReachable ? "healthy" : "degraded";
  res.status(dbHealthy && rpcReachable ? 200 : 503).json({
    status,
    version: APP_VERSION,
    uptime,
    db: dbHealthy ? "ok" : "unreachable",
    rpcReachable,
    pool: pool.stats(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/health/deep
 * Deep infrastructure health check — verifies DB connectivity, RPC reachability, and disk space.
 * Excluded from JWT auth and rate-limit middleware intentionally.
 * @returns 200 { db, rpc, disk } if all components healthy; 503 if any are degraded.
 */
app.use("/api/v1/health", healthRouter);

app.use(correlationMiddleware);
// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  (req as any).logger = createRequestLogger(req.requestId!);
  next();
});
app.use(globalLimiter);
app.use(timeoutMiddleware(parseInt(config.TIMEOUT_GLOBAL_MS, 10)));
app.use(loggingMiddleware);
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));


// Shutdown middleware - reject new requests during graceful shutdown
let isShuttingDown = false;
app.use((req: Request, res: Response, next: NextFunction) => {
  if (isShuttingDown) {
    res.setHeader("Connection", "close");
    return res.status(503).json({
      error: "Server is shutting down",
      message: "Please retry your request",
    });
  }
  next();
});

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const reqLogger = (req as any).logger;
  reqLogger.info(`${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
  });
  next();
});

// Audit logging middleware — logs all requests with redacted body to audit log
app.use(auditMiddleware);

// ── Prometheus instrumentation middleware ─────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  httpActiveConnections.inc();
  const end = httpRequestDurationSeconds.startTimer();
  res.on("finish", () => {
    const route = (req.route?.path as string) ?? req.path;
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    end(labels);
    httpActiveConnections.dec();
  });
  next();
});

// ── Auth ──────────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRouter);
app.use(jwtMiddleware);

// Configure appraisal cache TTL from env
configureCacheTTL(parseInt(config.APPRAISAL_CACHE_TTL_MS, 10));

// Run DB migrations on startup (automatic in development, manual in production)
(async () => {
  try {
    await runDbMigrations();
  } catch (error) {
    logger.error("Failed to run migrations on startup", {
      error: error instanceof Error ? error.message : String(error),
    });
    // In production, fail fast if migrations haven't been run
    if (process.env.NODE_ENV === "production") {
      logger.error("Production startup aborted due to migration failure");
      process.exit(1);
    }
  }
})();

// ── Validation Schemas ────────────────────────────────────────────────────────

const registerCollateralSchema = z.object({
  owner: stellarPublicKeySchema,
  animal_type: z.string().min(1),
  count: z.number().int().positive(),
  appraised_value: z.number().int().positive(),
});

const loanRequestSchema = z.object({
  borrower: stellarPublicKeySchema,
  collateral_id: z.number().int().nonnegative(),
  amount: z.number().int().positive(),
  min_disbursement: z.number().int().positive().optional(),
});

const loanRepaySchema = z.object({
  borrower: stellarPublicKeySchema,
  loan_id: z.number().int().nonnegative(),
  amount: z.number().int().positive(),
});

const loanRepaymentPreviewSchema = z.object({
  loan_id: z.number().int().nonnegative(),
  amount: z.number().int().positive(),
});

const createLoanSchema = z.object({
  borrowerAddress: stellarPublicKeySchema,
  collateralId: z.string().min(1),
  requestedAmount: z.number().int().positive(),
});

type LoanPreviewShape = {
  principal: number;
  outstanding: number;
  collateral_value: number;
};

type FeeConfigShape = {
  interest_fee_bps: number;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeNativeScVal(value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([k, v]) => [
        String(k),
        normalizeNativeScVal(v),
      ]),
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeNativeScVal(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        normalizeNativeScVal(v),
      ]),
    );
  }
  return value;
}

function parseLoanFromSimulation(retval: unknown): LoanPreviewShape {
  const fallbackValue = toNumber((retval as { value?: unknown })?.value);
  if (fallbackValue !== null) {
    return {
      principal: fallbackValue,
      outstanding: fallbackValue,
      collateral_value: fallbackValue,
    };
  }

  const native = normalizeNativeScVal(scValToNative(retval as xdr.ScVal));
  if (!native || typeof native !== "object") {
    throw new Error("Unable to decode loan record");
  }

  const n = native as Record<string, unknown>;
  const principal = toNumber(n.principal);
  const outstanding = toNumber(n.outstanding);
  const collateralValue = toNumber(n.collateral_value);

  if (principal === null || outstanding === null || collateralValue === null) {
    throw new Error("Loan record is missing numeric fields");
  }

  return {
    principal,
    outstanding,
    collateral_value: collateralValue,
  };
}

function parseFeeConfigFromSimulation(retval: unknown): FeeConfigShape | null {
  const native = normalizeNativeScVal(scValToNative(retval as xdr.ScVal));
  if (!native || typeof native !== "object") {
    return null;
  }

  const n = native as Record<string, unknown>;
  const interestFeeBps = toNumber(n.interest_fee_bps);
  if (interestFeeBps === null) {
    return null;
  }

  return { interest_fee_bps: interestFeeBps };
}

// ── helpers ──────────────────────────────────────────────────────────────────
async function buildContractTx(
  sourceAddress: string,
  method: string,
  args: xdr.ScVal[],
): Promise<string> {
  const account = await rpcClient.getAccount(sourceAddress);
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const prepared = await rpcClient.prepareTransaction(tx);
  return prepared.toXDR();
}

// ── routes ────────────────────────────────────────────────────────────────────



// POST /api/collateral/register
app.post(
  "/api/collateral/register",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  asyncHandler(async (req: Request, res: Response) => {
    const validation = registerCollateralSchema.safeParse(req.body);

    if (!validation.success) {
      logger.warn("Validation failed for collateral registration", {
        requestId: req.requestId,
        errors: validation.error.issues,
      });
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
    }

    const { owner, animal_type, count, appraised_value } = validation.data;
    logger.debug("Building collateral registration transaction", {
      requestId: req.requestId,
      owner,
      animal_type,
      count,
      appraised_value,
    });
    const xdrTx = await buildContractTx(owner, "register_livestock", [
      new Address(owner).toScVal(),
      nativeToScVal(animal_type, { type: "symbol" }),
      nativeToScVal(count, { type: "u32" }),
      nativeToScVal(BigInt(appraised_value), { type: "i128" }),
    ]);
    logger.info("Collateral registration transaction built successfully", {
      requestId: req.requestId,
      owner,
    });
    res.json({ xdr: xdrTx });
  }),
);

// POST /api/loan/request
app.post(
  "/api/loan/request",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  asyncHandler(async (req: Request, res: Response) => {
    const validation = loanRequestSchema.safeParse(req.body);

    if (!validation.success) {
      logger.warn("Validation failed for loan request", {
        requestId: req.requestId,
        errors: validation.error.issues,
      });
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
    }

    const { borrower, collateral_id, amount, min_disbursement } = validation.data;
    const cacheKey = String(collateral_id);
    const cached = getAppraisal(cacheKey);

    if (!cached) {
      // No cached value — fetch appraised_value from request body and cache it
      const appraised_value: number | undefined = req.body.appraised_value;
      if (appraised_value !== undefined) {
        setAppraisal(cacheKey, appraised_value);
      }
    }

    const minDisbursementScVal = min_disbursement !== undefined
      ? nativeToScVal(BigInt(min_disbursement), { type: "i128" })
      : xdr.ScVal.scvVoid();
    const xdrTx = await buildContractTx(borrower, "request_loan", [
      new Address(borrower).toScVal(),
      nativeToScVal(BigInt(collateral_id), { type: "u64" }),
      nativeToScVal(BigInt(amount), { type: "i128" }),
      minDisbursementScVal,
    ]);
    fireWebhooks("loan.approved", { borrower, collateral_id, amount });
    invalidateCache("/api/loans");
    res.json({ xdr: xdrTx, ...(cached?.stale ? { stale: true } : {}) });
  }),
);

// POST /api/loan/repay
app.post(
  "/api/loan/repay",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  asyncHandler(async (req: Request, res: Response) => {
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (!idempotencyKey) {
      return res.status(400).json({
        error: "Idempotency-Key header is required for repay requests",
      });
    }

    const cached = getIdempotencyEntry(idempotencyKey);
    if (cached) {
      res.setHeader("X-Idempotent-Replayed", "true");
      return res.status(cached.status).json(cached.body);
    }

    const validation = loanRepaySchema.safeParse(req.body);
    if (!validation.success) {
      const body = {
        error: "Validation failed",
        details: validation.error.issues,
      };
      setIdempotencyEntry(idempotencyKey, 400, body);
      return res.status(400).json(body);
    }

    const { borrower, loan_id, amount } = validation.data;
    const xdrTx = await buildContractTx(borrower, "repay_loan", [
      new Address(borrower).toScVal(),
      nativeToScVal(BigInt(loan_id), { type: "u64" }),
      nativeToScVal(BigInt(amount), { type: "i128" }),
    ]);
    const body = { xdr: xdrTx };
    setIdempotencyEntry(idempotencyKey, 200, body);
    res.json(body);
  }),
);

// POST /api/loan/repayment-preview
app.post(
  "/api/loan/repayment-preview",
  asyncHandler(async (req: Request, res: Response) => {
    const validation = loanRepaymentPreviewSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
    }

    const { loan_id, amount } = validation.data;
    const contract = new Contract(CONTRACT_ID);
    const account = await rpcClient.getAccount(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    );

    const loanTx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "get_loan",
          nativeToScVal(BigInt(loan_id), { type: "u64" }),
        ),
      )
      .setTimeout(30)
      .build();

    const loanResult = await rpcClient.simulateTransaction(loanTx);
    const parsed = parseLoanFromSimulation((loanResult as any).result?.retval);

    // Fetch dynamic fee config; fallback keeps preview resilient if read fails.
    let interestFeeBps = 1000;
    try {
      const feeTx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call("get_fee_config"))
        .setTimeout(30)
        .build();
      const feeResult = await rpcClient.simulateTransaction(feeTx);
      const feeConfig = parseFeeConfigFromSimulation(
        (feeResult as any).result?.retval,
      );
      if (feeConfig) {
        interestFeeBps = feeConfig.interest_fee_bps;
      }
    } catch {
      // Preview remains available with sane default when fee config lookup fails.
    }

    const cappedRepayment = Math.min(amount, parsed.outstanding);
    const interestOutstanding = Math.max(
      parsed.outstanding - parsed.principal,
      0,
    );
    const interestPaid = Math.min(cappedRepayment, interestOutstanding);
    const principalPaid = cappedRepayment - interestPaid;
    const fees = Math.floor((interestPaid * interestFeeBps) / 10_000);
    const remainingBalance = Math.max(parsed.outstanding - cappedRepayment, 0);

    const projectedHealthFactorBps =
      remainingBalance === 0
        ? null
        : Math.floor(
            (parsed.collateral_value * 8000 * 10_000) /
              (remainingBalance * 10_000),
          );

    res.json({
      loan_id,
      repayment_amount: cappedRepayment,
      breakdown: {
        principal: principalPaid,
        interest: interestPaid,
        fees,
        remaining_balance: remainingBalance,
      },
      projected_health_factor_bps: projectedHealthFactorBps,
      fully_repaid: remainingBalance === 0,
    });
  }),
);

// POST /api/loan/create
app.post(
  "/api/loan/create",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  asyncHandler(async (req: Request, res: Response) => {
    const validation = createLoanSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.issues });
    }

    const { borrowerAddress, collateralId, requestedAmount } = validation.data;

    const collateral = getCollateral(collateralId);
    if (!collateral) {
      return res.status(404).json({ error: "Collateral not found" });
    }

    if (isCollateralPledged(collateralId)) {
      return res.status(409).json({ error: "Collateral is already pledged to another loan" });
    }

    const maxLoanAmount = Math.floor(collateral.appraised_value * 0.8);
    const loanAmount = Math.min(requestedAmount, maxLoanAmount);

    const xdrTx = await buildContractTx(borrowerAddress, "request_loan", [
      new Address(borrowerAddress).toScVal(),
      nativeToScVal(collateralId, { type: "string" }),
      nativeToScVal(BigInt(loanAmount), { type: "i128" }),
    ]);

    const loan = insertLoan({
      id: randomUUID(),
      borrower: borrowerAddress,
      collateral_id: collateralId,
      amount: loanAmount,
    });

    return res.status(201).json({ loan, xdr: xdrTx });
  }),
);

// GET /api/loans — paginated loan listing
// Deprecated: unpaginated usage will be removed in a future version.
app.get(
  "/api/loans",
  readLimiter,
  responseCacheMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const pageRaw = req.query.page !== undefined ? Number(req.query.page) : 1;
    const pageSizeVal = req.query.pageSize !== undefined ? req.query.pageSize : req.query.limit;
    const limitRaw = pageSizeVal !== undefined ? Number(pageSizeVal) : 20;

    if (!Number.isInteger(pageRaw) || pageRaw < 1) {
      return res.status(400).json({ error: "page must be a positive integer" });
    }
    if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 100) {
      return res.status(400).json({ error: "pageSize must be between 1 and 100" });
    }

    if (req.query.page === undefined) {
      res.setHeader("Deprecation", "true");
      res.setHeader(
        "Warning",
        '299 - "Unpaginated usage is deprecated; use ?page=1&pageSize=20"',
      );
    }

    const result = listLoans({ page: pageRaw, limit: limitRaw });
    res.json({
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      pageSize: result.limit,
    });
  }),
);

// GET /api/borrowers/:wallet — aggregate borrower profile (settings + collateral + loans)
app.get(
  "/api/borrowers/:wallet",
  readLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const wallet = req.params.wallet as string;

    const collateralResult = listCollateral({ ownerId: wallet, page: 1, limit: 100 });
    const loansResult = listLoans({ borrowerAddress: wallet, page: 1, limit: 100 });

    res.json({
      wallet,
      collateral: collateralResult.data,
      loans: loansResult.data,
    });
  }),
);

// GET /api/collateral — paginated, filterable collateral listing
const collateralQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(["available", "pledged", "liquidated"]).optional(),
  ownerId: z.string().optional(),
});

app.get(
  "/api/collateral",
  responseCacheMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = collateralQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        errors: validation.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    }
    const { page, limit, status, ownerId } = validation.data;
    const result = listCollateral({
      page,
      limit,
      status: status as CollateralStatus | undefined,
      ownerId,
    });
    res.json(result);
  }),
);

// GET /api/loans/:id — full loan detail with collateral and on-chain status
app.get(
  "/api/loans/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const loan = getLoan(req.params.id as string);
    if (!loan) {
      return res.status(404).json({ error: `Loan ${req.params.id} not found` });
    }

    const collateral = getCollateral(loan.collateral_id);

    // Fetch on-chain status from Soroban contract
    let onChainStatus: unknown = null;
    try {
      const contract = new Contract(CONTRACT_ID);
      const account = await rpcClient.getAccount(
        "GASPH4OCYOERATXIKLPNURXUP7ISAQU2KWFB5XLUJ3LQHKHOCN3CEGD6",
      );
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call("get_loan", nativeToScVal(BigInt(loan.id), { type: "u64" })),
        )
        .setTimeout(30)
        .build();
      const result = await rpcClient.simulateTransaction(tx);
      onChainStatus = (result as any).result?.retval ?? null;
    } catch {
      // on-chain fetch is best-effort; don't fail the request
    }

    res.json({ loan, collateral: collateral ?? null, onChainStatus });
  }),
);

// GET /api/loan/:id (legacy — kept for backwards compat)
app.get(
  "/api/loan/:id",
  readLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contract = new Contract(CONTRACT_ID);
      const account = await rpcClient.getAccount(
        "GAKH4BC5GSE5UQDWWPCBCNVYRDBI5JGYRQRGZJT3YJ477ZFDK5EUBMBH", // fee-less read account
      );
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            "get_loan",
            nativeToScVal(BigInt(req.params.id as string), { type: "u64" }),
          ),
        )
        .setTimeout(30)
        .build();

      const result = await rpcClient.simulateTransaction(tx);
      res.json({ result: (result as any).result?.retval });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/health/:loanId
app.get(
  "/api/health/:loanId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contract = new Contract(CONTRACT_ID);
      const account = await rpcClient.getAccount(
        "GAKH4BC5GSE5UQDWWPCBCNVYRDBI5JGYRQRGZJT3YJ477ZFDK5EUBMBH",
      );
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            "health_factor",
            nativeToScVal(BigInt(req.params.loanId as string), { type: "u64" }),
          ),
        )
        .setTimeout(30)
        .build();

      const result = await rpcClient.simulateTransaction(tx);
      res.json({ health_factor: (result as any).result?.retval });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/loan/repayment-preview
app.post(
  "/api/loan/repayment-preview",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  asyncHandler(async (req: Request, res: Response) => {
    const validation = loanRepaymentPreviewSchema.safeParse(req.body);

    if (!validation.success) {
      logger.warn("Validation failed for loan repayment preview", {
        requestId: req.requestId,
        errors: validation.error.issues,
      });
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
    }

    const { loan_id, amount } = validation.data;

    // Fetch loan details from contract (simulated)
    const contract = new Contract(CONTRACT_ID);
    const account = await rpcClient.getAccount(
      "GASPH4OCYOERATXIKLPNURXUP7ISAQU2KWFB5XLUJ3LQHKHOCN3CEGD6", // fee-less read account
    );
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "get_loan",
          nativeToScVal(BigInt(loan_id), { type: "u64" }),
        ),
      )
      .setTimeout(30)
      .build();

    const result = await rpcClient.simulateTransaction(tx);
    const parsed = parseLoanFromSimulation((result as any).result?.retval);

    // Fetch interest fee config
    let interestFeeBps = 100; // default 1%
    try {
      const feeTx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call("fee_config"))
        .setTimeout(30)
        .build();
      const feeResult = await rpcClient.simulateTransaction(feeTx);
      const feeConfig = parseFeeConfigFromSimulation(
        (feeResult as any).result?.retval,
      );
      if (feeConfig) {
        interestFeeBps = feeConfig.interest_fee_bps;
      }
    } catch {
      // Preview remains available with sane default when fee config lookup fails.
    }

    const cappedRepayment = Math.min(amount, parsed.outstanding);
    const interestOutstanding = Math.max(
      parsed.outstanding - parsed.principal,
      0,
    );
    const interestPaid = Math.min(cappedRepayment, interestOutstanding);
    const principalPaid = cappedRepayment - interestPaid;
    const fees = Math.floor((interestPaid * interestFeeBps) / 10_000);
    const remainingBalance = Math.max(parsed.outstanding - cappedRepayment, 0);

    const projectedHealthFactorBps =
      remainingBalance === 0
        ? null
        : Math.floor(
            (parsed.collateral_value * 8000 * 10_000) /
              (remainingBalance * 10_000),
          );

    res.json({
      loan_id,
      repayment_amount: cappedRepayment,
      breakdown: {
        principal: principalPaid,
        interest: interestPaid,
        fees,
        remaining_balance: remainingBalance,
      },
      projected_health_factor_bps: projectedHealthFactorBps,
      fully_repaid: remainingBalance === 0,
    });
  }),
);

// POST /api/oracle/price-update — invalidate appraisal cache on oracle update
app.post(
  "/api/oracle/price-update",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  (req: Request, res: Response) => {
    invalidateAll();
    res.json({ invalidated: true });
  },
);

// ── webhook routes ────────────────────────────────────────────────────────────

// POST /api/webhooks — register a webhook URL
app.post(
  "/api/webhooks",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "url is required" });
    }
    try {
      const reg = registerWebhook(url);
      res.status(201).json(reg);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  },
);

// GET /api/admin/webhooks — list registered webhooks
app.get("/api/admin/webhooks", (req: Request, res: Response) => {
  res.json(getWebhooks());
});

// GET /api/admin/webhooks/logs — delivery logs
app.get("/api/admin/webhooks/logs", (req: Request, res: Response) => {
  res.json(getDeliveryLogs());
});

// GET /api/admin/migrations/status — migration status
app.get(
  "/api/admin/migrations/status",
  asyncHandler(async (req: Request, res: Response) => {
    const status = await getMigrationStatus();
    res.json({ status });
  }),
);

/**
 * GET /api/v1/admin/audit — paginated audit log for admins.
 *
 * Security threat model:
 *   - Endpoint requires admin role claim in JWT to prevent unprivileged access to audit logs.
 *   - Date range capped at 90 days to prevent resource exhaustion / long-running queries.
 *   - requestBody is stored already-redacted; re-redacted here for defence in depth.
 *
 * Query params:
 *   from     ISO date lower bound (inclusive)
 *   to       ISO date upper bound (inclusive)
 *   userId   filter by user ID
 *   page     page number (default 1)
 *   limit    records per page (default 20, max 100)
 */
app.get(
  "/api/v1/admin/audit",
  asyncHandler(async (req: Request, res: Response) => {
    // Admin-only: require role === "admin" in JWT payload
    const user = (req as any).user as { publicKey?: string; role?: string } | undefined;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: admin role required" });
    }

    const { from, to, userId } = req.query as Record<string, string | undefined>;
    const pageRaw = req.query.page !== undefined ? Number(req.query.page) : 1;
    const limitRaw = req.query.limit !== undefined ? Number(req.query.limit) : 20;

    if (!Number.isInteger(pageRaw) || pageRaw < 1) {
      return res.status(400).json({ error: "page must be a positive integer" });
    }
    if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 100) {
      return res.status(400).json({ error: "limit must be between 1 and 100" });
    }

    // Validate and enforce 90-day max range
    const MS_90_DAYS = 90 * 24 * 60 * 60 * 1000;
    if (from && isNaN(new Date(from).getTime())) {
      return res.status(400).json({ error: "from must be a valid ISO date" });
    }
    if (to && isNaN(new Date(to).getTime())) {
      return res.status(400).json({ error: "to must be a valid ISO date" });
    }
    if (from && to) {
      const rangeMs = new Date(to).getTime() - new Date(from).getTime();
      if (rangeMs > MS_90_DAYS) {
        return res.status(400).json({ error: "Date range must not exceed 90 days" });
      }
    }

    const result = listAuditEntries({ from, to, userId, page: pageRaw, limit: limitRaw });

    // Re-redact requestBody for defence in depth
    const data = result.data.map((e) => ({ ...e, requestBody: redact(e.requestBody as object) }));

    res.json({ data, total: result.total, page: result.page, limit: result.limit });
  }),
);

// ── soft-delete admin routes ──────────────────────────────────────────────────

// GET /api/admin/deleted/collateral — list soft-deleted collateral records
app.get("/api/admin/deleted/collateral", (req: Request, res: Response) => {
  res.json(listDeletedCollateral());
});

// POST /api/admin/restore/collateral/:id — restore a soft-deleted collateral record
app.post("/api/admin/restore/collateral/:id", (req: Request, res: Response) => {
  const ok = restoreCollateral(req.params.id as string);
  if (!ok)
    return res.status(404).json({ error: "Record not found or not deleted" });
  res.json({ restored: true, id: req.params.id });
});

/**
 * Handle deletion of a collateral record.
 * Validates active loan status and owner/admin authorization.
 * @param req - Express request object.
 * @param res - Express response object.
 * @returns A promise or value resolving to void.
 */
const handleDeleteCollateral = (req: Request, res: Response) => {
  const id = req.params.id as string;
  const record = getCollateral(id);
  if (!record) {
    return res.status(404).json({ error: "Record not found" });
  }

  // Check if pledged to an active loan
  if (isCollateralPledged(id)) {
    return res.status(409).json({ error: "Collateral is currently pledged to an active loan" });
  }

  // Check authorization: owner or admin
  const user = (req as Request & { user?: { publicKey: string; role?: string } }).user;
  const isOwner = user && user.publicKey === record.owner;
  const isUserAdmin =
    (user && user.role === "admin") ||
    (config.ADMIN_API_KEY && user && user.publicKey === config.ADMIN_API_KEY) ||
    (config.ADMIN_API_KEY && ((req.headers["x-admin-key"] as string) === config.ADMIN_API_KEY || (req.headers["admin-api-key"] as string) === config.ADMIN_API_KEY));

  if (!isOwner && !isUserAdmin) {
    return res.status(403).json({ error: "Forbidden: Only the owner or an admin can delete this collateral" });
  }

  const ok = softDeleteCollateral(id);
  if (!ok) return res.status(404).json({ error: "Record not found" });
  res.json({ deleted: true, id });
};

// DELETE /api/collateral/:id — soft delete a collateral record
app.delete("/api/collateral/:id", handleDeleteCollateral);

// ── POST /api/collateral — animal registration with image upload ──────────────

const uploadsDir = path.join(__dirname, "..", "uploads");
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// Ensure uploads directory exists
mkdirSync(uploadsDir, { recursive: true });

app.post(
  "/api/collateral",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  writeLimiter,
  upload.single("image"),
  asyncHandler(async (req: Request, res: Response) => {
    const { species, breed, age, weight } = req.body as {
      species?: string;
      breed?: string;
      age?: string;
      weight?: string;
    };

    if (!species || typeof species !== "string" || species.trim() === "") {
      return res.status(400).json({ error: "species is required" });
    }
    if (!breed || typeof breed !== "string" || breed.trim() === "") {
      return res.status(400).json({ error: "breed is required" });
    }
    const ageNum = Number(age);
    if (!age || !Number.isFinite(ageNum) || ageNum < 0) {
      return res.status(400).json({ error: "age must be a non-negative number" });
    }
    const weightNum = Number(weight);
    if (!weight || !Number.isFinite(weightNum) || weightNum <= 0) {
      return res.status(400).json({ error: "weight must be a positive number" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "image file is required" });
    }

    const owner = (req as any).user?.publicKey as string | undefined;
    if (!owner) {
      return res.status(401).json({ error: "Authenticated wallet address required" });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const appraised_value = Math.round(weightNum * 100); // simple appraisal: 100 per kg

    const record = insertCollateral({
      id: randomUUID(),
      owner,
      animal_type: species.trim(),
      count: 1,
      appraised_value,
      species: species.trim(),
      breed: breed.trim(),
      age: ageNum,
      weight: weightNum,
      image_url: imageUrl,
    });

    invalidateCache("/api/collateral");
    res.status(201).json(record);
  }),
);

// ── v1 collateral CRUD ────────────────────────────────────────────────────────

// POST /api/v1/collateral — register collateral (DB record)
app.post(
  "/api/v1/collateral",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  validate(createCollateralSchema, { statusCode: 422, errorShape: "dictionary" }),
  asyncHandler(async (req: Request, res: Response) => {
    const owner = (req as Request & { user?: { publicKey?: string } }).user?.publicKey;
    if (!owner) {
      return res.status(401).json({ error: "Authenticated wallet address required" });
    }

    const { animal_type, count, appraised_value } = req.body as CreateCollateralInput;
    const record = insertCollateral({ id: randomUUID(), owner, animal_type, count, appraised_value });
    invalidateCache("/api/collateral");
    res.status(201).json(record);
  }),
);

// PATCH /api/v1/collateral/:id — partially update collateral fields
app.patch(
  "/api/v1/collateral/:id",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  validate(updateCollateralSchema, { statusCode: 422, errorShape: "dictionary" }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const record = getCollateral(id);
    if (!record) {
      return res.status(404).json({ error: "Record not found" });
    }

    const updates = req.body as UpdateCollateralInput;
    const updated = updateCollateral(id, updates);
    if (!updated) {
      return res.status(404).json({ error: "Record not found" });
    }

    invalidateCache("/api/collateral");
    res.json(updated);
  }),
);

// GET /api/v1/collateral — list collateral with optional filters and pagination
app.get("/api/v1/collateral", asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page !== undefined ? Number(req.query.page) : 1;
  const pageSize = req.query.pageSize !== undefined ? Number(req.query.pageSize) : 20;
  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({ error: "page must be a positive integer" });
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ error: "pageSize must be between 1 and 100" });
  }
  const ownerId = typeof req.query.owner === "string" ? req.query.owner : undefined;
  const result = listCollateral({ page, limit: pageSize, ownerId });
  // Apply animal_type filter post-fetch (not part of the new store API)
  const animalType = typeof req.query.animal_type === "string" ? req.query.animal_type : undefined;
  const data = animalType ? result.data.filter((r) => r.animal_type === animalType) : result.data;
  const total = animalType ? data.length : result.total;
  res.json({ data, total, page: result.page, pageSize: result.limit });
}));

// PUT /api/v1/collateral/:id/appraise — update appraised_value
app.put("/api/v1/collateral/:id/appraise", timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)), asyncHandler(async (req: Request, res: Response) => {
  const { appraised_value } = req.body;
  if (typeof appraised_value !== "number" || !Number.isInteger(appraised_value) || appraised_value <= 0) {
    return res.status(400).json({ error: "appraised_value must be a positive integer" });
  }
  const record = getCollateral(req.params.id as string);
  if (!record) return res.status(404).json({ error: "Record not found" });
  record.appraised_value = appraised_value;
  setAppraisal(req.params.id as string, appraised_value);
  res.json(record);
}));

/**
 * PATCH /api/v1/collateral/:id — partial update of mutable collateral fields.
 * Accepts any subset of: animal_type, count, appraised_value.
 * Returns 400 if appraised_value is zero or negative.
 * Returns 409 if collateral is pledged to an active loan and appraised_value is being reduced.
 * Writes a structured audit log entry on every successful update.
 */
app.patch("/api/v1/collateral/:id", timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)), asyncHandler(async (req: Request, res: Response) => {
  const patchSchema = z.object({
    animal_type: z.string().min(1).optional(),
    count: z.number().int().positive().optional(),
    appraised_value: z.number().int().optional(),
  }).strict();

  const validation = patchSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: "Validation failed", details: validation.error.issues });
  }

  const updates = validation.data;

  if (updates.appraised_value !== undefined && updates.appraised_value <= 0) {
    return res.status(400).json({ error: "appraised_value must be positive" });
  }

  const record = getCollateral(req.params.id);
  if (!record) return res.status(404).json({ error: "Record not found" });

  // 409: pledged to active loan and appraised_value is being reduced
  if (
    updates.appraised_value !== undefined &&
    updates.appraised_value < record.appraised_value &&
    isCollateralPledged(req.params.id)
  ) {
    return res.status(409).json({
      error: "Cannot reduce appraised_value: collateral is pledged to an active loan",
    });
  }

  const updated = updateCollateral(req.params.id, updates);
  if (!updated) return res.status(404).json({ error: "Record not found" });

  // Audit log entry
  const user = (req as any).user;
  insertAuditEntry({
    userId: user?.publicKey ?? "anonymous",
    action: "collateral.patch",
    resource: "collateral",
    resourceId: req.params.id,
    requestBody: redact(updates),
    ip: req.ip,
  });
  auditLogger.info("collateral.patch", {
    requestId: (req as any).requestId,
    collateralId: req.params.id,
    userId: user?.publicKey,
    updates: redact(updates),
  });

  res.json(updated);
}));

// DELETE /api/v1/collateral/:id — soft delete
app.delete("/api/v1/collateral/:id", handleDeleteCollateral);

// PATCH /api/v1/collateral/:id/restore — restore soft-deleted collateral
app.patch(
  "/api/v1/collateral/:id/restore",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const collateral = getCollateralIncludingDeleted(id);

    if (!collateral || collateral.deletedAt === null) {
      return res.status(404).json({ error: "Record not found or not deleted" });
    }

    if (isCollateralPledged(id)) {
      return res.status(409).json({ error: "Collateral is currently pledged to an active loan" });
    }

    const restored = restoreCollateral(id);
    if (!restored) {
      return res.status(404).json({ error: "Record not found or not deleted" });
    }

    invalidateCache("/api/collateral");
    res.json({ restored: true, id });
  }),
);

// GET /api/v1/loans/summary — borrower-scoped portfolio summary
app.get(
  "/api/v1/loans/summary",
  readLimiter,
  createResponseCacheMiddleware(30_000),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as Request & { user?: { publicKey?: string } }).user;
    if (!user?.publicKey) {
      return res.status(401).json({ error: "Authenticated wallet address required" });
    }

    const summary = getLoanSummaryForBorrower(user.publicKey);
    res.json(summary);
  }),
);

// GET /api/admin/deleted/loans — list soft-deleted loan records
app.get("/api/admin/deleted/loans", (req: Request, res: Response) => {
  res.json(listDeletedLoans());
});

// POST /api/admin/restore/loans/:id — restore a soft-deleted loan record
app.post("/api/admin/restore/loans/:id", (req: Request, res: Response) => {
  const ok = restoreLoan(req.params.id as string);
  if (!ok)
    return res.status(404).json({ error: "Record not found or not deleted" });
  res.json({ restored: true, id: req.params.id });
});

// DELETE /api/loan/:id — soft delete a loan record
app.delete("/api/loan/:id", (req: Request, res: Response) => {
  const ok = softDeleteLoan(req.params.id as string);
  if (!ok) return res.status(404).json({ error: "Record not found" });
  res.json({ deleted: true, id: req.params.id });
});

// GET /api/transactions — transaction history with filtering, sorting, and pagination
app.get(
  "/api/transactions",
  asyncHandler(async (req: Request, res: Response) => {
    const borrower = req.query.borrower as string | undefined;
    const type = req.query.type as TransactionType | undefined;
    const status = req.query.status as TransactionStatus | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const pageRaw = req.query.page !== undefined ? Number(req.query.page) : 1;
    const pageSizeRaw = req.query.pageSize !== undefined ? Number(req.query.pageSize) : 20;

    if (!Number.isInteger(pageRaw) || pageRaw < 1) {
      return res.status(400).json({ error: "page must be a positive integer" });
    }
    if (!Number.isInteger(pageSizeRaw) || pageSizeRaw < 1 || pageSizeRaw > 100) {
      return res.status(400).json({ error: "pageSize must be between 1 and 100" });
    }

    // Validate date range if provided
    if (startDate && isNaN(new Date(startDate).getTime())) {
      return res.status(400).json({ error: "startDate must be a valid ISO date" });
    }
    if (endDate && isNaN(new Date(endDate).getTime())) {
      return res.status(400).json({ error: "endDate must be a valid ISO date" });
    }

    const result = listTransactions({
      borrower,
      type,
      status,
      startDate,
      endDate,
      page: pageRaw,
      pageSize: pageSizeRaw,
    });

    res.json(result);
  }),
);

// GET /api/transactions/:id — get transaction details
app.get(
  "/api/transactions/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const transaction = getTransaction(req.params.id as string);
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    res.json(transaction);
  }),
);

// PUT /api/loans/:id/repay — record a repayment against a loan
app.put(
  "/api/loans/:id/repay",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  writeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { amount, transactionHash } = req.body as { amount?: unknown; transactionHash?: unknown };

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }
    if (typeof transactionHash !== "string" || !transactionHash) {
      return res.status(400).json({ error: "transactionHash is required" });
    }

    const loan = getLoan(req.params.id as string);
    if (!loan) return res.status(404).json({ error: "Loan not found" });

    if (amount > loan.amount) {
      return res.status(400).json({ error: "amount exceeds outstanding balance" });
    }

    const newBalance = loan.amount - amount;
    const updated = updateLoan(req.params.id as string, { amount: newBalance });
    invalidateCache("/api/loans");

    insertTransaction({
      borrower: loan.borrower,
      type: "repayment",
      status: "completed",
      amount,
      loanId: loan.id,
    });

    res.json(updated);
  }),
);

// ── error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof PoolExhaustedError) {
    return res
      .status(503)
      .json({ error: "Service unavailable: connection pool exhausted" });
  }
  track5xx();
  errorHandler(err, req, res, next);
});

if (process.env.NODE_ENV !== "test") {
  const PORT = parseInt(process.env.PORT || "3001", 10);
  app.listen(PORT, () => {
    logger.info(`StellarKraal API running on port ${PORT}`, {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
      logLevel: process.env.LOG_LEVEL || "info",
    });
  });
}

const healthFactorTask = scheduleHealthFactorJob();

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

const SHUTDOWN_TIMEOUT_MS = parseInt(config.SHUTDOWN_TIMEOUT_MS, 10);

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress, ignoring signal", { signal });
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`, { signal });

  // Stop accepting new connections
  httpServer.close(() => {
    logger.info("HTTP server closed, no longer accepting connections");
  });

  // Set a timeout to force shutdown if graceful shutdown takes too long
  const forceShutdownTimer = setTimeout(() => {
    logger.error("Graceful shutdown timeout exceeded, forcing exit", {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // Wait for in-flight requests to complete
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const stats = pool.stats();
        if (stats.inUse === 0) {
          clearInterval(checkInterval);
          resolve();
        } else {
          logger.info("Waiting for in-flight requests to complete", {
            inUse: stats.inUse,
          });
        }
      }, 1000);
    });

    logger.info("All in-flight requests completed");

    // Close database connections
    pool.close();
    logger.info("Database connection pool closed");

    healthFactorTask.stop();
    logger.info("Health factor job stopped");

    clearTimeout(forceShutdownTimer);
    logger.info("Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error("Error during graceful shutdown", {
      error: (error as Error).message,
    });
    clearTimeout(forceShutdownTimer);
    process.exit(1);
  }
}

// Register signal handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught exception", {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
  gracefulShutdown("unhandledRejection");
});

// Redirect unversioned routes to v1 with deprecation warning
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  // Skip if already versioned or is auth/health
  if (req.path.startsWith("/api/v1") || req.path === "/api/health" || req.path.startsWith("/api/auth")) {
    return next();
  }

  const newPath = req.path.replace(/^\/api/, "/api/v1");
  res.setHeader("Deprecation", "true");
  res.setHeader("Warning", '299 - "Unversioned API routes are deprecated. Use /api/v1/ prefix."');
  res.redirect(301, newPath + (req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""));
});

export default app;

// Create HTTP server for graceful shutdown reference
const httpServer = app.listen(parseInt(config.PORT, 10), () => {
  logger.info(`Server started on port ${config.PORT}`);
});

