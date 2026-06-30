/**
 * Tests for API v2 stub router.
 */
import express from 'express';
import request from 'supertest';
import { v2Router } from '../../src/routes/v2';

const app = express();
app.use('/api/v2', v2Router);

describe('v2Router', () => {
  it('returns 501 for GET /api/v2/loans', async () => {
    const res = await request(app).get('/api/v2/loans');
    expect(res.status).toBe(501);
    expect(res.body.error).toBe('Not Implemented');
  });

  it('returns 501 for POST /api/v2/collateral', async () => {
    const res = await request(app).post('/api/v2/collateral').send({});
    expect(res.status).toBe(501);
  });

  it('includes API-Version: 2 header', async () => {
    const res = await request(app).get('/api/v2/anything');
    expect(res.headers['api-version']).toBe('2');
  });
});
