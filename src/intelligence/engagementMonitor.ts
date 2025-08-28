/**
 * Engagement Performance Monitor
 * Continuously tracks post performance and identifies improvement opportunities
 */

import { EngagementOptimizer } from './engagementOptimizer';

export interface PerformanceReport {
  period: '24h' | '7d' | '30d';
  total_posts: number;
  avg_followers_gained: number;
  avg_likes: number;
  avg_engagement_rate: number;
  best_performing_post: {
    content: string;
    metrics: any;
    success_factors: string[];
  };
  worst_performing_post: {
    content: string;
    metrics: any;
    failure_reasons: string[];
  };
  improvement_recommendations: string[];
  predicted_next_post_performance: {
    followers: number;
    likes: number;
    engagement_rate: number;
  };
}

export interface EngagementAlert {
  type: 'low_engagement' | 'viral_opportunity' | 'follower_drop' | 'content_fatigue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recommended_action: string;
  data: any;
}

export class EngagementMonitor {
  private static instance: EngagementMonitor;
  private optimizer: EngagementOptimizer;

  private constructor() {
    this.optimizer = EngagementOptimizer.getInstance();
  }

  public static getInstance(): EngagementMonitor {
    if (!EngagementMonitor.instance) {
      EngagementMonitor.instance = new EngagementMonitor();
    }
    return EngagementMonitor.instance;
  }

  /**
   * Generate comprehensive performance report
   */
  async generatePerformanceReport(period: '24h' | '7d' | '30d' = '7d'): Promise<PerformanceReport> {
    console.log(`📊 ENGAGEMENT_MONITOR: Generating ${period} performance report`);

    try {
      const posts = await this.getPostsInPeriod(period);
      
      if (posts.length === 0) {
        return this.getEmptyReport(period);
      }

      const metrics = this.calculateAggregateMetrics(posts);
      const bestPost = this.findBestPerformingPost(posts);
      const worstPost = this.findWorstPerformingPost(posts);
      const recommendations = await this.generateImprovementRecommendations(posts);
      const prediction = await this.predictNextPostPerformance(posts);

      const report: PerformanceReport = {
        period,
        total_posts: posts.length,
        avg_followers_gained: metrics.avg_followers,
        avg_likes: metrics.avg_likes,
        avg_engagement_rate: metrics.avg_engagement_rate,
        best_performing_post: {
          content: bestPost.content,
          metrics: bestPost.metrics,
          success_factors: await this.analyzeSuccessFactors(bestPost)
        },
        worst_performing_post: {
          content: worstPost.content,
          metrics: worstPost.metrics,
          failure_reasons: await this.analyzeFailureReasons(worstPost)
        },
        improvement_recommendations: recommendations,
        predicted_next_post_performance: prediction
      };

      console.log(`✅ PERFORMANCE_REPORT: ${posts.length} posts analyzed, ${recommendations.length} recommendations generated`);
      return report;

    } catch (error: any) {
      console.error('❌ PERFORMANCE_REPORT failed:', error.message);
      return this.getEmptyReport(period);
    }
  }

  /**
   * Monitor engagement in real-time and send alerts
   */
  async checkEngagementAlerts(): Promise<EngagementAlert[]> {
    console.log('🚨 ENGAGEMENT_MONITOR: Checking for engagement alerts');

    const alerts: EngagementAlert[] = [];

    try {
      // Check recent post performance
      const recentPosts = await this.getPostsInPeriod('24h');
      
      // Low engagement alert
      const lowEngagementAlert = await this.checkLowEngagement(recentPosts);
      if (lowEngagementAlert) alerts.push(lowEngagementAlert);

      // Viral opportunity alert
      const viralAlert = await this.checkViralOpportunity(recentPosts);
      if (viralAlert) alerts.push(viralAlert);

      // Follower drop alert
      const followerAlert = await this.checkFollowerDrop();
      if (followerAlert) alerts.push(followerAlert);

      // Content fatigue alert
      const fatigueAlert = await this.checkContentFatigue(recentPosts);
      if (fatigueAlert) alerts.push(fatigueAlert);

      if (alerts.length > 0) {
        console.log(`⚠️ ENGAGEMENT_ALERTS: ${alerts.length} alerts generated`);
      }

      return alerts;

    } catch (error: any) {
      console.error('❌ ENGAGEMENT_ALERTS failed:', error.message);
      return [];
    }
  }

