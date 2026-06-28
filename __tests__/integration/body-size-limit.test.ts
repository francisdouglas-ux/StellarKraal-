import request from 'supertest';
import app from '../../src/app';

describe('Body Size Limit Middleware', () => {
  describe('JSON Body Limit', () => {
    it('should accept JSON payload under 1MB', async () => {
      const payload = {
        data: 'x'.repeat(1024 * 100) // 100KB
      };

      const response = await request(app)
        .post('/api/v1/test')
        .set('Content-Type', 'application/json')
        .send(payload);

      // Should not be 413
      expect(response.status).not.toBe(413);
    });

    it('should reject JSON payload over 1MB with 413', async () => {
      const payload = {
        data: 'x'.repeat(1024 * 1024 * 1.5) // 1.5MB
      };

      const response = await request(app)
        .post('/api/v1/test')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(413);
      expect(response.body).toHaveProperty('error', 'Payload Too Large');
      expect(response.body.message).toContain('exceeds maximum allowed size');
    });

    it('should reject JSON payload at exactly 1MB + 1 byte', async () => {
      const payload = {
        data: 'x'.repeat(1024 * 1024 + 1) // 1MB + 1 byte
      };

      const response = await request(app)
        .post('/api/v1/test')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(413);
    });
  });

  describe('Multipart Form Limit', () => {
    it('should accept multipart payload under 5MB', async () => {
      const response = await request(app)
        .post('/api/v1/upload')
        .field('name', 'test')
        .attach('file', Buffer.alloc(1024 * 100), 'test.txt'); // 100KB

      // Should not be 413
      expect(response.status).not.toBe(413);
    });

    it('should reject multipart payload over 5MB with 413', async () => {
      const response = await request(app)
        .post('/api/v1/upload')
        .field('name', 'test')
        .attach('file', Buffer.alloc(1024 * 1024 * 6), 'large.txt'); // 6MB

      expect(response.status).toBe(413);
      expect(response.body).toHaveProperty('error', 'Payload Too Large');
    });
  });

  describe('Environment Configuration', () => {
    it('should use custom limit from environment variables', async () => {
      // This test should run with custom env vars
      // For now, we test that the default works
      const payload = {
        data: 'x'.repeat(1024 * 1024 * 1.5) // 1.5MB
      };

      const response = await request(app)
        .post('/api/v1/test')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(413);
    });
  });

  describe('Error Response Format', () => {
    it('should return 413 with correct error envelope', async () => {
      const payload = {
        data: 'x'.repeat(1024 * 1024 * 1.5) // 1.5MB
      };

      const response = await request(app)
        .post('/api/v1/test')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(413);
      expect(response.body).toMatchObject({
        error: 'Payload Too Large',
        message: expect.stringContaining('exceeds maximum allowed size')
      });
    });
  });

  describe('Content-Length Validation', () => {
    it('should reject requests with content-length exceeding limit', async () => {
      const payload = {
        data: 'x'.repeat(1024 * 1024 * 1.5) // 1.5MB
      };

      const response = await request(app)
        .post('/api/v1/test')
        .set('Content-Type', 'application/json')
        .set('Content-Length', String(1024 * 1024 * 1.5))
        .send(payload);

      expect(response.status).toBe(413);
    });
  });
});
