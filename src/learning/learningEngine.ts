/**
 * 🧠 LEARNING ENGINE - REAL DATA ONLY
 * 
 * Enforces strict real-data-only learning with guardrails against mock data.
 * Uses EWMA for outcome tracking and adjusts content generation strategies.
 */

import { supabaseClient } from '../db/supabaseClient';
import { redisCache } from '../cache/redisCache';

export interface LearningData {
  post_id: string;
  content: string;
  posted_at: Date;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    bookmarks?: number;
    impressions?: number;
  };
  derived: {
    engagement_rate: number;
    viral_score: number;
    hook_type?: string;
    topic_class?: string;
  };
}

export interface LearningInsight {
  insight_type: string;
  metric: string;
  value: number;
  confidence: number;
  recommendation: string;
  sample_size: number;
}

export interface LearningResult {
  insights_generated: number;
  data_points_processed: number;
  real_data_ratio: number;
  recommendations: string[];
  ewma_updates: number;
}

export class LearningEngine {
  private static instance: LearningEngine;
  
  // EWMA parameters
  private readonly ALPHA = 0.3; // Learning rate
  private readonly MIN_SAMPLE_SIZE = 10; // Minimum data points required
  private readonly REAL_DATA_THRESHOLD = 0.95; // 95% real data required

  // Learning is enabled only when explicitly configured
  private readonly learningEnabled = process.env.ENABLE_BANDIT_LEARNING === 'true';

  private constructor() {
    console.log(`🧠 LEARNING_ENGINE: Initialized (enabled: ${this.learningEnabled})`);
  }

  public static getInstance(): LearningEngine {
    if (!LearningEngine.instance) {
      LearningEngine.instance = new LearningEngine();
    }
    return LearningEngine.instance;
  }

  /**
   * 🎯 Main learning pipeline with real data enforcement
   */
  async learn(): Promise<LearningResult> {
    if (!this.learningEnabled) {
      console.log('🔒 LEARNING_DISABLED: ENABLE_BANDIT_LEARNING not set to true');
      return {
        insights_generated: 0,
        data_points_processed: 0,
        real_data_ratio: 0,
        recommendations: ['Learning disabled - set ENABLE_BANDIT_LEARNING=true'],
        ewma_updates: 0
      };
    }

    console.log('🧠 LEARNING_PIPELINE: Starting real-data-only learning...');

    try {
      // Step 1: Validate data sources
      const dataValidation = await this.validateDataSources();
      if (!dataValidation.passed) {
        console.error('❌ REAL_DATA_REQUIRED:', dataValidation.violations);
        return {
          insights_generated: 0,
          data_points_processed: 0,
          real_data_ratio: dataValidation.real_data_ratio,
          recommendations: dataValidation.violations,
          ewma_updates: 0
        };
      }

      // Step 2: Collect verified real data
      const realData = await this.collectRealData();
      
      if (realData.length < this.MIN_SAMPLE_SIZE) {
        console.warn(`⚠️ INSUFFICIENT_DATA: Need ${this.MIN_SAMPLE_SIZE}, got ${realData.length}`);
        return {
          insights_generated: 0,
          data_points_processed: realData.length,
          real_data_ratio: 1.0,
          recommendations: [`Need at least ${this.MIN_SAMPLE_SIZE} real data points for learning`],
          ewma_updates: 0
        };
      }

      // Step 3: Generate insights from real data
      const insights = await this.generateInsights(realData);
      
      // Step 4: Update EWMA models
      const ewmaUpdates = await this.updateEWMAModels(realData);
      
      // Step 5: Generate recommendations
      const recommendations = await this.generateRecommendations(insights);

      console.log(`✅ LEARNING_COMPLETE: ${insights.length} insights from ${realData.length} real data points`);

      return {
        insights_generated: insights.length,
        data_points_processed: realData.length,
        real_data_ratio: 1.0,
        recommendations,
        ewma_updates: ewmaUpdates
      };

    } catch (error) {
      console.error('❌ LEARNING_ERROR:', error);
      return {
        insights_generated: 0,
        data_points_processed: 0,
        real_data_ratio: 0,
        recommendations: ['Learning failed: ' + (error as Error).message],
        ewma_updates: 0
      };
    }
  }

