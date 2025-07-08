/**
 * 🧠 INTELLIGENT POSTING DECISION AGENT
 * 
 * Strategic thinking about when and what to post
 * - Analyzes performance of recent posts
 * - Makes smart decisions about timing and spacing
 * - Adapts strategy based on engagement patterns
 * - Prevents mindless rapid-fire posting
 */

import { supabaseClient } from '../utils/supabaseClient';
import { rateLimitManager } from '../utils/intelligentRateLimitManager';
import { TimingOptimizationAgent } from './timingOptimizationAgent';
import { RealTimeEngagementTracker } from './realTimeEngagementTracker';
import { openaiClient } from '../utils/openaiClient';

export interface PostingDecision {
  shouldPost: boolean;
  reason: string;
  confidence: number; // 0-1
  strategy: 'immediate' | 'wait_optimal' | 'wait_spacing' | 'wait_performance' | 'skip_today';
  waitTime?: number; // minutes
  nextDecisionTime: Date;
  contentGuidance?: {
    type: 'viral' | 'educational' | 'news_reaction' | 'engagement_boost' | 'recovery';
    reasoning: string;
    targetAudience: string;
  };
  performanceExpectation: {
    expectedLikes: number;
    expectedRetweets: number;
    expectedReplies: number;
    viralPotential: number; // 0-1
  };
}

export interface PostPerformanceAnalysis {
  recentPosts: Array<{
    id: string;
    content: string;
    engagement: {
      likes: number;
      retweets: number;
      replies: number;
      totalEngagement: number;
      engagementRate: number;
    };
    postedAt: Date;
    hoursAgo: number;
    performanceCategory: 'viral' | 'high' | 'medium' | 'low' | 'poor';
  }>;
  patterns: {
    avgEngagementLast24h: number;
    bestPerformingTime: string;
    worstPerformingTime: string;
    currentTrend: 'improving' | 'declining' | 'stable';
    lastViralPost?: Date;
  };
  insights: string[];
}

export class IntelligentPostingDecisionAgent {
  private timingAgent: TimingOptimizationAgent;
  private engagementTracker: RealTimeEngagementTracker;
  private lastDecisionTime: Date | null = null;
  private lastPostAnalysis: PostPerformanceAnalysis | null = null;

  constructor() {
    this.timingAgent = new TimingOptimizationAgent();
    this.engagementTracker = new RealTimeEngagementTracker();
    console.log('🧠 Intelligent Posting Decision Agent initialized');
  }

  /**
   * 🎯 MAIN DECISION FUNCTION: Should we post now?
   */
  async makePostingDecision(): Promise<PostingDecision> {
    console.log('🧠 === MAKING INTELLIGENT POSTING DECISION ===');
    
    try {
      // 1. Analyze recent performance
      const performanceAnalysis = await this.analyzeRecentPerformance();
      this.lastPostAnalysis = performanceAnalysis;

      // 2. Check rate limits and constraints
      const rateLimitStatus = await rateLimitManager.canMakeCall('twitter', 'post');
      if (rateLimitStatus.isLimited) {
        return {
          shouldPost: false,
          reason: `Rate limited: ${rateLimitStatus.waitTimeMinutes} minutes remaining`,
          confidence: 0.95,
          strategy: 'wait_spacing',
          waitTime: rateLimitStatus.waitTimeMinutes,
          nextDecisionTime: rateLimitStatus.nextRetryTime || new Date(Date.now() + 60 * 60 * 1000),
          performanceExpectation: { expectedLikes: 0, expectedRetweets: 0, expectedReplies: 0, viralPotential: 0 }
        };
      }

      // 3. Analyze current timing context
      const timingContext = await this.analyzeTimingContext(performanceAnalysis);

      // 4. Make strategic decision
      const decision = await this.makeStrategicDecision(performanceAnalysis, timingContext);

      console.log(`🧠 Decision: ${decision.shouldPost ? '✅ POST' : '⏳ WAIT'}`);
      console.log(`📊 Strategy: ${decision.strategy}`);
      console.log(`🎯 Confidence: ${Math.round(decision.confidence * 100)}%`);
      console.log(`💭 Reasoning: ${decision.reason}`);

      return decision;

    } catch (error) {
      console.error('❌ Error making posting decision:', error);
      
      // Safe fallback decision
      return {
        shouldPost: false,
        reason: 'Error in decision making - being conservative',
        confidence: 0.3,
        strategy: 'wait_spacing',
        waitTime: 30,
        nextDecisionTime: new Date(Date.now() + 30 * 60 * 1000),
        performanceExpectation: { expectedLikes: 0, expectedRetweets: 0, expectedReplies: 0, viralPotential: 0 }
      };
    }
  }

