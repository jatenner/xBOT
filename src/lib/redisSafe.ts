/**
 * Cloud-Safe Redis Client for xBOT
 * Avoids CONFIG commands that are restricted in managed Redis
 */

import Redis from 'ioredis';

export interface RedisMemoryStats {
  used_memory_human: string;
  used_memory: number;
  maxmemory_human?: string;
  maxmemory?: number;
}

export interface SafeRedisClient {
  // Core operations
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  
  // JSON helpers
  getJSON<T>(key: string): Promise<T | null>;
  setJSON<T>(key: string, value: T, ttl?: number): Promise<void>;
  
  // Numeric operations
  incr(key: string): Promise<number>;
  incrByFloat(key: string, increment: number): Promise<number>;
  
  // Memory and info
  getMemoryStats(): Promise<RedisMemoryStats>;
  ping(): Promise<string>;
  
  // Cleanup
  quit(): Promise<void>;
  
  // Fallback mode
  isConnected(): boolean;
  isFallbackMode(): boolean;
}

class CloudSafeRedis implements SafeRedisClient {
  private client: Redis | null = null;
  private fallbackStore: Map<string, { value: string; expiry?: number }> = new Map();
  private fallbackMode = false;
  private connectionAttempts = 0;
  private maxRetries = 3;
  private retryDelay = 2000;
  private lastConnectionAttempt = 0;
  private fallbackWarningLogged = false;

  constructor(redisUrl?: string) {
    if (redisUrl) {
      this.initializeConnection(redisUrl);
    } else {
      this.enableFallbackMode('No Redis URL provided');
    }
  }

  private async initializeConnection(redisUrl: string): Promise<void> {
    const now = Date.now();
    
    // Prevent rapid connection attempts
    if (now - this.lastConnectionAttempt < 5000) {
      return;
    }
    
    this.lastConnectionAttempt = now;

    try {
      console.log('🔌 REDIS_SAFE: Attempting connection...');
      
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 10000,
        commandTimeout: 5000,
        lazyConnect: true
      });

      // Connection event handlers
      this.client.on('connect', () => {
        console.log('✅ REDIS_SAFE: Connected successfully');
        this.fallbackMode = false;
        this.connectionAttempts = 0;
      });

      this.client.on('error', (error) => {
        console.warn(`⚠️ REDIS_SAFE: Connection error - ${error.message}`);
        this.handleConnectionError();
      });

      this.client.on('close', () => {
        console.warn('🔌 REDIS_SAFE: Connection closed');
        this.handleConnectionError();
      });

