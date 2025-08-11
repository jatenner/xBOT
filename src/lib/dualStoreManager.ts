/**
 * 🚀 DUAL STORE MANAGER - Redis + Supabase Integration
 * 
 * PURPOSE: Unified data layer that manages Redis (hot path) + Supabase (durable truth)
 * FEATURES: Auto-fallback, background sync, consistency checks, health monitoring
 * STRATEGY: Write to Redis first, background sync to Supabase, read Redis first with fallback
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { redisManager, RedisManager, RateLimitResult, ContentHash, QueueItem } from './redisManager';

interface DualStoreConfig {
  useRedis: boolean;
  fallbackMode: boolean;
  dualWriteEnabled: boolean;
  syncIntervalMs: number;
  maxSyncBatchSize: number;
  healthCheckIntervalMs: number;
}

interface Tweet {
  id?: number;
  tweet_id: string;
  content: string;
  posted_at?: Date;
  platform?: string;
  engagement_data?: any;
  ai_metadata?: any;
  content_analysis?: any;
}

interface BotConfig {
  key: string;
  environment: string;
  value: any;
  metadata?: any;
}

interface DailySum {
  date: string;
  summary_type: string;
  environment: string;
  metrics: any;
  quality_data?: any;
}

interface AuditEvent {
  event_type: string;
  component: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  event_data: any;
  context?: any;
}

interface HealthStatus {
  component: string;
  status: 'healthy' | 'degraded' | 'critical' | 'down';
  metrics: any;
  diagnostic_data?: any;
}

interface SyncQueueItem {
  type: 'tweet' | 'config' | 'health' | 'audit';
  operation: 'insert' | 'update' | 'upsert';
  data: any;
  retryCount: number;
  createdAt: Date;
}

interface ConsistencyReport {
  timestamp: Date;
  checks: {
    tweets: { redis: number; supabase: number; drift: number };
    rateLimits: { redis: number; supabase: number; drift: number };
    queues: { depth: number; oldestItem: Date | null };
    duplicates: { found: number; resolved: number };
  };
  overallHealth: 'pass' | 'warning' | 'fail';
  recommendations: string[];
}

class DualStoreManager {
  private static instance: DualStoreManager;
  private supabase: SupabaseClient;
  private redis: RedisManager;
  private config: DualStoreConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  private constructor() {
    this.redis = redisManager;
    this.supabase = this.initializeSupabase();
    this.config = this.loadConfig();
    this.initialize();
  }

  public static getInstance(): DualStoreManager {
    if (!DualStoreManager.instance) {
      DualStoreManager.instance = new DualStoreManager();
    }
    return DualStoreManager.instance;
  }

  /**
   * Initialize Supabase client
   */
  private initializeSupabase(): SupabaseClient {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    }

    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    });
  }

  /**
   * Load configuration from environment and database
   */
  private loadConfig(): DualStoreConfig {
    return {
      useRedis: process.env.USE_REDIS !== 'false',
      fallbackMode: process.env.REDIS_FALLBACK_MODE === 'true',
      dualWriteEnabled: process.env.DUAL_WRITE_ENABLED !== 'false',
      syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS || '3600000'), // 1 hour default
      maxSyncBatchSize: parseInt(process.env.MAX_SYNC_BATCH_SIZE || '100'),
      healthCheckIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '300000') // 5 minutes default
    };
  }

  /**
   * Initialize dual store system
   */
  private async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Dual Store Manager...');

      // Test Supabase connection
      await this.testSupabaseConnection();

      // Load configuration from database
      await this.loadDatabaseConfig();

      // Start background processes
      this.startBackgroundSync();
      this.startHealthChecks();

      this.isInitialized = true;
      console.log('✅ Dual Store Manager initialized successfully');

      // Log initialization
      await this.logAuditEvent({
        event_type: 'dual_store_initialized',
        component: 'dual_store_manager',
        severity: 'info',
        event_data: {
          config: this.config,
          redis_status: this.redis.getConnectionStatus(),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('❌ Dual Store Manager initialization failed:', error.message);
      // Enable fallback mode but continue
      this.config.fallbackMode = true;
      this.config.useRedis = false;
    }
  }

  /**
   * Test Supabase connection
   */
  private async testSupabaseConnection(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('bot_config')
        .select('key')
        .limit(1);

      if (error) {
        throw new Error(`Supabase connection test failed: ${error.message}`);
      }

      console.log('✅ Supabase connection test successful');
    } catch (error: any) {
      console.error('❌ Supabase connection test failed:', error.message);
      throw error;
    }
  }

  /**
   * Load configuration from database
   */
  private async loadDatabaseConfig(): Promise<void> {
    try {
      const { data: configs, error } = await this.supabase
        .from('bot_config')
        .select('*')
        .in('key', ['redis_config', 'feature_flags', 'health_thresholds']);

      if (error) {
        console.warn('⚠️ Could not load database config:', error.message);
        return;
      }

      // Update config from database
      configs?.forEach(config => {
        if (config.key === 'redis_config') {
          this.config.useRedis = config.value.enabled;
          this.config.fallbackMode = config.value.fallback_mode;
          this.config.dualWriteEnabled = config.value.dual_write;
        } else if (config.key === 'feature_flags') {
          this.config.useRedis = this.config.useRedis && config.value.USE_REDIS;
          this.config.fallbackMode = this.config.fallbackMode || !config.value.REDIS_FALLBACK_MODE;
        }
      });

      console.log('⚙️ Configuration loaded from database');
    } catch (error: any) {
      console.warn('⚠️ Failed to load database config:', error.message);
    }
  }

  // =====================================================================================
  // TWEET OPERATIONS
  // =====================================================================================

  /**
   * Store tweet with dual-write strategy
   */
  public async storeTweet(tweet: Tweet): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      console.log(`📝 Storing tweet: ${tweet.tweet_id}`);

      // Add to Redis queue for immediate access
      if (this.config.useRedis && !this.config.fallbackMode) {
        try {
          // Store in recent tweets cache
          await this.redis.setCache(`recent:tweet:${tweet.tweet_id}`, tweet, 86400); // 24 hours

          // Add to sync queue for Supabase
          const queueItem: SyncQueueItem = {
            type: 'tweet',
            operation: 'upsert',
            data: tweet,
            retryCount: 0,
            createdAt: new Date()
          };

          await this.redis.addToQueue('sync_to_supabase', {
            type: 'sync',
            data: queueItem,
            priority: 5
          });

          console.log('✅ Tweet stored in Redis and queued for Supabase sync');
        } catch (redisError: any) {
          console.warn('⚠️ Redis storage failed, falling back to direct Supabase:', redisError.message);
        }
      }

      // Immediate Supabase write if dual-write enabled or Redis failed
      if (this.config.dualWriteEnabled || this.config.fallbackMode) {
        const { data, error } = await this.supabase
          .from('tweets')
          .upsert([{
            tweet_id: tweet.tweet_id,
            content: tweet.content,
            posted_at: tweet.posted_at || new Date(),
            platform: tweet.platform || 'twitter',
            engagement_data: tweet.engagement_data || {},
            ai_metadata: tweet.ai_metadata || {},
            content_analysis: tweet.content_analysis || {}
          }])
          .select('id')
          .single();

        if (error) {
          throw new Error(`Supabase storage failed: ${error.message}`);
        }

        return { success: true, id: data?.id?.toString() };
      }

      return { success: true, id: tweet.tweet_id };

    } catch (error: any) {
      console.error('❌ Tweet storage failed:', error.message);
      
      // Log the error
      await this.logAuditEvent({
        event_type: 'tweet_storage_failed',
        component: 'dual_store_manager',
        severity: 'error',
        event_data: {
          tweet_id: tweet.tweet_id,
          error: error.message,
          config: this.config
        }
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Get tweet by ID (Redis first, Supabase fallback)
   */
  public async getTweet(tweetId: string): Promise<Tweet | null> {
    try {
      // Try Redis first
      if (this.config.useRedis && !this.config.fallbackMode) {
        const cached = await this.redis.getCache<Tweet>(`recent:tweet:${tweetId}`);
        if (cached) {
          return cached;
        }
      }

      // Fallback to Supabase
      const { data, error } = await this.supabase
        .from('tweets')
        .select('*')
        .eq('tweet_id', tweetId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Supabase query failed: ${error.message}`);
      }

      return data;

    } catch (error: any) {
      console.error('❌ Tweet retrieval failed:', error.message);
      return null;
    }
  }

  /**
   * Get recent tweets (Redis first, Supabase fallback)
   */
  public async getRecentTweets(limit: number = 50): Promise<Tweet[]> {
    try {
      // Try Redis first
      if (this.config.useRedis && !this.config.fallbackMode) {
        const recentList = await this.redis.getCache<string[]>('recent_tweets_list');
        if (recentList && recentList.length > 0) {
          const tweets: Tweet[] = [];
          for (const tweetId of recentList.slice(0, limit)) {
            const tweet = await this.redis.getCache<Tweet>(`recent:tweet:${tweetId}`);
            if (tweet) tweets.push(tweet);
          }
          if (tweets.length > 0) return tweets;
        }
      }

      // Fallback to Supabase
      const { data, error } = await this.supabase
        .from('tweets')
        .select('*')
        .order('posted_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Supabase query failed: ${error.message}`);
      }

      return data || [];

    } catch (error: any) {
      console.error('❌ Recent tweets retrieval failed:', error.message);
      return [];
    }
  }

  // =====================================================================================
  // RATE LIMITING
  // =====================================================================================

  /**
   * Check rate limit (Redis first, Supabase fallback)
   */
  public async checkRateLimit(
    type: 'daily_tweets' | 'hourly_tweets' | 'ai_budget',
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    try {
      // Try Redis first
      if (this.config.useRedis && !this.config.fallbackMode) {
        const key = `${type}:${new Date().toISOString().split('T')[0]}`;
        return await this.redis.checkRateLimit(key, limit, windowSeconds);
      }

      // Fallback to Supabase-based rate limiting
      return await this.checkRateLimitSupabase(type, limit, windowSeconds);

    } catch (error: any) {
      console.error('❌ Rate limit check failed:', error.message);
      
      // Return conservative result (deny) to be safe
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + windowSeconds * 1000),
        currentCount: limit
      };
    }
  }

  /**
   * Supabase-based rate limiting fallback
   */
  private async checkRateLimitSupabase(
    type: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get current count from daily summaries
    const { data, error } = await this.supabase
      .from('daily_summaries')
      .select('metrics')
      .eq('date', today)
      .eq('summary_type', type)
      .eq('environment', 'production')
      .single();

    const currentCount = data?.metrics?.[`${type}_count`] || 0;
    const allowed = currentCount < limit;
    const remaining = Math.max(0, limit - currentCount);
    const resetTime = new Date();
    resetTime.setHours(23, 59, 59, 999); // End of day

    return {
      allowed,
      remaining,
      resetTime,
      currentCount
    };
  }

  // =====================================================================================
  // CONTENT DEDUPLICATION
  // =====================================================================================

  /**
   * Check content duplication (Redis first, Supabase fallback)
   */
  public async checkContentDuplicate(content: string, tweetId?: string): Promise<ContentHash> {
    try {
      // Try Redis first
      if (this.config.useRedis && !this.config.fallbackMode) {
        return await this.redis.checkContentDuplicate(content, tweetId);
      }

      // Fallback to Supabase-based deduplication
      return await this.checkContentDuplicateSupabase(content, tweetId);

    } catch (error: any) {
      console.error('❌ Content duplicate check failed:', error.message);
      
      // Return safe result (no duplicate found)
      return {
        hash: 'error',
        exists: false
      };
    }
  }

  /**
   * Supabase-based content deduplication fallback
   */
  private async checkContentDuplicateSupabase(content: string, tweetId?: string): Promise<ContentHash> {
    // Simple content matching (can be enhanced)
    const { data, error } = await this.supabase
      .from('tweets')
      .select('tweet_id, posted_at')
      .eq('content', content)
      .order('posted_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Supabase duplicate check failed: ${error.message}`);
    }

    const exists = data && data.length > 0;
    const hash = require('crypto').createHash('sha256').update(content).digest('hex');

    return {
      hash,
      exists,
      tweetId: exists ? data[0].tweet_id : undefined,
      createdAt: exists ? new Date(data[0].posted_at) : undefined
    };
  }

  // =====================================================================================
  // CONFIGURATION MANAGEMENT
  // =====================================================================================

  /**
   * Get configuration (Redis cache first, Supabase source)
   */
  public async getConfig(key: string, environment: string = 'production'): Promise<any> {
    try {
      // Try Redis cache first
      if (this.config.useRedis && !this.config.fallbackMode) {
        const cached = await this.redis.getCache(`config:${key}:${environment}`);
        if (cached) {
          return cached;
        }
      }

      // Get from Supabase
      const { data, error } = await this.supabase
        .from('bot_config')
        .select('value')
        .eq('key', key)
        .eq('environment', environment)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Config retrieval failed: ${error.message}`);
      }

      const value = data.value;

      // Cache in Redis
      if (this.config.useRedis && !this.config.fallbackMode) {
        await this.redis.setCache(`config:${key}:${environment}`, value, 3600); // 1 hour
      }

      return value;

    } catch (error: any) {
      console.error('❌ Config retrieval failed:', error.message);
      return null;
    }
  }

  /**
   * Set configuration (dual write)
   */
  public async setConfig(
    key: string, 
    value: any, 
    environment: string = 'production',
    metadata?: any
  ): Promise<boolean> {
    try {
      // Write to Supabase first (source of truth)
      const { error } = await this.supabase
        .from('bot_config')
        .upsert([{
          key,
          environment,
          value,
          metadata: metadata || {},
          updated_at: new Date().toISOString()
        }]);

      if (error) {
        throw new Error(`Config storage failed: ${error.message}`);
      }

      // Update Redis cache
      if (this.config.useRedis && !this.config.fallbackMode) {
        await this.redis.setCache(`config:${key}:${environment}`, value, 3600);
        
        // Clear related caches if needed
        if (key === 'feature_flags') {
          await this.redis.deleteCache('feature_flags_all');
        }
      }

      console.log(`⚙️ Configuration updated: ${key} = ${JSON.stringify(value).substring(0, 100)}`);
      return true;

    } catch (error: any) {
      console.error('❌ Config update failed:', error.message);
      return false;
    }
  }

  // =====================================================================================
  // BACKGROUND SYNC
  // =====================================================================================

  /**
   * Start background sync process
   */
  private startBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.processSyncQueue();
    }, this.config.syncIntervalMs);

    console.log(`🔄 Background sync started (interval: ${this.config.syncIntervalMs}ms)`);
  }

  /**
   * Process sync queue from Redis to Supabase
   */
  private async processSyncQueue(): Promise<void> {
    if (!this.config.useRedis || this.config.fallbackMode) {
      return;
    }

    try {
      const queueDepth = await this.redis.getQueueDepth('sync_to_supabase');
      if (queueDepth === 0) {
        return;
      }

      console.log(`🔄 Processing sync queue (${queueDepth} items)...`);

      const items = await this.redis.getFromQueue('sync_to_supabase', this.config.maxSyncBatchSize);
      
      for (const item of items) {
        try {
          const syncItem = item.data as SyncQueueItem;
          
          switch (syncItem.type) {
            case 'tweet':
              await this.syncTweetToSupabase(syncItem.data);
              break;
            case 'config':
              await this.syncConfigToSupabase(syncItem.data);
              break;
            case 'health':
              await this.syncHealthToSupabase(syncItem.data);
              break;
            case 'audit':
              await this.syncAuditToSupabase(syncItem.data);
              break;
          }

          // Remove from queue on success
          await this.redis.removeFromQueue('sync_to_supabase', item.id);
          
        } catch (syncError: any) {
          console.error(`❌ Sync item failed:`, syncError.message);
          
          // Increment retry count and re-queue if under limit
          item.retryCount++;
          if (item.retryCount < 3) {
            await this.redis.addToQueue('sync_to_supabase', {
              ...item,
              retryCount: item.retryCount
            });
          } else {
            console.error(`❌ Sync item exceeded retry limit, removing from queue`);
            await this.redis.removeFromQueue('sync_to_supabase', item.id);
          }
        }
      }

      console.log(`✅ Sync queue processed (${items.length} items)`);

    } catch (error: any) {
      console.error('❌ Sync queue processing failed:', error.message);
    }
  }

  /**
   * Sync tweet to Supabase
   */
  private async syncTweetToSupabase(tweet: Tweet): Promise<void> {
    const { error } = await this.supabase
      .from('tweets')
      .upsert([{
        tweet_id: tweet.tweet_id,
        content: tweet.content,
        posted_at: tweet.posted_at || new Date(),
        platform: tweet.platform || 'twitter',
        engagement_data: tweet.engagement_data || {},
        ai_metadata: tweet.ai_metadata || {},
        content_analysis: tweet.content_analysis || {}
      }]);

    if (error) {
      throw new Error(`Tweet sync failed: ${error.message}`);
    }
  }

  /**
   * Sync config to Supabase
   */
  private async syncConfigToSupabase(config: BotConfig): Promise<void> {
    const { error } = await this.supabase
      .from('bot_config')
      .upsert([config]);

    if (error) {
      throw new Error(`Config sync failed: ${error.message}`);
    }
  }

  /**
   * Sync health data to Supabase
   */
  private async syncHealthToSupabase(health: HealthStatus): Promise<void> {
    const { error } = await this.supabase
      .from('system_health')
      .insert([{
        component: health.component,
        status: health.status,
        metrics: health.metrics,
        diagnostic_data: health.diagnostic_data || {}
      }]);

    if (error) {
      throw new Error(`Health sync failed: ${error.message}`);
    }
  }

  /**
   * Sync audit event to Supabase
   */
  private async syncAuditToSupabase(audit: AuditEvent): Promise<void> {
    const { error } = await this.supabase
      .from('audit_log')
      .insert([{
        event_type: audit.event_type,
        component: audit.component,
        severity: audit.severity,
        event_data: audit.event_data,
        context: audit.context || {}
      }]);

    if (error) {
      throw new Error(`Audit sync failed: ${error.message}`);
    }
  }

  // =====================================================================================
  // HEALTH MONITORING
  // =====================================================================================

  /**
   * Start health check process
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);

    console.log(`❤️ Health checks started (interval: ${this.config.healthCheckIntervalMs}ms)`);
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const healthData: HealthStatus = {
        component: 'dual_store_manager',
        status: 'healthy',
        metrics: {
          redis_connected: false,
          supabase_connected: false,
          sync_queue_depth: 0,
          last_sync: null,
          configuration_loaded: this.isInitialized
        }
      };

      // Check Redis health
      try {
        if (this.config.useRedis && !this.config.fallbackMode) {
          const redisHealth = await this.redis.isHealthy();
          healthData.metrics.redis_connected = redisHealth;
          healthData.metrics.sync_queue_depth = await this.redis.getQueueDepth('sync_to_supabase');
        }
      } catch (error) {
        healthData.metrics.redis_connected = false;
      }

      // Check Supabase health
      try {
        const { error } = await this.supabase
          .from('bot_config')
          .select('key')
          .limit(1);
        healthData.metrics.supabase_connected = !error;
      } catch (error) {
        healthData.metrics.supabase_connected = false;
      }

      // Determine overall status
      if (!healthData.metrics.supabase_connected) {
        healthData.status = 'critical';
      } else if (!healthData.metrics.redis_connected && this.config.useRedis) {
        healthData.status = 'degraded';
      } else if (healthData.metrics.sync_queue_depth > 1000) {
        healthData.status = 'degraded';
      }

      // Store health status
      if (this.config.useRedis && !this.config.fallbackMode) {
        await this.redis.setState('last_health_check', healthData);
      }

      // Log to Supabase if needed
      if (healthData.status !== 'healthy') {
        await this.logHealthStatus(healthData);
      }

    } catch (error: any) {
      console.error('❌ Health check failed:', error.message);
    }
  }

  /**
   * Get current health status
   */
  public async getHealthStatus(): Promise<HealthStatus | null> {
    try {
      if (this.config.useRedis && !this.config.fallbackMode) {
        return await this.redis.getState<HealthStatus>('last_health_check');
      }

      // Fallback: perform immediate health check
      await this.performHealthCheck();
      return await this.redis.getState<HealthStatus>('last_health_check');

    } catch (error: any) {
      console.error('❌ Could not get health status:', error.message);
      return null;
    }
  }

  // =====================================================================================
  // AUDIT LOGGING
  // =====================================================================================

  /**
   * Log audit event
   */
  public async logAuditEvent(event: AuditEvent): Promise<void> {
    try {
      // Add to sync queue for background processing
      if (this.config.useRedis && !this.config.fallbackMode) {
        const queueItem: SyncQueueItem = {
          type: 'audit',
          operation: 'insert',
          data: event,
          retryCount: 0,
          createdAt: new Date()
        };

        await this.redis.addToQueue('sync_to_supabase', {
          type: 'sync',
          data: queueItem,
          priority: event.severity === 'critical' ? 10 : 3
        });
      } else {
        // Direct write to Supabase
        await this.syncAuditToSupabase(event);
      }

    } catch (error: any) {
      console.error('❌ Audit logging failed:', error.message);
    }
  }

  /**
   * Log health status
   */
  private async logHealthStatus(health: HealthStatus): Promise<void> {
    try {
      if (this.config.useRedis && !this.config.fallbackMode) {
        const queueItem: SyncQueueItem = {
          type: 'health',
          operation: 'insert',
          data: health,
          retryCount: 0,
          createdAt: new Date()
        };

        await this.redis.addToQueue('sync_to_supabase', {
          type: 'sync',
          data: queueItem,
          priority: health.status === 'critical' ? 10 : 2
        });
      } else {
        await this.syncHealthToSupabase(health);
      }

    } catch (error: any) {
      console.error('❌ Health status logging failed:', error.message);
    }
  }

  // =====================================================================================
  // CONSISTENCY CHECKS
  // =====================================================================================

  /**
   * Perform daily consistency audit
   */
  public async performConsistencyAudit(): Promise<ConsistencyReport> {
    console.log('🔍 Starting consistency audit...');
    
    const report: ConsistencyReport = {
      timestamp: new Date(),
      checks: {
        tweets: { redis: 0, supabase: 0, drift: 0 },
        rateLimits: { redis: 0, supabase: 0, drift: 0 },
        queues: { depth: 0, oldestItem: null },
        duplicates: { found: 0, resolved: 0 }
      },
      overallHealth: 'pass',
      recommendations: []
    };

    try {
      // Check tweet counts
      if (this.config.useRedis && !this.config.fallbackMode) {
        const recentTweets = await this.redis.getCache<string[]>('recent_tweets_list');
        report.checks.tweets.redis = recentTweets?.length || 0;
      }

      const { count: supabaseTweetCount } = await this.supabase
        .from('tweets')
        .select('*', { count: 'exact', head: true })
        .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      report.checks.tweets.supabase = supabaseTweetCount || 0;
      report.checks.tweets.drift = Math.abs(report.checks.tweets.redis - report.checks.tweets.supabase);

      // Check queue depths
      if (this.config.useRedis && !this.config.fallbackMode) {
        report.checks.queues.depth = await this.redis.getQueueDepth('sync_to_supabase');
        
        // Get oldest item timestamp
        const queueItems = await this.redis.getFromQueue('sync_to_supabase', 1);
        if (queueItems.length > 0) {
          report.checks.queues.oldestItem = queueItems[0].createdAt;
        }
      }

      // Determine overall health
      if (report.checks.tweets.drift > report.checks.tweets.supabase * 0.05) {
        report.overallHealth = 'warning';
        report.recommendations.push('Tweet count drift exceeds 5% threshold');
      }

      if (report.checks.queues.depth > 1000) {
        report.overallHealth = 'warning';
        report.recommendations.push('Sync queue depth is high, check processing');
      }

      if (report.checks.queues.oldestItem && 
          (new Date().getTime() - report.checks.queues.oldestItem.getTime()) > 4 * 60 * 60 * 1000) {
        report.overallHealth = 'fail';
        report.recommendations.push('Sync queue has items older than 4 hours');
      }

      console.log(`✅ Consistency audit completed: ${report.overallHealth}`);
      
      // Log the audit results
      await this.logAuditEvent({
        event_type: 'consistency_audit',
        component: 'dual_store_manager',
        severity: report.overallHealth === 'fail' ? 'warning' : 'info',
        event_data: report
      });

      return report;

    } catch (error: any) {
      console.error('❌ Consistency audit failed:', error.message);
      report.overallHealth = 'fail';
      report.recommendations.push(`Audit failed: ${error.message}`);
      return report;
    }
  }

  // =====================================================================================
  // UTILITY METHODS
  // =====================================================================================

  /**
   * Get system status summary
   */
  public getSystemStatus(): {
    initialized: boolean;
    config: DualStoreConfig;
    redis: any;
    uptime: number;
  } {
    return {
      initialized: this.isInitialized,
      config: this.config,
      redis: this.redis.getConnectionStatus(),
      uptime: process.uptime()
    };
  }

  /**
   * Enable fallback mode
   */
  public async enableFallbackMode(): Promise<void> {
    console.log('⚠️ Enabling fallback mode - all operations will use Supabase only');
    
    this.config.fallbackMode = true;
    this.config.useRedis = false;

    await this.logAuditEvent({
      event_type: 'fallback_mode_enabled',
      component: 'dual_store_manager',
      severity: 'warning',
      event_data: {
        reason: 'manual_activation',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Disable fallback mode
   */
  public async disableFallbackMode(): Promise<void> {
    console.log('✅ Disabling fallback mode - resuming Redis operations');
    
    this.config.fallbackMode = false;
    this.config.useRedis = true;

    await this.logAuditEvent({
      event_type: 'fallback_mode_disabled',
      component: 'dual_store_manager',
      severity: 'info',
      event_data: {
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Dual Store Manager...');

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await this.redis.shutdown();
    
    console.log('✅ Dual Store Manager shutdown complete');
  }
}

// Export singleton instance
export const dualStoreManager = DualStoreManager.getInstance();

// Export types
export type {
  Tweet,
  BotConfig,
  DailySum,
  AuditEvent,
  HealthStatus,
  ConsistencyReport,
  DualStoreConfig
};

// Export class
export { DualStoreManager };

// Default export
export default dualStoreManager;