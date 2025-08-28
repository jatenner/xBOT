import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

interface ConnectionHealth {
  supabase: boolean;
  redis: boolean;
  lastSuccessfulQuery: Date | null;
  failureCount: number;
  isCircuitBreakerOpen: boolean;
}

export class ResilientDatabaseManager {
  private static instance: ResilientDatabaseManager;
  private supabase: SupabaseClient | null = null;
  private redis: Redis | null = null;
  private connectionHealth: ConnectionHealth = {
    supabase: false,
    redis: false,
    lastSuccessfulQuery: null,
    failureCount: 0,
    isCircuitBreakerOpen: false
  };
  
  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 5000]; // Progressive backoff
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 5000; // Reduced from 10s

  private constructor() {}

  public static getInstance(): ResilientDatabaseManager {
    if (!ResilientDatabaseManager.instance) {
      ResilientDatabaseManager.instance = new ResilientDatabaseManager();
    }
    return ResilientDatabaseManager.instance;
  }

  public async initialize(): Promise<void> {
    console.log('🗄️ Initializing Resilient Database Manager...');
    
    await Promise.allSettled([
      this.initializeSupabaseWithRetry(),
      this.initializeRedisWithRetry()
    ]);
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    console.log('✅ Resilient Database Manager initialized');
    console.log(`📊 Connection Health: Supabase=${this.connectionHealth.supabase}, Redis=${this.connectionHealth.redis}`);
  }

  /**
   * Initialize Supabase with exponential backoff retry
   */
  private async initializeSupabaseWithRetry(): Promise<void> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        console.log(`🔌 Supabase connection attempt ${attempt + 1}/${this.MAX_RETRIES}...`);
        
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          },
          // Add connection pooling and optimizations
          global: {
            headers: {
              'Connection': 'keep-alive',
              'Keep-Alive': 'timeout=5, max=1000'
            }
          }
        });

        // Test connection with shorter timeout
        const testResult = await this.testSupabaseConnection();
        
        if (testResult.success) {
          this.connectionHealth.supabase = true;
          this.connectionHealth.lastSuccessfulQuery = new Date();
          this.connectionHealth.failureCount = 0;
          console.log('✅ Supabase connected successfully');
          return;
        } else {
          throw new Error(testResult.error);
        }

      } catch (error: any) {
        this.connectionHealth.failureCount++;
        console.warn(`⚠️ Supabase attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt < this.MAX_RETRIES - 1) {
          const delay = this.RETRY_DELAYS[attempt];
          console.log(`⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    console.error('❌ Supabase connection failed after all retries');
    this.openCircuitBreaker();
  }

  /**
   * Test Supabase connection with timeout
   */
  private async testSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'No Supabase client' };
    }

    try {
      const testPromise = this.supabase
        .from('tweets')
        .select('count')
        .limit(1);
        
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), this.CONNECTION_TIMEOUT)
      );
      
      const { error } = await Promise.race([testPromise, timeoutPromise]) as any;
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true };
      
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize Redis with retry logic
   */
  private async initializeRedisWithRetry(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.log('📝 No Redis URL provided');
      return;
    }

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        console.log(`🔗 Redis connection attempt ${attempt + 1}/${this.MAX_RETRIES}...`);
        
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: this.CONNECTION_TIMEOUT,
          lazyConnect: true,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          tls: redisUrl.includes('rediss://') ? {} : undefined,
        });

        // Test connection
        await Promise.race([
          this.redis.ping(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis ping timeout')), this.CONNECTION_TIMEOUT)
          )
        ]);
        
        this.connectionHealth.redis = true;
        console.log('✅ Redis connected successfully');
        return;

      } catch (error: any) {
        console.warn(`⚠️ Redis attempt ${attempt + 1} failed:`, error.message);
        
        if (this.redis) {
          this.redis.disconnect();
          this.redis = null;
        }
        
        if (attempt < this.MAX_RETRIES - 1) {
          await this.sleep(this.RETRY_DELAYS[attempt]);
        }
      }
    }
    
    console.warn('⚠️ Redis connection failed, continuing without cache');
  }

  /**
   * Execute database query with retry and circuit breaker
   */
  public async executeQuery<T>(
    operation: (supabase: SupabaseClient) => Promise<{ data: T | null; error: any }>,
    fallbackValue: T | null = null
  ): Promise<{ data: T | null; error: any; fromCache?: boolean }> {
    
    // Check circuit breaker
    if (this.connectionHealth.isCircuitBreakerOpen) {
      if (this.shouldAttemptCircuitBreakerReset()) {
        console.log('🔄 Attempting to reset circuit breaker...');
        this.connectionHealth.isCircuitBreakerOpen = false;
      } else {
        console.warn('⚠️ Circuit breaker open, returning fallback value');
        return { data: fallbackValue, error: new Error('Circuit breaker open') };
      }
    }

    if (!this.supabase || !this.connectionHealth.supabase) {
      console.warn('⚠️ No Supabase connection, returning fallback value');
      return { data: fallbackValue, error: new Error('No database connection') };
    }

    // Attempt query with retry
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const result = await Promise.race([
          operation(this.supabase),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), this.CONNECTION_TIMEOUT)
          )
        ]);

        if (!result.error) {
          this.connectionHealth.lastSuccessfulQuery = new Date();
          this.connectionHealth.failureCount = 0;
          return result;
        } else {
          throw new Error(result.error.message);
        }

      } catch (error: any) {
        this.connectionHealth.failureCount++;
        console.warn(`⚠️ Query attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt < this.MAX_RETRIES - 1) {
          await this.sleep(this.RETRY_DELAYS[attempt]);
        }
      }
    }

    // All retries failed
    this.connectionHealth.failureCount++;
    
    if (this.connectionHealth.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.openCircuitBreaker();
    }

    console.error('❌ Database query failed after all retries, returning fallback');
    return { data: fallbackValue, error: new Error('Query failed after retries') };
  }

  /**
   * Save tweet with bulletproof retry logic
   */
  public async saveTweetToDatabase(tweetData: any): Promise<{ success: boolean; error?: string }> {
    console.log('💾 Saving tweet to database with bulletproof retry...');
    
    const operation = async (supabase: SupabaseClient) => {
      return supabase
        .from('tweets')
        .insert({
          tweet_id: tweetData.tweet_id || `local_${Date.now()}`,
          content: tweetData.content,
          content_type: tweetData.content_type || 'general',
          tweet_type: tweetData.tweet_type || 'original',
          engagement_score: 0,
          likes: 0,
          retweets: 0,
          replies: 0,
          created_at: new Date().toISOString()
        });
    };

    const result = await this.executeQuery(operation, null);
    
    if (result.error) {
      console.error('❌ Tweet save failed:', result.error.message);
      
      // Try to save basic info to bot_config as fallback
      await this.saveTweetToFallbackStorage(tweetData);
      
      return { success: false, error: result.error.message };
    }

    console.log('✅ Tweet saved successfully to database');
    return { success: true };
  }

  /**
   * Fallback storage when database is unavailable
   */
  private async saveTweetToFallbackStorage(tweetData: any): Promise<void> {
    try {
      const fallbackKey = `tweet_fallback_${Date.now()}`;
      const fallbackData = JSON.stringify({
        content: tweetData.content,
        timestamp: new Date().toISOString(),
        tweet_id: tweetData.tweet_id
      });
      
      const operation = async (supabase: SupabaseClient) => {
        return supabase
          .from('bot_config')
          .upsert({ key: fallbackKey, value: fallbackData });
      };
      
      await this.executeQuery(operation, null);
      console.log('📝 Tweet saved to fallback storage');
      
    } catch (error: any) {
      console.error('❌ Fallback storage also failed:', error.message);
    }
  }

  /**
   * Circuit breaker management
   */
  private openCircuitBreaker(): void {
    this.connectionHealth.isCircuitBreakerOpen = true;
    console.warn('🚨 Database circuit breaker opened due to repeated failures');
    
    // Schedule circuit breaker reset attempt
    setTimeout(() => {
      console.log('🔄 Attempting to reset circuit breaker...');
      this.connectionHealth.isCircuitBreakerOpen = false;
    }, this.CIRCUIT_BREAKER_TIMEOUT);
  }

  private shouldAttemptCircuitBreakerReset(): boolean {
    const timeSinceLastAttempt = Date.now() - (this.connectionHealth.lastSuccessfulQuery?.getTime() || 0);
    return timeSinceLastAttempt > this.CIRCUIT_BREAKER_TIMEOUT;
  }

  /**
   * Health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.performHealthCheck();
    }, 60000); // Check every minute
  }

  private async performHealthCheck(): Promise<void> {
    if (this.supabase && this.connectionHealth.supabase) {
      const testResult = await this.testSupabaseConnection();
      if (!testResult.success) {
        console.warn('⚠️ Health check failed, connection may be degraded');
        this.connectionHealth.supabase = false;
      }
    }
  }

  /**
   * Get connection status for monitoring
   */
  public getConnectionStatus(): ConnectionHealth {
    return { ...this.connectionHealth };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}