  /**
   * 🔍 Validate that all data sources are real (no mock data)
   */
  private async validateDataSources(): Promise<{
    passed: boolean;
    real_data_ratio: number;
    violations: string[];
  }> {
    console.log('🔍 DATA_VALIDATION: Checking for mock data...');

    const violations: string[] = [];

    // Check for mock data indicators in post_metrics
    const mockIndicators = [
      'mock_',
      'test_',
      'dummy_',
      'fake_',
      'example_'
    ];

    const { data: recentPosts } = await supabaseClient.safeSelect('posts', {
      order: { column: 'created_at', ascending: false },
      limit: 100
    });

    if (!recentPosts) {
      violations.push('No posts found in database');
      return { passed: false, real_data_ratio: 0, violations };
    }

    let realDataCount = 0;
    let totalDataCount = recentPosts.length;

    for (const post of recentPosts) {
      let isReal = true;

      // Check tweet_id for mock patterns
      for (const indicator of mockIndicators) {
        if (post.tweet_id?.toLowerCase().includes(indicator)) {
          isReal = false;
          violations.push(`Mock tweet_id detected: ${post.tweet_id}`);
          break;
        }
      }

      // Check content for mock patterns
      if (post.content?.includes('mock') || post.content?.includes('test content')) {
        isReal = false;
        violations.push(`Mock content detected in post: ${post.tweet_id}`);
      }

      // Check metrics - real Twitter metrics should have variation
      if (post.likes === 0 && post.retweets === 0 && post.replies === 0 && post.impressions === 0) {
        // Could be real but brand new, not necessarily mock
      }

      if (isReal) {
        realDataCount++;
      }
    }

    const realDataRatio = totalDataCount > 0 ? realDataCount / totalDataCount : 0;

    const passed = realDataRatio >= this.REAL_DATA_THRESHOLD && violations.length === 0;

    console.log(`📊 DATA_VALIDATION: ${realDataCount}/${totalDataCount} real (${(realDataRatio * 100).toFixed(1)}%)`);

    return {
      passed,
      real_data_ratio: realDataRatio,
      violations: violations.slice(0, 5) // Limit violations shown
    };
  }

  /**
   * 📊 Collect verified real data for learning
   */
  private async collectRealData(): Promise<LearningData[]> {
    console.log('📊 DATA_COLLECTION: Gathering real metrics...');

    // Get posts with their metrics
    const { data: posts } = await supabaseClient.safeSelect('posts', {
      order: { column: 'posted_at', ascending: false },
      limit: 50
    });

    if (!posts) {
      return [];
    }

    const learningData: LearningData[] = [];

    for (const post of posts) {
      // Skip posts without real tweet IDs
      if (!post.tweet_id || post.tweet_id.includes('mock') || post.tweet_id.includes('test')) {
        continue;
      }

      // Get latest metrics for this post
      const { data: metrics } = await supabaseClient.safeSelect('post_metrics', {
        filter: { post_id: post.tweet_id },
        order: { column: 'collected_at', ascending: false },
        limit: 1
      });

      const latestMetrics = metrics?.[0];
      
      if (!latestMetrics) {
        // Use post-level metrics if available
        if (post.likes || post.retweets || post.replies) {
          learningData.push(this.buildLearningData(post, {
            likes: post.likes || 0,
            retweets: post.retweets || 0,
            replies: post.replies || 0,
            impressions: post.impressions || 0
          }));
        }
        continue;
      }

      learningData.push(this.buildLearningData(post, {
        likes: latestMetrics.likes || 0,
        retweets: latestMetrics.retweets || 0,
        replies: latestMetrics.replies || 0,
        bookmarks: latestMetrics.bookmarks || 0,
        impressions: latestMetrics.impressions || 0
      }));
    }

    console.log(`📊 REAL_DATA_COLLECTED: ${learningData.length} verified posts`);
    return learningData;
  }

