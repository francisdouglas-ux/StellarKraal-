import "./config"; // validate env at startup
import { config } from "./config";
import express, { Request, Response, NextFunction } from "express";
import {
  runMigrations,
  insertCollateral,
  listCollateral,
  getCollateral,
  softDeleteCollateral,
  restoreCollateral,
  listDeletedCollateral,
  insertLoan,
  listLoans,
  getLoan,
  softDeleteLoan,
  restoreLoan,
  listDeletedLoans,
} from "./db/store";
import cors from "cors";
import {
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  nativeToScVal,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import { SorobanRpc } from "@stellar/stellar-sdk";
import logger, { createRequestLogger } from "./utils/logger";
import { pool, PoolExhaustedError } from "./utils/connectionPool";
import { auditMiddleware } from "./middleware/audit";
import { authRouter, jwtMiddleware } from "./middleware/auth";
import { timeoutMiddleware } from "./middleware/timeout";
import { getAppraisal, setAppraisal, invalidateAll, configureCacheTTL } from "./utils/appraisalCache";
import { randomUUID } from "crypto";
import { z } from "zod";
import { globalLimiter } from "./middleware/rateLimit";
import { asyncHandler } from "./utils/asyncHandler";
import { stellarPublicKeySchema } from "./validators/stellar";
import rpcClient from "./utils/rpcClient";
import { registerWebhook, getWebhooks, getDeliveryLogs } from "./webhooks";
const { Server } = SorobanRpc;

// ── Idempotency cache (in-memory, 24h TTL) ───────────────────────────────────
interface IdempotencyEntry { status: number; body: unknown; createdAt: number }
const idempotencyCache = new Map<string, IdempotencyEntry>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
function getIdempotencyEntry(key: string): IdempotencyEntry | undefined {
  const entry = idempotencyCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > IDEMPOTENCY_TTL_MS) {
    idempotencyCache.delete(key);
    return undefined;
  }
  return entry;
}
function setIdempotencyEntry(key: string, status: number, body: unknown): void {
  idempotencyCache.set(key, { status, body, createdAt: Date.now() });
}

const app = express();

const isProduction = process.env.NODE_ENV === "production";
const FRONTEND_URL = process.env.FRONTEND_URL;

// Startup warning for CORS misconfiguration
if (isProduction && !FRONTEND_URL) {
  logger.warn("CORS misconfiguration: FRONTEND_URL is not set in production environment. Requests may be blocked.");
}

// Secure CORS configuration
app.use((req: Request, res: Response, next: NextFunction) => {
  // Allow credentials only for authenticated routes (e.g., API endpoints excluding health check)
  const isAuthRoute = req.path.startsWith("/api") && req.path !== "/api/health";
  
  const corsOptions: cors.CorsOptions = {
    origin: isProduction 
      ? (FRONTEND_URL || false) 
      : (isAuthRoute ? true : "*"),
    credentials: isAuthRoute,
    maxAge: 86400, // Cache preflight requests for 24 hours
  };
  
  cors(corsOptions)(req, res, next);
});
app.use(express.json());
app.use(globalLimiter);
app.use(timeoutMiddleware(parseInt(config.TIMEOUT_GLOBAL_MS, 10)));

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = randomUUID();
  (req as any).requestId = requestId;
  (req as any).logger = createRequestLogger(requestId);
  res.setHeader("X-Request-ID", requestId);
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

// ── Auth ──────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use(jwtMiddleware);

const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.CONTRACT_ID || "";
const NETWORK_PASSPHRASE =
  config.NEXT_PUBLIC_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

const APP_VERSION = process.env.npm_package_version || "1.0.0";
const startTime = Date.now();

const server = new Server(RPC_URL);

// Configure appraisal cache TTL from env
configureCacheTTL(parseInt(config.APPRAISAL_CACHE_TTL_MS, 10));

// Run DB migrations on startup
runMigrations();

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
});

const loanRepaySchema = z.object({
  borrower: stellarPublicKeySchema,
  loan_id: z.number().int().nonnegative(),
  amount: z.number().int().positive(),
});

