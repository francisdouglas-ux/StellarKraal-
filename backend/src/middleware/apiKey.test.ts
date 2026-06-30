/**
 * Unit tests for API key authentication.
 */
import { authenticateApiKey, apiKeyRouter } from '../../src/middleware/apiKey';
import express from 'express';
import request from 'supertest';

function buildApp() {
  const app = express();
  app.use(express.json());
  // Simulate authenticated user for key creation
  app.use((req, _res, next) => {
    (req as express.Request & { user: { publicKey: string } }).user = {
      publicKey: 'GCTESTABC123',
    };
    next();
  });
  app.use('/api/v1/admin/api-keys', apiKeyRouter);
  return app;
}

describe('API key authentication', () => {
  it('creates a new API key prefixed with sk_', async () => {
    const res = await request(buildApp()).post('/api/v1/admin/api-keys');
    expect(res.status).toBe(201);
    expect(res.body.key).toMatch(/^sk_/);
    expect(res.body.id).toBeDefined();
  });

  it('authenticates with a valid key', async () => {
    const app = buildApp();
    const createRes = await request(app).post('/api/v1/admin/api-keys');
    const { key } = createRes.body as { key: string };

    const publicKey = authenticateApiKey(`Bearer ${key}`);
    expect(publicKey).toBe('GCTESTABC123');
  });

  it('returns null for an unknown key', () => {
    const result = authenticateApiKey('Bearer sk_' + 'a'.repeat(64));
    expect(result).toBeNull();
  });

  it('returns null for a non-sk_ bearer token', () => {
    const result = authenticateApiKey('Bearer some.jwt.token');
    expect(result).toBeNull();
  });

  it('returns null after key is revoked', async () => {
    const app = buildApp();
    const createRes = await request(app).post('/api/v1/admin/api-keys');
    const { key, id } = createRes.body as { key: string; id: string };

    // Revoke it
    await request(app).delete(`/api/v1/admin/api-keys/${id}`);

    const publicKey = authenticateApiKey(`Bearer ${key}`);
    expect(publicKey).toBeNull();
  });
});
