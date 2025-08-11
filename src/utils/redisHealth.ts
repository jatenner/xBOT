/**
 * 🔴 REDIS HEALTH & KEY PREFIX UTILITIES
 * 
 * PURPOSE: Redis health monitoring and namespace isolation
 * FEATURES: Health checks, prefix management, connectivity testing
 */

import Redis from 'ioredis';

interface RedisHealthStatus {
  connected: boolean;
  ping: number;
  prefix: string;
  error?: string;
}

export class RedisHealthManager {
  private redis: Redis | null = null;
  private prefix: string;
  private isConnected = false;

  constructor() {
    this.prefix = process.env.REDIS_PREFIX || 'app:';
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.log('📝 No Redis URL provided, operating without Redis');
      this.isConnected = false;
      return;
    }

    try {
      console.log('🔗 Attempting Redis connection...');
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 500,
        connectTimeout: 5000,
        tls: redisUrl.includes('rediss://') ? {} : undefined,
      });

      // Test connection
      await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis ping timeout')), 3000)
        )
      ]);

      this.isConnected = true;
      console.log('✅ Redis connected successfully');
    } catch (error: any) {
      console.warn('⚠️ Redis unavailable:', error.message);
      this.isConnected = false;
      this.redis = null;
    }
  }

  /**
   * Get prefixed key for namespace isolation
   */
  key(keyName: string): string {
    return `${this.prefix}${keyName}`;
  }

  /**
   * Health check with ping and test operations
   */
  async healthCheck(): Promise<RedisHealthStatus> {
    if (!this.redis || !this.isConnected) {
      return {
        connected: false,
        ping: -1,
        prefix: this.prefix,
        error: 'Redis not connected'
      };
    }

    try {
      // Measure ping time
      const startTime = Date.now();
      await this.redis.ping();
      const ping = Date.now() - startTime;

      // Test set/get with health key
      const healthKey = this.key('health');
      const testValue = `ok-${Date.now()}`;
      
      await this.redis.set(healthKey, testValue, 'EX', 60); // 60 second expiry
      const retrieved = await this.redis.get(healthKey);
      
      if (retrieved !== testValue) {
        throw new Error('Redis set/get test failed');
      }

      return {
        connected: true,
        ping,
        prefix: this.prefix
      };

    } catch (error: any) {
      this.isConnected = false;
      return {
        connected: false,
        ping: -1,
        prefix: this.prefix,
        error: error.message
      };
    }
  }

  /**
   * Get Redis instance (with prefix helper methods)
   */
  getClient(): Redis | null {
    return this.redis;
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Set a value with automatic prefix
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false;
    }

    try {
      const prefixedKey = this.key(key);
      if (ttlSeconds) {
        await this.redis.setex(prefixedKey, ttlSeconds, value);
      } else {
        await this.redis.set(prefixedKey, value);
      }
      return true;
    } catch (error: any) {
      console.error('❌ Redis set error:', error.message);
      return false;
    }
  }

  /**
   * Get a value with automatic prefix
   */
  async get(key: string): Promise<string | null> {
    if (!this.redis || !this.isConnected) {
      return null;
    }

    try {
      const prefixedKey = this.key(key);
      return await this.redis.get(prefixedKey);
    } catch (error: any) {
      console.error('❌ Redis get error:', error.message);
      return null;
    }
  }

  /**
   * Startup health verification
   */
  async verifyStartup(): Promise<void> {
    console.log('🔴 Redis Health: Starting verification...');
    
    const health = await this.healthCheck();
    
    if (health.connected) {
      console.log(`✅ Redis Health: Connected (ping: ${health.ping}ms, prefix: ${health.prefix})`);
    } else {
      console.log(`⚠️ Redis Health: Not connected (${health.error || 'unknown error'})`);
      console.log('📝 Application will continue without Redis cache');
    }
  }
}

// Singleton instance
export const redisHealth = new RedisHealthManager();

/**
 * Convenience functions
 */
export async function checkRedisHealth(): Promise<RedisHealthStatus> {
  return await redisHealth.healthCheck();
}

export function redisKey(keyName: string): string {
  return redisHealth.key(keyName);
}

export async function verifyRedisStartup(): Promise<void> {
  await redisHealth.verifyStartup();
}