  /**
   * 🏗️ Build learning data structure
   */
  private buildLearningData(post: any, metrics: any): LearningData {
    const totalEngagement = metrics.likes + metrics.retweets + metrics.replies;
    const engagementRate = metrics.impressions > 0 ? totalEngagement / metrics.impressions : 0;
    const viralScore = (metrics.likes * 1) + (metrics.retweets * 3) + (metrics.replies * 2);

    return {
      post_id: post.tweet_id,
      content: post.content,
      posted_at: new Date(post.posted_at),
      metrics,
      derived: {
        engagement_rate: engagementRate,
        viral_score: viralScore,
        hook_type: this.classifyHookType(post.content),
        topic_class: this.classifyTopic(post.content)
      }
    };
  }

  /**
   * 💡 Generate insights from real data
   */
  private async generateInsights(data: LearningData[]): Promise<LearningInsight[]> {
    console.log('💡 INSIGHT_GENERATION: Analyzing patterns...');

    const insights: LearningInsight[] = [];

    // Hook type performance analysis
    const hookPerformance = this.analyzeHookPerformance(data);
    for (const [hookType, performance] of Object.entries(hookPerformance)) {
      if (performance.count >= 3) { // Minimum sample size for insight
        insights.push({
          insight_type: 'hook_performance',
          metric: 'engagement_rate',
          value: performance.avg_engagement,
          confidence: Math.min(performance.count / 10, 1.0),
          recommendation: `${hookType} hooks show ${performance.avg_engagement.toFixed(3)} avg engagement`,
          sample_size: performance.count
        });
      }
    }

    // Topic performance analysis
    const topicPerformance = this.analyzeTopicPerformance(data);
    for (const [topic, performance] of Object.entries(topicPerformance)) {
      if (performance.count >= 3) {
        insights.push({
          insight_type: 'topic_performance',
          metric: 'viral_score',
          value: performance.avg_viral_score,
          confidence: Math.min(performance.count / 10, 1.0),
          recommendation: `${topic} topics average ${performance.avg_viral_score.toFixed(1)} viral score`,
          sample_size: performance.count
        });
      }
    }

    console.log(`💡 INSIGHTS_GENERATED: ${insights.length} actionable insights`);
    return insights;
  }

  /**
   * 📈 Update EWMA models with new data
   */
  private async updateEWMAModels(data: LearningData[]): Promise<number> {
    console.log('📈 EWMA_UPDATE: Updating exponential moving averages...');

    let updateCount = 0;

    // Update hook type EWMAs
    for (const item of data) {
      if (!item.derived.hook_type) continue;

      const hookKey = `ewma:hook:${item.derived.hook_type}`;
      const currentEWMA = await redisCache.get<number>(hookKey);
      
      if (currentEWMA.success && currentEWMA.data !== undefined) {
        const newEWMA = (this.ALPHA * item.derived.engagement_rate) + 
                       ((1 - this.ALPHA) * currentEWMA.data);
        await redisCache.set(hookKey, newEWMA, 86400 * 30); // 30 days
      } else {
        await redisCache.set(hookKey, item.derived.engagement_rate, 86400 * 30);
      }
      
      updateCount++;
    }

    // Update topic EWMAs
    for (const item of data) {
      if (!item.derived.topic_class) continue;

      const topicKey = `ewma:topic:${item.derived.topic_class}`;
      const currentEWMA = await redisCache.get<number>(topicKey);
      
      if (currentEWMA.success && currentEWMA.data !== undefined) {
        const newEWMA = (this.ALPHA * item.derived.viral_score) + 
                       ((1 - this.ALPHA) * currentEWMA.data);
        await redisCache.set(topicKey, newEWMA, 86400 * 30);
      } else {
        await redisCache.set(topicKey, item.derived.viral_score, 86400 * 30);
      }
      
      updateCount++;
    }

    console.log(`📈 EWMA_UPDATED: ${updateCount} model parameters updated`);
    return updateCount;
  }

