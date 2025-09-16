/**
 * Pluggable Key-Value Storage
 * Supports Redis, Supabase, and in-memory fallback
 */

import { FEATURE_FLAGS } from '../config/featureFlags';

export interface KVStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  close?(): Promise<void>;
}

class InMemoryKVStore implements KVStore {
  private data: Map<string, { value: string; expiry?: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const item = this.data.get(key);
    if (!item) return null;
    
    if (item.expiry && Date.now() > item.expiry) {
      this.data.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiry = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
    this.data.set(key, { value, expiry });
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }
}

class RedisKVStore implements KVStore {
  private redis: any;

  constructor() {
    const Redis = require('ioredis');
    this.redis = new Redis(process.env.REDIS_URL!, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      console.warn(`Redis GET failed for ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, value);
      } else {
        await this.redis.set(key, value);
      }
    } catch (error) {
      console.warn(`Redis SET failed for ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.warn(`Redis DEL failed for ${key}:`, error);
    }
  }

  async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.warn('Redis close error:', error);
    }
  }
}

class SupabaseKVStore implements KVStore {
  private supabase: any;
  private initialized = false;

  constructor() {
    // Lazy load supabase client
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      const { createClient } = await import('@supabase/supabase-js');
      this.supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Ensure kv_store table exists
      await this.createTableIfNotExists();
      this.initialized = true;
    } catch (error) {
      console.warn('Supabase KV initialization failed:', error);
      throw error;
    }
  }

  private async createTableIfNotExists(): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('create_kv_table_if_not_exists', {
        sql: `
          CREATE TABLE IF NOT EXISTS kv_store (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ
          );
          CREATE INDEX IF NOT EXISTS idx_kv_store_expires_at ON kv_store(expires_at);
        `
      });

      // Fallback: direct table creation if RPC fails
      if (error) {
        await this.supabase.from('kv_store').select('key').limit(1);
      }
    } catch (error) {
      console.warn('KV table creation check failed:', error);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      await this.ensureInitialized();
      
      const { data, error } = await this.supabase
        .from('kv_store')
        .select('value, expires_at')
        .eq('key', key)
        .single();

      if (error || !data) return null;

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        await this.del(key);
        return null;
      }

      return data.value;
    } catch (error) {
      console.warn(`Supabase GET failed for ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const expires_at = ttlSeconds 
        ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
        : null;

      await this.supabase
        .from('kv_store')
        .upsert({ 
          key, 
          value, 
          updated_at: new Date().toISOString(),
          expires_at 
        });
    } catch (error) {
      console.warn(`Supabase SET failed for ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.supabase.from('kv_store').delete().eq('key', key);
    } catch (error) {
      console.warn(`Supabase DEL failed for ${key}:`, error);
    }
  }
}

// Singleton KV store instance
let kvStore: KVStore | null = null;

/**
 * Get the configured KV store (Redis > Supabase > Memory)
 */
export function getKVStore(): KVStore {
  if (kvStore) return kvStore;

  // Priority 1: Redis
  if (process.env.REDIS_URL) {
    console.log('🔗 KV_STORE: Using Redis');
    kvStore = new RedisKVStore();
    return kvStore;
  }

  // Priority 2: Supabase
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('🔗 KV_STORE: Using Supabase');
    kvStore = new SupabaseKVStore();
    return kvStore;
  }

  // Priority 3: In-memory fallback
  console.log('🔗 KV_STORE: Using in-memory fallback');
  kvStore = new InMemoryKVStore();
  return kvStore;
}

/**
 * Convenience functions that use the singleton store
 */
export async function kvGet(key: string): Promise<string | null> {
  return getKVStore().get(key);
}

export async function kvSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  return getKVStore().set(key, value, ttlSeconds);
}

export async function kvDel(key: string): Promise<void> {
  return getKVStore().del(key);
}

/**
 * Close the KV store connection (for graceful shutdown)
 */
export async function closeKVStore(): Promise<void> {
  if (kvStore && kvStore.close) {
    await kvStore.close();
    kvStore = null;
  }
}
