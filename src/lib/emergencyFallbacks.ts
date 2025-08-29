/**
 * 🚨 EMERGENCY FALLBACKS
 * Temporary fallbacks for missing database functions and Redis issues
 */

// Emergency duplicate check fallback
export function emergencyDuplicateCheck(content: string): Promise<{
  isDuplicate: boolean;
  similarPostId?: string;
  hoursAgo?: number;
  similarity?: number;
}> {
  // Always return no duplicates for now to prevent posting failures
  return Promise.resolve({ isDuplicate: false });
}

// Emergency cache fallback
export class EmergencyCache {
  private cache = new Map<string, { data: any; expires: number }>();

  async get(key: string): Promise<any> {
    const item = this.cache.get(key);
    if (item && Date.now() < item.expires) {
      return item.data;
    }
    this.cache.delete(key);
    return null;
  }

  async set(key: string, data: any, ttlCategory: string): Promise<void> {
    // Simple TTL mapping
    const ttlSeconds = ttlCategory === 'recent_tweets' ? 300 : 1800; // 5min or 30min
    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { data, expires });

    // Clean up old entries periodically
    if (this.cache.size > 100) {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (now >= v.expires) {
          this.cache.delete(k);
        }
      }
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}

export const emergencyCache = new EmergencyCache();
