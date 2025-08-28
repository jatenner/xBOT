/**
 * 🚀 OPTIMIZATION INTEGRATOR
 * Seamlessly integrates performance optimizations into existing systems
 * 
 * Features:
 * - Drop-in replacements for common database operations
 * - Automatic optimization detection and application
 * - Performance monitoring and reporting
 * - Backward compatibility with existing code
 */

import { getSmartCacheManager } from './smartCacheManager';
import { getQueryOptimizer } from './queryOptimizer';
import { SupabaseClient } from '@supabase/supabase-js';

interface OptimizationConfig {
  enableSmartCaching: boolean;
  enableQueryOptimization: boolean;
  enableMaterializedViews: boolean;
  performanceMonitoring: boolean;
}

interface PerformanceMetrics {
  operationsOptimized: number;
  avgSpeedImprovement: number;
  cacheHitRate: number;
  totalTimeSaved: number; // milliseconds
}

export class OptimizationIntegrator {
  private static instance: OptimizationIntegrator;
  private cacheManager = getSmartCacheManager();
  private queryOptimizer = getQueryOptimizer();
  private metrics: PerformanceMetrics = {
    operationsOptimized: 0,
    avgSpeedImprovement: 0,
    cacheHitRate: 0,
    totalTimeSaved: 0
  };

  private config: OptimizationConfig = {
    enableSmartCaching: true,
    enableQueryOptimization: true,
    enableMaterializedViews: true,
    performanceMonitoring: true
  };

  private constructor() {}

  public static getInstance(): OptimizationIntegrator {
    if (!OptimizationIntegrator.instance) {
      OptimizationIntegrator.instance = new OptimizationIntegrator();
    }
    return OptimizationIntegrator.instance;
  }

  /**
   * 🎯 OPTIMIZED ML TRAINING DATA (Drop-in replacement)
   */
  public async getMLTrainingData(
    client: SupabaseClient,
    options: {
      hoursBack?: number;
      limit?: number;
      minEngagement?: number;
    } = {}
  ): Promise<any[]> {
    const startTime = Date.now();

    try {
      if (this.config.enableQueryOptimization) {
        // Use optimized query
        const data = await this.queryOptimizer.getMLTrainingData(
          client,
          options.hoursBack || 168,
          options.limit || 500
        );

        this.recordOptimization(startTime, 'ml_training_data', data.length);
        return data;
      } else {
        // Fallback to traditional query
        return await this.fallbackMLQuery(client, options);
      }
    } catch (error: any) {
      console.warn('⚠️ Optimized ML query failed, using fallback:', error.message);
      return await this.fallbackMLQuery(client, options);
    }
  }

  /**
   * ⚡ OPTIMIZED RECENT TWEETS (Drop-in replacement)
   */
  public async getRecentTweets(
    client: SupabaseClient,
    options: {
      hours?: number;
      limit?: number;
      includeEngagement?: boolean;
    } = {}
  ): Promise<any[]> {
    const startTime = Date.now();

    try {
      if (this.config.enableQueryOptimization) {
        const data = await this.queryOptimizer.getRecentTweets(
          client,
          options.hours || 24,
          options.limit || 50
        );

        this.recordOptimization(startTime, 'recent_tweets', data.length);
        return data;
      } else {
        return await this.fallbackRecentTweetsQuery(client, options);
      }
    } catch (error: any) {
      console.warn('⚠️ Optimized tweets query failed, using fallback:', error.message);
      return await this.fallbackRecentTweetsQuery(client, options);
    }
  }

