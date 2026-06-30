/**
 * API v2 router stub.
 *
 * v2 is not yet implemented. All routes return 501 Not Implemented so that
 * clients can detect the version boundary and handle it gracefully.
 *
 * When v2 features are ready, replace individual 501 handlers with real
 * route handlers and remove them from this file.
 */
import { Router, Request, Response } from 'express';

export const v2Router = Router();

// Add API-Version header to all v2 responses
v2Router.use((_req: Request, res: Response, next) => {
  res.setHeader('API-Version', '2');
  next();
});

// Catch-all stub: any method, any path under /api/v2/*
// Express 5 / path-to-regexp v8 syntax: use /:path{0,} for optional catch-all
v2Router.all(['/', '/:path{0,}'], (_req: Request, res: Response) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'API v2 is not yet available. Use /api/v1 endpoints.',
  });
});
