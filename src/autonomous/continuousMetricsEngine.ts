/**
 * 📊 CONTINUOUS METRICS ENGINE
 * Constantly monitors every posted tweet and learns from performance
 */

import { getRedisSafeClient } from '../lib/redisSafe';
import { getSafeDatabase } from '../lib/db';
import { RealTwitterMetricsCollector } from '../metrics/realTwitterMetricsCollector';

export interface PostMonitoringData {
  tweetId: string;
  content: string;
  format: 'single' | 'thread';
  topic: string;
  postedAt: Date;
  qualityScore: number;
  hook_type?: string;
  persona?: string;
  framework?: string;
}

export interface MetricsPhase {
  phase: string;
  delay: number; // minutes
  description: string;
}

export interface LearningInsight {
  tweetId: string;
  phase: string;
  topic: string;
  format: 'single' | 'thread';
  postedAt: Date;
  metrics: any;
  performanceTier: 'low' | 'medium' | 'high' | 'viral';
  insights: string[];
  timestamp: Date;
}

export class ContinuousMetricsEngine {
  private static instance: ContinuousMetricsEngine;
  private redis = getRedisSafeClient();
  private db = getSafeDatabase();
  private metricsCollector = RealTwitterMetricsCollector.getInstance();
  
  private readonly COLLECTION_PHASES: MetricsPhase[] = [
    { phase: '5min', delay: 5, description: 'Initial engagement check' },
    { phase: '15min', delay: 15, description: 'Early viral potential' },
    { phase: '1hour', delay: 60, description: 'Peak engagement window' },
    { phase: '3hour', delay: 180, description: 'Extended reach analysis' },
    { phase: '6hour', delay: 360, description: 'Full engagement cycle' },
    { phase: '24hour', delay: 1440, description: 'Daily performance summary' },
    { phase: '3day', delay: 4320, description: 'Long-tail engagement' },
    { phase: '1week', delay: 10080, description: 'Final performance assessment' }
  ];

  public static getInstance(): ContinuousMetricsEngine {
    if (!ContinuousMetricsEngine.instance) {
      ContinuousMetricsEngine.instance = new ContinuousMetricsEngine();
    }
    return ContinuousMetricsEngine.instance;
  }

  /**
   * 🚀 START MONITORING A NEW POST
   * Called immediately after posting
   */
  async startMonitoringPost(postData: PostMonitoringData): Promise<void> {
    console.log(`📊 MONITORING_START: Tweet ${postData.tweetId}`);
    console.log(`📝 Content: "${postData.content.substring(0, 50)}..."`);
    console.log(`🎯 Topic: ${postData.topic} | Format: ${postData.format} | Quality: ${postData.qualityScore}`);
    
    try {
      // Store initial post data
      await this.storeInitialPost(postData);
      
      // Schedule all collection phases
      await this.scheduleAllMetricsCollection(postData.tweetId);
      
      // Trigger immediate learning update
      await this.triggerInitialLearning(postData);
      
      console.log(`✅ MONITORING_SCHEDULED: ${this.COLLECTION_PHASES.length} phases scheduled for ${postData.tweetId}`);
      
    } catch (error) {
      console.error(`❌ MONITORING_START_FAILED: ${postData.tweetId}:`, error);
    }
  }

  /**
   * ⏰ SCHEDULE ALL METRICS COLLECTION PHASES
   */
  private async scheduleAllMetricsCollection(tweetId: string): Promise<void> {
    for (const phase of this.COLLECTION_PHASES) {
      // Schedule collection with Node.js timeout
      setTimeout(async () => {
        await this.collectAndLearn(tweetId, phase);
      }, phase.delay * 60 * 1000);
      
      // Store schedule in Redis for persistence/monitoring
      await this.storeCollectionSchedule(tweetId, phase);
    }
    
    console.log(`⏰ SCHEDULED: ${this.COLLECTION_PHASES.length} collection phases for ${tweetId}`);
  }

