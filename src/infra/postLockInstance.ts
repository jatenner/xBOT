import Redis from 'ioredis';
import { PostLock } from './PostLock';

/**
 * Global PostLock instance using Redis connection
 */

let redis: Redis | null = null;
let postLock: PostLock | null = null;

function getRedisConnection(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required for PostLock');
    }

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      }
    });

    redis.on('error', (error) => {
      console.error('PostLock Redis connection error:', error.message);
    });

    redis.on('connect', () => {
      console.log('PostLock Redis connected');
    });
  }

  return redis;
}

export function getPostLock(): PostLock {
  if (!postLock) {
    const redisConnection = getRedisConnection();
    postLock = new PostLock(redisConnection);
  }
  return postLock;
}

export async function closePostLockRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
    } catch (error) {
      console.warn('Error closing PostLock Redis connection:', error);
    } finally {
      redis = null;
      postLock = null;
    }
  }
}
