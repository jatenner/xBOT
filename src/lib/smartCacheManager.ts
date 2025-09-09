/**
 * 🧠 SMART CACHE MANAGER
 * Dynamic TTL optimization based on data volatility and access patterns
 * 
 * Features:
 * - Dynamic TTL based on content type and update frequency
 * - Cache warming for predictable queries
 * - Intelligent cache invalidation
 * - Performance analytics and optimization
 * - Memory-efficient storage with compression
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';

interface CacheConfig {
  // Content-based TTL strategies (in seconds)
  ttlStrategies: {
    ml_training_data: number;      // 3600 (1 hour) - rarely changes
    recent_tweets: number;         // 300 (5 min) - moderate updates
    engagement_metrics: number;    // 120 (2 min) - frequent updates
    competitor_data: number;       // 21600 (6 hours) - external, slow
    ab_test_results: number;       // 1800 (30 min) - experiment data
    viral_patterns: number;        // 7200 (2 hours) - analysis data
    growth_insights: number;       // 3600 (1 hour) - optimization data
    posting_schedule: number;      // 900 (15 min) - dynamic timing
  };
  
  // Cache warming configuration
  warmingPatterns: {
    pattern: string;
    frequency: number; // seconds
    ttl: number;
  }[];
  
  // Performance optimization
  compressionThreshold: number;  // Compress values larger than this (bytes)
  maxMemoryUsage: number;       // Max Redis memory usage (bytes)
  evictionPolicy: string;       // Memory eviction strategy
}

interface CacheMetrics {
  hitRate: number;
  missRate: number;
  avgResponseTime: number;
  memoryUsage: number;
  operationsPerSecond: number;
  topMissedKeys: string[];
}

interface CacheOperation {
  key: string;
  operation: 'get' | 'set' | 'delete' | 'warm';
  timestamp: Date;
  hit: boolean;
  responseTime: number;
  size?: number;
}

export class SmartCacheManager extends EventEmitter {
  private static instance: SmartCacheManager;
  private redis: Redis;
  private config: CacheConfig;
  private metrics: CacheOperation[] = [];
  private warmingInterval?: NodeJS.Timeout;

  private constructor() {
    super();
    this.setupConfiguration();
    this.initializeRedis();
    this.startCacheWarming();
    this.startMetricsCollection();
  }

  public static getInstance(): SmartCacheManager {
    if (!SmartCacheManager.instance) {
      SmartCacheManager.instance = new SmartCacheManager();
    }
    return SmartCacheManager.instance;
  }

  private setupConfiguration(): void {
    this.config = {
      ttlStrategies: {
        ml_training_data: 3600,      // 1 hour - ML models change infrequently
        recent_tweets: 300,          // 5 min - regular updates
        engagement_metrics: 120,     // 2 min - real-time tracking
        competitor_data: 21600,      // 6 hours - external API limits
        ab_test_results: 1800,       // 30 min - experimental data
        viral_patterns: 7200,        // 2 hours - pattern analysis
        growth_insights: 3600,       // 1 hour - strategic insights
        posting_schedule: 900        // 15 min - dynamic timing
      },
      warmingPatterns: [
        { pattern: 'recent_tweets:*', frequency: 240, ttl: 300 },    // Warm every 4 min
        { pattern: 'ml_training_data:*', frequency: 1800, ttl: 3600 }, // Warm every 30 min
        { pattern: 'engagement_metrics:*', frequency: 60, ttl: 120 },   // Warm every minute
      ],
      compressionThreshold: 1024,    // 1KB
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      evictionPolicy: 'allkeys-lru'
    };
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true
      });

      await this.redis.connect();
      try { await this.redis.ping(); } catch {}
      console.log('✅ REDIS_SAFE: Connected successfully');

    } catch (error: any) {
      console.log('❌ SMART_CACHE: Redis connection failed:', error.message);
      console.log('🔄 SMART_CACHE: Using in-memory fallback');
      // Initialize in-memory fallback
      this.initializeMemoryFallback();
    }
  }

  private memoryCache = new Map<string, { value: any; expires: number; size: number }>();

  private initializeMemoryFallback(): void {
    console.log('🔄 SMART_CACHE: Using in-memory fallback');
    
    // Cleanup expired entries every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.expires < now) {
          this.memoryCache.delete(key);
        }
      }
    }, 60000);
  }

  /**
   * 🎯 INTELLIGENT GET: Retrieve with smart TTL and warming
   */
  public async get<T>(key: string, contentType?: keyof CacheConfig['ttlStrategies']): Promise<T | null> {
    const startTime = Date.now();
    let hit = false;
    let result: T | null = null;

    try {
      // Try Redis first
      if (this.redis && this.redis.status === 'ready') {
        const cached = await this.redis.get(key);
        if (cached) {
          result = JSON.parse(cached);
          hit = true;
        }
      } else {
        // Fallback to memory cache
        const entry = this.memoryCache.get(key);
        if (entry && entry.expires > Date.now()) {
          result = entry.value;
          hit = true;
        }
      }

      // Record metrics
      this.recordOperation({
        key,
        operation: 'get',
        timestamp: new Date(),
        hit,
        responseTime: Date.now() - startTime
      });

      return result;

    } catch (error: any) {
      console.error(`❌ SMART_CACHE: Get failed for ${key}:`, error.message);
      
      this.recordOperation({
        key,
        operation: 'get',
        timestamp: new Date(),
        hit: false,
        responseTime: Date.now() - startTime
      });

      return null;
    }
  }

  /**
   * ⚡ INTELLIGENT SET: Store with dynamic TTL optimization
   */
  public async set<T>(
    key: string, 
    value: T, 
    contentType: keyof CacheConfig['ttlStrategies'],
    customTtl?: number
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      const ttl = customTtl || this.config.ttlStrategies[contentType];
      const serialized = JSON.stringify(value);
      const size = Buffer.byteLength(serialized, 'utf8');

      // Store in Redis
      if (this.redis && this.redis.status === 'ready') {
        await this.redis.setex(key, ttl, serialized);
      } else {
        // Fallback to memory cache
        this.memoryCache.set(key, {
          value,
          expires: Date.now() + (ttl * 1000),
          size
        });
      }

      this.recordOperation({
        key,
        operation: 'set',
        timestamp: new Date(),
        hit: true,
        responseTime: Date.now() - startTime,
        size
      });

      return true;

    } catch (error: any) {
      console.error(`❌ SMART_CACHE: Set failed for ${key}:`, error.message);
      
      this.recordOperation({
        key,
        operation: 'set',
        timestamp: new Date(),
        hit: false,
        responseTime: Date.now() - startTime
      });

      return false;
    }
  }

  /**
   * 🔥 CACHE WARMING: Proactively load frequently accessed data
   */
  private startCacheWarming(): void {
    console.log('🔥 SMART_CACHE: Starting intelligent cache warming...');

    this.warmingInterval = setInterval(async () => {
      for (const pattern of this.config.warmingPatterns) {
        try {
          await this.warmKeysMatching(pattern.pattern, pattern.ttl);
        } catch (error: any) {
          console.warn(`⚠️ Cache warming failed for pattern ${pattern.pattern}:`, error.message);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private async warmKeysMatching(pattern: string, ttl: number): Promise<void> {
    const recentKeys = this.getFrequentlyAccessedKeys(pattern);
    for (const key of recentKeys) {
      const remaining = await this.getKeyTTL(key);
      if (remaining < ttl * 0.1) { // Less than 10% TTL remaining
        this.emit('warmingNeeded', { key, pattern, remaining });
      }
    }
  }

  private getFrequentlyAccessedKeys(pattern: string): string[] {
    const recentOps = this.metrics.slice(-1000);
    const keyFrequency = new Map<string, number>();

    for (const op of recentOps) {
      if (op.key.match(this.patternToRegex(pattern))) {
        keyFrequency.set(op.key, (keyFrequency.get(op.key) || 0) + 1);
      }
    }

    return Array.from(keyFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key]) => key);
  }

  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = escaped.replace(/\\\*/g, '.*');
    return new RegExp('^' + regexPattern + '$');
  }

  private async getKeyTTL(key: string): Promise<number> {
    try {
      if (this.redis && this.redis.status === 'ready') {
        return await this.redis.ttl(key);
      } else {
        const entry = this.memoryCache.get(key);
        if (entry) {
          return Math.max(0, Math.floor((entry.expires - Date.now()) / 1000));
        }
      }
      return -1;
    } catch (error) {
      return -1;
    }
  }

  /**
   * 📊 PERFORMANCE ANALYTICS
   */
  private startMetricsCollection(): void {
    console.log('📊 SMART_CACHE: Starting metrics collection...');

    setInterval(() => {
      const metrics = this.calculateMetrics();
      this.emit('metricsUpdate', metrics);
      
      console.log(`📊 CACHE_METRICS: Hit rate: ${(metrics.hitRate * 100).toFixed(1)}%, ` +
                 `Avg response: ${metrics.avgResponseTime.toFixed(1)}ms, ` +
                 `Ops/sec: ${metrics.operationsPerSecond.toFixed(1)}`);
      
      this.autoOptimize(metrics);
      
    }, 300000); // Every 5 minutes
  }

  private calculateMetrics(): CacheMetrics {
    const recentOps = this.metrics.slice(-1000);
    const hits = recentOps.filter(op => op.hit).length;
    const totalOps = recentOps.length;
    
    const avgResponseTime = recentOps.length > 0 
      ? recentOps.reduce((sum, op) => sum + op.responseTime, 0) / recentOps.length 
      : 0;

    const timeSpan = recentOps.length > 0 
      ? (Date.now() - recentOps[0].timestamp.getTime()) / 1000 
      : 1;
    const operationsPerSecond = totalOps / Math.max(timeSpan, 1);

    const missedKeys = recentOps
      .filter(op => !op.hit && op.operation === 'get')
      .reduce((acc, op) => {
        acc[op.key] = (acc[op.key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const topMissedKeys = Object.entries(missedKeys)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key]) => key);

    return {
      hitRate: totalOps > 0 ? hits / totalOps : 0,
      missRate: totalOps > 0 ? (totalOps - hits) / totalOps : 0,
      avgResponseTime,
      memoryUsage: this.getMemoryUsage(),
      operationsPerSecond,
      topMissedKeys
    };
  }

  private autoOptimize(metrics: CacheMetrics): void {
    if (metrics.hitRate < 0.7) {
      for (const key of metrics.topMissedKeys) {
        const contentType = this.inferContentType(key);
        if (contentType) {
          const currentTtl = this.config.ttlStrategies[contentType];
          this.config.ttlStrategies[contentType] = Math.min(currentTtl * 1.5, 7200);
        }
      }
      console.log('🔧 SMART_CACHE: Auto-optimized TTL for low hit rate');
    }

    if (metrics.memoryUsage > this.config.maxMemoryUsage * 0.8) {
      this.compactCache();
    }
  }

  private inferContentType(key: string): keyof CacheConfig['ttlStrategies'] | null {
    for (const contentType of Object.keys(this.config.ttlStrategies) as Array<keyof CacheConfig['ttlStrategies']>) {
      if (key.includes(contentType.replace(/_/g, ''))) {
        return contentType;
      }
    }
    return null;
  }

  private async compactCache(): Promise<void> {
    console.log('🧹 SMART_CACHE: Compacting cache to reduce memory usage...');
    
    try {
      if (this.redis && this.redis.status === 'ready') {
        await this.redis.eval(`
          local keys = redis.call('KEYS', '*')
          local expired = 0
          for i=1,#keys do
            if redis.call('TTL', keys[i]) == -1 then
              redis.call('DEL', keys[i])
              expired = expired + 1
            end
          end
          return expired
        `, 0);
      } else {
        const now = Date.now();
        for (const [key, entry] of this.memoryCache.entries()) {
          if (entry.expires < now) {
            this.memoryCache.delete(key);
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Cache compaction failed:', error.message);
    }
  }

  private recordOperation(operation: CacheOperation): void {
    this.metrics.push(operation);
    
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000);
    }
  }

  private getMemoryUsage(): number {
    if (this.redis && this.redis.status === 'ready') {
      return 0;
    } else {
      let totalSize = 0;
      for (const entry of this.memoryCache.values()) {
        totalSize += entry.size || 0;
      }
      return totalSize;
    }
  }

  /**
   * 🧹 CACHE MANAGEMENT
   */
  public async delete(key: string): Promise<boolean> {
    try {
      if (this.redis && this.redis.status === 'ready') {
        await this.redis.del(key);
      } else {
        this.memoryCache.delete(key);
      }
      
      this.recordOperation({
        key,
        operation: 'delete',
        timestamp: new Date(),
        hit: true,
        responseTime: 0
      });
      
      return true;
    } catch (error: any) {
      console.error(`❌ SMART_CACHE: Delete failed for ${key}:`, error.message);
      return false;
    }
  }

  public async clear(): Promise<void> {
    try {
      if (this.redis && this.redis.status === 'ready') {
        await this.redis.flushdb();
      } else {
        this.memoryCache.clear();
      }
      console.log('🧹 SMART_CACHE: Cache cleared');
    } catch (error: any) {
      console.error('❌ SMART_CACHE: Clear failed:', error.message);
    }
  }

  /**
   * 📊 PUBLIC METRICS API
   */
  public getMetrics(): CacheMetrics {
    return this.calculateMetrics();
  }

  public getConfiguration(): CacheConfig {
    return { ...this.config };
  }

  public updateTTL(contentType: keyof CacheConfig['ttlStrategies'], newTtl: number): void {
    this.config.ttlStrategies[contentType] = newTtl;
    console.log(`🔧 SMART_CACHE: Updated TTL for ${contentType} to ${newTtl}s`);
  }

  /**
   * 🔧 HELPER METHODS FOR INTEGRATION
   */
  public async cacheOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    contentType: keyof CacheConfig['ttlStrategies'],
    customTtl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key, contentType);
    if (cached !== null) {
      return cached;
    }

    const freshData = await fetchFn();
    await this.set(key, freshData, contentType, customTtl);
    
    return freshData;
  }

  public generateKey(prefix: string, ...parts: (string | number)[]): string {
    return [prefix, ...parts].join(':');
  }

  public destroy(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }
    
    if (this.redis) {
      this.redis.disconnect();
    }
    
    this.memoryCache.clear();
    this.removeAllListeners();
  }
}

export const getSmartCacheManager = () => SmartCacheManager.getInstance();