  /**
   * Automatically optimize next post based on performance data
   */
  async optimizeNextPost(): Promise<{
    recommended_format: string;
    recommended_topics: string[];
    recommended_timing: string;
    optimization_strategies: string[];
    expected_improvement: number;
  }> {
    console.log('🎯 ENGAGEMENT_MONITOR: Optimizing next post strategy');

    try {
      const recentPosts = await this.getPostsInPeriod('7d');
      const performancePatterns = this.analyzePerformancePatterns(recentPosts);
      
      // Determine optimal format
      const bestFormat = this.findBestPerformingFormat(performancePatterns);
      
      // Determine optimal topics
      const bestTopics = this.findBestPerformingTopics(performancePatterns);
      
      // Determine optimal timing
      const bestTiming = this.findOptimalTiming(performancePatterns);
      
      // Generate optimization strategies
      const strategies = await this.generateOptimizationStrategies(performancePatterns);
      
      // Calculate expected improvement
      const expectedImprovement = this.calculateExpectedImprovement(strategies);

      const optimization = {
        recommended_format: bestFormat,
        recommended_topics: bestTopics,
        recommended_timing: bestTiming,
        optimization_strategies: strategies,
        expected_improvement: expectedImprovement
      };

      console.log(`✅ NEXT_POST_OPTIMIZATION: ${bestFormat} format, ${bestTopics.length} topics, ${strategies.length} strategies`);
      return optimization;

    } catch (error: any) {
      console.error('❌ NEXT_POST_OPTIMIZATION failed:', error.message);
      return this.getDefaultOptimization();
    }
  }

  private async getPostsInPeriod(period: string): Promise<any[]> {
    try {
      const { getQueryOptimizer } = await import('../lib/queryOptimizer');
      const { admin } = await import('../lib/supabaseClients');
      
      const optimizer = getQueryOptimizer();
      const hoursBack = period === '24h' ? 24 : period === '7d' ? 168 : 720; // 30 days

      // Use optimized query with smart caching
      const data = await optimizer.getMLTrainingData(admin, hoursBack, 200);

      console.log(`✅ ENGAGEMENT_MONITOR: Retrieved ${data.length} optimized posts for ${period}`);
      return data;
    } catch (error: any) {
      console.error('Failed to get posts:', error.message);
      return [];
    }
  }

  private calculateAggregateMetrics(posts: any[]): {
    avg_followers: number;
    avg_likes: number;
    avg_engagement_rate: number;
  } {
    if (posts.length === 0) {
      return { avg_followers: 0, avg_likes: 0, avg_engagement_rate: 0 };
    }

    const totalFollowers = posts.reduce((sum, post) => sum + (post.converted_followers || 0), 0);
    const totalLikes = posts.reduce((sum, post) => sum + (post.likes_count || 0), 0);
    const totalEngagement = posts.reduce((sum, post) => 
      sum + ((post.likes_count || 0) + (post.retweets_count || 0) + (post.replies_count || 0)), 0);
    const totalImpressions = posts.reduce((sum, post) => sum + (post.impressions_count || 1), 0);

    return {
      avg_followers: Math.round(totalFollowers / posts.length),
      avg_likes: Math.round(totalLikes / posts.length),
      avg_engagement_rate: Math.round((totalEngagement / totalImpressions) * 100 * 100) / 100 // Percentage
    };
  }

  private findBestPerformingPost(posts: any[]): any {
    if (posts.length === 0) return { content: '', metrics: {}, success_factors: [] };

    return posts.reduce((best, current) => {
      const bestScore = (best.likes_count || 0) + (best.converted_followers || 0) * 5;
      const currentScore = (current.likes_count || 0) + (current.converted_followers || 0) * 5;
      return currentScore > bestScore ? current : best;
    });
  }

  private findWorstPerformingPost(posts: any[]): any {
    if (posts.length === 0) return { content: '', metrics: {}, failure_reasons: [] };

    return posts.reduce((worst, current) => {
      const worstScore = (worst.likes_count || 0) + (worst.converted_followers || 0) * 5;
      const currentScore = (current.likes_count || 0) + (current.converted_followers || 0) * 5;
      return currentScore < worstScore ? current : worst;
    });
  }

