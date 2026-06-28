/**
 * API v1 router — all application routes are mounted here.
 * Accessed via /api/v1/...
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { config } from "../config";
import { pool } from "../utils/connectionPool";
import { invalidateAll } from "../utils/appraisalCache";
import { asyncHandler } from "../utils/asyncHandler";
import { registerWebhook, getWebhooks, getDeliveryLogs } from "../webhooks";
import { timeoutMiddleware } from "../middleware/timeout";
import { writeLimiter } from "../middleware/rateLimit";
import { deprecationHeadersWhen } from "../middleware/deprecation";
import { fireAlert } from "../utils/alerting";
import { rules } from "../utils/alertRules";
import rpcClient from "../utils/rpcClient";
import { healthRouter } from "./health";
const CONTRACT_ID = process.env.CONTRACT_ID || "";
const NETWORK_PASSPHRASE =
  config.NEXT_PUBLIC_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

const SCALE = 10_000;

const APP_VERSION = process.env["npm_package_version"] || "1.0.0";
const startTime = Date.now();

const settingsSchema = z.object({
  notifications: z
    .object({
      loanApproved: z.boolean(),
      loanRepaid: z.boolean(),
      liquidationWarning: z.boolean(),
    })
    .optional(),
  language: z.string().min(2).max(10).optional(),
  currency: z.string().min(3).max(6).optional(),
});

type UserSettings = z.infer<typeof settingsSchema> & {
  walletAddress: string;
  joinDate: string;
};

const settingsStore = new Map<string, UserSettings>();

const v1Router = Router();

v1Router.use((_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return originalJson({ api_version: "v1", ...(body as object) });
    }
    return originalJson(body);
  };
  next();
});

// GET /health/deep — deep infrastructure health check (no auth, no rate limit)
v1Router.use("/health", healthRouter);

// GET /health — shallow liveness check
v1Router.get("/health", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    let rpcReachable = false;
    try {
      await pool.run((s) => s.getHealth());
      rpcReachable = true;
    } catch {
      // degraded
    }
    res.status(rpcReachable ? 200 : 503).json({
      status: rpcReachable ? "healthy" : "degraded",
      version: APP_VERSION,
      uptime,
      rpcReachable,
      pool: pool.stats(),
    });
  } catch (err) {
    next(err);
  }
});

v1Router.post(
  "/collateral/register",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  writeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = registerCollateralSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.issues });
    }
    const result = await registerCollateral(validation.data);
    res.json(result);
  })
);

v1Router.post(
  "/loan/request",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  writeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = loanRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.issues });
    }
    const result = await requestLoan(validation.data);
    res.json(result);
  })
);

v1Router.post(
  "/loan/repay",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  writeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = loanRepaySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.issues });
    }
    const result = await repayLoan(validation.data);
    res.json(result);
  })
);

v1Router.post(
  "/loan/liquidate",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  writeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = loanLiquidateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.issues });
    }
    try {
      const result = await liquidateLoan(validation.data);
      res.json(result);
    } catch (err) {
      if (err instanceof LoanNotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      if (err instanceof LoanNotLiquidatableError) {
        return res
          .status(400)
          .json({ error: err.message, health_factor: err.healthFactor });
      }
      throw err;
    }
  })
);

v1Router.get(
  "/loan/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const result = await getLoanOnChain(req.params.id as string);
    res.json(result);
  })
);

v1Router.get(
  "/health/:loanId",
  asyncHandler(async (req: Request, res: Response) => {
    const result = await getHealthFactor(req.params.loanId as string);
    res.json(result);
  })
);

v1Router.get("/collateral/:id", (req: Request, res: Response) => {
  const record = getCollateralById(req.params.id as string);
  if (!record) {
    return res.status(404).json({ error: "Collateral not found" });
  }
  res.json(record);
});

v1Router.get(
  "/loans",
  deprecationHeadersWhen(
    (req) =>
      req.query.page === undefined &&
      req.query.pageSize === undefined &&
      req.query.limit === undefined,
    {
      sunset: new Date("2026-12-31T23:59:59Z"),
      warning: "Unpaginated loan listing is deprecated; use ?page=1&pageSize=20",
      link: '</api/v1/loans?page=1&pageSize=20>; rel="successor-version"',
    }
  ),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = listLoansPaginated(req.query as Record<string, string | undefined>);
      res.json({
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        pageSize: result.pageSize,
      });
    } catch (err) {
      if (err instanceof InvalidPaginationError) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }
  })
);

v1Router.post(
  "/oracle/price-update",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  (_req: Request, res: Response) => {
    invalidateAll();
    res.json({ invalidated: true });
  }
);

v1Router.post(
  "/webhooks",
  timeoutMiddleware(parseInt(config.TIMEOUT_WRITE_MS, 10)),
  (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "url is required" });
    }
    try {
      return res.status(201).json(registerWebhook(url));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to register webhook";
      return res.status(400).json({ error: message });
    }
  }
);

v1Router.get("/admin/webhooks", (_req: Request, res: Response) => {
  res.json(getWebhooks());
});

v1Router.get("/admin/webhooks/logs", (_req: Request, res: Response) => {
  res.json(getDeliveryLogs());
});

v1Router.post("/alerts/webhook", async (req: Request, res: Response) => {
  const body = req.body;

  if (req.header("x-amz-sns-message-type") === "SubscriptionConfirmation") {
    const subscribeUrl = body.SubscribeURL;
    if (subscribeUrl) {
      await fetch(subscribeUrl);
      return res.status(200).send("Subscribed");
    }
  }

  if (req.header("x-amz-sns-message-type") === "Notification") {
    try {
      const message = JSON.parse(body.Message);
      if (
        message["detail-type"] === "Backup Job State Change" &&
        message.detail.state === "FAILED"
      ) {
        await fireAlert(rules.backupFailure, "AWS Backup job failed", {
          backupJobId: message.detail.backupJobId,
          resourceArn: message.detail.resourceArn,
        });
      }
    } catch {
      // Not a JSON message or different format
    }
  }

  res.status(200).send("OK");
});

v1Router.get("/settings/:wallet", (req: Request, res: Response) => {
  const wallet = req.params.wallet as string;
  const existing = settingsStore.get(wallet);
  if (!existing) {
    return res.json({
      walletAddress: wallet,
      joinDate: new Date().toISOString(),
      notifications: { loanApproved: true, loanRepaid: true, liquidationWarning: true },
      language: "en",
      currency: "USD",
    });
  }
  res.json(existing);
});

v1Router.put("/settings/:wallet", (req: Request, res: Response) => {
  const wallet = req.params.wallet as string;
  const validation = settingsSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: "Validation failed", details: validation.error.issues });
  }
  const existing = settingsStore.get(wallet) ?? {
    walletAddress: wallet,
    joinDate: new Date().toISOString(),
    notifications: { loanApproved: true, loanRepaid: true, liquidationWarning: true },
    language: "en",
    currency: "USD",
  };
  const updated: UserSettings = { ...existing, ...validation.data };
  settingsStore.set(wallet, updated);
  res.json(updated);
});

export { v1Router, startTime, APP_VERSION };