  /**
   * 🎯 Generate actionable recommendations
   */
  private async generateRecommendations(insights: LearningInsight[]): Promise<string[]> {
    const recommendations: string[] = [];

    // Find best performing hook types
    const hookInsights = insights.filter(i => i.insight_type === 'hook_performance');
    if (hookInsights.length > 0) {
      const bestHook = hookInsights.reduce((best, current) => 
        current.value > best.value ? current : best
      );
      recommendations.push(`Use "${bestHook.metric}" hooks more frequently (${(bestHook.value * 100).toFixed(1)}% engagement)`);
    }

    // Find best performing topics
    const topicInsights = insights.filter(i => i.insight_type === 'topic_performance');
    if (topicInsights.length > 0) {
      const bestTopic = topicInsights.reduce((best, current) => 
        current.value > best.value ? current : best
      );
      recommendations.push(`Focus on "${bestTopic.metric}" topics (${bestTopic.value.toFixed(1)} avg viral score)`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Insufficient data for specific recommendations - continue collecting real engagement data');
    }

    return recommendations;
  }

  // Helper methods for classification
  private classifyHookType(content: string): string {
    if (content.includes('?')) return 'question';
    if (content.match(/\d+%/)) return 'statistic';
    if (content.toLowerCase().includes('research') || content.toLowerCase().includes('study')) return 'evidence';
    if (content.toLowerCase().includes('why') || content.toLowerCase().includes('how')) return 'explanation';
    return 'general';
  }

  private classifyTopic(content: string): string {
    const lower = content.toLowerCase();
    if (lower.includes('sleep')) return 'sleep';
    if (lower.includes('exercise') || lower.includes('workout')) return 'exercise';
    if (lower.includes('nutrition') || lower.includes('diet')) return 'nutrition';
    if (lower.includes('supplement')) return 'supplements';
    if (lower.includes('mental') || lower.includes('stress')) return 'mental_health';
    return 'general_health';
  }

  private analyzeHookPerformance(data: LearningData[]): Record<string, any> {
    const performance: Record<string, { total_engagement: number; count: number; avg_engagement: number }> = {};

    for (const item of data) {
      if (!item.derived.hook_type) continue;

      if (!performance[item.derived.hook_type]) {
        performance[item.derived.hook_type] = { total_engagement: 0, count: 0, avg_engagement: 0 };
      }

      performance[item.derived.hook_type].total_engagement += item.derived.engagement_rate;
      performance[item.derived.hook_type].count++;
    }

    // Calculate averages
    for (const hookType of Object.keys(performance)) {
      performance[hookType].avg_engagement = 
        performance[hookType].total_engagement / performance[hookType].count;
    }

    return performance;
  }

  private analyzeTopicPerformance(data: LearningData[]): Record<string, any> {
    const performance: Record<string, { total_viral: number; count: number; avg_viral_score: number }> = {};

    for (const item of data) {
      if (!item.derived.topic_class) continue;

      if (!performance[item.derived.topic_class]) {
        performance[item.derived.topic_class] = { total_viral: 0, count: 0, avg_viral_score: 0 };
      }

      performance[item.derived.topic_class].total_viral += item.derived.viral_score;
      performance[item.derived.topic_class].count++;
    }

    // Calculate averages
    for (const topic of Object.keys(performance)) {
      performance[topic].avg_viral_score = 
        performance[topic].total_viral / performance[topic].count;
    }

    return performance;
  }
}

export default LearningEngine;