  private async analyzeSuccessFactors(post: any): Promise<string[]> {
    const factors: string[] = [];
    
    if (post.likes_count > 20) factors.push('High engagement content');
    if (post.converted_followers > 3) factors.push('Strong follower conversion');
    if (post.content && post.content.includes('?')) factors.push('Engagement question');
    if (post.content && /unpopular opinion|hot take|controversial/i.test(post.content)) factors.push('Controversial hook');
    if (post.viral_potential_score > 70) factors.push('High viral potential');

    return factors;
  }

  private async analyzeFailureReasons(post: any): Promise<string[]> {
    const reasons: string[] = [];
    
    if (post.likes_count < 3) reasons.push('Low engagement');
    if (post.converted_followers === 0) reasons.push('No follower conversion');
    if (post.content && post.content.length > 250) reasons.push('Too long for Twitter');
    if (post.content && !/[?!]/.test(post.content)) reasons.push('No engagement trigger');
    if (post.viral_potential_score < 30) reasons.push('Low viral potential');

    return reasons;
  }

  private async generateImprovementRecommendations(posts: any[]): Promise<string[]> {
    const recommendations: string[] = [];
    const avgMetrics = this.calculateAggregateMetrics(posts);

    if (avgMetrics.avg_followers < 2) {
      recommendations.push('Focus on controversial topics to drive follower growth');
    }

    if (avgMetrics.avg_likes < 10) {
      recommendations.push('Add stronger engagement hooks (questions, hot takes)');
    }

    if (avgMetrics.avg_engagement_rate < 1) {
      recommendations.push('Optimize posting timing for better reach');
    }

    const formats = posts.map(p => p.format || 'single');
    const threadCount = formats.filter(f => f === 'thread').length;
    if (threadCount / posts.length < 0.3) {
      recommendations.push('Experiment with more thread content for engagement');
    }

    return recommendations;
  }

  private async predictNextPostPerformance(posts: any[]): Promise<{
    followers: number;
    likes: number;
    engagement_rate: number;
  }> {
    const metrics = this.calculateAggregateMetrics(posts);
    
    // Simple prediction based on trends
    return {
      followers: Math.max(1, Math.round(metrics.avg_followers * 1.1)), // 10% improvement goal
      likes: Math.max(5, Math.round(metrics.avg_likes * 1.2)), // 20% improvement goal
      engagement_rate: Math.max(0.5, metrics.avg_engagement_rate * 1.15) // 15% improvement goal
    };
  }

  // Alert checking methods
  private async checkLowEngagement(posts: any[]): Promise<EngagementAlert | null> {
    if (posts.length === 0) return null;

    const avgLikes = posts.reduce((sum, p) => sum + (p.likes_count || 0), 0) / posts.length;
    
    if (avgLikes < 5) {
      return {
        type: 'low_engagement',
        severity: 'high',
        message: `Average likes dropped to ${avgLikes.toFixed(1)} (below 5 threshold)`,
        recommended_action: 'Use more controversial hooks and engagement questions',
        data: { avg_likes: avgLikes, post_count: posts.length }
      };
    }

    return null;
  }

  private async checkViralOpportunity(posts: any[]): Promise<EngagementAlert | null> {
    // Check if there's a topic/format showing viral potential
    const highPerformers = posts.filter(p => (p.likes_count || 0) > 15);
    
    if (highPerformers.length > 0) {
      return {
        type: 'viral_opportunity',
        severity: 'medium',
        message: `${highPerformers.length} posts showing viral potential`,
        recommended_action: 'Double down on successful content patterns',
        data: { high_performers: highPerformers.length }
      };
    }

    return null;
  }

  private async checkFollowerDrop(): Promise<EngagementAlert | null> {
    // Implementation for follower tracking
    return null;
  }