  /**
   * 📊 ANALYZE RECENT PERFORMANCE
   */
  private async analyzeRecentPerformance(): Promise<PostPerformanceAnalysis> {
    try {
      // Get recent posts from last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { data: recentTweets } = await supabaseClient.supabase
        ?.from('tweets')
        .select('*')
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(10) || { data: [] };

      const recentPosts = (recentTweets || []).map(tweet => {
        const postedAt = new Date(tweet.created_at);
        const hoursAgo = (Date.now() - postedAt.getTime()) / (1000 * 60 * 60);
        const totalEngagement = tweet.likes + tweet.retweets + tweet.replies;
        
        // Calculate engagement rate (rough estimate)
        const estimatedImpressions = Math.max(totalEngagement * 20, 100); // Rough estimate
        const engagementRate = totalEngagement / estimatedImpressions;

        // Categorize performance
        let performanceCategory: 'viral' | 'high' | 'medium' | 'low' | 'poor' = 'poor';
        if (totalEngagement >= 100) performanceCategory = 'viral';
        else if (totalEngagement >= 50) performanceCategory = 'high';
        else if (totalEngagement >= 20) performanceCategory = 'medium';
        else if (totalEngagement >= 5) performanceCategory = 'low';

        return {
          id: tweet.id,
          content: tweet.content,
          engagement: {
            likes: tweet.likes || 0,
            retweets: tweet.retweets || 0,
            replies: tweet.replies || 0,
            totalEngagement,
            engagementRate
          },
          postedAt,
          hoursAgo,
          performanceCategory
        };
      });

      // Calculate patterns
      const avgEngagementLast24h = recentPosts.length > 0 
        ? recentPosts.reduce((sum, post) => sum + post.engagement.totalEngagement, 0) / recentPosts.length
        : 0;

      // Find best and worst performing times
      const timePerformance = new Map<number, number[]>();
      recentPosts.forEach(post => {
        const hour = post.postedAt.getHours();
        if (!timePerformance.has(hour)) timePerformance.set(hour, []);
        timePerformance.get(hour)!.push(post.engagement.totalEngagement);
      });

      let bestHour = 12; // Default
      let worstHour = 3; // Default
      let bestAvg = 0;
      let worstAvg = Infinity;

      timePerformance.forEach((engagements, hour) => {
        const avg = engagements.reduce((sum, e) => sum + e, 0) / engagements.length;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestHour = hour;
        }
        if (avg < worstAvg) {
          worstAvg = avg;
          worstHour = hour;
        }
      });

      // Determine trend
      let currentTrend: 'improving' | 'declining' | 'stable' = 'stable';
      if (recentPosts.length >= 3) {
        const recentAvg = recentPosts.slice(0, 3).reduce((sum, post) => sum + post.engagement.totalEngagement, 0) / 3;
        const olderAvg = recentPosts.slice(3).reduce((sum, post) => sum + post.engagement.totalEngagement, 0) / Math.max(recentPosts.slice(3).length, 1);
        
        if (recentAvg > olderAvg * 1.2) currentTrend = 'improving';
        else if (recentAvg < olderAvg * 0.8) currentTrend = 'declining';
      }

      // Find last viral post
      const lastViralPost = recentPosts.find(post => post.performanceCategory === 'viral')?.postedAt;

      // Generate insights
      const insights: string[] = [];
      
      if (avgEngagementLast24h > 30) {
        insights.push('🔥 Strong engagement momentum - good time to post');
      } else if (avgEngagementLast24h < 5) {
        insights.push('📉 Low engagement recently - consider content strategy shift');
      }

      if (currentTrend === 'improving') {
        insights.push('📈 Engagement trending upward - capitalize on momentum');
      } else if (currentTrend === 'declining') {
        insights.push('⚠️ Engagement declining - time to experiment with new content');
      }

      if (lastViralPost && Date.now() - lastViralPost.getTime() < 6 * 60 * 60 * 1000) {
        insights.push('⚡ Recent viral post - audience is engaged, good time for follow-up');
      }

      const patterns = {
        avgEngagementLast24h,
        bestPerformingTime: this.formatHour(bestHour),
        worstPerformingTime: this.formatHour(worstHour),
        currentTrend,
        lastViralPost
      };

      console.log('📊 Performance Analysis:');
      console.log(`   📈 Avg engagement: ${avgEngagementLast24h.toFixed(1)}`);
      console.log(`   🏆 Best time: ${patterns.bestPerformingTime}`);
      console.log(`   📉 Worst time: ${patterns.worstPerformingTime}`);
      console.log(`   📊 Trend: ${currentTrend}`);
      console.log(`   💡 Insights: ${insights.length} found`);

      return {
        recentPosts,
        patterns,
        insights
      };

    } catch (error) {
      console.error('❌ Error analyzing performance:', error);
      return {
        recentPosts: [],
        patterns: {
          avgEngagementLast24h: 10, // Conservative default
          bestPerformingTime: '2:00 PM',
          worstPerformingTime: '3:00 AM',
          currentTrend: 'stable'
        },
        insights: ['Unable to analyze recent performance - using conservative approach']
      };
    }
  }

  /**
   * ⏰ ANALYZE TIMING CONTEXT
   */
  private async analyzeTimingContext(performanceAnalysis: PostPerformanceAnalysis) {
    const now = new Date();
    const currentHour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Get timing optimization
    const timingOptimization = await this.timingAgent.shouldPostNow();
    
    // Check if we're in a peak time
    const isPeakTime = currentHour >= 9 && currentHour <= 17; // Business hours
    const isEveningEngagement = currentHour >= 19 && currentHour <= 21; // Evening engagement
    
    // Check spacing since last post
    const lastPost = performanceAnalysis.recentPosts[0];
    const hoursSpacing = lastPost ? lastPost.hoursAgo : 24;
    const minutesSpacing = hoursSpacing * 60;
    
    // Ideal spacing calculation
    const idealSpacing = this.calculateIdealSpacing(performanceAnalysis);
    
    return {
      currentHour,
      dayOfWeek,
      isPeakTime,
      isEveningEngagement,
      timingOptimization,
      spacing: {
        minutesSinceLastPost: minutesSpacing,
        idealSpacing,
        hasGoodSpacing: minutesSpacing >= idealSpacing
      }
    };
  }

  /**
   * 🎯 MAKE STRATEGIC DECISION
   */
  private async makeStrategicDecision(
    performanceAnalysis: PostPerformanceAnalysis,
    timingContext: any
  ): Promise<PostingDecision> {
    
    const now = new Date();
    
    // Decision factors
    let shouldPost = false;
    let reason = '';
    let strategy: PostingDecision['strategy'] = 'wait_spacing';
    let confidence = 0.5;
    let waitTime = 60; // default 1 hour
    
    // FACTOR 1: Rate limiting and spacing
    if (!timingContext.spacing.hasGoodSpacing) {
      const needToWait = timingContext.spacing.idealSpacing - timingContext.spacing.minutesSinceLastPost;
      return {
        shouldPost: false,
        reason: `Strategic spacing: Need ${Math.round(needToWait)} more minutes for optimal impact`,
        confidence: 0.9,
        strategy: 'wait_spacing',
        waitTime: Math.round(needToWait),
        nextDecisionTime: new Date(now.getTime() + needToWait * 60 * 1000),
        performanceExpectation: this.calculatePerformanceExpectation(performanceAnalysis, timingContext)
      };
    }

    // FACTOR 2: Poor recent performance - be more strategic
    if (performanceAnalysis.patterns.avgEngagementLast24h < 5) {
      if (timingContext.timingOptimization.confidence < 0.8) {
        return {
          shouldPost: false,
          reason: 'Low recent engagement + suboptimal timing - waiting for better window',
          confidence: 0.8,
          strategy: 'wait_optimal',
          waitTime: this.getTimeToNextOptimalWindow(timingContext.currentHour),
          nextDecisionTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // Check again in 2 hours
          contentGuidance: {
            type: 'recovery',
            reasoning: 'Need engaging content to recover from poor performance',
            targetAudience: 'Broad appeal with viral potential'
          },
          performanceExpectation: this.calculatePerformanceExpectation(performanceAnalysis, timingContext)
        };
      }
    }

    // FACTOR 3: Strong momentum - capitalize
    if (performanceAnalysis.patterns.currentTrend === 'improving' && 
        performanceAnalysis.patterns.avgEngagementLast24h > 20) {
      shouldPost = true;
      reason = 'Strong engagement momentum - capitalizing on audience attention';
      confidence = 0.85;
      strategy = 'immediate';
    }

    // FACTOR 4: Optimal timing
    else if (timingContext.timingOptimization.shouldPost && 
             timingContext.timingOptimization.confidence > 0.7) {
      shouldPost = true;
      reason = `Optimal timing window: ${timingContext.timingOptimization.reason}`;
      confidence = timingContext.timingOptimization.confidence;
      strategy = 'immediate';
    }

    // FACTOR 5: Peak engagement hours
    else if (timingContext.isPeakTime && timingContext.spacing.minutesSinceLastPost > 120) {
      shouldPost = true;
      reason = 'Peak engagement hours with good spacing';
      confidence = 0.7;
      strategy = 'immediate';
    }

    // FACTOR 6: Evening engagement opportunity
    else if (timingContext.isEveningEngagement && timingContext.spacing.minutesSinceLastPost > 180) {
      shouldPost = true;
      reason = 'Evening engagement window - good for educational content';
      confidence = 0.65;
      strategy = 'immediate';
    }

    // DEFAULT: Wait for better timing
    else {
      const nextOptimalTime = this.getTimeToNextOptimalWindow(timingContext.currentHour);
      return {
        shouldPost: false,
        reason: 'Waiting for optimal engagement window',
        confidence: 0.7,
        strategy: 'wait_optimal',
        waitTime: nextOptimalTime,
        nextDecisionTime: new Date(now.getTime() + nextOptimalTime * 60 * 1000),
        performanceExpectation: this.calculatePerformanceExpectation(performanceAnalysis, timingContext)
      };
    }

    // Generate content guidance if posting
    let contentGuidance: PostingDecision['contentGuidance'] | undefined;
    if (shouldPost) {
      contentGuidance = await this.generateContentGuidance(performanceAnalysis, timingContext);
    }

    return {
      shouldPost,
      reason,
      confidence,
      strategy,
      waitTime: shouldPost ? 0 : waitTime,
      nextDecisionTime: new Date(now.getTime() + (shouldPost ? 2 * 60 * 60 * 1000 : waitTime * 60 * 1000)),
      contentGuidance,
      performanceExpectation: this.calculatePerformanceExpectation(performanceAnalysis, timingContext)
    };
  }

  /**
   * 📏 CALCULATE IDEAL SPACING
   */
  private calculateIdealSpacing(performanceAnalysis: PostPerformanceAnalysis): number {
    const baseSpacing = 45; // 45 minutes base
    
    // Adjust based on recent performance
    if (performanceAnalysis.patterns.avgEngagementLast24h > 50) {
      return baseSpacing * 0.7; // 30 minutes - high engagement allows more frequent posting
    } else if (performanceAnalysis.patterns.avgEngagementLast24h < 5) {
      return baseSpacing * 1.8; // 80 minutes - poor engagement needs more spacing
    } else if (performanceAnalysis.patterns.currentTrend === 'declining') {
      return baseSpacing * 1.5; // 70 minutes - declining trend needs more careful timing
    }
    
    return baseSpacing;
  }

  /**
   * ⏰ GET TIME TO NEXT OPTIMAL WINDOW
   */
  private getTimeToNextOptimalWindow(currentHour: number): number {
    const optimalHours = [9, 11, 14, 16, 19]; // Peak engagement hours
    
    // Find next optimal hour
    const nextOptimal = optimalHours.find(hour => hour > currentHour) || optimalHours[0] + 24;
    const hoursToWait = nextOptimal > 24 ? nextOptimal - 24 - currentHour : nextOptimal - currentHour;
    
    return Math.max(30, hoursToWait * 60); // Minimum 30 minutes
  }

  /**
   * 💡 GENERATE CONTENT GUIDANCE
   */
  private async generateContentGuidance(
    performanceAnalysis: PostPerformanceAnalysis,
    timingContext: any
  ): Promise<PostingDecision['contentGuidance']> {
    
    // Analyze what content performed well recently
    const topPerformers = performanceAnalysis.recentPosts
      .filter(post => post.performanceCategory === 'viral' || post.performanceCategory === 'high')
      .slice(0, 3);

    let type: 'viral' | 'educational' | 'news_reaction' | 'engagement_boost' | 'recovery' = 'viral';
    let reasoning = '';
    let targetAudience = '';

    if (timingContext.currentHour >= 19 && timingContext.currentHour <= 21) {
      // Evening - educational content performs well
      type = 'educational';
      reasoning = 'Evening audience prefers in-depth, educational content';
      targetAudience = 'Professionals looking to learn after work hours';
    } else if (timingContext.currentHour >= 13 && timingContext.currentHour <= 15) {
      // Peak lunch hours - viral content
      type = 'viral';
      reasoning = 'Peak engagement hours - perfect for viral, shareable content';
      targetAudience = 'Broad professional audience during lunch break';
    } else if (performanceAnalysis.patterns.avgEngagementLast24h < 10) {
      // Poor performance - engagement boost
      type = 'engagement_boost';
      reasoning = 'Recent low engagement - need highly engaging content to rebuild momentum';
      targetAudience = 'Core followers who typically engage';
    } else if (performanceAnalysis.patterns.currentTrend === 'improving') {
      // Momentum building - capitalize
      type = 'viral';
      reasoning = 'Positive momentum - capitalize with high-impact content';
      targetAudience = 'Growing engaged audience ready for viral content';
    } else {
      // Default - educational
      type = 'educational';
      reasoning = 'Stable conditions - focus on valuable educational content';
      targetAudience = 'Health tech professionals and enthusiasts';
    }

    return {
      type,
      reasoning,
      targetAudience
    };
  }

  /**
   * 📈 CALCULATE PERFORMANCE EXPECTATION
   */
  private calculatePerformanceExpectation(
    performanceAnalysis: PostPerformanceAnalysis,
    timingContext: any
  ): PostingDecision['performanceExpectation'] {
    
    const baseExpectation = {
      expectedLikes: Math.round(performanceAnalysis.patterns.avgEngagementLast24h * 0.7) || 5,
      expectedRetweets: Math.round(performanceAnalysis.patterns.avgEngagementLast24h * 0.2) || 1,
      expectedReplies: Math.round(performanceAnalysis.patterns.avgEngagementLast24h * 0.1) || 1,
      viralPotential: 0.1
    };

    // Adjust based on timing
    if (timingContext.timingOptimization.confidence > 0.8) {
      baseExpectation.expectedLikes *= 1.5;
      baseExpectation.expectedRetweets *= 1.3;
      baseExpectation.viralPotential = 0.3;
    }

    // Adjust based on recent trend
    if (performanceAnalysis.patterns.currentTrend === 'improving') {
      baseExpectation.expectedLikes *= 1.3;
      baseExpectation.viralPotential += 0.2;
    } else if (performanceAnalysis.patterns.currentTrend === 'declining') {
      baseExpectation.expectedLikes *= 0.7;
      baseExpectation.viralPotential *= 0.5;
    }

    // Cap viral potential
    baseExpectation.viralPotential = Math.min(0.8, baseExpectation.viralPotential);

    return baseExpectation;
  }

  /**
   * 🕐 FORMAT HOUR
   */
  private formatHour(hour: number): string {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${ampm}`;
  }

  /**
   * 📊 GET DECISION INSIGHTS
   */
  async getDecisionInsights(): Promise<{
    recentDecisions: string[];
    performanceTrends: string[];
    recommendations: string[];
  }> {
    const analysis = this.lastPostAnalysis;
    
    if (!analysis) {
      return {
        recentDecisions: ['No recent decisions available'],
        performanceTrends: ['No performance data available'],
        recommendations: ['Analyze recent posts to make better decisions']
      };
    }

    const recentDecisions = [
      `Last decision made: ${this.lastDecisionTime?.toLocaleTimeString() || 'Never'}`,
      `Recent posts analyzed: ${analysis.recentPosts.length}`,
      `Performance trend: ${analysis.patterns.currentTrend}`
    ];

    const performanceTrends = [
      `Average engagement: ${analysis.patterns.avgEngagementLast24h.toFixed(1)}`,
      `Best performing time: ${analysis.patterns.bestPerformingTime}`,
      `Current trend: ${analysis.patterns.currentTrend}`,
      `Viral posts: ${analysis.recentPosts.filter(p => p.performanceCategory === 'viral').length}`
    ];

    const recommendations = analysis.insights;

    return {
      recentDecisions,
      performanceTrends,
      recommendations
    };
  }

  /**
   * 🔄 RESET DECISION STATE (for testing/debugging)
   */
  resetDecisionState(): void {
    this.lastDecisionTime = null;
    this.lastPostAnalysis = null;
    console.log('🔄 Decision state reset');
  }
}

export const intelligentPostingDecision = new IntelligentPostingDecisionAgent(); 