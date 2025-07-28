/**
 * 🚀 USER ID CACHE SYSTEM
 * 
 * Eliminates 429 rate limit errors by caching Twitter user ID persistently.
 * Prevents repeated client.v2.me() calls that hit the 25-call daily limit.
 */

import * as fs from 'fs';
import * as path from 'path';

// Cache file location
const CACHE_FILE = path.join(process.cwd(), 'data', 'twitter-user-cache.json');

interface UserCache {
  userId: string;
  username: string;
  cachedAt: string;
  lastValidated: string;
}

/**
 * Get cached user ID or return from environment variable
 */
export function getCachedUserId(): string | null {
  try {
    // First priority: Environment variable (most reliable)
    if (process.env.TWITTER_USER_ID) {
      console.log('✅ Using TWITTER_USER_ID from environment');
      return process.env.TWITTER_USER_ID;
    }

    // Second priority: Cache file
    if (fs.existsSync(CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as UserCache;
      const cacheAge = Date.now() - new Date(cache.cachedAt).getTime();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (cacheAge < maxAge && cache.userId) {
        console.log(`✅ Using cached user ID: ${cache.userId} (age: ${Math.round(cacheAge / (1000 * 60 * 60))}h)`);
        return cache.userId;
      } else {
        console.log('⚠️ Cached user ID expired, needs refresh');
      }
    }

    console.log('❌ No cached user ID available');
    return null;
  } catch (error) {
    console.error('❌ Error reading user ID cache:', error);
    return null;
  }
}

/**
 * Cache user ID for future use (reduces API calls)
 */
export function cacheUserId(userId: string, username?: string): void {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const cache: UserCache = {
      userId,
      username: username || process.env.TWITTER_USERNAME || 'unknown',
      cachedAt: new Date().toISOString(),
      lastValidated: new Date().toISOString()
    };

    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`✅ Cached user ID: ${userId} for future use`);
    
    // Also set environment variable for current session
    process.env.TWITTER_USER_ID = userId;
  } catch (error) {
    console.error('❌ Error caching user ID:', error);
  }
}

/**
 * Get username from cache or environment
 */
export function getCachedUsername(): string | null {
  try {
    // Environment variable first
    if (process.env.TWITTER_USERNAME) {
      return process.env.TWITTER_USERNAME;
    }

    // Cache file second
    if (fs.existsSync(CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as UserCache;
      return cache.username || null;
    }

    return null;
  } catch (error) {
    console.error('❌ Error reading username cache:', error);
    return null;
  }
}

/**
 * Clear cache (for testing or reset)
 */
export function clearUserCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
      console.log('✅ User cache cleared');
    }
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
}

/**
 * Validate cache status
 */
export function validateCacheStatus(): {
  hasUserId: boolean;
  hasUsername: boolean;
  source: 'environment' | 'cache' | 'none';
  cacheAge?: number;
} {
  const userId = getCachedUserId();
  const username = getCachedUsername();
  
  let source: 'environment' | 'cache' | 'none' = 'none';
  let cacheAge: number | undefined;

  if (process.env.TWITTER_USER_ID) {
    source = 'environment';
  } else if (fs.existsSync(CACHE_FILE)) {
    source = 'cache';
    try {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as UserCache;
      cacheAge = Date.now() - new Date(cache.cachedAt).getTime();
    } catch (error) {
      // Ignore cache read errors
    }
  }

  return {
    hasUserId: !!userId,
    hasUsername: !!username,
    source,
    cacheAge
  };
} 