  private async checkContentFatigue(posts: any[]): Promise<EngagementAlert | null> {
    // Check for repetitive content patterns
    const topics = posts.map(p => this.extractMainTopic(p.content || '')).filter(Boolean);
    const topicCounts = topics.reduce((acc, topic) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const maxRepeats = Math.max(...Object.values(topicCounts));
    
    if (maxRepeats > 3) {
      return {
        type: 'content_fatigue',
        severity: 'medium',
        message: `Topic repeated ${maxRepeats} times recently`,
        recommended_action: 'Diversify content topics to avoid audience fatigue',
        data: { max_repeats: maxRepeats, topic_counts: topicCounts }
      };
    }

    return null;
  }

  private extractMainTopic(content: string): string {
    const topics = ['sleep', 'nutrition', 'exercise', 'productivity', 'health', 'wellness'];
    const lowerContent = content.toLowerCase();
    
    return topics.find(topic => lowerContent.includes(topic)) || '';
  }

  // Helper methods
  private analyzePerformancePatterns(posts: any[]): any {
    return {
      formats: posts.map(p => ({ format: p.format, performance: p.likes_count || 0 })),
      topics: posts.map(p => ({ topic: this.extractMainTopic(p.content || ''), performance: p.likes_count || 0 })),
      timing: posts.map(p => ({ hour: new Date(p.created_at).getHours(), performance: p.likes_count || 0 }))
    };
  }

  private findBestPerformingFormat(patterns: any): string {
    const formatPerformance = patterns.formats.reduce((acc: any, item: any) => {
      if (!acc[item.format]) acc[item.format] = [];
      acc[item.format].push(item.performance);
      return acc;
    }, {});

    let bestFormat = 'single';
    let bestAvg = 0;

    Object.entries(formatPerformance).forEach(([format, performances]: [string, any]) => {
      const avg = performances.reduce((sum: number, p: number) => sum + p, 0) / performances.length;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestFormat = format;
      }
    });

    return bestFormat;
  }

  private findBestPerformingTopics(patterns: any): string[] {
    const topicPerformance = patterns.topics.reduce((acc: any, item: any) => {
      if (!item.topic) return acc;
      if (!acc[item.topic]) acc[item.topic] = [];
      acc[item.topic].push(item.performance);
      return acc;
    }, {});

    const sortedTopics = Object.entries(topicPerformance)
      .map(([topic, performances]: [string, any]) => ({
        topic,
        avg: performances.reduce((sum: number, p: number) => sum + p, 0) / performances.length
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map(item => item.topic);

    return sortedTopics.length > 0 ? sortedTopics : ['health', 'productivity'];
  }

  private findOptimalTiming(patterns: any): string {
    const hourPerformance = patterns.timing.reduce((acc: any, item: any) => {
      if (!acc[item.hour]) acc[item.hour] = [];
      acc[item.hour].push(item.performance);
      return acc;
    }, {});

    let bestHour = 12;
    let bestAvg = 0;

    Object.entries(hourPerformance).forEach(([hour, performances]: [string, any]) => {
      const avg = performances.reduce((sum: number, p: number) => sum + p, 0) / performances.length;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestHour = parseInt(hour);
      }
    });

    return `${bestHour}:00`;
  }

  private async generateOptimizationStrategies(patterns: any): Promise<string[]> {
    const strategies: string[] = [];
    
    strategies.push('Use controversial hooks to increase engagement');
    strategies.push('Include engagement questions in every post');
    strategies.push('Focus on best-performing topics');
    strategies.push('Optimize posting time based on historical data');
    
    return strategies;
  }

  private calculateExpectedImprovement(strategies: string[]): number {
    return strategies.length * 15; // 15% improvement per strategy
  }

  private getEmptyReport(period: string): PerformanceReport {
    return {
      period: period as any,
      total_posts: 0,
      avg_followers_gained: 0,
      avg_likes: 0,
      avg_engagement_rate: 0,
      best_performing_post: { content: '', metrics: {}, success_factors: [] },
      worst_performing_post: { content: '', metrics: {}, failure_reasons: [] },
      improvement_recommendations: ['Need more posts to analyze performance'],
      predicted_next_post_performance: { followers: 1, likes: 5, engagement_rate: 0.5 }
    };
  }

  private getDefaultOptimization(): any {
    return {
      recommended_format: 'single',
      recommended_topics: ['health', 'productivity'],
      recommended_timing: '12:00',
      optimization_strategies: ['Add controversial hook', 'Include engagement question'],
      expected_improvement: 30
    };
  }
}

/**
 * Singleton instance
 */
let monitorInstance: EngagementMonitor | null = null;

export function getEngagementMonitor(): EngagementMonitor {
  if (!monitorInstance) {
    monitorInstance = EngagementMonitor.getInstance();
  }
  return monitorInstance;
}
