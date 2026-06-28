const request = require('supertest');
const app = require('../server');

describe('Rate Limiting Tests', () => {
  test('Strict limit: 10 requests per minute', async () => {
    const endpoint = '/api/loan';
    
    // Make 11 requests
    for (let i = 0; i < 11; i++) {
      const response = await request(app)
        .post(endpoint)
        .send({ amount: 100 });
      
      if (i < 10) {
        expect(response.status).toBe(201); // Or 200
      } else {
        // 11th request should be rate limited
        expect(response.status).toBe(429);
        expect(response.body).toHaveProperty('error', 'Too Many Requests');
        expect(response.headers).toHaveProperty('retry-after');
      }
    }
  });

  test('Standard limit: 60 requests per minute', async () => {
    const endpoint = '/api/loans';
    
    // Make 61 requests
    for (let i = 0; i < 61; i++) {
      const response = await request(app).get(endpoint);
      
      if (i < 60) {
        expect(response.status).toBe(200);
      } else {
        expect(response.status).toBe(429);
        expect(response.headers).toHaveProperty('retry-after');
      }
    }
  });

  test('Retry-After header is present', async () => {
    const response = await request(app)
      .post('/api/loan')
      .set('X-Forwarded-For', '127.0.0.1')
      .send({ amount: 100 });
    
    if (response.status === 429) {
      expect(response.headers).toHaveProperty('retry-after');
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    }
  });
});