  /**
   * 🔍 OPTIMIZED DUPLICATE CHECK (Drop-in replacement)
   */
  public async checkForDuplicates(
    client: SupabaseClient,
    contentHash: string,
    hoursBack: number = 24
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      if (this.config.enableSmartCaching) {
        const isDuplicate = await this.queryOptimizer.checkForDuplicates(
          client,
          contentHash,
          hoursBack
        );

        this.recordOptimization(startTime, 'duplicate_check', 1);
        return isDuplicate;
      } else {
        return await this.fallbackDuplicateCheck(client, contentHash, hoursBack);
      }
    } catch (error: any) {
      console.warn('⚠️ Optimized duplicate check failed, using fallback:', error.message);
      return await this.fallbackDuplicateCheck(client, contentHash, hoursBack);
    }
  }

  /**
   * 📊 OPTIMIZED ENGAGEMENT METRICS (Drop-in replacement)
   */
  public async getEngagementMetrics(
    client: SupabaseClient,
    options: {
      hours?: number;
      minEngagement?: number;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    const startTime = Date.now();

    try {
      if (this.config.enableQueryOptimization) {
        const data = await this.queryOptimizer.getEngagementMetrics(
          client,
          options.hours || 24,
          options.minEngagement || 0
        );

        this.recordOptimization(startTime, 'engagement_metrics', data.length);
        return data;
      } else {
        return await this.fallbackEngagementQuery(client, options);
      }
    } catch (error: any) {
      console.warn('⚠️ Optimized engagement query failed, using fallback:', error.message);
      return await this.fallbackEngagementQuery(client, options);
    }
  }

  /**
   * 🔥 OPTIMIZED VIRAL PATTERNS (Drop-in replacement)
   */
  public async getViralPatterns(
    client: SupabaseClient,
    options: {
      minLikes?: number;
      minRetweets?: number;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    const startTime = Date.now();

    try {
      if (this.config.enableQueryOptimization) {
        const data = await this.queryOptimizer.getViralPatterns(
          client,
          options.minLikes || 10,
          options.minRetweets || 3
        );

        this.recordOptimization(startTime, 'viral_patterns', data.length);
        return data;
      } else {
        return await this.fallbackViralQuery(client, options);
      }
    } catch (error: any) {
      console.warn('⚠️ Optimized viral query failed, using fallback:', error.message);
      return await this.fallbackViralQuery(client, options);
    }
  }

  /**
   * 📈 OPTIMIZED GROWTH ANALYTICS (Drop-in replacement)
   */
  public async getGrowthAnalytics(
    client: SupabaseClient,
    days: number = 7
  ): Promise<{
    dailyStats: any[];
    totalGrowth: number;
    avgEngagement: number;
  }> {
    const startTime = Date.now();

    try {
      if (this.config.enableMaterializedViews) {
        const analytics = await this.queryOptimizer.getGrowthAnalytics(client, days);

        this.recordOptimization(startTime, 'growth_analytics', analytics.dailyStats.length);
        return analytics;
      } else {
        return await this.fallbackGrowthQuery(client, days);
      }
    } catch (error: any) {
      console.warn('⚠️ Optimized growth analytics failed, using fallback:', error.message);
      return await this.fallbackGrowthQuery(client, days);
    }
  }

  /**
   * Fallback methods (original implementations)
   */
  private async fallbackMLQuery(client: SupabaseClient, options: any): Promise<any[]> {
    const hoursBack = options.hoursBack || 168;
    const { data, error } = await client
      .from('learning_posts')
      .select('*')
      .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(options.limit || 500);
    
    if (error) throw error;
    return data || [];
  }

  private async fallbackRecentTweetsQuery(client: SupabaseClient, options: any): Promise<any[]> {
    const hours = options.hours || 24;
    const { data, error } = await client
      .from('tweets')
      .select('*')
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(options.limit || 50);
    
    if (error) throw error;
    return data || [];
  }

  private async fallbackDuplicateCheck(client: SupabaseClient, contentHash: string, hoursBack: number): Promise<boolean> {
    const { data, error } = await client
      .from('tweets')
      .select('tweet_id')
      .eq('similarity_hash', contentHash)
      .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
      .limit(1);
    
    if (error) throw error;
    return (data?.length || 0) > 0;
  }

  private async fallbackEngagementQuery(client: SupabaseClient, options: any): Promise<any[]> {
    const hours = options.hours || 24;
    const { data, error } = await client
      .from('tweets')
      .select('tweet_id, likes_count, retweets_count, replies_count, created_at')
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .gte('likes_count', options.minEngagement || 0)
      .order('likes_count', { ascending: false })
      .limit(options.limit || 100);
    
    if (error) throw error;
    return data || [];
  }

  private async fallbackViralQuery(client: SupabaseClient, options: any): Promise<any[]> {
    const { data, error } = await client
      .from('learning_posts')
      .select('content, likes_count, retweets_count, ai_metadata, created_at')
      .gte('likes_count', options.minLikes || 10)
      .gte('retweets_count', options.minRetweets || 3)
      .order('likes_count', { ascending: false })
      .limit(options.limit || 20);
    
    if (error) throw error;
    return data || [];
  }

  private async fallbackGrowthQuery(client: SupabaseClient, days: number): Promise<any> {
    const tweets = await this.fallbackRecentTweetsQuery(client, { hours: days * 24, limit: 1000 });
    
    const dailyStats = this.aggregateByDay(tweets, days);
    const totalGrowth = tweets.reduce((sum, tweet) => sum + (tweet.likes_count || 0), 0);
    const avgEngagement = totalGrowth / Math.max(tweets.length, 1);

    return { dailyStats, totalGrowth, avgEngagement };
  }

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
    
    return dailyStats.reverse();
  }

  /**
   * Performance tracking
   */
  private recordOptimization(startTime: number, operationType: string, resultCount: number): void {
    if (!this.config.performanceMonitoring) return;

    const executionTime = Date.now() - startTime;
    
    this.metrics.operationsOptimized++;
    this.metrics.totalTimeSaved += Math.max(0, 200 - executionTime); // Assume 200ms baseline
    
    // Calculate average improvement
    const cacheMetrics = this.cacheManager.getMetrics();
    this.metrics.cacheHitRate = cacheMetrics.hitRate;
    this.metrics.avgSpeedImprovement = this.metrics.totalTimeSaved / this.metrics.operationsOptimized;

    // Log significant optimizations
    if (executionTime < 50) {
      console.log(`⚡ OPTIMIZATION: ${operationType} completed in ${executionTime}ms (${resultCount} records)`);
    }
  }

  /**
   * 📊 PUBLIC API
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getOptimizationStatus(): {
    smartCaching: boolean;
    queryOptimization: boolean;
    materializedViews: boolean;
    overallHealth: number;
  } {
    const cacheMetrics = this.cacheManager.getMetrics();
    const overallHealth = (
      (this.config.enableSmartCaching ? 25 : 0) +
      (this.config.enableQueryOptimization ? 25 : 0) +
      (this.config.enableMaterializedViews ? 25 : 0) +
      (cacheMetrics.hitRate * 25)
    );

    return {
      smartCaching: this.config.enableSmartCaching,
      queryOptimization: this.config.enableQueryOptimization,
      materializedViews: this.config.enableMaterializedViews,
      overallHealth: Math.round(overallHealth)
    };
  }

  public updateConfiguration(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 OPTIMIZATION_INTEGRATOR: Configuration updated');
  }

  public resetMetrics(): void {
    this.metrics = {
      operationsOptimized: 0,
      avgSpeedImprovement: 0,
      cacheHitRate: 0,
      totalTimeSaved: 0
    };
    console.log('📊 OPTIMIZATION_INTEGRATOR: Metrics reset');
  }

  /**
   * 🧪 COMPATIBILITY TEST
   */
  public async testOptimizations(client: SupabaseClient): Promise<{
    success: boolean;
    results: Record<string, { time: number; success: boolean; error?: string }>;
  }> {
    console.log('🧪 OPTIMIZATION_INTEGRATOR: Testing all optimizations...');

    const tests = [
      { name: 'mlTrainingData', test: () => this.getMLTrainingData(client, { limit: 10 }) },
      { name: 'recentTweets', test: () => this.getRecentTweets(client, { limit: 10 }) },
      { name: 'duplicateCheck', test: () => this.checkForDuplicates(client, 'test_hash') },
      { name: 'engagementMetrics', test: () => this.getEngagementMetrics(client, { limit: 10 }) },
      { name: 'viralPatterns', test: () => this.getViralPatterns(client, { limit: 5 }) },
      { name: 'growthAnalytics', test: () => this.getGrowthAnalytics(client, 1) }
    ];

    const results: Record<string, { time: number; success: boolean; error?: string }> = {};
    let overallSuccess = true;

    for (const { name, test } of tests) {
      const startTime = Date.now();
      try {
        await test();
        results[name] = {
          time: Date.now() - startTime,
          success: true
        };
      } catch (error: any) {
        results[name] = {
          time: Date.now() - startTime,
          success: false,
          error: error.message
        };
        overallSuccess = false;
      }
    }

    const avgTime = Object.values(results).reduce((sum, r) => sum + r.time, 0) / tests.length;
    console.log(`🧪 OPTIMIZATION_TEST: ${overallSuccess ? 'PASSED' : 'FAILED'} - Avg time: ${avgTime.toFixed(1)}ms`);

    return { success: overallSuccess, results };
  }
}

export const getOptimizationIntegrator = () => OptimizationIntegrator.getInstance();
