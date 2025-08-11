/**
 * 🔴 REDIS KEY PREFIX HELPER
 * 
 * PURPOSE: Ensures all Redis keys use proper namespace isolation
 * STRATEGY: Automatic prefixing with REDIS_PREFIX environment variable
 */

/**
 * Get Redis key with proper prefix for namespace isolation
 * 
 * @param keyParts - Key components to join with colons
 * @returns Prefixed Redis key
 * 
 * @example
 * // With REDIS_PREFIX=stg:
 * key('tweets', 'recent') // => 'stg:tweets:recent'
 * key('user', '123', 'cache') // => 'stg:user:123:cache'
 */
export function key(...keyParts: string[]): string {
  const prefix = process.env.REDIS_PREFIX || 'app:';
  const keyPath = keyParts.filter(part => part && part.length > 0).join(':');
  
  if (!keyPath) {
    throw new Error('Redis key cannot be empty');
  }
  
  return `${prefix}${keyPath}`;
}

/**
 * Get Redis key for health check
 */
export function healthKey(): string {
  return key('health', 'check');
}

/**
 * Get Redis key for cache items
 */
export function cacheKey(category: string, id: string): string {
  return key('cache', category, id);
}

/**
 * Get Redis key for rate limiting
 */
export function rateLimitKey(identifier: string, window: string): string {
  return key('rate_limit', identifier, window);
}

/**
 * Get Redis key for queues
 */
export function queueKey(queueName: string): string {
  return key('queue', queueName);
}

/**
 * Get Redis key for locks
 */
export function lockKey(resource: string): string {
  return key('lock', resource);
}

/**
 * Get Redis key for temporary data
 */
export function tempKey(category: string, id: string, ttl?: string): string {
  const parts = ['temp', category, id];
  if (ttl) {
    parts.push(ttl);
  }
  return key(...parts);
}

/**
 * Parse Redis key to extract components (removes prefix)
 */
export function parseKey(redisKey: string): string[] {
  const prefix = process.env.REDIS_PREFIX || 'app:';
  
  if (!redisKey.startsWith(prefix)) {
    throw new Error(`Key does not start with expected prefix: ${prefix}`);
  }
  
  const withoutPrefix = redisKey.substring(prefix.length);
  return withoutPrefix.split(':');
}

/**
 * Check if a key belongs to current environment
 */
export function isOurKey(redisKey: string): boolean {
  const prefix = process.env.REDIS_PREFIX || 'app:';
  return redisKey.startsWith(prefix);
}

/**
 * Get all keys pattern for current environment
 */
export function getAllKeysPattern(): string {
  const prefix = process.env.REDIS_PREFIX || 'app:';
  return `${prefix}*`;
}

/**
 * Environment-specific key helpers
 */
export const RedisKeys = {
  // Health and monitoring
  health: () => healthKey(),
  
  // Tweet caching
  tweet: (tweetId: string) => cacheKey('tweet', tweetId),
  recentTweets: () => key('tweets', 'recent'),
  
  // Rate limiting
  postingLimit: (hour: string) => rateLimitKey('posting', hour),
  apiLimit: (minute: string) => rateLimitKey('api', minute),
  
  // Queues
  syncQueue: () => queueKey('sync_to_supabase'),
  analyticsQueue: () => queueKey('analytics_processing'),
  
  // Locks
  postingLock: () => lockKey('posting_in_progress'),
  syncLock: () => lockKey('sync_in_progress'),
  
  // Temporary data
  draftTweet: (id: string) => tempKey('draft', id, '1h'),
  session: (sessionId: string) => tempKey('session', sessionId, '24h'),
  
  // Analytics
  dailyStats: (date: string) => key('stats', 'daily', date),
  hourlyStats: (hour: string) => key('stats', 'hourly', hour),
  
  // Configuration cache
  configCache: (configKey: string) => cacheKey('config', configKey),
  
  // Helper to get environment info
  environment: () => process.env.REDIS_PREFIX || 'app:',
  
  // Pattern for cleanup
  allKeys: () => getAllKeysPattern()
};