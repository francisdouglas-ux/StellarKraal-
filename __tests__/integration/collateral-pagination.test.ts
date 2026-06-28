import request from 'supertest';
import app from '../../src/app';
import { db } from '../../src/config/database';

describe('GET /api/v1/collateral - Pagination', () => {
  let authToken: string;
  let userId: string;
  
  beforeAll(async () => {
    // Setup test data
    // 1. Create test user
    // 2. Generate JWT token
    // 3. Create multiple collateral records
  });
  
  afterAll(async () => {
    // Clean up test data
    await db('collateral').where('user_id', userId).delete();
    await db('users').where('id', userId).delete();
  });
  
  describe('First Page', () => {
    it('should return first page with default limit (20)', async () => {
      const response = await request(app)
        .get('/api/v1/collateral')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('collateral');
      expect(response.body).toHaveProperty('nextCursor');
      expect(response.body).toHaveProperty('limit');
      expect(response.body.limit).toBe(20);
      expect(Array.isArray(response.body.collateral)).toBe(true);
    });
    
    it('should respect custom limit parameter', async () => {
      const limit = 5;
      const response = await request(app)
        .get('/api/v1/collateral')
        .query({ limit })
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(limit);
      expect(response.body.collateral.length).toBeLessThanOrEqual(limit);
    });
    
    it('should cap limit at 100', async () => {
      const response = await request(app)
        .get('/api/v1/collateral')
        .query({ limit: 200 })
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(100);
    });
  });
  
  describe('Next Page', () => {
    it('should include nextCursor when more records exist', async () => {
      // Ensure we have more than 20 records
      const response = await request(app)
        .get('/api/v1/collateral')
        .query({ limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      
      if (response.body.collateral.length === 10) {
        expect(response.body.nextCursor).toBeDefined();
        expect(response.body.nextCursor).not.toBeNull();
      }
    });
    
    it('should fetch next page using cursor', async () => {
      // First page
      const firstPage = await request(app)
        .get('/api/v1/collateral')
        .query({ limit: 5 })
        .set('Authorization', `Bearer ${authToken}`);
      
      // Second page using cursor
      const secondPage = await request(app)
        .get('/api/v1/collateral')
        .query({ 
          limit: 5,
          cursor: firstPage.body.nextCursor 
        })
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(secondPage.status).toBe(200);
      expect(secondPage.body.collateral).toBeDefined();
      
      // Verify different records
      const firstIds = firstPage.body.collateral.map((c: any) => c.id);
      const secondIds = secondPage.body.collateral.map((c: any) => c.id);
      
      // No overlap between pages
      const overlap = firstIds.filter((id: string) => secondIds.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });
  
  describe('Last Page', () => {
    it('should return null nextCursor when no more records exist', async () => {
      // Fetch last page
      let cursor: string | undefined = undefined;
      let response: any;
      let hasMore = true;
      let pageCount = 0;
      
      // Keep fetching until no more records
      while (hasMore && pageCount < 10) {
        response = await request(app)
          .get('/api/v1/collateral')
          .query({ 
            limit: 5,
            cursor 
          })
          .set('Authorization', `Bearer ${authToken}`);
        
        hasMore = !!response.body.nextCursor;
        cursor = response.body.nextCursor || undefined;
        pageCount++;
      }
      
      // Last page should have null cursor
      expect(response.body.nextCursor).toBeNull();
    });
  });
  
  describe('Validation', () => {
    it('should reject invalid limit (negative)', async () => {
      const response = await request(app)
        .get('/api/v1/collateral')
        .query({ limit: -5 })
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });
    
    it('should reject invalid limit (string)', async () => {
      const response = await request(app)
        .get('/api/v1/collateral')
        .query({ limit: 'abc' })
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should reject invalid cursor', async () => {
      const response = await request(app)
        .get('/api/v1/collateral')
        .query({ cursor: 123 }) // Should be string
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/v1/collateral');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('Unauthorized');
    });
  });
});
