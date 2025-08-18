/**
 * Tests for PostLock concurrency control
 * Verifies double start → second call exits fast; stale lock is cleared
 */

import Redis from 'ioredis';
import { PostLock } from '../src/infra/PostLock';
import { skipIfMissingEnv } from './setup';

describe('PostLock', () => {
  let redis: Redis;
  let lock1: PostLock;
  let lock2: PostLock;

  beforeAll(async () => {
    if (skipIfMissingEnv(['REDIS_URL'], 'PostLock tests')) {
      return;
    }

    // Use test Redis database
    const redisUrl = process.env.REDIS_URL;
    redis = new Redis(redisUrl, { 
      db: 15, // Use test db
      connectTimeout: 5000,
      lazyConnect: true
    });
    
    try {
      await redis.ping();
      lock1 = new PostLock(redis);
      lock2 = new PostLock(redis);
    } catch (error) {
      console.warn('Redis connection failed, skipping PostLock tests');
      return;
    }
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    // Clean up any existing locks
    await redis.del('test:xbot:lock:posting');
  });

  describe('Basic Lock Operations', () => {
    beforeEach(() => {
      if (!redis) {
        pending('Redis not available - skipping test');
      }
    });

    it('should acquire lock when available', async () => {
      const acquired = await lock1.acquire('test operation');
      expect(acquired).toBe(true);
      
      // Clean up
      await lock1.release();
    });

    it('should fail to acquire when already locked by another instance', async () => {
      // First lock acquires
      const firstAcquired = await lock1.acquire('first operation');
      expect(firstAcquired).toBe(true);

      // Second lock should fail
      const secondAcquired = await lock2.acquire('second operation');
      expect(secondAcquired).toBe(false);

      // Clean up
      await lock1.release();
    });

    it('should release lock properly', async () => {
      await lock1.acquire('test operation');
      await lock1.release();

      // Should be able to acquire again
      const acquired = await lock2.acquire('second operation');
      expect(acquired).toBe(true);
      
      await lock2.release();
    });
  });

  describe('Lock Status and Information', () => {
    it('should return correct status when unlocked', async () => {
      const status = await lock1.status();
      expect(status.locked).toBe(false);
      expect(status.owner).toBeUndefined();
    });

    it('should return correct status when locked', async () => {
      await lock1.acquire('test operation');
      
      const status = await lock1.status();
      expect(status.locked).toBe(true);
      expect(status.owner).toBeDefined();
      expect(status.reason).toBe('test operation');
      expect(status.expiresInMs).toBeGreaterThan(0);
      
      await lock1.release();
    });
  });

  describe('Lock Extension', () => {
    it('should extend lock TTL when owner', async () => {
      await lock1.acquire('test operation');
      
      const extended = await lock1.extend();
      expect(extended).toBe(true);
      
      await lock1.release();
    });

    it('should fail to extend when not owner', async () => {
      await lock1.acquire('test operation');
      
      const extended = await lock2.extend();
      expect(extended).toBe(false);
      
      await lock1.release();
    });
  });

  describe('Stale Lock Detection', () => {
    it('should detect stale locks', async () => {
      // Manually create an old lock entry
      const staleTime = Date.now() - (10 * 60 * 1000); // 10 minutes ago
      const staleLock = {
        owner: 'stale-owner',
        reason: 'stale operation',
        corrId: 'stale-corr-id',
        acquiredAt: staleTime,
        heartbeatAt: staleTime
      };
      
      await redis.set('test:xbot:lock:posting', JSON.stringify(staleLock), 'PX', 60000);
      
      const isStale = await lock1.isStale();
      expect(isStale).toBe(true);
      
      // Clean up
      await redis.del('test:xbot:lock:posting');
    });

    it('should not detect fresh locks as stale', async () => {
      await lock1.acquire('fresh operation');
      
      const isStale = await lock1.isStale();
      expect(isStale).toBe(false);
      
      await lock1.release();
    });
  });

  describe('Run with Lock', () => {
    it('should execute function when lock acquired', async () => {
      let executed = false;
      
      const result = await lock1.run('test run', async (corrId) => {
        executed = true;
        expect(corrId).toBeDefined();
        expect(typeof corrId).toBe('string');
        return 'success';
      });
      
      expect(executed).toBe(true);
      expect(result).toBe('success');
    });

    it('should not execute when lock unavailable', async () => {
      // First lock acquires and holds
      await lock1.acquire('blocking operation');
      
      let executed = false;
      let onLockedCalled = false;
      
      const result = await lock2.run(
        'blocked operation',
        async () => {
          executed = true;
          return 'should not run';
        },
        () => {
          onLockedCalled = true;
        }
      );
      
      expect(executed).toBe(false);
      expect(onLockedCalled).toBe(true);
      expect(result).toBeNull();
      
      // Clean up
      await lock1.release();
    });

    it('should release lock even if function throws', async () => {
      let errorThrown = false;
      
      try {
        await lock1.run('error operation', async () => {
          throw new Error('Test error');
        });
      } catch (error) {
        errorThrown = true;
      }
      
      expect(errorThrown).toBe(true);
      
      // Lock should be released, so this should succeed
      const acquired = await lock2.acquire('after error');
      expect(acquired).toBe(true);
      
      await lock2.release();
    });
  });

  describe('Force Unlock', () => {
    it('should force unlock any existing lock', async () => {
      await lock1.acquire('operation to be forced');
      
      const unlocked = await lock2.forceUnlock();
      expect(unlocked).toBe(true);
      
      // Should be able to acquire now
      const acquired = await lock2.acquire('after force unlock');
      expect(acquired).toBe(true);
      
      await lock2.release();
    });

    it('should return false when no lock exists', async () => {
      const unlocked = await lock1.forceUnlock();
      expect(unlocked).toBe(false);
    });
  });

  describe('Timing Tests', () => {
    it('should exit fast when lock unavailable', async () => {
      await lock1.acquire('blocking operation');
      
      const startTime = Date.now();
      let onLockedCalled = false;
      
      await lock2.run(
        'fast exit test',
        async () => 'should not run',
        () => { onLockedCalled = true; }
      );
      
      const duration = Date.now() - startTime;
      
      expect(onLockedCalled).toBe(true);
      expect(duration).toBeLessThan(100); // Should exit within 100ms
      
      await lock1.release();
    });
  });
});
