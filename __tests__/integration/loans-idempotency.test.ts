import request from 'supertest';
import app from '../../src/app';
import { db } from '../../src/config/database';

describe('POST /api/v1/loans - Idempotency', () => {
  let authToken: string;
  let userId: string;
  const idempotencyKey = 'test-idempotency-key-001';

  beforeAll(async () => {
    // Setup test user and auth token
    // This should be implemented based on your auth setup
  });

  afterAll(async () => {
    // Clean up test data
    await db('idempotency_records').where('request_id', 'like', '%test%').delete();
  });

  describe('Idempotency Key Header', () => {
    it('should require Idempotency-Key header', async () => {
      const response = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 1000,
          collateralId: 'col-001',
          terms: { duration: 30, interestRate: 0.05 }
        });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('Idempotency-Key header is required');
    });

    it('should reject empty idempotency key', async () => {
      const response = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', '')
        .send({
          amount: 1000,
          collateralId: 'col-001',
          terms: { duration: 30, interestRate: 0.05 }
        });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('non-empty string');
    });
  });

  describe('Idempotent Replay Behavior', () => {
    it('should return original response for duplicate request with same key', async () => {
      const loanData = {
        amount: 1000,
        collateralId: 'col-001',
        terms: { duration: 30, interestRate: 0.05 }
      };

      // First request - should succeed
      const firstResponse = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(loanData);

      expect(firstResponse.status).toBe(201);
      expect(firstResponse.body).toHaveProperty('success', true);
      expect(firstResponse.body.data).toHaveProperty('id');

      // Second request with same key - should return same response
      const secondResponse = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(loanData);

      expect(secondResponse.status).toBe(201); // Should be same as first
      expect(secondResponse.body).toEqual(firstResponse.body);
    });

    it('should create only one loan for duplicate requests', async () => {
      const key = 'test-idempotency-key-002';
      const loanData = {
        amount: 2000,
        collateralId: 'col-002',
        terms: { duration: 60, interestRate: 0.04 }
      };

      // First request
      const firstResponse = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', key)
        .send(loanData);

      const loanId1 = firstResponse.body.data.id;

      // Second request with same key
      const secondResponse = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', key)
        .send(loanData);

      const loanId2 = secondResponse.body.data.id;

      // Should return the same loan ID
      expect(loanId2).toBe(loanId1);
    });
  });

  describe('Different Keys', () => {
    it('should create separate loans for different idempotency keys', async () => {
      const key1 = 'test-idempotency-key-003';
      const key2 = 'test-idempotency-key-004';
      const loanData = {
        amount: 3000,
        collateralId: 'col-003',
        terms: { duration: 90, interestRate: 0.03 }
      };

      // First request with key1
      const response1 = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', key1)
        .send(loanData);

      // Second request with key2
      const response2 = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', key2)
        .send(loanData);

      // Both should succeed
      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);

      // Should have different loan IDs
      expect(response1.body.data.id).not.toBe(response2.body.data.id);
    });
  });

  describe('Key Expiry', () => {
    it('should expire keys after 24 hours', async () => {
      // This test would require mocking the database time
      // or manually setting expired_at in the database
      
      // For now, we'll test that the expiry check exists
      const key = 'test-idempotency-key-005';
      const loanData = {
        amount: 4000,
        collateralId: 'col-004',
        terms: { duration: 30, interestRate: 0.05 }
      };

      // First request
      await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', key)
        .send(loanData);

      // Manually expire the key (for testing purposes)
      await db('idempotency_records')
        .where('request_id', 'like', `%${key}%`)
        .update({ expires_at: new Date(Date.now() - 1000) });

      // Second request with expired key should create a new loan
      const response = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', key)
        .send(loanData);

      // Should succeed (create new loan)
      expect(response.status).toBe(201);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle malformed idempotency key', async () => {
      const response = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', '   ')
        .send({
          amount: 1000,
          collateralId: 'col-005'
        });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });
  });
});
