/**
 * Integration test: compression middleware adds Content-Encoding: gzip
 * for compressible responses larger than 1 kB.
 */
import express from 'express';
import request from 'supertest';
import { compressionMiddleware } from '../../src/middleware/compression';

function buildApp() {
  const app = express();
  app.use(compressionMiddleware);
  app.get('/large', (_req, res) => {
    // Produce a >1 kB JSON payload so compression threshold is met
    const data = Array.from({ length: 200 }, (_, i) => ({ id: i, value: `item-${i}` }));
    res.json(data);
  });
  app.get('/small', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('compressionMiddleware', () => {
  it('compresses large JSON responses (Content-Encoding: gzip)', async () => {
    const res = await request(buildApp())
      .get('/large')
      .set('Accept-Encoding', 'gzip');
    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('does not compress when client sends x-no-compression header', async () => {
    const res = await request(buildApp())
      .get('/large')
      .set('Accept-Encoding', 'gzip')
      .set('x-no-compression', '1');
    expect(res.headers['content-encoding']).toBeUndefined();
  });
});
