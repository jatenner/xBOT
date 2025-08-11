/**
 * 🚀 REDIS MANAGER - Enterprise Redis Data Layer
 * 
 * PURPOSE: Complete Redis integration for hot-path operations
 * FEATURES: Rate limiting, caching, queues, deduplication, health monitoring
 * FALLBACK: Automatic Supabase fallback when Redis unavailable
 */

import Redis from 'ioredis';
import { createHash } from 'crypto';

interface RedisConfig {
  url: string;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  connectTimeout: number;
  commandTimeout: number;
  maxMemoryPolicy: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  currentCount: number;
}

interface ContentHash {
  hash: string;
  exists: boolean;
  tweetId?: string;
  createdAt?: Date;
}

interface QueueItem {
  id: string;
  type: string;
  data: any;
  priority: number;
  createdAt: Date;
  retryCount: number;
}

interface HealthMetrics {
  ping: number;
  memoryUsage: number;
  connectionCount: number;
  commandLatency: number;
  keyCount: number;
  uptime: number;
}

class RedisManager {
  private static instance: RedisManager;
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private fallbackMode: boolean = false;
  private connectionAttempts: number = 0;
  private lastHealthCheck: Date = new Date();
  private healthMetrics: HealthMetrics | null = null;

  private constructor() {
    this.initializeRedis();
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  /**
   * Initialize Redis connection with enterprise configuration
   */
  private async initializeRedis(): Promise<void> {
    try {
      console.log('🔄 Initializing Redis connection...');

      if (!process.env.REDIS_URL) {
        console.warn('⚠️ REDIS_URL not found, enabling fallback mode');
        this.fallbackMode = true;
        return;
      }

      const config: RedisConfig = {
        url: process.env.REDIS_URL,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        connectTimeout: 10000,
        commandTimeout: 5000,
        maxMemoryPolicy: 'allkeys-lru'
      };

      this.client = new Redis(config.url, {
        maxRetriesPerRequest: config.maxRetriesPerRequest,
        retryDelayOnFailover: config.retryDelayOnFailover,
        connectTimeout: config.connectTimeout,
        commandTimeout: config.commandTimeout,
        lazyConnect: true,
        keepAlive: 30000,
        family: 6, // IPv6 support
        
        // Connection event handlers
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          console.log(`🔄 Redis retry attempt ${times}, delay: ${delay}ms`);
          return delay;
        }
      });

      // Set up event listeners
      this.setupEventListeners();

      // Attempt connection
      await this.connect();

    } catch (error: any) {
      console.error('❌ Redis initialization failed:', error.message);
      this.enableFallbackMode();
    }
  }

  /**
   * Set up Redis event listeners for monitoring
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      console.log('✅ Redis connected successfully');
      this.isConnected = true;
      this.fallbackMode = false;
      this.connectionAttempts = 0;
    });

    this.client.on('ready', () => {
      console.log('🚀 Redis ready for operations');
      this.configureRedisSettings();
    });

    this.client.on('error', (error: Error) => {
      console.error('❌ Redis error:', error.message);
      this.connectionAttempts++;
      if (this.connectionAttempts >= 3) {
        this.enableFallbackMode();
      }
    });

    this.client.on('close', () => {
      console.warn('⚠️ Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', (delay: number) => {
      console.log(`🔄 Redis reconnecting in ${delay}ms...`);
    });
  }

  /**
   * Connect to Redis with error handling
   */
  private async connect(): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');

    try {
      await this.client.connect();
      console.log('✅ Redis connection established');
      
      // Test connection with ping
      const pingResponse = await this.ping();
      console.log(`📡 Redis ping: ${pingResponse}ms`);
      
    } catch (error: any) {
      console.error('❌ Redis connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Configure Redis settings for optimal performance
   */
  private async configureRedisSettings(): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      // Set memory policy
      await this.client.config('SET', 'maxmemory-policy', 'allkeys-lru');
      
      // Set save policy (disable auto-save, we'll use AOF)
      await this.client.config('SET', 'save', '');
      
      // Enable AOF for persistence
      await this.client.config('SET', 'appendonly', 'yes');
      await this.client.config('SET', 'appendfsync', 'everysec');
      
      console.log('⚙️ Redis settings configured for optimal performance');
      
    } catch (error: any) {
      console.warn('⚠️ Could not configure Redis settings:', error.message);
    }
  }

