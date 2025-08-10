import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private supabase: SupabaseClient | null = null;
  private redis: Redis | null = null;
  private isSupabaseConnected = false;
  private isRedisConnected = false;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async initialize(): Promise<void> {
    try {
      console.log('🗄️ Initializing Database Manager...');
      
      await this.initializeSupabase();
      await this.initializeRedis();
      
      console.log('✅ Database Manager initialized');
    } catch (error: any) {
      console.error('❌ Database Manager initialization failed:', error.message);
      throw error;
    }
  }

  private async initializeSupabase(): Promise<void> {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      
      // Test connection with timeout
      const testPromise = this.supabase.from('tweets').select('count').limit(1);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase connection timeout')), 10000)
      );
      
      const { error } = await Promise.race([testPromise, timeoutPromise]) as any;
      
      if (error) {
        console.warn('⚠️ Supabase connection test failed:', error.message);
        this.isSupabaseConnected = false;
      } else {
        this.isSupabaseConnected = true;
        console.log('✅ Supabase connected');
      }
    } catch (error: any) {
      console.error('❌ Supabase initialization failed:', error.message);
      this.isSupabaseConnected = false;
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL;
      
      if (!redisUrl) {
        console.log('📝 No Redis URL provided, skipping Redis');
        return;
      }

      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        tls: redisUrl.includes('rediss://') ? {} : undefined,
      });

      // Test connection with timeout
      const pingPromise = this.redis.ping();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis ping timeout')), 5000)
      );
      
      await Promise.race([pingPromise, timeoutPromise]);
      this.isRedisConnected = true;
      console.log('✅ Redis connected');

    } catch (error: any) {
      console.error('❌ Redis initialization failed:', error.message);
      this.isRedisConnected = false;
      this.redis = null;
    }
  }

  // Supabase operations
  public async insertTweet(data: {
    content: string;
    tweet_id: string;
    posted_at: string;
    platform: string;
    status: string;
  }): Promise<boolean> {
    if (!this.supabase || !this.isSupabaseConnected) {
      console.warn('⚠️ Supabase not available for tweet insert');
      return false;
    }

    try {
      const { error } = await this.supabase.from('tweets').insert(data);
      
      if (error) {
        console.error('❌ Failed to insert tweet:', error.message);
        return false;
      }
      
      return true;
    } catch (error: any) {
      console.error('❌ Tweet insert error:', error.message);
      return false;
    }
  }

  public async getRecentTweets(limit = 10): Promise<any[]> {
    if (!this.supabase || !this.isSupabaseConnected) {
      console.warn('⚠️ Supabase not available for recent tweets');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('tweets')
        .select('*')
        .order('posted_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Failed to get recent tweets:', error.message);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Get recent tweets error:', error.message);
      return [];
    }
  }

  // Redis operations
  public async cacheSet(key: string, value: any, ttlSeconds = 3600): Promise<boolean> {
    if (!this.redis || !this.isRedisConnected) {
      console.warn('⚠️ Redis not available for cache set');
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlSeconds, serialized);
      return true;
    } catch (error: any) {
      console.error('❌ Redis cache set error:', error.message);
      return false;
    }
  }

  public async cacheGet(key: string): Promise<any | null> {
    if (!this.redis || !this.isRedisConnected) {
      console.warn('⚠️ Redis not available for cache get');
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      
      return JSON.parse(value);
    } catch (error: any) {
      console.error('❌ Redis cache get error:', error.message);
      return null;
    }
  }

  // Health checks
  public async checkHealth(): Promise<{
    supabase: boolean;
    redis: boolean;
    overall: boolean;
  }> {
    let supabaseHealth = false;
    let redisHealth = false;

    // Check Supabase
    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('tweets').select('count').limit(1);
        supabaseHealth = !error;
      } catch {
        supabaseHealth = false;
      }
    }

    // Check Redis
    if (this.redis) {
      try {
        await this.redis.ping();
        redisHealth = true;
      } catch {
        redisHealth = false;
      }
    } else {
      // If Redis is not configured, consider it "healthy" (optional)
      redisHealth = true;
    }

    return {
      supabase: supabaseHealth,
      redis: redisHealth,
      overall: supabaseHealth && redisHealth
    };
  }

  public getConnectionStatus(): {
    supabase: boolean;
    redis: boolean;
  } {
    return {
      supabase: this.isSupabaseConnected,
      redis: this.isRedisConnected
    };
  }
}