/**
 * 🔴 REDIS HEALTH MONITORING
 * 
 * PURPOSE: Redis connectivity testing and health verification
 * FEATURES: PING tests, SET/GET verification, environment isolation
 */

import Redis from 'ioredis';
import { key, healthKey, RedisKeys } from './key';

interface RedisHealthResult {
  connected: boolean;
  ping: number;
  setGetTest: boolean;
  prefix: string;
  environment: string;
  error?: string;
  timestamp: string;
}

export class RedisHealth {
  private redis: Redis | null = null;
  private lastHealthCheck: RedisHealthResult | null = null;

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.log('📝 No Redis URL provided - Redis health checks disabled');
      return;
    }

    try {
      console.log('🔗 Redis Health: Initializing connection...');
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 500,
        connectTimeout: 5000,
        lazyConnect: true,
        tls: redisUrl.includes('rediss://') ? {} : undefined,
      });

      // Test initial connection
      await this.redis.connect();
      console.log('✅ Redis Health: Connection initialized');
    } catch (error: any) {
      console.warn('⚠️ Redis Health: Connection failed:', error.message);
      this.redis = null;
    }
  }

  /**
   * Comprehensive health check with PING and SET/GET tests
   */
  async healthCheck(): Promise<RedisHealthResult> {
    const timestamp = new Date().toISOString();
    const prefix = process.env.REDIS_PREFIX || 'app:';
    const environment = process.env.APP_ENV || 'unknown';

    if (!this.redis) {
      const result: RedisHealthResult = {
        connected: false,
        ping: -1,
        setGetTest: false,
        prefix,
        environment,
        error: 'Redis not initialized',
        timestamp
      };
      this.lastHealthCheck = result;
      return result;
    }

    try {
      // Test 1: PING
      const pingStart = Date.now();
      const pingResult = await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Ping timeout')), 3000)
        )
      ]);
      const pingTime = Date.now() - pingStart;

      if (pingResult !== 'PONG') {
        throw new Error(`Unexpected ping response: ${pingResult}`);
      }

      // Test 2: SET/GET with prefixed key
      const testKey = healthKey();
      const testValue = `health_check_${Date.now()}`;
      
      await this.redis.set(testKey, testValue, 'EX', 60); // 60 second expiry
      const retrievedValue = await this.redis.get(testKey);
      
      const setGetTest = retrievedValue === testValue;
      if (!setGetTest) {
        throw new Error(`SET/GET test failed: expected ${testValue}, got ${retrievedValue}`);
      }

      // Cleanup test key
      await this.redis.del(testKey);

      const result: RedisHealthResult = {
        connected: true,
        ping: pingTime,
        setGetTest: true,
        prefix,
        environment,
        timestamp
      };

      this.lastHealthCheck = result;
      return result;

    } catch (error: any) {
      const result: RedisHealthResult = {
        connected: false,
        ping: -1,
        setGetTest: false,
        prefix,
        environment,
        error: error.message,
        timestamp
      };
      this.lastHealthCheck = result;
      return result;
    }
  }

  /**
   * Quick ping test
   */
  async ping(): Promise<{ success: boolean; time: number; error?: string }> {
    if (!this.redis) {
      return { success: false, time: -1, error: 'Redis not initialized' };
    }

    try {
      const start = Date.now();
      const result = await this.redis.ping();
      const time = Date.now() - start;
      
      return {
        success: result === 'PONG',
        time,
        error: result !== 'PONG' ? `Unexpected response: ${result}` : undefined
      };
    } catch (error: any) {
      return { success: false, time: -1, error: error.message };
    }
  }

  /**
   * Test SET/GET with prefixed key
   */
  async testSetGet(): Promise<{ success: boolean; error?: string }> {
    if (!this.redis) {
      return { success: false, error: 'Redis not initialized' };
    }

    try {
      const testKey = key('test', 'set_get', Date.now().toString());
      const testValue = `test_${Math.random()}`;
      
      await this.redis.set(testKey, testValue, 'EX', 10);
      const retrieved = await this.redis.get(testKey);
      await this.redis.del(testKey);
      
      if (retrieved === testValue) {
        return { success: true };
      } else {
        return { success: false, error: `Value mismatch: expected ${testValue}, got ${retrieved}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get last health check result
   */
  getLastHealthCheck(): RedisHealthResult | null {
    return this.lastHealthCheck;
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.redis !== null && this.lastHealthCheck?.connected === true;
  }

  /**
   * Get Redis instance (for advanced usage)
   */
  getRedis(): Redis | null {
    return this.redis;
  }

  /**
   * Startup health verification - logs results but doesn't exit
   */
  async verifyStartup(): Promise<void> {
    console.log('🔴 Redis Health: Starting startup verification...');
    
    const health = await this.healthCheck();
    
    if (health.connected) {
      console.log(`✅ Redis Health: Connected successfully`);
      console.log(`   - Environment: ${health.environment}`);
      console.log(`   - Prefix: ${health.prefix}`);
      console.log(`   - Ping: ${health.ping}ms`);
      console.log(`   - SET/GET: ${health.setGetTest ? 'OK' : 'FAILED'}`);
    } else {
      console.log(`⚠️ Redis Health: Not available`);
      console.log(`   - Environment: ${health.environment}`);
      console.log(`   - Error: ${health.error || 'Unknown error'}`);
      console.log(`   - Application will continue without Redis cache`);
    }
  }

  /**
   * Environment info
   */
  getEnvironmentInfo(): {
    environment: string;
    prefix: string;
    redisUrl: boolean;
    connected: boolean;
  } {
    return {
      environment: process.env.APP_ENV || 'unknown',
      prefix: process.env.REDIS_PREFIX || 'app:',
      redisUrl: !!process.env.REDIS_URL,
      connected: this.isAvailable()
    };
  }
}

// Singleton instance
export const redisHealth = new RedisHealth();

/**
 * Convenience functions
 */
export async function checkRedisHealth(): Promise<RedisHealthResult> {
  return await redisHealth.healthCheck();
}

export async function pingRedis(): Promise<{ success: boolean; time: number; error?: string }> {
  return await redisHealth.ping();
}

export async function testRedisSetGet(): Promise<{ success: boolean; error?: string }> {
  return await redisHealth.testSetGet();
}

export async function verifyRedisStartup(): Promise<void> {
  await redisHealth.verifyStartup();
}

export function isRedisAvailable(): boolean {
  return redisHealth.isAvailable();
}

export function getRedisEnvironmentInfo(): {
  environment: string;
  prefix: string;
  redisUrl: boolean;
  connected: boolean;
} {
  return redisHealth.getEnvironmentInfo();
}