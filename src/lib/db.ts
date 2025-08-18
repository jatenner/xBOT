import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { AutoMigrationRunner } from './migrationRunner';
import { Pool } from 'pg';
import dns from 'node:dns';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private supabase: SupabaseClient | null = null;
  private redis: Redis | null = null;
  private pgPool: Pool | null = null;
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
      await this.initializeDirectDb();
      
      // Run automatic migrations if Supabase is connected
      if (this.isSupabaseConnected) {
        console.log('🔄 Running automatic migrations...');
        const migrationRunner = new AutoMigrationRunner();
        await migrationRunner.runPendingMigrations();
      }
      
      await this.initializeRedis();
      
      console.log('✅ Database Manager initialized');
    } catch (error: any) {
      console.error('❌ Database Manager initialization failed:', error.message);
      throw error;
    }
  }

  private async initializeDirectDb(): Promise<void> {
    const directDbUrl = process.env.DIRECT_DB_URL;
    
    if (!directDbUrl) {
      console.log('📍 No DIRECT_DB_URL provided, skipping direct PostgreSQL connection');
      return;
    }

    try {
      console.log('🔗 Initializing direct PostgreSQL connection with IPv4 preference...');
      
      // IPv4 lookup function to avoid ENETUNREACH on IPv6
      const lookupIPv4: any = (host: string, _opts: any, cb: any) => {
        dns.lookup(host, { family: 4 }, cb);
      };

      this.pgPool = new Pool({
        connectionString: directDbUrl,
        ssl: { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 10000
      });

      // Test connection
      const client = await this.pgPool.connect();
      await client.query('SELECT 1');
      client.release();
      
      console.log('✅ Direct PostgreSQL connection established');
    } catch (error: any) {
      console.warn('⚠️ Direct PostgreSQL connection failed:', error.message);
      this.pgPool = null;
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
        console.log('📝 No Redis URL provided, operating in Supabase-only mode');
        this.isRedisConnected = false;
        return;
      }

      console.log('🔗 Attempting Redis connection...');
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1, // Reduced retries for faster failover
        connectTimeout: 5000,    // Reduced timeout
        lazyConnect: true,       // Don't connect immediately
        tls: redisUrl.includes('rediss://') ? {} : undefined,
      });

      // Test connection with short timeout
      const pingPromise = this.redis.ping();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis ping timeout')), 3000)
      );
      
      await Promise.race([pingPromise, timeoutPromise]);
      this.isRedisConnected = true;
      console.log('✅ Redis connected successfully');

    } catch (error: any) {
      console.warn('⚠️ Redis unavailable, continuing with Supabase-only mode:', error.message);
      this.isRedisConnected = false;
      this.redis = null;
      // Don't throw - bot should work without Redis
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
  public getSupabaseClient() {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }
    return this.supabase;
  }

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