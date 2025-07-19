import { systemMonitor } from './systemMonitor';

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number;
  accessCount: number;
  lastAccessed: Date;
  size: number;
  priority: 'high' | 'medium' | 'low';
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  priority?: 'high' | 'medium' | 'low';
  maxSize?: number; // Max cache size in bytes
  serialize?: boolean; // Whether to serialize the data for size calculation
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  topKeys: string[];
}

/**
 * 🧠 INTELLIGENT CACHE SYSTEM
 * 
 * Advanced caching with memory optimization, automatic cleanup, and performance monitoring.
 * Uses LRU with TTL and priority-based eviction strategies.
 */
export class IntelligentCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private hitCount = 0;
  private missCount = 0;
  private maxMemoryUsage: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly defaultTTL = 60 * 60 * 1000; // 1 hour
  private readonly cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes

  constructor(maxMemoryUsageMB: number = 100) {
    this.maxMemoryUsage = maxMemoryUsageMB * 1024 * 1024; // Convert to bytes
    this.startCleanupProcess();
    console.log(`🧠 IntelligentCache: Initialized with ${maxMemoryUsageMB}MB limit`);
  }

  /**
   * 💾 GET FROM CACHE
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp.getTime() > entry.ttl) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = new Date();
    
    this.hitCount++;
    return entry.data;
  }

  /**
   * 💾 SET TO CACHE
   */
  set(key: string, data: T, options: CacheOptions = {}): boolean {
    try {
      const ttl = options.ttl || this.defaultTTL;
      const priority = options.priority || 'medium';
      const size = this.calculateSize(data, options.serialize);

      // Check if adding this entry would exceed memory limit
      if (this.getCurrentSize() + size > this.maxMemoryUsage) {
        console.log('🧠 Cache: Memory limit reached, running cleanup...');
        this.intelligentCleanup();
        
        // If still no space after cleanup, reject
        if (this.getCurrentSize() + size > this.maxMemoryUsage) {
          console.warn(`⚠️ Cache: Cannot store ${key} (${size} bytes) - memory limit exceeded`);
          return false;
        }
      }

      const entry: CacheEntry<T> = {
        data,
        timestamp: new Date(),
        ttl,
        accessCount: 0,
        lastAccessed: new Date(),
        size,
        priority
      };

      this.cache.set(key, entry);
      console.log(`💾 Cached: ${key} (${size} bytes, TTL: ${ttl}ms, Priority: ${priority})`);
      return true;

    } catch (error) {
      console.error(`❌ Cache: Failed to store ${key}:`, error);
      return false;
    }
  }

  /**
   * 🗑️ DELETE FROM CACHE
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`🗑️ Cache: Deleted ${key}`);
    }
    return deleted;
  }

  /**
   * 🎯 SMART GET OR SET
   * Returns cached value or executes provided function and caches the result
   */
  async getOrSet<R = T>(
    key: string, 
    fetchFunction: () => Promise<R>, 
    options: CacheOptions = {}
  ): Promise<R> {
         // Try to get from cache first
     const cached = this.get(key);
     if (cached !== null) {
       console.log(`💾 Cache HIT: ${key}`);
       return cached as unknown as R;
     }

    console.log(`💾 Cache MISS: ${key} - executing fetch function`);
    
         try {
       const result = await fetchFunction();
       this.set(key, result as unknown as T, options);
       return result;
    } catch (error) {
      console.error(`❌ Cache: Fetch function failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 🧹 INTELLIGENT CLEANUP
   * Uses multiple strategies: TTL, LRU, Priority, and Memory pressure
   */
  private intelligentCleanup(): void {
    const startTime = Date.now();
    const initialSize = this.getCurrentSize();
    const initialEntries = this.cache.size;

    console.log(`🧹 Cache cleanup started (${initialEntries} entries, ${Math.round(initialSize / 1024 / 1024)}MB)`);

    // Strategy 1: Remove expired entries
    this.removeExpiredEntries();

    // Strategy 2: If still over limit, use priority-based LRU
    if (this.getCurrentSize() > this.maxMemoryUsage * 0.8) { // 80% threshold
      this.priorityBasedEviction();
    }

    // Strategy 3: If still over limit, aggressive LRU
    if (this.getCurrentSize() > this.maxMemoryUsage * 0.9) { // 90% threshold
      this.aggressiveLRUEviction();
    }

    const finalSize = this.getCurrentSize();
    const finalEntries = this.cache.size;
    const cleanupTime = Date.now() - startTime;

    console.log(`✅ Cache cleanup complete: ${finalEntries} entries (-${initialEntries - finalEntries}), ${Math.round(finalSize / 1024 / 1024)}MB (-${Math.round((initialSize - finalSize) / 1024 / 1024)}MB) in ${cleanupTime}ms`);

    // Track cleanup performance
    systemMonitor.addAlert('info', 'IntelligentCache', 'Cleanup completed', 
      `Freed ${Math.round((initialSize - finalSize) / 1024 / 1024)}MB in ${cleanupTime}ms`);
  }

  /**
   * 🗑️ REMOVE EXPIRED ENTRIES
   */
  private removeExpiredEntries(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp.getTime() > entry.ttl) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`🗑️ Removed ${expiredCount} expired entries`);
    }
  }

  /**
   * 🎯 PRIORITY-BASED EVICTION
   */
  private priorityBasedEviction(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by priority (low first) and access count (least accessed first)
    entries.sort(([, a], [, b]) => {
      const priorityOrder = { low: 0, medium: 1, high: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // Same priority, sort by access count and recency
      const accessDiff = a.accessCount - b.accessCount;
      if (accessDiff !== 0) return accessDiff;
      
      return a.lastAccessed.getTime() - b.lastAccessed.getTime();
    });

    let freedSpace = 0;
    let removedCount = 0;
    const targetFree = this.maxMemoryUsage * 0.2; // Free 20%

    for (const [key, entry] of entries) {
      if (freedSpace >= targetFree) break;
      
      // Don't remove high priority items unless absolutely necessary
      if (entry.priority === 'high' && freedSpace > 0) continue;
      
      freedSpace += entry.size;
      this.cache.delete(key);
      removedCount++;
    }

    if (removedCount > 0) {
      console.log(`🎯 Priority eviction: Removed ${removedCount} entries, freed ${Math.round(freedSpace / 1024)}KB`);
    }
  }

  /**
   * 🔥 AGGRESSIVE LRU EVICTION
   */
  private aggressiveLRUEviction(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed (oldest first)
    entries.sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

    let freedSpace = 0;
    let removedCount = 0;
    const targetSize = this.maxMemoryUsage * 0.7; // Aggressive: reduce to 70%

    for (const [key, entry] of entries) {
      if (this.getCurrentSize() - freedSpace <= targetSize) break;
      
      freedSpace += entry.size;
      this.cache.delete(key);
      removedCount++;
    }

    if (removedCount > 0) {
      console.log(`🔥 Aggressive LRU: Removed ${removedCount} entries, freed ${Math.round(freedSpace / 1024)}KB`);
    }
  }

  /**
   * 📊 CACHE STATISTICS
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalCalls = this.hitCount + this.missCount;
    
    return {
      totalEntries: this.cache.size,
      totalSize: this.getCurrentSize(),
      hitRate: totalCalls > 0 ? Math.round((this.hitCount / totalCalls) * 100) : 0,
      memoryUsage: Math.round((this.getCurrentSize() / this.maxMemoryUsage) * 100),
      oldestEntry: entries.length > 0 ? 
        new Date(Math.min(...entries.map(e => e.timestamp.getTime()))) : null,
      newestEntry: entries.length > 0 ? 
        new Date(Math.max(...entries.map(e => e.timestamp.getTime()))) : null,
      topKeys: this.getTopAccessedKeys(5)
    };
  }

  /**
   * 🔧 UTILITY METHODS
   */
  
  private calculateSize(data: T, serialize: boolean = false): number {
    try {
      if (serialize) {
        return new Blob([JSON.stringify(data)]).size;
      }
      
      // Rough estimation for common types
      if (typeof data === 'string') {
        return data.length * 2; // UTF-16
      }
      
      if (typeof data === 'number') {
        return 8; // 64-bit number
      }
      
      if (typeof data === 'boolean') {
        return 1;
      }
      
      if (Array.isArray(data)) {
        return data.reduce((size, item) => size + this.calculateSize(item, false), 0);
      }
      
      if (typeof data === 'object' && data !== null) {
        return Object.values(data).reduce((size, value) => size + this.calculateSize(value, false), 0);
      }
      
      return 100; // Default fallback
    } catch (error) {
      return 100; // Fallback if calculation fails
    }
  }

  private getCurrentSize(): number {
    return Array.from(this.cache.values()).reduce((total, entry) => total + entry.size, 0);
  }

  private getTopAccessedKeys(limit: number): string[] {
    const entries = Array.from(this.cache.entries());
    entries.sort(([, a], [, b]) => b.accessCount - a.accessCount);
    return entries.slice(0, limit).map(([key]) => key);
  }

  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      try {
        this.removeExpiredEntries();
        
        // More aggressive cleanup if memory pressure is high
        if (this.getCurrentSize() > this.maxMemoryUsage * 0.8) {
          this.intelligentCleanup();
        }
      } catch (error) {
        console.error('❌ Cache: Cleanup process failed:', error);
      }
    }, this.cleanupIntervalMs);
  }

  /**
   * 🎯 SPECIALIZED CACHE METHODS FOR COMMON USE CASES
   */

  // Cache with automatic refresh
  async cacheWithRefresh<R = T>(
    key: string,
    fetchFunction: () => Promise<R>,
    refreshInterval: number,
    options: CacheOptions = {}
  ): Promise<R> {
    const cached = this.get(key);
    
    if (cached !== null) {
      const entry = this.cache.get(key)!;
      const age = Date.now() - entry.timestamp.getTime();
      
      // If data is old but not expired, refresh in background
      if (age > refreshInterval && age < entry.ttl) {
                 console.log(`🔄 Background refresh triggered for ${key}`);
         fetchFunction().then(result => {
           this.set(key, result as unknown as T, options);
         }).catch(error => {
           console.warn(`⚠️ Background refresh failed for ${key}:`, error);
         });
       }
       
       return cached as unknown as R;
    }

    return this.getOrSet(key, fetchFunction, options);
  }

  // Cache for learning data with high priority
  setLearningData(key: string, data: T, ttl: number = 24 * 60 * 60 * 1000): boolean {
    return this.set(key, data, {
      ttl,
      priority: 'high',
      serialize: true
    });
  }

  // Cache for content with medium priority
  setContentData(key: string, data: T, ttl: number = 60 * 60 * 1000): boolean {
    return this.set(key, data, {
      ttl,
      priority: 'medium',
      serialize: false
    });
  }

  // Cache for temporary data with low priority
  setTemporaryData(key: string, data: T, ttl: number = 5 * 60 * 1000): boolean {
    return this.set(key, data, {
      ttl,
      priority: 'low',
      serialize: false
    });
  }

  /**
   * 🛑 CLEANUP AND SHUTDOWN
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    console.log('🧠 Cache: Cleared all entries');
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
    console.log('🛑 IntelligentCache: Shutdown complete');
  }

  /**
   * 📊 MONITORING INTEGRATION
   */
  reportMetrics(): void {
    const stats = this.getStats();
    
    // Report to system monitor
    systemMonitor.addAlert('info', 'IntelligentCache', 'Cache metrics', 
      `${stats.totalEntries} entries, ${stats.hitRate}% hit rate, ${stats.memoryUsage}% memory`);

    // Log detailed stats
    console.log('📊 Cache Statistics:', {
      entries: stats.totalEntries,
      sizeMB: Math.round(stats.totalSize / 1024 / 1024),
      hitRate: `${stats.hitRate}%`,
      memoryUsage: `${stats.memoryUsage}%`,
      topKeys: stats.topKeys
    });
  }
}

// Export singleton instances for different use cases
export const contentCache = new IntelligentCache(50); // 50MB for content
export const learningCache = new IntelligentCache(30); // 30MB for learning data
export const temporaryCache = new IntelligentCache(20); // 20MB for temporary data

// Combined cache manager
export class CacheManager {
  static async initialize(): Promise<void> {
    console.log('🧠 CacheManager: Initializing all cache systems...');
    
    // Start metrics reporting
    setInterval(() => {
      contentCache.reportMetrics();
      learningCache.reportMetrics();
      temporaryCache.reportMetrics();
    }, 10 * 60 * 1000); // Report every 10 minutes

    console.log('✅ CacheManager: All cache systems initialized');
  }

  static getGlobalStats() {
    return {
      content: contentCache.getStats(),
      learning: learningCache.getStats(),
      temporary: temporaryCache.getStats()
    };
  }

  static shutdown(): void {
    contentCache.shutdown();
    learningCache.shutdown();
    temporaryCache.shutdown();
    console.log('🛑 CacheManager: All caches shutdown');
  }
} 