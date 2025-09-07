import Redis from 'ioredis';
import { MIN_POST_INTERVAL_MINUTES, REDIS_URL, FORCE_POST } from '../config/env';

let redis: Redis | null = null;

function getRedisClient(): Redis {
  if (!redis && REDIS_URL) {
    redis = new Redis(REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    } as any);
  }
  return redis as Redis;
}

interface PostingCheck {
  allowed: boolean;
  reason?: string;
  nextAllowedAt?: Date;
  lockAcquired?: boolean;
}

/**
 * Distributed posting cadence guard using Redis
 * Prevents posting spam loops and enforces minimum intervals
 */
export class CadenceGuard {
  private static readonly LOCK_KEY = 'posting:inflight';
  private static readonly LAST_POST_KEY = 'posting:last_post_time';
  private static readonly LOCK_TTL_SECONDS = 600; // 10 minutes max lock time

  /**
   * Check if posting is allowed and acquire lock if so
   */
  static async checkAndLock(): Promise<PostingCheck> {
    try {
      // If FORCE_POST is enabled, skip all checks except lock
      if (FORCE_POST) {
        const lockAcquired = await this.acquireLock();
        return {
          allowed: lockAcquired,
          reason: lockAcquired ? 'FORCE_POST enabled' : 'Another post in progress',
          lockAcquired
        };
      }

      // Check if another post is in progress
      const lockAcquired = await this.acquireLock();
      if (!lockAcquired) {
        return {
          allowed: false,
          reason: 'Another post is already in progress',
          lockAcquired: false
        };
      }

      // Check minimum interval since last post
      const lastPostTime = await this.getLastPostTime();
      if (lastPostTime) {
        const timeSinceLastPost = Date.now() - lastPostTime.getTime();
        const minIntervalMs = MIN_POST_INTERVAL_MINUTES * 60 * 1000;
        
        if (timeSinceLastPost < minIntervalMs) {
          // Release lock since we're not posting
          await this.releaseLock();
          
          const nextAllowedAt = new Date(lastPostTime.getTime() + minIntervalMs);
          const remainingMinutes = Math.ceil((minIntervalMs - timeSinceLastPost) / (60 * 1000));
          
          return {
            allowed: false,
            reason: `Minimum interval not met. Last post: ${lastPostTime.toISOString()}, wait ${remainingMinutes} more minutes`,
            nextAllowedAt,
            lockAcquired: false
          };
        }
      }

      return {
        allowed: true,
        reason: 'Posting allowed - lock acquired',
        lockAcquired: true
      };

    } catch (error) {
      console.error('CadenceGuard error:', error);
      // On Redis failure, allow posting but log the issue
      return {
        allowed: true,
        reason: `Redis unavailable, allowing post: ${error}`,
        lockAcquired: false
      };
    }
  }

  /**
   * Mark successful post and release lock
   */
  static async markPostSuccess(): Promise<void> {
    try {
      const client = getRedisClient();
      if (client) {
        await Promise.all([
          client.set(this.LAST_POST_KEY, Date.now().toString()),
          this.releaseLock()
        ]);
        console.log('✅ Post success marked, lock released');
      }
    } catch (error) {
      console.error('Failed to mark post success:', error);
    }
  }

  /**
   * Release lock on failure
   */
  static async markPostFailure(error: string): Promise<void> {
    try {
      await this.releaseLock();
      console.log(`❌ Post failed, lock released: ${error}`);
    } catch (releaseError) {
      console.error('Failed to release lock on failure:', releaseError);
    }
  }

  /**
   * Force release lock (emergency use)
   */
  static async forceReleaseLock(): Promise<void> {
    try {
      const client = getRedisClient();
      if (client) {
        await client.del(this.LOCK_KEY);
        console.log('🔓 Lock force-released');
      }
    } catch (error) {
      console.error('Failed to force release lock:', error);
    }
  }

  /**
   * Get posting status info
   */
  static async getStatus(): Promise<{
    isLocked: boolean;
    lastPostTime: Date | null;
    nextAllowedAt: Date | null;
    minIntervalMinutes: number;
  }> {
    try {
      const client = getRedisClient();
      if (!client) {
        return {
          isLocked: false,
          lastPostTime: null,
          nextAllowedAt: null,
          minIntervalMinutes: MIN_POST_INTERVAL_MINUTES
        };
      }

      const [lockValue, lastPostTimeStr] = await Promise.all([
        client.get(this.LOCK_KEY),
        client.get(this.LAST_POST_KEY)
      ]);

      const isLocked = !!lockValue;
      const lastPostTime = lastPostTimeStr ? new Date(parseInt(lastPostTimeStr)) : null;
      
      let nextAllowedAt: Date | null = null;
      if (lastPostTime) {
        nextAllowedAt = new Date(lastPostTime.getTime() + (MIN_POST_INTERVAL_MINUTES * 60 * 1000));
      }

      return {
        isLocked,
        lastPostTime,
        nextAllowedAt,
        minIntervalMinutes: MIN_POST_INTERVAL_MINUTES
      };
    } catch (error) {
      console.error('Failed to get cadence status:', error);
      return {
        isLocked: false,
        lastPostTime: null,
        nextAllowedAt: null,
        minIntervalMinutes: MIN_POST_INTERVAL_MINUTES
      };
    }
  }

  private static async acquireLock(): Promise<boolean> {
    try {
      const client = getRedisClient();
      if (!client) {
        console.warn('Redis not available, skipping lock');
        return true; // Allow posting if Redis is down
      }

      const result = await client.set(
        this.LOCK_KEY,
        '1',
        'EX', // Set expiry
        this.LOCK_TTL_SECONDS,
        'NX'  // Only set if not exists
      );

      return result === 'OK';
    } catch (error) {
      console.error('Failed to acquire posting lock:', error);
      return true; // Allow posting on error
    }
  }

  private static async releaseLock(): Promise<void> {
    try {
      const client = getRedisClient();
      if (client) {
        await client.del(this.LOCK_KEY);
      }
    } catch (error) {
      console.error('Failed to release posting lock:', error);
    }
  }

  private static async getLastPostTime(): Promise<Date | null> {
    try {
      const client = getRedisClient();
      if (!client) return null;

      const lastPostTimeStr = await client.get(this.LAST_POST_KEY);
      return lastPostTimeStr ? new Date(parseInt(lastPostTimeStr)) : null;
    } catch (error) {
      console.error('Failed to get last post time:', error);
      return null;
    }
  }

  static async clearCache(): Promise<void> {
    try {
      const client = getRedisClient();
      if (client) {
        await client.del(this.LAST_POST_KEY);
        await client.del(this.LOCK_KEY);
        console.log('✅ Cache cleared, new 5-minute intervals will take effect');
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }
}

// Graceful shutdown
export async function closeCadenceGuard(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