  /**
   * 📈 COLLECT METRICS AND TRIGGER LEARNING
   */
  private async collectAndLearn(tweetId: string, phase: MetricsPhase): Promise<void> {
    try {
      console.log(`📈 COLLECTING: ${tweetId} at ${phase.phase} (${phase.description})`);
      
      // Collect current metrics
      const metrics = await this.metricsCollector.collectMetrics(tweetId);
      
      if (metrics) {
        // Store metrics with phase info
        await this.storeMetricsWithPhase(metrics, phase.phase);
        
        // Trigger immediate learning
        await this.triggerImmediateLearning(tweetId, metrics, phase.phase);
        
        // Update performance patterns
        await this.updatePerformancePatterns(tweetId, metrics, phase.phase);
        
        console.log(`✅ LEARNED: ${tweetId} ${phase.phase} - Likes: ${metrics.likes}, Engagement: ${metrics.engagementRate?.toFixed(2)}%`);
        
        // Store learning insights
        await this.storeLearningInsights(tweetId, metrics, phase.phase);
        
      } else {
        console.warn(`⚠️ METRICS_UNAVAILABLE: ${tweetId} at ${phase.phase}`);
      }
      
    } catch (error) {
      console.error(`❌ COLLECTION_FAILED: ${tweetId} at ${phase.phase}:`, error);
    }
  }

  /**
   * 🧠 TRIGGER IMMEDIATE LEARNING
   */
  private async triggerImmediateLearning(tweetId: string, metrics: any, phase: string): Promise<void> {
    try {
      // Get post context
      const postContext = await this.getPostContext(tweetId);
      if (!postContext) return;
      
      // Calculate performance tier
      const performanceTier = this.calculatePerformanceTier(metrics);
      
      // Update various learning dimensions
      await Promise.all([
        this.updateTopicPerformance(postContext.topic, metrics, phase),
        this.updateTimingPerformance(postContext.postedAt, metrics, phase),
        this.updateFormatPerformance(postContext.format, metrics, phase),
        this.updateHookPerformance(postContext.hook_type, metrics, phase),
        this.updateQualityCorrelation(postContext.qualityScore, metrics, phase)
      ]);
      
      console.log(`🧠 LEARNING_UPDATED: ${tweetId} ${phase} - Tier: ${performanceTier}`);
      
    } catch (error) {
      console.error(`❌ LEARNING_FAILED: ${tweetId} ${phase}:`, error);
    }
  }

  /**
   * 🎯 UPDATE TOPIC PERFORMANCE
   */
  private async updateTopicPerformance(topic: string, metrics: any, phase: string): Promise<void> {
    const topicKey = `topic_performance:${topic}`;
    const phaseKey = `${topicKey}:${phase}`;
    
    // Update engagement metrics
    await this.redis.incrByFloat(`${phaseKey}:likes`, metrics.likes || 0);
    await this.redis.incrByFloat(`${phaseKey}:retweets`, metrics.retweets || 0);
    await this.redis.incrByFloat(`${phaseKey}:replies`, metrics.replies || 0);
    await this.redis.incrByFloat(`${phaseKey}:engagement_rate`, metrics.engagementRate || 0);
    await this.redis.incrByFloat(`${phaseKey}:posts`, 1);
    
    // Calculate running averages
    const posts = await this.redis.get(`${phaseKey}:posts`);
    if (posts && parseInt(posts) > 0) {
      const avgEngagement = (await this.redis.get(`${phaseKey}:engagement_rate`)) || '0';
      const avgLikes = (await this.redis.get(`${phaseKey}:likes`)) || '0';
      
      await this.redis.set(`${phaseKey}:avg_engagement`, (parseFloat(avgEngagement) / parseInt(posts)).toString());
      await this.redis.set(`${phaseKey}:avg_likes`, (parseFloat(avgLikes) / parseInt(posts)).toString());
    }
    
    console.log(`📊 TOPIC_LEARNED: ${topic} ${phase} - Posts: ${posts}, Engagement: ${metrics.engagementRate?.toFixed(2)}%`);
  }

