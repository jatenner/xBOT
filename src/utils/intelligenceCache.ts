interface CachedIntelligence {
  trends: any[];
  news: any[];
  engagement: any;
  timestamp: Date;
  expiresAt: Date;
}

interface CacheEntry {
  data: any;
  timestamp: Date;
  expiresAt: Date;
  source: 'trends' | 'news' | 'engagement' | 'schedule';
}

export class IntelligenceCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 4 * 60 * 60 * 1000; // 4 hours
  private readonly CACHE_LIMITS = {
    trends: 6 * 60 * 60 * 1000,     // 6 hours for trends
    news: 2 * 60 * 60 * 1000,      // 2 hours for news
    engagement: 12 * 60 * 60 * 1000, // 12 hours for engagement
    schedule: 24 * 60 * 60 * 1000   // 24 hours for schedule patterns
  };

  /**
   * 💰 Get cached data or return null if expired/missing
   */
  get(key: string, source: keyof typeof this.CACHE_LIMITS): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      console.log(`💾 Cache miss: ${key}`);
      return null;
    }
    
    if (new Date() > entry.expiresAt) {
      console.log(`⏰ Cache expired: ${key}`);
      this.cache.delete(key);
      return null;
    }
    
    console.log(`✅ Cache hit: ${key} (${this.getTimeRemaining(entry.expiresAt)} remaining)`);
    return entry.data;
  }

  /**
   * 💾 Store data in cache with appropriate TTL
   */
  set(key: string, data: any, source: keyof typeof this.CACHE_LIMITS): void {
    const ttl = this.CACHE_LIMITS[source];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl);
    
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
      source
    });
    
    console.log(`💾 Cached: ${key} (expires in ${this.getTimeRemaining(expiresAt)})`);
  }

  /**
   * 🔍 Check if we have fresh data without making API calls
   */
  isFresh(key: string): boolean {
    const entry = this.cache.get(key);
    return entry ? new Date() < entry.expiresAt : false;
  }

  /**
   * 📊 Get cache statistics
   */
  getStats(): {
    totalEntries: number,
    freshEntries: number,
    expiredEntries: number,
    apiCallsSaved: number
  } {
    const now = new Date();
    let fresh = 0;
    let expired = 0;
    let apiCallsSaved = 0;
    
    for (const [key, entry] of this.cache) {
      if (now < entry.expiresAt) {
        fresh++;
        apiCallsSaved++;
      } else {
        expired++;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      freshEntries: fresh,
      expiredEntries: expired,
      apiCallsSaved
    };
  }

  /**
   * 🧹 Clean up expired entries
   */
  cleanup(): void {
    const now = new Date();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`🧹 Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  /**
   * 💰 Estimate API cost savings
   */
  getAPISavings(): {
    callsSaved: number,
    estimatedCostSavings: string,
    efficiencyGain: string
  } {
    const stats = this.getStats();
    const avgCallCost = 0.01; // Estimated cost per API call
    const estimatedSavings = stats.apiCallsSaved * avgCallCost;
    
    return {
      callsSaved: stats.apiCallsSaved,
      estimatedCostSavings: `$${estimatedSavings.toFixed(2)}`,
      efficiencyGain: `${Math.round((stats.apiCallsSaved / Math.max(1, stats.totalEntries)) * 100)}%`
    };
  }

  /**
   * 🕒 Get human-readable time remaining
   */
  private getTimeRemaining(expiresAt: Date): string {
    const remaining = expiresAt.getTime() - Date.now();
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * 📋 Log current cache status
   */
  logStatus(): void {
    const stats = this.getStats();
    const savings = this.getAPISavings();
    
    console.log('💾 INTELLIGENCE CACHE STATUS:');
    console.log(`   📊 Total entries: ${stats.totalEntries}`);
    console.log(`   ✅ Fresh entries: ${stats.freshEntries}`);
    console.log(`   ⏰ Expired entries: ${stats.expiredEntries}`);
    console.log(`   💰 API calls saved: ${stats.apiCallsSaved}`);
    console.log(`   💵 Cost savings: ${savings.estimatedCostSavings}`);
    console.log(`   📈 Efficiency gain: ${savings.efficiencyGain}`);
  }

  /**
   * 🔄 Get or set with automatic API call management
   */
  async getOrFetch<T>(
    key: string, 
    source: keyof typeof this.CACHE_LIMITS,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    // Try cache first
    const cached = this.get(key, source);
    if (cached) {
      return cached;
    }
    
    // Cache miss - make API call
    console.log(`🌐 Making API call for: ${key}`);
    try {
      const data = await fetchFn();
      this.set(key, data, source);
      return data;
    } catch (error) {
      console.error(`❌ API call failed for ${key}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const intelligenceCache = new IntelligenceCache();

// Auto-cleanup every hour
setInterval(() => {
  intelligenceCache.cleanup();
}, 60 * 60 * 1000); 