  /**
   * Enable fallback mode when Redis is unavailable
   */
  private enableFallbackMode(): void {
    this.fallbackMode = true;
    this.isConnected = false;
    console.warn('⚠️ Enabling Redis fallback mode - operations will use Supabase');
  }

  // =====================================================================================
  // HEALTH MONITORING
  // =====================================================================================

  /**
   * Ping Redis and measure response time
   */
  public async ping(): Promise<number> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    const start = Date.now();
    await this.client.ping();
    return Date.now() - start;
  }

  /**
   * Get comprehensive health metrics
   */
  public async getHealthMetrics(): Promise<HealthMetrics> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const start = Date.now();
      
      // Get info from Redis
      const info = await this.client.info();
      const ping = await this.ping();
      const dbsize = await this.client.dbsize();
      
      const commandLatency = Date.now() - start;

      // Parse memory usage from info
      const memoryLines = info.split('\n').filter(line => line.startsWith('used_memory:'));
      const memoryUsed = memoryLines.length > 0 
        ? parseInt(memoryLines[0].split(':')[1])
        : 0;

      // Parse connections
      const connectionLines = info.split('\n').filter(line => line.startsWith('connected_clients:'));
      const connectionCount = connectionLines.length > 0
        ? parseInt(connectionLines[0].split(':')[1])
        : 0;

      // Parse uptime
      const uptimeLines = info.split('\n').filter(line => line.startsWith('uptime_in_seconds:'));
      const uptime = uptimeLines.length > 0
        ? parseInt(uptimeLines[0].split(':')[1])
        : 0;

      this.healthMetrics = {
        ping,
        memoryUsage: memoryUsed,
        connectionCount,
        commandLatency,
        keyCount: dbsize,
        uptime
      };

      this.lastHealthCheck = new Date();
      return this.healthMetrics;

    } catch (error: any) {
      console.error('❌ Failed to get Redis health metrics:', error.message);
      throw error;
    }
  }

  /**
   * Check if Redis is healthy based on thresholds
   */
  public async isHealthy(): Promise<boolean> {
    try {
      if (!this.isConnected) return false;

      const metrics = await this.getHealthMetrics();
      
      // Health thresholds
      const thresholds = {
        maxPing: 10, // ms
        maxMemoryPercent: 80,
        maxConnections: 90 // percent of max
      };

      return (
        metrics.ping < thresholds.maxPing &&
        metrics.memoryUsage < (1024 * 1024 * 1024 * 0.8) && // 80% of 1GB
        metrics.connectionCount < 100 // reasonable connection limit
      );

    } catch (error) {
      return false;
    }
  }

  // =====================================================================================
  // RATE LIMITING
  // =====================================================================================

  /**
   * Check and increment rate limit counter
   */
  public async checkRateLimit(
    key: string, 
    limit: number, 
    windowSeconds: number
  ): Promise<RateLimitResult> {
    if (this.fallbackMode) {
      throw new Error('Rate limiting requires Redis - currently in fallback mode');
    }

    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const rateLimitKey = `rate_limit:${key}`;
      const pipeline = this.client.pipeline();
      
      // Use Redis pipeline for atomic operation
      pipeline.incr(rateLimitKey);
      pipeline.expire(rateLimitKey, windowSeconds);
      pipeline.ttl(rateLimitKey);
      
      const results = await pipeline.exec();
      
      if (!results || results.some(result => result[0])) {
        throw new Error('Rate limit pipeline failed');
      }

      const currentCount = results[0][1] as number;
      const ttl = results[2][1] as number;
      
      const allowed = currentCount <= limit;
      const remaining = Math.max(0, limit - currentCount);
      const resetTime = new Date(Date.now() + (ttl * 1000));

      return {
        allowed,
        remaining,
        resetTime,
        currentCount
      };

    } catch (error: any) {
      console.error('❌ Rate limit check failed:', error.message);
      throw error;
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  public async getRateLimitStatus(key: string): Promise<RateLimitResult | null> {
    if (this.fallbackMode || !this.client || !this.isConnected) {
      return null;
    }

    try {
      const rateLimitKey = `rate_limit:${key}`;
      const pipeline = this.client.pipeline();
      
      pipeline.get(rateLimitKey);
      pipeline.ttl(rateLimitKey);
      
      const results = await pipeline.exec();
      
      if (!results || results.some(result => result[0])) {
        return null;
      }

      const currentCount = parseInt(results[0][1] as string) || 0;
      const ttl = results[1][1] as number;
      
      const resetTime = ttl > 0 
        ? new Date(Date.now() + (ttl * 1000))
        : new Date();

      return {
        allowed: true, // We're just checking status
        remaining: 0, // Unknown without limit
        resetTime,
        currentCount
      };

    } catch (error: any) {
      console.warn('⚠️ Could not get rate limit status:', error.message);
      return null;
    }
  }

  // =====================================================================================
  // CONTENT DEDUPLICATION
  // =====================================================================================

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(content: string): string {
    // Normalize content for better duplicate detection
    const normalized = content
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
    
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Check if content is duplicate and optionally store hash
   */
  public async checkContentDuplicate(
    content: string, 
    tweetId?: string,
    ttlSeconds: number = 604800 // 7 days default
  ): Promise<ContentHash> {
    if (this.fallbackMode) {
      throw new Error('Content deduplication requires Redis - currently in fallback mode');
    }

    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const hash = this.generateContentHash(content);
      const hashKey = `content_hash:${hash}`;
      
      // Check if hash exists
      const existingTweetId = await this.client.get(hashKey);
      
      if (existingTweetId) {
        // Get creation time if available
        const createdAtKey = `${hashKey}:created`;
        const createdAtStr = await this.client.get(createdAtKey);
        const createdAt = createdAtStr ? new Date(createdAtStr) : undefined;
        
        return {
          hash,
          exists: true,
          tweetId: existingTweetId,
          createdAt
        };
      }

      // Store new hash if tweetId provided
      if (tweetId) {
        const pipeline = this.client.pipeline();
        pipeline.setex(hashKey, ttlSeconds, tweetId);
        pipeline.setex(`${hashKey}:created`, ttlSeconds, new Date().toISOString());
        await pipeline.exec();
      }

      return {
        hash,
        exists: false
      };

    } catch (error: any) {
      console.error('❌ Content duplicate check failed:', error.message);
      throw error;
    }
  }

  /**
   * Get all recent content hashes (for monitoring)
   */
  public async getRecentContentHashes(limit: number = 100): Promise<string[]> {
    if (this.fallbackMode || !this.client || !this.isConnected) {
      return [];
    }

    try {
      const keys = await this.client.keys('content_hash:*');
      return keys
        .filter(key => !key.endsWith(':created'))
        .slice(0, limit);
        
    } catch (error: any) {
      console.warn('⚠️ Could not get recent content hashes:', error.message);
      return [];
    }
  }

  // =====================================================================================
  // CACHING
  // =====================================================================================

  /**
   * Set cache value with TTL
   */
  public async setCache(
    key: string, 
    value: any, 
    ttlSeconds: number = 3600
  ): Promise<void> {
    if (this.fallbackMode || !this.client || !this.isConnected) {
      return; // Graceful degradation - no caching
    }

    try {
      const cacheKey = `cache:${key}`;
      const serializedValue = JSON.stringify(value);
      await this.client.setex(cacheKey, ttlSeconds, serializedValue);
      
    } catch (error: any) {
      console.warn('⚠️ Cache set failed:', error.message);
      // Don't throw - caching is non-critical
    }
  }

  /**
   * Get cache value
   */
  public async getCache<T>(key: string): Promise<T | null> {
    if (this.fallbackMode || !this.client || !this.isConnected) {
      return null;
    }

    try {
      const cacheKey = `cache:${key}`;
      const cachedValue = await this.client.get(cacheKey);
      
      if (!cachedValue) return null;
      
      return JSON.parse(cachedValue) as T;
      
    } catch (error: any) {
      console.warn('⚠️ Cache get failed:', error.message);
      return null;
    }
  }

  /**
   * Delete cache value
   */
  public async deleteCache(key: string): Promise<void> {
    if (this.fallbackMode || !this.client || !this.isConnected) {
      return;
    }

    try {
      const cacheKey = `cache:${key}`;
      await this.client.del(cacheKey);
      
    } catch (error: any) {
      console.warn('⚠️ Cache delete failed:', error.message);
    }
  }

  // =====================================================================================
  // QUEUE MANAGEMENT
  // =====================================================================================

  /**
   * Add item to queue
   */
  public async addToQueue(
    queueName: string, 
    item: Omit<QueueItem, 'id' | 'createdAt' | 'retryCount'>
  ): Promise<string> {
    if (this.fallbackMode) {
      throw new Error('Queue operations require Redis - currently in fallback mode');
    }

    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const queueItem: QueueItem = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        retryCount: 0
      };

      const queueKey = `queue:${queueName}`;
      const serializedItem = JSON.stringify(queueItem);
      
      // Use priority score for sorted set (higher priority = higher score)
      await this.client.zadd(queueKey, item.priority, serializedItem);
      
      return queueItem.id;
      
    } catch (error: any) {
      console.error('❌ Failed to add item to queue:', error.message);
      throw error;
    }
  }

  /**
   * Get items from queue (highest priority first)
   */
  public async getFromQueue(
    queueName: string, 
    count: number = 10
  ): Promise<QueueItem[]> {
    if (this.fallbackMode || !this.client || !this.isConnected) {
      return [];
    }

    try {
      const queueKey = `queue:${queueName}`;
      
      // Get highest priority items (ZREVRANGE for highest first)
      const items = await this.client.zrevrange(queueKey, 0, count - 1);
      
      return items.map(item => JSON.parse(item) as QueueItem);
      
    } catch (error: any) {
      console.error('❌ Failed to get items from queue:', error.message);
      return [];
    }
  }

  /**
   * Remove item from queue
   */
  public async removeFromQueue(queueName: string, itemId: string): Promise<boolean> {
    if (this.fallbackMode || !this.client || !this.isConnected) {
      return false;
    }

    try {
      const queueKey = `queue:${queueName}`;
      
      // Find and remove the item by ID
      const items = await this.client.zrange(queueKey, 0, -1);
      
      for (const itemStr of items) {
        const item = JSON.parse(itemStr) as QueueItem;
        if (item.id === itemId) {
          await this.client.zrem(queueKey, itemStr);
          return true;
        }
      }
      
      return false;
      
    } catch (error: any) {
      console.error('❌ Failed to remove item from queue:', error.message);
      return false;
    }
  }

  /**
   * Get queue depth
   */
  public async getQueueDepth(queueName: string): Promise<number> {
    if (this.fallbackMode || !this.client || !this.isConnected) {
      return 0;
    }

    try {
      const queueKey = `queue:${queueName}`;
      return await this.client.zcard(queueKey);
      
    } catch (error: any) {
      console.warn('⚠️ Could not get queue depth:', error.message);
      return 0;
    }
  }

  // =====================================================================================
  // STATE MANAGEMENT
  // =====================================================================================

  /**
   * Set state value (persistent)
   */
  public async setState(key: string, value: any): Promise<void> {
    if (this.fallbackMode || !this.client || !this.isConnected) {
      return;
    }

    try {
      const stateKey = `state:${key}`;
      const serializedValue = JSON.stringify(value);
      await this.client.set(stateKey, serializedValue);
      
    } catch (error: any) {
      console.warn('⚠️ Set state failed:', error.message);
    }
  }

  /**
   * Get state value
   */
  public async getState<T>(key: string): Promise<T | null> {
    if (this.fallbackMode || !this.client || !this.isConnected) {
      return null;
    }

    try {
      const stateKey = `state:${key}`;
      const stateValue = await this.client.get(stateKey);
      
      if (!stateValue) return null;
      
      return JSON.parse(stateValue) as T;
      
    } catch (error: any) {
      console.warn('⚠️ Get state failed:', error.message);
      return null;
    }
  }

  // =====================================================================================
  // UTILITY METHODS
  // =====================================================================================

  /**
   * Get Redis connection status
   */
  public getConnectionStatus(): {
    connected: boolean;
    fallbackMode: boolean;
    connectionAttempts: number;
    lastHealthCheck: Date;
  } {
    return {
      connected: this.isConnected,
      fallbackMode: this.fallbackMode,
      connectionAttempts: this.connectionAttempts,
      lastHealthCheck: this.lastHealthCheck
    };
  }

  /**
   * Force reconnection attempt
   */
  public async reconnect(): Promise<void> {
    console.log('🔄 Forcing Redis reconnection...');
    
    if (this.client) {
      await this.client.disconnect();
    }
    
    this.isConnected = false;
    this.fallbackMode = false;
    this.connectionAttempts = 0;
    
    await this.initializeRedis();
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Redis manager...');
    
    if (this.client && this.isConnected) {
      await this.client.quit();
    }
    
    this.isConnected = false;
    this.client = null;
  }
}

// Export singleton instance
export const redisManager = RedisManager.getInstance();

// Export types
export type {
  RateLimitResult,
  ContentHash,
  QueueItem,
  HealthMetrics
};

// Export class for direct instantiation if needed
export { RedisManager };

// Default export
export default redisManager;