/**
 * ⚡ HARDENED REDIS CACHE
 * 
 * Cloud-safe Redis client that avoids CONFIG commands and provides
 * robust caching with fallback capabilities for Railway/managed Redis.
 */

import Redis from 'ioredis';

export interface CacheResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  fromCache?: boolean;
}

export interface HealthStatus {
  connected: boolean;
  latency?: number;
  error?: string;
  version?: string;
}

export class HardenedRedisCache {
  private static instance: HardenedRedisCache;
  private client: Redis | null = null;
  private connected = false;
  private fallbackStore = new Map<string, { value: any; expires: number }>();
  private readonly FALLBACK_MAX_SIZE = 1000;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): HardenedRedisCache {
    if (!HardenedRedisCache.instance) {
      HardenedRedisCache.instance = new HardenedRedisCache();
    }
    return HardenedRedisCache.instance;
  }

  /**
   * 🚀 Initialize Redis connection (cloud-safe)
   */
  private async initialize(): Promise<void> {
    if (!process.env.REDIS_URL) {
      console.warn('⚠️ REDIS_CACHE: No REDIS_URL provided, using fallback mode');
      return;
    }

    try {
      console.log('⚡ REDIS_CACHE: Initializing cloud-safe connection...');

      this.client = new Redis(process.env.REDIS_URL, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        // Cloud-safe: no CONFIG commands
        enableAutoPipelining: true,
        lazyConnect: true
      });

      this.client.on('connect', () => {
        console.log('✅ REDIS_CACHE: Connected successfully');
        this.connected = true;
      });

      this.client.on('error', (error) => {
        console.error('❌ REDIS_CACHE: Connection error:', error.message);
        this.connected = false;
        
        // Don't crash on CONFIG errors (common in managed Redis)
        if (error.message.includes('CONFIG')) {
          console.log('⚠️ REDIS_CACHE: CONFIG commands disabled (managed Redis), continuing...');
        }
      });

      this.client.on('ready', () => {
        console.log('🎯 REDIS_CACHE: Ready for operations');
        this.connected = true;
      });

      // Attempt connection
      await this.client.ping();

    } catch (error) {
      console.error('❌ REDIS_CACHE: Initialization failed:', error);
      this.connected = false;
    }
  }

  /**
   * 📝 Set cache value with TTL
   */
  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<CacheResult> {
    try {
      const serialized = JSON.stringify(value);

      if (this.connected && this.client) {
        const result = await this.client.setex(key, ttlSeconds, serialized);
        
        if (result === 'OK') {
          return { success: true, data: value };
        } else {
          return { success: false, error: 'Redis SET failed' };
        }
      } else {
        // Fallback to in-memory store
        this.setFallback(key, value, ttlSeconds);
        return { success: true, data: value, fromCache: false };
      }

    } catch (error) {
      console.error('❌ REDIS_SET_ERROR:', error);
      
      // Try fallback
      this.setFallback(key, value, ttlSeconds);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        data: value
      };
    }
  }

  /**
   * 📖 Get cache value
   */
  async get<T = any>(key: string): Promise<CacheResult<T>> {
    try {
      if (this.connected && this.client) {
        const result = await this.client.get(key);
        
        if (result === null) {
          return { success: true, data: undefined };
        }

        const parsed = JSON.parse(result) as T;
        return { success: true, data: parsed, fromCache: true };
      } else {
        // Check fallback store
        const fallbackResult = this.getFallback<T>(key);
        if (fallbackResult !== undefined) {
          return { success: true, data: fallbackResult, fromCache: true };
        } else {
          return { success: true, data: undefined };
        }
      }

    } catch (error) {
      console.error('❌ REDIS_GET_ERROR:', error);
      
      // Try fallback
      const fallbackResult = this.getFallback<T>(key);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: fallbackResult
      };
    }
  }

  /**
   * 🔢 Increment by float (for metrics)
   */
  async incrByFloat(key: string, increment: number): Promise<CacheResult<number>> {
    try {
      if (this.connected && this.client) {
        const result = await this.client.incrbyfloat(key, increment);
        return { success: true, data: parseFloat(result) };
      } else {
        // Fallback: get current value, increment, set
        const current = await this.get<number>(key);
        const newValue = (current.data || 0) + increment;
        await this.set(key, newValue, 3600);
        return { success: true, data: newValue };
      }

    } catch (error) {
      console.error('❌ REDIS_INCRBYFLOAT_ERROR:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 🗑️ Delete cache key
   */
  async del(key: string): Promise<CacheResult<number>> {
    try {
      if (this.connected && this.client) {
        const result = await this.client.del(key);
        return { success: true, data: result };
      } else {
        // Remove from fallback
        const existed = this.fallbackStore.has(key);
        this.fallbackStore.delete(key);
        return { success: true, data: existed ? 1 : 0 };
      }

    } catch (error) {
      console.error('❌ REDIS_DEL_ERROR:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 🏥 Health check (cloud-safe)
   */
  async health(): Promise<HealthStatus> {
    try {
      if (!this.client) {
        return { 
          connected: false, 
          error: 'Redis client not initialized' 
        };
      }

      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      // Try to get Redis version safely (avoid CONFIG commands)
      let version = 'unknown';
      try {
        const info = await this.client.call('INFO', 'server');
        const versionMatch = info.toString().match(/redis_version:([^\r\n]+)/);
        if (versionMatch) {
          version = versionMatch[1];
        }
      } catch (infoError) {
        // INFO might be disabled in some managed Redis
        console.log('⚠️ REDIS_INFO: Command unavailable (managed Redis)');
      }

      return {
        connected: true,
        latency,
        version
      };

    } catch (error) {
      console.error('❌ REDIS_HEALTH_ERROR:', error);
      
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 💾 Fallback in-memory storage
   */
  private setFallback(key: string, value: any, ttlSeconds: number): void {
    // Clean expired entries if store is getting large
    if (this.fallbackStore.size >= this.FALLBACK_MAX_SIZE) {
      this.cleanupFallback();
    }

    const expires = Date.now() + (ttlSeconds * 1000);
    this.fallbackStore.set(key, { value, expires });
  }

  private getFallback<T>(key: string): T | undefined {
    const entry = this.fallbackStore.get(key);
    
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expires) {
      this.fallbackStore.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  private cleanupFallback(): void {
    const now = Date.now();
    for (const [key, entry] of this.fallbackStore) {
      if (now > entry.expires) {
        this.fallbackStore.delete(key);
      }
    }
  }

  /**
   * 🔌 Get connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 🔗 Get raw client (for advanced operations)
   */
  getRawClient(): Redis | null {
    return this.client;
  }
}

// Export singleton instance
export const redisCache = HardenedRedisCache.getInstance();
export default redisCache;
