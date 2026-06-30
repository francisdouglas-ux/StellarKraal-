/**
 * Response compression middleware (gzip/brotli).
 * Compresses text/json responses larger than 1 kB.
 * Compression level is configurable via COMPRESSION_LEVEL env var (0-9, default 6).
 */
import compression from 'compression';
import { Request, Response } from 'express';

const level = process.env.COMPRESSION_LEVEL !== undefined
  ? parseInt(process.env.COMPRESSION_LEVEL, 10)
  : 6;

export const compressionMiddleware = compression({
  level,
  threshold: 1024, // only compress responses > 1 kB
  filter: (req: Request, res: Response) => {
    // Don't compress if the client explicitly opts out
    if (req.headers['x-no-compression']) return false;
    // Use default filter for everything else (text/*, application/json, etc.)
    return compression.filter(req, res);
  },
});