  /**
   * ⏰ UPDATE TIMING PERFORMANCE
   */
  private async updateTimingPerformance(postedAt: Date, metrics: any, phase: string): Promise<void> {
    const hour = postedAt.getHours();
    const dayOfWeek = postedAt.getDay();
    
    // Update hour performance
    const hourKey = `timing:hour:${hour}:${phase}`;
    await this.redis.incrByFloat(`${hourKey}:engagement`, metrics.engagementRate || 0);
    await this.redis.incrByFloat(`${hourKey}:likes`, metrics.likes || 0);
    await this.redis.incrByFloat(`${hourKey}:posts`, 1);
    
    // Update day performance
    const dayKey = `timing:day:${dayOfWeek}:${phase}`;
    await this.redis.incrByFloat(`${dayKey}:engagement`, metrics.engagementRate || 0);
    await this.redis.incrByFloat(`${dayKey}:likes`, metrics.likes || 0);
    await this.redis.incrByFloat(`${dayKey}:posts`, 1);
    
    // Update combined timing
    const combinedKey = `timing:combined:${dayOfWeek}:${hour}:${phase}`;
    await this.redis.incrByFloat(`${combinedKey}:engagement`, metrics.engagementRate || 0);
    await this.redis.incrByFloat(`${combinedKey}:posts`, 1);
    
    console.log(`⏰ TIMING_LEARNED: Hour ${hour}, Day ${dayOfWeek}, ${phase} - Engagement: ${metrics.engagementRate?.toFixed(2)}%`);
  }

  /**
   * 📝 UPDATE FORMAT PERFORMANCE
   */
  private async updateFormatPerformance(format: string, metrics: any, phase: string): Promise<void> {
    const formatKey = `format_performance:${format}:${phase}`;
    
    await this.redis.incrByFloat(`${formatKey}:engagement`, metrics.engagementRate || 0);
    await this.redis.incrByFloat(`${formatKey}:likes`, metrics.likes || 0);
    await this.redis.incrByFloat(`${formatKey}:retweets`, metrics.retweets || 0);
    await this.redis.incrByFloat(`${formatKey}:replies`, metrics.replies || 0);
    await this.redis.incrByFloat(`${formatKey}:posts`, 1);
    
    // Calculate format effectiveness
    const posts = await this.redis.get(`${formatKey}:posts`);
    if (posts && parseInt(posts) > 0) {
      const totalEngagement = await this.redis.get(`${formatKey}:engagement`) || '0';
      const avgEffectiveness = parseFloat(totalEngagement) / parseInt(posts);
      await this.redis.set(`${formatKey}:effectiveness`, avgEffectiveness.toString());
    }
    
    console.log(`📝 FORMAT_LEARNED: ${format} ${phase} - Effectiveness: ${metrics.engagementRate?.toFixed(2)}%`);
  }

  /**
   * 🎣 UPDATE HOOK PERFORMANCE
   */
  private async updateHookPerformance(hookType: string | undefined, metrics: any, phase: string): Promise<void> {
    if (!hookType) return;
    
    const hookKey = `hook_performance:${hookType}:${phase}`;
    
    await this.redis.incrByFloat(`${hookKey}:engagement`, metrics.engagementRate || 0);
    await this.redis.incrByFloat(`${hookKey}:viral_score`, this.calculateViralScore(metrics));
    await this.redis.incrByFloat(`${hookKey}:posts`, 1);
    
    console.log(`🎣 HOOK_LEARNED: ${hookType} ${phase} - Engagement: ${metrics.engagementRate?.toFixed(2)}%`);
  }