// ── helpers ──────────────────────────────────────────────────────────────────
async function buildContractTx(
  sourceAddress: string,
  method: string,
  args: xdr.ScVal[]
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

// GET /api/health - Health check endpoint
app.get("/api/health", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    let rpcReachable = false;
    try {
      await pool.run((server) => server.getHealth());
      rpcReachable = true;
    } catch (error) {
      console.warn("RPC health check failed:", (error as Error).message);
    }

    const healthData = {
      status: rpcReachable ? "healthy" : "degraded",
      version: APP_VERSION,
      uptime,
      rpcReachable,
      pool: pool.stats(),
    };

    res.status(rpcReachable ? 200 : 503).json(healthData);
  } catch (error) {
    next(error);
  }
});

// POST /api/collateral/register
app.post("/api/collateral/register", timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)), asyncHandler(async (req: Request, res: Response) => {
  const validation = registerCollateralSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors,
      });
    }

    const { owner, animal_type, count, appraised_value } = validation.data;
    const xdrTx = await buildContractTx(owner, "register_livestock", [
      new Address(owner).toScVal(),
      nativeToScVal(animal_type, { type: "symbol" }),
      nativeToScVal(count, { type: "u32" }),
      nativeToScVal(BigInt(appraised_value), { type: "i128" }),
    ]);
    res.json({ xdr: xdrTx });
}));

// POST /api/loan/request
app.post("/api/loan/request", timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)), asyncHandler(async (req: Request, res: Response) => {
  const validation = loanRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors,
      });
    }

    const { borrower, collateral_id, amount } = validation.data;
    const cacheKey = String(collateral_id);
    const cached = getAppraisal(cacheKey);

    if (!cached) {
      // No cached value — fetch appraised_value from request body and cache it
      const appraised_value: number | undefined = req.body.appraised_value;
      if (appraised_value !== undefined) {
        setAppraisal(cacheKey, appraised_value);
      }
    }

    const xdrTx = await buildContractTx(borrower, "request_loan", [
      new Address(borrower).toScVal(),
      nativeToScVal(BigInt(collateral_id), { type: "u64" }),
      nativeToScVal(BigInt(amount), { type: "i128" }),
    ]);
    res.json({ xdr: xdrTx, ...(cached?.stale ? { stale: true } : {}) });
}));

// POST /api/loan/repay
app.post("/api/loan/repay", timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)), asyncHandler(async (req: Request, res: Response) => {
  const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
  if (!idempotencyKey) {
    return res.status(400).json({ error: "Idempotency-Key header is required for repay requests" });
  }

  const cached = getIdempotencyEntry(idempotencyKey);
  if (cached) {
    res.setHeader("X-Idempotent-Replayed", "true");
    return res.status(cached.status).json(cached.body);
  }

  const validation = loanRepaySchema.safeParse(req.body);
  if (!validation.success) {
    const body = { error: "Validation failed", details: validation.error.errors };
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
}));

// GET /api/loans — paginated loan listing
// Deprecated: unpaginated usage will be removed in a future version.
app.get("/api/loans", asyncHandler(async (req: Request, res: Response) => {
  const pageRaw = req.query.page !== undefined ? Number(req.query.page) : 1;
  const pageSizeRaw = req.query.pageSize !== undefined ? Number(req.query.pageSize) : 20;

  if (!Number.isInteger(pageRaw) || pageRaw < 1) {
    return res.status(400).json({ error: "page must be a positive integer" });
  }
  if (!Number.isInteger(pageSizeRaw) || pageSizeRaw < 1 || pageSizeRaw > 100) {
    return res.status(400).json({ error: "pageSize must be between 1 and 100" });
  }

  if (req.query.page === undefined) {
    res.setHeader("Deprecation", "true");
    res.setHeader("Warning", '299 - "Unpaginated usage is deprecated; use ?page=1&pageSize=20"');
  }

  // Placeholder: in production this would query a DB. Returns empty list with envelope.
  const total = 0;
  const data: unknown[] = [];
  res.json({ data, total, page: pageRaw, pageSize: pageSizeRaw });
}));