      // Test connection
      await this.client.connect();
      await this.client.ping();
      
    } catch (error) {
      console.warn(`❌ REDIS_SAFE: Connection failed - ${error instanceof Error ? error.message : error}`);
      this.handleConnectionError();
    }
  }

  private handleConnectionError(): void {
    this.connectionAttempts++;
    
    if (this.connectionAttempts >= this.maxRetries) {
      this.enableFallbackMode(`Failed after ${this.maxRetries} attempts`);
    } else {
      // Retry with exponential backoff
      const delay = this.retryDelay * Math.pow(2, this.connectionAttempts - 1);
      setTimeout(() => {
        if (process.env.REDIS_URL) {
          this.initializeConnection(process.env.REDIS_URL);
        }
      }, delay);
    }
  }

  private enableFallbackMode(reason: string): void {
    this.fallbackMode = true;
    
    if (!this.fallbackWarningLogged) {
      console.warn(`⚠️ REDIS_SAFE: Fallback to in-memory mode - ${reason}`);
      this.fallbackWarningLogged = true;
    }
    
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
  }

  // Core operations
  async get(key: string): Promise<string | null> {
    if (this.fallbackMode) {
      const item = this.fallbackStore.get(key);
      if (!item) return null;
      
      if (item.expiry && Date.now() > item.expiry) {
        this.fallbackStore.delete(key);
        return null;
      }
      
      return item.value;
    }

    try {
      return await this.client!.get(key);
    } catch (error) {
      console.warn(`⚠️ REDIS_SAFE: GET failed for ${key}, using fallback`);
      this.handleConnectionError();
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (this.fallbackMode) {
      const item: { value: string; expiry?: number } = { value };
      
      if (ttl && ttl > 0) {
        item.expiry = Date.now() + (ttl * 1000);
      }
      
      this.fallbackStore.set(key, item);
      return;
    }

    try {
      if (ttl && ttl > 0) {
        await this.client!.setex(key, ttl, value);
      } else {
        await this.client!.set(key, value);
      }
    } catch (error) {
      console.warn(`⚠️ REDIS_SAFE: SET failed for ${key}, using fallback`);
      this.handleConnectionError();
      
      // Store in fallback
      const item: { value: string; expiry?: number } = { value };
      if (ttl && ttl > 0) {
        item.expiry = Date.now() + (ttl * 1000);
      }
      this.fallbackStore.set(key, item);
    }
  }

  async del(key: string): Promise<number> {
    if (this.fallbackMode) {
      const existed = this.fallbackStore.has(key);
      this.fallbackStore.delete(key);
      return existed ? 1 : 0;
    }

    try {
      return await this.client!.del(key);
    } catch (error) {
      console.warn(`⚠️ REDIS_SAFE: DEL failed for ${key}, using fallback`);
      this.handleConnectionError();
      
      const existed = this.fallbackStore.has(key);
      this.fallbackStore.delete(key);
      return existed ? 1 : 0;
    }
  }

  async exists(key: string): Promise<number> {
    if (this.fallbackMode) {
      const item = this.fallbackStore.get(key);
      if (!item) return 0;
      
      if (item.expiry && Date.now() > item.expiry) {
        this.fallbackStore.delete(key);
        return 0;
      }
      
      return 1;
    }

    try {
      return await this.client!.exists(key);
    } catch (error) {
      console.warn(`⚠️ REDIS_SAFE: EXISTS failed for ${key}, using fallback`);
      this.handleConnectionError();
      return 0;
    }
  }

  async ttl(key: string): Promise<number> {
    if (this.fallbackMode) {
      const item = this.fallbackStore.get(key);
      if (!item) return -2; // Key doesn't exist
      
      if (!item.expiry) return -1; // No expiry
      
      const remaining = Math.ceil((item.expiry - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    }

    try {
      return await this.client!.ttl(key);
    } catch (error) {
      console.warn(`⚠️ REDIS_SAFE: TTL failed for ${key}, using fallback`);
      this.handleConnectionError();
      return -2;
    }
  }

  // JSON helpers
  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn(`⚠️ REDIS_SAFE: Invalid JSON for key ${key}`);
      return null;
    }
  }

  async setJSON<T>(key: string, value: T, ttl?: number): Promise<void> {
    const jsonString = JSON.stringify(value);
    await this.set(key, jsonString, ttl);
  }

  // Numeric operations
  async incr(key: string): Promise<number> {
    if (this.fallbackMode) {
      const current = parseInt(await this.get(key) || '0', 10);
      const newValue = current + 1;
      await this.set(key, newValue.toString());
      return newValue;
    }

    try {
      return await this.client!.incr(key);
    } catch (error) {
      console.warn(`⚠️ REDIS_SAFE: INCR failed for ${key}, using fallback`);
      this.handleConnectionError();
      
      const current = parseInt(await this.get(key) || '0', 10);
      const newValue = current + 1;
      await this.set(key, newValue.toString());
      return newValue;
    }
  }

  async incrByFloat(key: string, increment: number): Promise<number> {
    if (this.fallbackMode) {
      const current = parseFloat(await this.get(key) || '0');
      const newValue = current + increment;
      await this.set(key, newValue.toString());
      return newValue;
    }

    try {
      const result = await this.client!.incrbyfloat(key, increment);
      return parseFloat(result);
    } catch (error) {
      console.warn(`⚠️ REDIS_SAFE: INCRBYFLOAT failed for ${key}, using fallback`);
      this.handleConnectionError();
      
      const current = parseFloat(await this.get(key) || '0');
      const newValue = current + increment;
      await this.set(key, newValue.toString());
      return newValue;
    }
  }

  // Memory stats using INFO MEMORY (cloud-safe)
  async getMemoryStats(): Promise<RedisMemoryStats> {
    if (this.fallbackMode) {
      const estimatedSize = this.fallbackStore.size * 100; // Rough estimate
      return {
        used_memory_human: `${Math.round(estimatedSize / 1024)}K`,
        used_memory: estimatedSize,
        maxmemory_human: 'fallback',
        maxmemory: -1
      };
    }

    try {
      const info = await this.client!.info('memory');
      const stats: RedisMemoryStats = {
        used_memory_human: 'unknown',
        used_memory: 0
      };

      // Parse INFO MEMORY response
      const lines = info.split('\r\n');
      for (const line of lines) {
        if (line.startsWith('used_memory_human:')) {
          stats.used_memory_human = line.split(':')[1];
        } else if (line.startsWith('used_memory:')) {
          stats.used_memory = parseInt(line.split(':')[1], 10);
        } else if (line.startsWith('maxmemory_human:')) {
          stats.maxmemory_human = line.split(':')[1];
        } else if (line.startsWith('maxmemory:')) {
          stats.maxmemory = parseInt(line.split(':')[1], 10);
        }
      }

      return stats;
    } catch (error) {
      console.warn(`⚠️ REDIS_SAFE: Memory stats failed, using fallback`);
      this.handleConnectionError();
      
      const estimatedSize = this.fallbackStore.size * 100;
      return {
        used_memory_human: `${Math.round(estimatedSize / 1024)}K`,
        used_memory: estimatedSize,
        maxmemory_human: 'fallback',
        maxmemory: -1
      };
    }
  }

  async ping(): Promise<string> {
    if (this.fallbackMode) {
      return 'PONG (fallback)';
    }

    try {
      return await this.client!.ping();
    } catch (error) {
      console.warn(`⚠️ REDIS_SAFE: PING failed, using fallback`);
      this.handleConnectionError();
      return 'PONG (fallback)';
    }
  }

  async quit(): Promise<void> {
    if (this.client && !this.fallbackMode) {
      try {
        await this.client.quit();
      } catch (error) {
        // Ignore errors during quit
      }
    }
    
    this.fallbackStore.clear();
  }

  isConnected(): boolean {
    return !this.fallbackMode && this.client?.status === 'ready';
  }

  isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  // Cleanup expired fallback items periodically
  private cleanupFallback(): void {
    if (!this.fallbackMode) return;
    
    const now = Date.now();
    for (const [key, item] of this.fallbackStore.entries()) {
      if (item.expiry && now > item.expiry) {
        this.fallbackStore.delete(key);
      }
    }
  }
}

// Singleton instance
let redisSafeInstance: SafeRedisClient | null = null;

export function createRedisSafeClient(redisUrl?: string): SafeRedisClient {
  if (!redisSafeInstance) {
    redisSafeInstance = new CloudSafeRedis(redisUrl || process.env.REDIS_URL);
    
    // Cleanup fallback items every 5 minutes
    setInterval(() => {
      if (redisSafeInstance && redisSafeInstance.isFallbackMode()) {
        (redisSafeInstance as CloudSafeRedis)['cleanupFallback']?.();
      }
    }, 5 * 60 * 1000);
  }
  
  return redisSafeInstance;
}

export function getRedisSafeClient(): SafeRedisClient {
  if (!redisSafeInstance) {
    redisSafeInstance = createRedisSafeClient();
  }
  return redisSafeInstance;
}

export default createRedisSafeClient;