  /**
   * �� UPDATE QUALITY CORRELATION
   */
  private async updateQualityCorrelation(qualityScore: number, metrics: any, phase: string): Promise<void> {
    const qualityTier = this.getQualityTier(qualityScore);
    const correlationKey = `quality_correlation:${qualityTier}:${phase}`;
    
    await this.redis.incrByFloat(`${correlationKey}:engagement`, metrics.engagementRate || 0);
    await this.redis.incrByFloat(`${correlationKey}:posts`, 1);
    
    // Store specific correlation data point
    const correlationData = {
      qualityScore,
      engagementRate: metrics.engagementRate || 0,
      likes: metrics.likes || 0,
      timestamp: new Date(),
      phase
    };
    
    await this.redis.setJSON(`quality_data_point:${Date.now()}`, JSON.stringify(correlationData), 86400 * 30); // 30 days
    
    console.log(`🏆 QUALITY_LEARNED: Score ${qualityScore} (${qualityTier}) ${phase} - Engagement: ${metrics.engagementRate?.toFixed(2)}%`);
  }

  /**
   * 📊 UPDATE PERFORMANCE PATTERNS
   */
  private async updatePerformancePatterns(tweetId: string, metrics: any, phase: string): Promise<void> {
    const postContext = await this.getPostContext(tweetId);
    if (!postContext) return;
    
    // Create performance pattern
    const pattern = {
      tweetId,
      phase,
      topic: postContext.topic,
      format: postContext.format,
      postedHour: postContext.postedAt.getHours(),
      postedDay: postContext.postedAt.getDay(),
      qualityScore: postContext.qualityScore,
      metrics: {
        likes: metrics.likes || 0,
        retweets: metrics.retweets || 0,
        replies: metrics.replies || 0,
        engagementRate: metrics.engagementRate || 0
      },
      timestamp: new Date()
    };
    
    // Store pattern for machine learning
    await this.db.safeInsert('performance_patterns', pattern);
    
    // Update Redis pattern tracking
    const patternKey = `patterns:${postContext.topic}:${postContext.format}:${phase}`;
    await this.redis.setJSON(patternKey, JSON.stringify(pattern), 86400 * 7); // 7 days
  }

  /**
   * 💡 STORE LEARNING INSIGHTS
   */
  private async storeLearningInsights(tweetId: string, metrics: any, phase: string): Promise<void> {
    const postContext = await this.getPostContext(tweetId);
    if (!postContext) return;
    
    const performanceTier = this.calculatePerformanceTier(metrics);
    const insights = this.generateInsights(postContext, metrics, phase);
    
    const learningInsight: LearningInsight = {
      tweetId,
      phase,
      topic: postContext.topic,
      format: postContext.format,
      postedAt: postContext.postedAt,
      metrics,
      performanceTier,
      insights,
      timestamp: new Date()
    };
    
    try {
      await this.db.safeInsert('learning_insights', learningInsight);
      console.log(`💡 INSIGHTS_STORED: ${tweetId} ${phase} - ${insights.length} insights`);
    } catch (error) {
      console.warn(`⚠️ INSIGHTS_STORAGE_FAILED: ${tweetId}:`, error);
    }
  }

