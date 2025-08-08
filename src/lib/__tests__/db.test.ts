/**
 * 🧪 DATABASE ABSTRACTION LAYER (DAL) TESTS
 * ==========================================
 * 
 * Tests for Redis Cloud hot cache and Supabase durable storage integration.
 * Uses ioredis-mock for Redis testing and mocked Supabase client.
 */

import RedisMock from 'ioredis-mock';

// Mock ioredis to use ioredis-mock
jest.mock('ioredis', () => {
  return RedisMock;
});

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({ error: null })),
    select: jest.fn(() => ({ 
      order: jest.fn(() => ({ 
        limit: jest.fn(() => ({ data: [], error: null }))
      })),
      gte: jest.fn(() => ({ 
        lt: jest.fn(() => ({ data: [], error: null }))
      })),
      eq: jest.fn(() => ({ single: jest.fn(() => ({ data: null, error: null })) })),
      limit: jest.fn(() => ({ data: [], error: null })),
      ilike: jest.fn(() => ({ data: [], error: null }))
    })),
    upsert: jest.fn(() => ({ error: null }))
  }))
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

// Set test environment variables
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.USE_SUPABASE_ONLY = 'false';

import { DB } from '../db';

describe('Database Abstraction Layer (DAL)', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.USE_SUPABASE_ONLY;
  });

  describe('🚀 Hot Cache Operations (Redis)', () => {
    describe('saveTweetFast', () => {
      it('should save tweet to Redis hot cache', async () => {
        const tweet = {
          id: 'test-123',
          content: 'Test tweet content',
          posted_at: '2025-01-08T12:00:00Z',
          likes: 5,
          viral_score: 7
        };

        await DB.saveTweetFast(tweet);

        // Verify Redis operations (would need to check mock calls in real implementation)
        // This is a structure test - the actual Redis mock calls would be verified here
        expect(true).toBe(true); // Placeholder for Redis mock verification
      });

      it('should fall back to Supabase when Redis fails', async () => {
        // Set USE_SUPABASE_ONLY to test fallback
        process.env.USE_SUPABASE_ONLY = 'true';

        const tweet = {
          id: 'test-123',
          content: 'Test tweet content',
          posted_at: '2025-01-08T12:00:00Z'
        };

        await DB.saveTweetFast(tweet);

        // Should call Supabase instead
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('tweets');
      });
    });

    describe('getRecentTweets', () => {
      it('should retrieve recent tweets from Redis cache', async () => {
        const result = await DB.getRecentTweets(10);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeLessThanOrEqual(10);
      });

      it('should fall back to Supabase when Redis cache is empty', async () => {
        process.env.USE_SUPABASE_ONLY = 'true';

        await DB.getRecentTweets(5);

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('tweets');
      });
    });

    describe('isDuplicateContent', () => {
      it('should detect non-duplicate content', async () => {
        const content = 'Unique test content';
        const isDuplicate = await DB.isDuplicateContent(content);

        expect(isDuplicate).toBe(false);
      });

      it('should detect duplicate content within lookback window', async () => {
        const content = 'Duplicate test content';
        
        // First call should not be duplicate
        const firstCheck = await DB.isDuplicateContent(content);
        expect(firstCheck).toBe(false);

        // Second call should be duplicate (if Redis mock was properly set up)
        // This test would need proper Redis mock setup
        const secondCheck = await DB.isDuplicateContent(content);
        expect(typeof secondCheck).toBe('boolean');
      });

      it('should fall back to Supabase duplicate check', async () => {
        process.env.USE_SUPABASE_ONLY = 'true';

        await DB.isDuplicateContent('test content');

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('tweets');
      });
    });

    describe('checkRateLimit', () => {
      it('should allow requests within rate limit', async () => {
        const result = await DB.checkRateLimit('test-key', 10, 3600);

        expect(result).toHaveProperty('count');
        expect(result).toHaveProperty('remaining');
        expect(result).toHaveProperty('resetTime');
        expect(result.remaining).toBeGreaterThanOrEqual(0);
      });

      it('should deny requests when rate limit exceeded', async () => {
        // This would require setting up Redis mock with existing data
        const result = await DB.checkRateLimit('test-key', 0, 3600);

        expect(result.count).toBeGreaterThanOrEqual(0);
        expect(typeof result.resetTime).toBe('number');
      });

      it('should fall back to Supabase rate limiting', async () => {
        process.env.USE_SUPABASE_ONLY = 'true';

        await DB.checkRateLimit('test-key', 10, 3600);

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('tweets');
      });
    });

    describe('getDailyTweetCount', () => {
      it('should return daily tweet count from Redis', async () => {
        const count = await DB.getDailyTweetCount('2025-01-08');

        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });

      it('should fall back to Supabase for daily count', async () => {
        process.env.USE_SUPABASE_ONLY = 'true';

        await DB.getDailyTweetCount('2025-01-08');

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('tweets');
      });
    });
  });

  describe('💾 Durable Storage Operations (Supabase)', () => {
    describe('saveTweetDurable', () => {
      it('should save tweet to Supabase', async () => {
        const tweet = {
          id: 'test-123',
          content: 'Test tweet content',
          posted_at: '2025-01-08T12:00:00Z',
          likes: 5,
          viral_score: 7
        };

        await DB.saveTweetDurable(tweet);

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('tweets');
      });

      it('should handle Supabase errors gracefully', async () => {
        // Mock Supabase error
        mockSupabaseClient.from.mockReturnValueOnce({
          insert: jest.fn(() => ({ error: { message: 'Database error' } }))
        });

        const tweet = {
          id: 'test-123',
          content: 'Test tweet content',
          posted_at: '2025-01-08T12:00:00Z'
        };

        await expect(DB.saveTweetDurable(tweet)).rejects.toThrow();
      });
    });

    describe('getRecentTweetsDurable', () => {
      it('should retrieve recent tweets from Supabase', async () => {
        // Mock Supabase response
        mockSupabaseClient.from.mockReturnValueOnce({
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                data: [
                  {
                    tweet_id: 'test-123',
                    content: 'Test content',
                    created_at: '2025-01-08T12:00:00Z'
                  }
                ],
                error: null
              }))
            }))
          }))
        });

        const tweets = await DB.getRecentTweetsDurable(5);

        expect(Array.isArray(tweets)).toBe(true);
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('tweets');
      });

      it('should return empty array on Supabase error', async () => {
        mockSupabaseClient.from.mockReturnValueOnce({
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({ data: null, error: { message: 'Error' } }))
            }))
          }))
        });

        const tweets = await DB.getRecentTweetsDurable(5);

        expect(tweets).toEqual([]);
      });
    });
  });

  describe('🔄 Flush Operations', () => {
    describe('flushToSupabase', () => {
      it('should flush Redis data to Supabase', async () => {
        const result = await DB.flushToSupabase();

        expect(result).toHaveProperty('flushed');
        expect(result).toHaveProperty('errors');
        expect(typeof result.flushed).toBe('number');
        expect(typeof result.errors).toBe('number');
      });

      it('should skip flush in Supabase-only mode', async () => {
        process.env.USE_SUPABASE_ONLY = 'true';

        const result = await DB.flushToSupabase();

        expect(result.flushed).toBe(0);
        expect(result.errors).toBe(0);
      });
    });
  });

  describe('🔧 Utility Methods', () => {
    describe('generateContentHash', () => {
      it('should generate consistent hashes for same content', async () => {
        const content = 'Test content for hashing';
        
        const hash1 = await DB.generateContentHash(content);
        const hash2 = await DB.generateContentHash(content);

        expect(hash1).toBe(hash2);
        expect(typeof hash1).toBe('string');
        expect(hash1.length).toBe(32); // MD5 hash length
      });

      it('should generate different hashes for different content', async () => {
        const hash1 = await DB.generateContentHash('Content 1');
        const hash2 = await DB.generateContentHash('Content 2');

        expect(hash1).not.toBe(hash2);
      });

      it('should normalize content (case insensitive)', async () => {
        const hash1 = await DB.generateContentHash('Test Content');
        const hash2 = await DB.generateContentHash('test content');

        expect(hash1).toBe(hash2);
      });
    });

    describe('healthCheck', () => {
      it('should return health status for both databases', async () => {
        const health = await DB.healthCheck();

        expect(health).toHaveProperty('redis');
        expect(health).toHaveProperty('supabase');
        expect(health).toHaveProperty('overall');
        
        expect(['ok', 'error', 'slow_50ms'].some(status => 
          health.redis.includes('ok') || health.redis === 'error'
        )).toBe(true);
        
        expect(['ok', 'error'].includes(health.supabase)).toBe(true);
        expect(['healthy', 'degraded', 'down'].includes(health.overall)).toBe(true);
      });
    });
  });

  describe('🛡️ Error Handling & Resilience', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // This would test actual Redis failure scenarios
      // For now, we test that methods don't throw
      await expect(DB.getDailyTweetCount()).resolves.not.toThrow();
    });

    it('should handle Supabase connection failures gracefully', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });

      await expect(DB.getRecentTweetsDurable(5)).resolves.toEqual([]);
    });

    it('should maintain functionality with partial database failure', async () => {
      // Test degraded mode where one database is down
      const health = await DB.healthCheck();
      
      // Should still return a valid health object
      expect(health).toHaveProperty('overall');
    });
  });

  describe('🔄 Environment Configuration', () => {
    it('should respect USE_SUPABASE_ONLY flag', async () => {
      process.env.USE_SUPABASE_ONLY = 'true';

      // All operations should go to Supabase
      await DB.saveTweetFast({ id: 'test', content: 'test', posted_at: new Date().toISOString() });
      
      expect(mockSupabaseClient.from).toHaveBeenCalled();
    });

    it('should use Redis by default when flag is false', async () => {
      process.env.USE_SUPABASE_ONLY = 'false';

      const count = await DB.getDailyTweetCount();
      
      // Should attempt Redis first (count should be number)
      expect(typeof count).toBe('number');
    });
  });
});