// GET /api/loan/:id
app.get("/api/loan/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contract = new Contract(CONTRACT_ID);
    const account = await rpcClient.getAccount(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN" // fee-less read account
    );
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call("get_loan", nativeToScVal(BigInt(req.params.id), { type: "u64" }))
      )
      .setTimeout(30)
      .build();

    const result = await rpcClient.simulateTransaction(tx);
    res.json({ result: (result as any).result?.retval });
  } catch (error) {
    next(error);
  }
});

// GET /api/health/:loanId
app.get("/api/health/:loanId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contract = new Contract(CONTRACT_ID);
    const account = await rpcClient.getAccount(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
    );
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "health_factor",
          nativeToScVal(BigInt(req.params.loanId), { type: "u64" })
        )
      )
      .setTimeout(30)
      .build();

    const result = await rpcClient.simulateTransaction(tx);
    res.json({ health_factor: (result as any).result?.retval });
  } catch (error) {
    next(error);
  }
});

// POST /api/oracle/price-update — invalidate appraisal cache on oracle update
app.post("/api/oracle/price-update", timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)), (req: Request, res: Response) => {
  invalidateAll();
  res.json({ invalidated: true });
});

// ── webhook routes ────────────────────────────────────────────────────────────

// POST /api/webhooks — register a webhook URL
app.post("/api/webhooks", timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)), (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }
  const reg = registerWebhook(url);
  res.status(201).json(reg);
});

// GET /api/admin/webhooks — list registered webhooks
app.get("/api/admin/webhooks", (req: Request, res: Response) => {
  res.json(getWebhooks());
});

// GET /api/admin/webhooks/logs — delivery logs
app.get("/api/admin/webhooks/logs", (req: Request, res: Response) => {
  res.json(getDeliveryLogs());
});

// ── soft-delete admin routes ──────────────────────────────────────────────────

// GET /api/admin/deleted/collateral — list soft-deleted collateral records
app.get("/api/admin/deleted/collateral", (req: Request, res: Response) => {
  res.json(listDeletedCollateral());
});

// POST /api/admin/restore/collateral/:id — restore a soft-deleted collateral record
app.post("/api/admin/restore/collateral/:id", (req: Request, res: Response) => {
  const ok = restoreCollateral(req.params.id);
  if (!ok) return res.status(404).json({ error: "Record not found or not deleted" });
  res.json({ restored: true, id: req.params.id });
});

// DELETE /api/collateral/:id — soft delete a collateral record
app.delete("/api/collateral/:id", (req: Request, res: Response) => {
  const ok = softDeleteCollateral(req.params.id);
  if (!ok) return res.status(404).json({ error: "Record not found" });
  res.json({ deleted: true, id: req.params.id });
});

// GET /api/admin/deleted/loans — list soft-deleted loan records
app.get("/api/admin/deleted/loans", (req: Request, res: Response) => {
  res.json(listDeletedLoans());
});

// POST /api/admin/restore/loans/:id — restore a soft-deleted loan record
app.post("/api/admin/restore/loans/:id", (req: Request, res: Response) => {
  const ok = restoreLoan(req.params.id);
  if (!ok) return res.status(404).json({ error: "Record not found or not deleted" });
  res.json({ restored: true, id: req.params.id });
});

// DELETE /api/loan/:id — soft delete a loan record
app.delete("/api/loan/:id", (req: Request, res: Response) => {
  const ok = softDeleteLoan(req.params.id);
  if (!ok) return res.status(404).json({ error: "Record not found" });
  res.json({ deleted: true, id: req.params.id });
});

// ── error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const reqLogger = (req as any).logger || logger;
  if (err instanceof PoolExhaustedError) {
    return res.status(503).json({ error: "Service unavailable: connection pool exhausted" });
  }
  reqLogger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
  });
  res.status(500).json({ error: err.message });
});

const PORT = parseInt(process.env.PORT || "3001", 10);
app.listen(PORT, () => {
  logger.info(`StellarKraal API running on port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    logLevel: process.env.LOG_LEVEL || "info",
  });
});

export default app;