  // Helper methods
  private async storeInitialPost(postData: PostMonitoringData): Promise<void> {
    try {
      await this.db.safeInsert('monitored_posts', {
        tweet_id: postData.tweetId,
        content: postData.content,
        format: postData.format,
        topic: postData.topic,
        posted_at: postData.postedAt.toISOString(),
        quality_score: postData.qualityScore,
        hook_type: postData.hook_type,
        persona: postData.persona,
        framework: postData.framework,
        monitoring_started_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn(`⚠️ INITIAL_POST_STORAGE_FAILED: ${postData.tweetId}:`, error);
    }
  }

  private async storeCollectionSchedule(tweetId: string, phase: MetricsPhase): Promise<void> {
    const scheduleData = {
      tweetId,
      phase: phase.phase,
      delay: phase.delay,
      scheduledFor: new Date(Date.now() + phase.delay * 60 * 1000),
      description: phase.description
    };
    
    await this.redis.setJSON(
      `metrics_schedule:${tweetId}:${phase.phase}`,
      JSON.stringify(scheduleData),
      phase.delay * 60 + 3600 // TTL slightly longer than delay
    );
  }

  private async storeMetricsWithPhase(metrics: any, phase: string): Promise<void> {
    try {
      await this.db.safeInsert('metrics_by_phase', {
        tweet_id: metrics.tweetId,
        phase,
        likes: metrics.likes || 0,
        retweets: metrics.retweets || 0,
        replies: metrics.replies || 0,
        bookmarks: metrics.bookmarks || 0,
        impressions: metrics.impressions || 0,
        engagement_rate: metrics.engagementRate || 0,
        collected_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn(`⚠️ METRICS_STORAGE_FAILED: ${metrics.tweetId} ${phase}:`, error);
    }
  }

  private async getPostContext(tweetId: string): Promise<any> {
    try {
      const { data } = await this.db.safeSelect(
        'monitored_posts',
        '*',
        { tweet_id: tweetId },
        { limit: 1 }
      );
      
      if (data && data.length > 0) {
        const post = data[0];
        return {
          topic: post.topic,
          format: post.format,
          postedAt: new Date(post.posted_at),
          qualityScore: post.quality_score,
          hook_type: post.hook_type,
          persona: post.persona,
          framework: post.framework
        };
      }
      
      return null;
    } catch (error) {
      console.warn(`⚠️ POST_CONTEXT_RETRIEVAL_FAILED: ${tweetId}:`, error);
      return null;
    }
  }

  private calculatePerformanceTier(metrics: any): 'low' | 'medium' | 'high' | 'viral' {
    const likes = metrics.likes || 0;
    const engagement = metrics.engagementRate || 0;
    
    if (likes >= 100 || engagement >= 15) return 'viral';
    if (likes >= 50 || engagement >= 8) return 'high';
    if (likes >= 20 || engagement >= 4) return 'medium';
    return 'low';
  }

  private calculateViralScore(metrics: any): number {
    const likes = metrics.likes || 0;
    const retweets = metrics.retweets || 0;
    const replies = metrics.replies || 0;
    
    // Weighted viral score
    return (likes * 1) + (retweets * 3) + (replies * 2);
  }

  private getQualityTier(qualityScore: number): string {
    if (qualityScore >= 90) return 'excellent';
    if (qualityScore >= 80) return 'high';
    if (qualityScore >= 70) return 'good';
    if (qualityScore >= 60) return 'medium';
    return 'low';
  }

  private generateInsights(postContext: any, metrics: any, phase: string): string[] {
    const insights: string[] = [];
    const engagement = metrics.engagementRate || 0;
    const likes = metrics.likes || 0;
    
    // Performance insights
    if (engagement > 10) {
      insights.push(`High engagement (${engagement.toFixed(1)}%) at ${phase} indicates strong audience resonance`);
    }
    
    if (likes > 50) {
      insights.push(`Strong like performance (${likes}) suggests topic ${postContext.topic} is highly relevant`);
    }
    
    // Quality correlation insights
    if (postContext.qualityScore > 80 && engagement > 5) {
      insights.push(`Quality score ${postContext.qualityScore} correlates with strong engagement`);
    }
    
    // Timing insights
    const hour = postContext.postedAt.getHours();
    if (engagement > 5 && (hour >= 9 && hour <= 11)) {
      insights.push(`Morning posting (${hour}:00) shows strong performance for ${postContext.topic}`);
    }
    
    // Format insights
    if (postContext.format === 'thread' && metrics.replies > 5) {
      insights.push(`Thread format generates good discussion (${metrics.replies} replies)`);
    }
    
    return insights;
  }

  private async triggerInitialLearning(postData: PostMonitoringData): Promise<void> {
    // Store initial patterns for immediate learning
    const initialPattern = {
      tweetId: postData.tweetId,
      topic: postData.topic,
      format: postData.format,
      qualityScore: postData.qualityScore,
      postedHour: postData.postedAt.getHours(),
      postedDay: postData.postedAt.getDay(),
      timestamp: new Date()
    };
    
    await this.redis.setJSON(`initial_pattern:${postData.tweetId}`, JSON.stringify(initialPattern), 86400 * 7);
    
    console.log(`🎯 INITIAL_LEARNING: Pattern stored for ${postData.tweetId}`);
  }
}

export default ContinuousMetricsEngine;
