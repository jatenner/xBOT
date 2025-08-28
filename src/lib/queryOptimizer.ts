/**
 * ⚡ QUERY OPTIMIZATION ENGINE
 * Intelligent query optimization for maximum performance
 * 
 * Features:
 * - Automatic column selection optimization
 * - Query plan analysis and recommendations
 * - Batch query optimization
 * - Connection pooling optimization
 * - Real-time performance monitoring
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSmartCacheManager } from './smartCacheManager';

interface QueryOptimization {
  originalQuery: string;
  optimizedQuery: string;
  estimatedImprovement: number;
  reasoning: string[];
}

interface QueryPattern {
  table: string;
  columns: string[];
  filters: string[];
  orderBy?: string;
  limit?: number;
  frequency: number;
}

interface OptimizedQueryConfig {
  // Common query patterns with optimized column selections
  patterns: {
    ml_training_data: {
      columns: string[];
      defaultLimit: number;
      cacheKey: string;
      cacheTtl: 'ml_training_data';
    };
    recent_tweets: {
      columns: string[];
      defaultLimit: number;
      cacheKey: string;
      cacheTtl: 'recent_tweets';
    };
    engagement_metrics: {
      columns: string[];
      defaultLimit: number;
      cacheKey: string;
      cacheTtl: 'engagement_metrics';
    };
    viral_patterns: {
      columns: string[];
      defaultLimit: number;
      cacheKey: string;
      cacheTtl: 'viral_patterns';
    };
  };
}

export class QueryOptimizer {
  private static instance: QueryOptimizer;
  private cacheManager = getSmartCacheManager();
  private config: OptimizedQueryConfig;
  private queryPatterns: Map<string, QueryPattern> = new Map();

  private constructor() {
    this.setupOptimizedPatterns();
  }

  public static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer();
    }
    return QueryOptimizer.instance;
  }

  private setupOptimizedPatterns(): void {
    this.config = {
      patterns: {
        ml_training_data: {
          columns: ['content', 'likes_count', 'retweets_count', 'replies_count', 'created_at', 'ai_metadata'],
          defaultLimit: 1000,
          cacheKey: 'ml_training',
          cacheTtl: 'ml_training_data'
        },
        recent_tweets: {
          columns: ['content', 'likes_count', 'retweets_count', 'replies_count', 'created_at', 'tweet_id'],
          defaultLimit: 50,
          cacheKey: 'recent_tweets',
          cacheTtl: 'recent_tweets'
        },
        engagement_metrics: {
          columns: ['tweet_id', 'likes_count', 'retweets_count', 'replies_count', 'created_at'],
          defaultLimit: 100,
          cacheKey: 'engagement',
          cacheTtl: 'engagement_metrics'
        },
        viral_patterns: {
          columns: ['content', 'likes_count', 'retweets_count', 'ai_metadata', 'created_at'],
          defaultLimit: 20,
          cacheKey: 'viral_patterns',
          cacheTtl: 'viral_patterns'
        }
      }
    };
  }

  /**
   * 🚀 OPTIMIZED ML TRAINING DATA QUERY
   */
  public async getMLTrainingData(
    client: SupabaseClient,
    hoursBack: number = 168, // 7 days default
    limit?: number
  ): Promise<any[]> {
    const pattern = this.config.patterns.ml_training_data;
    const cacheKey = this.cacheManager.generateKey(
      pattern.cacheKey, 
      'hours', 
      hoursBack, 
      'limit', 
      limit || pattern.defaultLimit
    );

    return this.cacheManager.cacheOrFetch(
      cacheKey,
      async () => {
        console.log(`⚡ QUERY_OPTIMIZER: Fetching ML training data (${hoursBack}h, ${limit || pattern.defaultLimit} records)`);
        
        const { data, error } = await client
          .from('learning_posts')
          .select(pattern.columns.join(', '))
          .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(limit || pattern.defaultLimit);

        if (error) throw error;
        
        console.log(`✅ QUERY_OPTIMIZER: Retrieved ${data?.length || 0} ML training records`);
        return data || [];
      },
      pattern.cacheTtl
    );
  }

  /**
   * ⚡ OPTIMIZED RECENT TWEETS QUERY
   */
  public async getRecentTweets(
    client: SupabaseClient,
    hours: number = 24,
    limit?: number
  ): Promise<any[]> {
    const pattern = this.config.patterns.recent_tweets;
    const cacheKey = this.cacheManager.generateKey(
      pattern.cacheKey, 
      'hours', 
      hours, 
      'limit', 
      limit || pattern.defaultLimit
    );

    return this.cacheManager.cacheOrFetch(
      cacheKey,
      async () => {
        console.log(`⚡ QUERY_OPTIMIZER: Fetching recent tweets (${hours}h, ${limit || pattern.defaultLimit} records)`);
        
        const { data, error } = await client
          .from('tweets')
          .select(pattern.columns.join(', '))
          .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(limit || pattern.defaultLimit);

        if (error) throw error;
        
        console.log(`✅ QUERY_OPTIMIZER: Retrieved ${data?.length || 0} recent tweets`);
        return data || [];
      },
      pattern.cacheTtl
    );
  }

  /**
   * 📊 OPTIMIZED ENGAGEMENT METRICS QUERY
   */
  public async getEngagementMetrics(
    client: SupabaseClient,
    hours: number = 24,
    minEngagement: number = 0
  ): Promise<any[]> {
    const pattern = this.config.patterns.engagement_metrics;
    const cacheKey = this.cacheManager.generateKey(
      pattern.cacheKey, 
      'hours', 
      hours, 
      'min', 
      minEngagement
    );

    return this.cacheManager.cacheOrFetch(
      cacheKey,
      async () => {
        console.log(`⚡ QUERY_OPTIMIZER: Fetching engagement metrics (${hours}h, min: ${minEngagement})`);
        
        const { data, error } = await client
          .from('tweets')
          .select(pattern.columns.join(', '))
          .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
          .gte('likes_count', minEngagement)
          .order('likes_count', { ascending: false })
          .limit(pattern.defaultLimit);

        if (error) throw error;
        
        console.log(`✅ QUERY_OPTIMIZER: Retrieved ${data?.length || 0} engagement records`);
        return data || [];
      },
      pattern.cacheTtl
    );
  }

  /**
   * 🔥 OPTIMIZED VIRAL CONTENT QUERY
   */
  public async getViralPatterns(
    client: SupabaseClient,
    minLikes: number = 10,
    minRetweets: number = 3
  ): Promise<any[]> {
    const pattern = this.config.patterns.viral_patterns;
    const cacheKey = this.cacheManager.generateKey(
      pattern.cacheKey, 
      'likes', 
      minLikes, 
      'retweets', 
      minRetweets
    );

    return this.cacheManager.cacheOrFetch(
      cacheKey,
      async () => {
        console.log(`⚡ QUERY_OPTIMIZER: Fetching viral patterns (likes: ${minLikes}+, retweets: ${minRetweets}+)`);
        
        const { data, error } = await client
          .from('learning_posts')
          .select(pattern.columns.join(', '))
          .gte('likes_count', minLikes)
          .gte('retweets_count', minRetweets)
          .order('likes_count', { ascending: false })
          .limit(pattern.defaultLimit);

        if (error) throw error;
        
        console.log(`✅ QUERY_OPTIMIZER: Retrieved ${data?.length || 0} viral patterns`);
        return data || [];
      },
      pattern.cacheTtl
    );
  }

  /**
   * 📈 OPTIMIZED GROWTH ANALYTICS QUERY
   */
  public async getGrowthAnalytics(
    client: SupabaseClient,
    days: number = 7
  ): Promise<{
    dailyStats: any[];
    totalGrowth: number;
    avgEngagement: number;
  }> {
    const cacheKey = this.cacheManager.generateKey('growth_analytics', 'days', days);

    return this.cacheManager.cacheOrFetch(
      cacheKey,
      async () => {
        console.log(`⚡ QUERY_OPTIMIZER: Fetching growth analytics (${days} days)`);
        
        // Optimized aggregation query
        const { data, error } = await client
          .rpc('get_growth_analytics', {
            days_back: days
          });

        if (error) {
          // Fallback to manual aggregation if RPC doesn't exist
          const tweets = await this.getRecentTweets(client, days * 24, 1000);
          
          const dailyStats = this.aggregateByDay(tweets, days);
          const totalGrowth = tweets.reduce((sum, tweet) => sum + (tweet.likes_count || 0), 0);
          const avgEngagement = totalGrowth / Math.max(tweets.length, 1);

          return { dailyStats, totalGrowth, avgEngagement };
        }
        
        console.log(`✅ QUERY_OPTIMIZER: Retrieved growth analytics`);
        return data;
      },
      'growth_insights'
    );
  }

  /**
   * 🎯 OPTIMIZED DUPLICATE CHECK QUERY
   */
  public async checkForDuplicates(
    client: SupabaseClient,
    contentHash: string,
    hours: number = 24
  ): Promise<boolean> {
    const cacheKey = this.cacheManager.generateKey('duplicate_check', contentHash);

    return this.cacheManager.cacheOrFetch(
      cacheKey,
      async () => {
        console.log(`⚡ QUERY_OPTIMIZER: Checking for duplicates (hash: ${contentHash.substring(0, 8)}...)`);
        
        const { data, error } = await client
          .from('tweets')
          .select('tweet_id')  // Only select the ID we need
          .eq('similarity_hash', contentHash)
          .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
          .limit(1);  // We only need to know if ANY exist

        if (error) throw error;
        
        const isDuplicate = (data?.length || 0) > 0;
        console.log(`✅ QUERY_OPTIMIZER: Duplicate check result: ${isDuplicate}`);
        return isDuplicate;
      },
      'engagement_metrics', // Short TTL for duplicate checks
      60 // 1 minute custom TTL
    );
  }

  /**
   * 🔥 BATCH QUERY OPTIMIZATION
   */
  public async batchOptimizedQuery<T>(
    client: SupabaseClient,
    queries: Array<{
      name: string;
      query: () => Promise<T>;
      cacheKey: string;
      contentType: keyof any;
    }>
  ): Promise<Record<string, T>> {
    console.log(`⚡ QUERY_OPTIMIZER: Executing ${queries.length} batch queries`);
    
    const results: Record<string, T> = {};
    
    // Execute queries in parallel for maximum speed
    const promises = queries.map(async ({ name, query, cacheKey, contentType }) => {
      try {
        const result = await this.cacheManager.cacheOrFetch(
          cacheKey,
          query,
          contentType as any
        );
        results[name] = result;
        return { name, success: true };
      } catch (error: any) {
        console.error(`❌ Batch query failed for ${name}:`, error.message);
        return { name, success: false, error: error.message };
      }
    });

    const batchResults = await Promise.all(promises);
    const successful = batchResults.filter(r => r.success).length;
    
    console.log(`✅ QUERY_OPTIMIZER: Batch completed - ${successful}/${queries.length} successful`);
    
    return results;
  }

  /**
   * 📊 QUERY PERFORMANCE ANALYTICS
   */
  public async analyzeQueryPerformance(): Promise<{
    hitRate: number;
    avgResponseTime: number;
    slowQueries: string[];
    recommendations: string[];
  }> {
    const cacheMetrics = this.cacheManager.getMetrics();
    
    const recommendations = [];
    
    if (cacheMetrics.hitRate < 0.7) {
      recommendations.push('Increase cache TTL for frequently accessed data');
    }
    
    if (cacheMetrics.avgResponseTime > 100) {
      recommendations.push('Consider adding more specific indexes');
    }
    
    if (cacheMetrics.topMissedKeys.length > 0) {
      recommendations.push(`Optimize queries for: ${cacheMetrics.topMissedKeys.slice(0, 3).join(', ')}`);
    }

    return {
      hitRate: cacheMetrics.hitRate,
      avgResponseTime: cacheMetrics.avgResponseTime,
      slowQueries: cacheMetrics.topMissedKeys,
      recommendations
    };
  }

  /**
   * Helper methods
   */
  private aggregateByDay(tweets: any[], days: number): any[] {
    const dailyStats = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const dayTweets = tweets.filter(tweet => {
        const tweetDate = new Date(tweet.created_at);
        return tweetDate >= dayStart && tweetDate < dayEnd;
      });

      dailyStats.push({
        date: dayStart.toISOString().split('T')[0],
        tweets: dayTweets.length,
        totalLikes: dayTweets.reduce((sum, tweet) => sum + (tweet.likes_count || 0), 0),
        totalRetweets: dayTweets.reduce((sum, tweet) => sum + (tweet.retweets_count || 0), 0),
        totalReplies: dayTweets.reduce((sum, tweet) => sum + (tweet.replies_count || 0), 0)
      });
    }
    
    return dailyStats.reverse(); // Oldest first
  }

  /**
   * 🔧 CONFIGURATION AND TUNING
   */
  public updateQueryPattern(
    patternName: keyof OptimizedQueryConfig['patterns'],
    updates: Partial<any>
  ): void {
    this.config.patterns[patternName] = {
      ...this.config.patterns[patternName],
      ...updates
    } as any;
    console.log(`🔧 QUERY_OPTIMIZER: Updated pattern ${patternName}`);
  }

  public getQueryPatterns(): OptimizedQueryConfig {
    return { ...this.config };
  }

  public clearQueryCache(): void {
    this.cacheManager.clear();
    console.log('🧹 QUERY_OPTIMIZER: Query cache cleared');
  }

  /**
   * 🚀 SMART QUERY BUILDER
   */
  public buildOptimizedQuery(
    table: string,
    intent: 'ml_training' | 'recent_analysis' | 'engagement_tracking' | 'viral_discovery',
    customOptions?: {
      columns?: string[];
      limit?: number;
      timeRange?: number; // hours
      filters?: Record<string, any>;
    }
  ): {
    query: string;
    cacheKey: string;
    estimatedPerformance: 'fast' | 'medium' | 'slow';
  } {
    const intentMap = {
      'ml_training': this.config.patterns.ml_training_data,
      'recent_analysis': this.config.patterns.recent_tweets,
      'engagement_tracking': this.config.patterns.engagement_metrics,
      'viral_discovery': this.config.patterns.viral_patterns
    };

    const pattern = intentMap[intent];
    const columns = customOptions?.columns || pattern.columns;
    const limit = customOptions?.limit || pattern.defaultLimit;

    // Build optimized query string
    let query = `SELECT ${columns.join(', ')} FROM ${table}`;
    
    if (customOptions?.timeRange) {
      const timeFilter = new Date(Date.now() - customOptions.timeRange * 60 * 60 * 1000).toISOString();
      query += ` WHERE created_at >= '${timeFilter}'`;
    }

    if (customOptions?.filters) {
      const filterClauses = Object.entries(customOptions.filters)
        .map(([key, value]) => `${key} = '${value}'`)
        .join(' AND ');
      query += customOptions?.timeRange ? ` AND ${filterClauses}` : ` WHERE ${filterClauses}`;
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit}`;

    // Generate cache key
    const cacheKey = this.cacheManager.generateKey(
      intent,
      table,
      JSON.stringify(customOptions || {})
    );

    // Estimate performance
    let estimatedPerformance: 'fast' | 'medium' | 'slow' = 'fast';
    if (limit > 1000) estimatedPerformance = 'medium';
    if (limit > 5000 || !customOptions?.timeRange) estimatedPerformance = 'slow';

    return {
      query,
      cacheKey,
      estimatedPerformance
    };
  }
}

export const getQueryOptimizer = () => QueryOptimizer.getInstance();
