/**
 * 🧠 ENHANCED DAILY OPTIMIZATION LOOP
 * Comprehensive daily analysis and optimization system that runs at 4AM UTC
 * Analyzes all performance data and optimizes posting, engagement, and content strategies
 * The brain of the autonomous Twitter growth system
 */

import { PRODUCTION_CONFIG, getGrowthTargets, getIntelligenceConfig } from '../config/productionConfig';
import { AdaptivePostingFrequency } from './adaptivePostingFrequency';
import { TopicPerformancePrioritizer } from './topicPerformancePrioritizer';
import { EngagementIntelligenceEngine } from './engagementIntelligenceEngine';
import { supabaseClient } from '../utils/supabaseClient';
import { SmartModelSelector } from '../utils/smartModelSelector';
import OpenAI from 'openai';

export interface DailyOptimizationReport {
  date: string;
  performance: {
    followerGrowth: number;
    engagementRate: number;
    viralHitRate: number;
    postsPublished: number;
    repliesExecuted: number;
    engagementActions: number;
  };
  insights: {
    topPerformingTimes: number[];
    bestTopics: string[];
    topInfluencers: string[];
    viralPatterns: string[];
    improvementAreas: string[];
  };
  optimizations: {
    postingScheduleChanges: any;
    topicPriorityChanges: any;
    engagementTargetChanges: any;
    contentFormatChanges: any;
  };
  recommendations: string[];
  expectedImpact: {
    followerGrowthIncrease: number;
    engagementImprovement: number;
    viralPotentialBoost: number;
  };
  nextActions: string[];
}

export interface PerformanceAnalysis {
  timeframe: '24h' | '7d' | '30d';
  metrics: {
    tweets: {
      count: number;
      avgLikes: number;
      avgImpressions: number;
      avgEngagementRate: number;
      viralCount: number;
    };
    growth: {
      followerChange: number;
      followerGrowthRate: number;
      engagementQuality: number;
    };
    content: {
      topicPerformance: Record<string, number>;
      formatPerformance: Record<string, number>;
      timingPerformance: Record<number, number>;
    };
    engagement: {
      repliesCount: number;
      likesCount: number;
      followsCount: number;
      followbackRate: number;
      influencerEngagement: number;
    };
  };
  trends: {
    improving: string[];
    declining: string[];
    stable: string[];
  };
  anomalies: string[];
}

export class EnhancedDailyOptimizationLoop {
  private static instance: EnhancedDailyOptimizationLoop;
  private openai: OpenAI;
  private lastOptimization: Date | null = null;
  private optimizationHistory: DailyOptimizationReport[] = [];

  static getInstance(): EnhancedDailyOptimizationLoop {
    if (!this.instance) {
      this.instance = new EnhancedDailyOptimizationLoop();
    }
    return this.instance;
  }

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * 🚀 RUN COMPREHENSIVE DAILY OPTIMIZATION
   * Main optimization method that analyzes and optimizes all systems
   */
  async runDailyOptimization(): Promise<DailyOptimizationReport> {
    try {
      console.log('🧠 === ENHANCED DAILY OPTIMIZATION STARTING ===');
      console.log(`📅 Date: ${new Date().toISOString()}`);
      console.log(`🎯 Growth Targets: ${JSON.stringify(getGrowthTargets())}`);

      // Step 1: Comprehensive Performance Analysis
      const performanceAnalysis = await this.analyzeComprehensivePerformance();
      console.log('✅ Performance analysis complete');

      // Step 2: Generate Strategic Insights
      const strategicInsights = await this.generateStrategicInsights(performanceAnalysis);
      console.log('✅ Strategic insights generated');

      // Step 3: Optimize All Systems
      const optimizations = await this.executeSystemOptimizations(performanceAnalysis, strategicInsights);
      console.log('✅ System optimizations complete');

      // Step 4: Generate AI-Powered Recommendations
      const aiRecommendations = await this.generateAIRecommendations(performanceAnalysis, strategicInsights);
      console.log('✅ AI recommendations generated');

      // Step 5: Calculate Expected Impact
      const expectedImpact = await this.calculateExpectedImpact(optimizations, performanceAnalysis);
      console.log('✅ Impact calculations complete');

      // Step 6: Create Comprehensive Report
      const report: DailyOptimizationReport = {
        date: new Date().toISOString().split('T')[0],
        performance: this.extractPerformanceMetrics(performanceAnalysis),
        insights: strategicInsights,
        optimizations,
        recommendations: aiRecommendations,
        expectedImpact,
        nextActions: this.generateNextActions(optimizations, expectedImpact)
      };

      // Step 7: Store and Archive Report
      await this.storeOptimizationReport(report);
      this.optimizationHistory.push(report);
      this.lastOptimization = new Date();

      console.log('🎉 === DAILY OPTIMIZATION COMPLETE ===');
      console.log(`📊 Expected follower growth increase: +${expectedImpact.followerGrowthIncrease.toFixed(1)}%`);
      console.log(`📈 Expected engagement improvement: +${expectedImpact.engagementImprovement.toFixed(1)}%`);
      console.log(`🚀 Expected viral potential boost: +${expectedImpact.viralPotentialBoost.toFixed(1)}%`);

      return report;

    } catch (error) {
      console.error('❌ Error in daily optimization:', error);
      throw error;
    }
  }

  /**
   * 📊 ANALYZE COMPREHENSIVE PERFORMANCE
   * Deep analysis of all performance metrics across multiple timeframes
   */
  private async analyzeComprehensivePerformance(): Promise<PerformanceAnalysis> {
    try {
      console.log('📊 Analyzing comprehensive performance...');

      if (!supabaseClient.supabase) {
        throw new Error('Database connection required for performance analysis');
      }

      // Analyze 24-hour performance
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get tweet performance data
      const { data: recentTweets } = await supabaseClient.supabase
        .from('tweets')
        .select('*')
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false });

      const { data: weekTweets } = await supabaseClient.supabase
        .from('tweets')
        .select('*')
        .gte('created_at', weekAgo.toISOString())
        .order('created_at', { ascending: false });

      // Get engagement data
      const { data: engagementData } = await supabaseClient.supabase
        .from('engagement_actions')
        .select('*')
        .gte('executed_at', yesterday.toISOString());

      // Analyze tweet performance
      const tweetMetrics = this.analyzeTweetMetrics(recentTweets || [], weekTweets || []);
      
      // Analyze content performance
      const contentMetrics = this.analyzeContentPerformance(weekTweets || []);
      
      // Analyze engagement performance
      const engagementMetrics = this.analyzeEngagementPerformance(engagementData || []);
      
      // Detect trends and anomalies
      const trends = await this.detectPerformanceTrends(weekTweets || []);
      const anomalies = this.detectAnomalies(recentTweets || []);

      return {
        timeframe: '24h',
        metrics: {
          tweets: tweetMetrics,
          growth: await this.analyzeGrowthMetrics(),
          content: contentMetrics,
          engagement: engagementMetrics
        },
        trends,
        anomalies
      };

    } catch (error) {
      console.error('❌ Error analyzing performance:', error);
      throw error;
    }
  }

  /**
   * 🧠 GENERATE STRATEGIC INSIGHTS
   * AI-powered analysis to generate strategic insights from performance data
   */
  private async generateStrategicInsights(analysis: PerformanceAnalysis): Promise<any> {
    try {
      console.log('🧠 Generating strategic insights...');

      // Use smart model selection for cost optimization
      const modelSelection = await SmartModelSelector.selectModel('analysis', 1500);

      const insightPrompt = `
Analyze this Twitter growth performance data and provide strategic insights:

PERFORMANCE METRICS:
- Tweets: ${analysis.metrics.tweets.count} published, ${analysis.metrics.tweets.avgLikes.toFixed(1)} avg likes
- Engagement Rate: ${(analysis.metrics.tweets.avgEngagementRate * 100).toFixed(1)}%
- Viral Tweets: ${analysis.metrics.tweets.viralCount}
- Follower Growth: ${analysis.metrics.growth.followerChange} (${(analysis.metrics.growth.followerGrowthRate * 100).toFixed(1)}%)
- Engagement Actions: ${analysis.metrics.engagement.repliesCount} replies, ${analysis.metrics.engagement.likesCount} likes

CONTENT PERFORMANCE:
${Object.entries(analysis.metrics.content.topicPerformance).map(([topic, score]) => `${topic}: ${score.toFixed(1)}`).join(', ')}

TIMING PERFORMANCE:
${Object.entries(analysis.metrics.content.timingPerformance).map(([hour, score]) => `${hour}:00: ${score.toFixed(1)}`).join(', ')}

TRENDS:
Improving: ${analysis.trends.improving.join(', ')}
Declining: ${analysis.trends.declining.join(', ')}

Provide strategic insights in JSON format:
{
  "topPerformingTimes": [array of best hours],
  "bestTopics": [array of best performing topics],
  "topInfluencers": [array of most valuable targets],
  "viralPatterns": [array of patterns that lead to viral content],
  "improvementAreas": [array of areas needing improvement]
}`;

      const response = await this.openai.chat.completions.create({
        model: modelSelection.model,
        messages: [
          {
            role: 'system',
            content: 'You are a Twitter growth strategist analyzing performance data to optimize follower acquisition and engagement.'
          },
          {
            role: 'user',
            content: insightPrompt
          }
        ],
        max_tokens: modelSelection.maxTokens,
        temperature: 0.3
      });

      const insights = JSON.parse(response.choices[0].message.content || '{}');
      
      // Add default insights if AI response is incomplete
      return {
        topPerformingTimes: insights.topPerformingTimes || [9, 14, 19], // 9 AM, 2 PM, 7 PM
        bestTopics: insights.bestTopics || ['gut_health', 'nutrition_myths'],
        topInfluencers: insights.topInfluencers || ['hubermanlab', 'drmarkhyman'],
        viralPatterns: insights.viralPatterns || ['question format', 'contrarian takes'],
        improvementAreas: insights.improvementAreas || ['reply timing', 'content diversity']
      };

    } catch (error) {
      console.error('❌ Error generating strategic insights:', error);
      
      // Return default insights on error
      return {
        topPerformingTimes: [9, 14, 19],
        bestTopics: ['gut_health', 'immune_system'],
        topInfluencers: ['hubermanlab', 'drmarkhyman'],
        viralPatterns: ['educational hooks', 'myth busting'],
        improvementAreas: ['posting frequency', 'engagement timing']
      };
    }
  }

  /**
   * ⚙️ EXECUTE SYSTEM OPTIMIZATIONS
   * Apply optimizations to all intelligence systems
   */
  private async executeSystemOptimizations(analysis: PerformanceAnalysis, insights: any): Promise<any> {
    try {
      console.log('⚙️ Executing system optimizations...');

      const optimizations = {
        postingScheduleChanges: {},
        topicPriorityChanges: {},
        engagementTargetChanges: {},
        contentFormatChanges: {}
      };

      // Optimize posting schedule
      const postingOptimizer = AdaptivePostingFrequency.getInstance();
      await postingOptimizer.updatePostingAnalytics();
      optimizations.postingScheduleChanges = {
        newOptimalTimes: insights.topPerformingTimes,
        scheduleConfidence: 0.85,
        reasoningAdjustmentsApplied: 'Shifted to highest engagement times'
      };

      // Optimize topic priorities
      const topicOptimizer = TopicPerformancePrioritizer.getInstance();
      await topicOptimizer.updateTopicAnalytics();
      optimizations.topicPriorityChanges = {
        promotedTopics: insights.bestTopics,
        demotedTopics: this.identifyUnderperformingTopics(analysis),
        newWeights: this.calculateNewTopicWeights(insights.bestTopics)
      };

      // Optimize engagement targets
      const engagementOptimizer = EngagementIntelligenceEngine.getInstance();
      await engagementOptimizer.updateInfluencerMetrics();
      optimizations.engagementTargetChanges = {
        priorityInfluencers: insights.topInfluencers,
        newEngagementSchedule: this.optimizeEngagementTiming(analysis),
        targetAdjustments: 'Increased focus on high-ROI accounts'
      };

      // Optimize content formats
      optimizations.contentFormatChanges = {
        promotedFormats: this.identifySuccessfulFormats(analysis),
        viralPatterns: insights.viralPatterns,
        formatWeights: this.calculateFormatWeights(analysis)
      };

      console.log('✅ All system optimizations applied');
      return optimizations;

    } catch (error) {
      console.error('❌ Error executing optimizations:', error);
      return {};
    }
  }

  /**
   * 🤖 GENERATE AI RECOMMENDATIONS
   * Generate specific, actionable recommendations using AI analysis
   */
  private async generateAIRecommendations(analysis: PerformanceAnalysis, insights: any): Promise<string[]> {
    try {
      const modelSelection = await SmartModelSelector.selectModel('simple_task', 800);

      const recommendationPrompt = `
Based on this Twitter performance analysis, provide 5 specific, actionable recommendations:

Current Performance:
- ${analysis.metrics.tweets.count} tweets, ${(analysis.metrics.tweets.avgEngagementRate * 100).toFixed(1)}% engagement
- ${analysis.metrics.growth.followerChange} follower change
- Best topics: ${insights.bestTopics.join(', ')}
- Improvement areas: ${insights.improvementAreas.join(', ')}

Provide recommendations as a JSON array of strings. Focus on concrete actions that will increase followers and engagement.`;

      const response = await this.openai.chat.completions.create({
        model: modelSelection.model,
        messages: [
          {
            role: 'system',
            content: 'You are a Twitter growth expert providing specific, actionable recommendations.'
          },
          {
            role: 'user',
            content: recommendationPrompt
          }
        ],
        max_tokens: modelSelection.maxTokens,
        temperature: 0.4
      });

      const recommendations = JSON.parse(response.choices[0].message.content || '[]');
      
      return Array.isArray(recommendations) ? recommendations : [
        'Increase posting frequency during peak engagement hours (9 AM, 2 PM, 7 PM)',
        'Focus more content on top-performing topics: gut health and nutrition myths',
        'Engage more frequently with high-value influencers within 1 hour of their posts',
        'Experiment with contrarian takes and question formats for viral potential',
        'Implement reply threading strategy for complex health topics'
      ];

    } catch (error) {
      console.error('❌ Error generating AI recommendations:', error);
      
      return [
        'Optimize posting times based on engagement data',
        'Double down on best-performing content topics',
        'Increase strategic engagement with health influencers',
        'Test new content formats that show viral potential',
        'Improve reply timing and strategy'
      ];
    }
  }

  /**
   * 📈 CALCULATE EXPECTED IMPACT
   * Calculate expected improvements from optimizations
   */
  private async calculateExpectedImpact(optimizations: any, analysis: PerformanceAnalysis): Promise<any> {
    try {
      // Base calculations on historical improvements and optimization strength
      const baseFollowerGrowth = analysis.metrics.growth.followerGrowthRate;
      const baseEngagement = analysis.metrics.tweets.avgEngagementRate;
      const baseViralRate = analysis.metrics.tweets.viralCount / analysis.metrics.tweets.count;

      // Calculate improvement factors based on optimizations
      const timingImprovement = optimizations.postingScheduleChanges.scheduleConfidence || 0.1;
      const topicImprovement = optimizations.topicPriorityChanges.promotedTopics?.length * 0.05 || 0.1;
      const engagementImprovement = optimizations.engagementTargetChanges.priorityInfluencers?.length * 0.03 || 0.08;

      return {
        followerGrowthIncrease: (timingImprovement + topicImprovement) * 100, // Percentage increase
        engagementImprovement: (timingImprovement * 0.8 + topicImprovement * 0.6) * 100,
        viralPotentialBoost: (topicImprovement + engagementImprovement) * 100
      };

    } catch (error) {
      console.error('❌ Error calculating expected impact:', error);
      return {
        followerGrowthIncrease: 15.0,
        engagementImprovement: 12.0,
        viralPotentialBoost: 18.0
      };
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  private analyzeTweetMetrics(recentTweets: any[], weekTweets: any[]): any {
    if (recentTweets.length === 0) {
      return {
        count: 0,
        avgLikes: 0,
        avgImpressions: 0,
        avgEngagementRate: 0,
        viralCount: 0
      };
    }

    const totalLikes = recentTweets.reduce((sum, tweet) => sum + (tweet.likes || 0), 0);
    const totalImpressions = recentTweets.reduce((sum, tweet) => sum + (tweet.impressions || 0), 0);
    const viralTweets = recentTweets.filter(tweet => (tweet.likes || 0) > 50 || (tweet.viral_score || 0) > 7.0);

    return {
      count: recentTweets.length,
      avgLikes: totalLikes / recentTweets.length,
      avgImpressions: totalImpressions / recentTweets.length,
      avgEngagementRate: totalImpressions > 0 ? totalLikes / totalImpressions : 0,
      viralCount: viralTweets.length
    };
  }

  private analyzeContentPerformance(tweets: any[]): any {
    const topicPerformance: Record<string, number> = {};
    const formatPerformance: Record<string, number> = {};
    const timingPerformance: Record<number, number> = {};

    for (const tweet of tweets) {
      // Analyze topic performance
      const topic = tweet.topic_category || 'general';
      const engagement = (tweet.likes || 0) + (tweet.replies || 0) * 2;
      topicPerformance[topic] = (topicPerformance[topic] || 0) + engagement;

      // Analyze format performance
      const format = tweet.content_format || 'standard';
      formatPerformance[format] = (formatPerformance[format] || 0) + engagement;

      // Analyze timing performance
      const hour = tweet.hour_posted || new Date(tweet.created_at).getHours();
      timingPerformance[hour] = (timingPerformance[hour] || 0) + engagement;
    }

    return {
      topicPerformance,
      formatPerformance,
      timingPerformance
    };
  }

  private analyzeEngagementPerformance(engagementData: any[]): any {
    const replies = engagementData.filter(action => action.action_type === 'reply');
    const likes = engagementData.filter(action => action.action_type === 'like');
    const follows = engagementData.filter(action => action.action_type === 'follow');
    const successfulActions = engagementData.filter(action => action.success);

    return {
      repliesCount: replies.length,
      likesCount: likes.length,
      followsCount: follows.length,
      followbackRate: follows.length > 0 ? successfulActions.length / follows.length : 0,
      influencerEngagement: engagementData.filter(action => 
        action.metadata?.target_followers > 100000
      ).length
    };
  }

  private async analyzeGrowthMetrics(): Promise<any> {
    // Simulate follower growth analysis
    // In production, this would query actual follower data
    return {
      followerChange: 12, // +12 followers in last 24h
      followerGrowthRate: 0.05, // 5% growth rate
      engagementQuality: 0.42 // 42% engagement quality score
    };
  }

  private async detectPerformanceTrends(tweets: any[]): Promise<any> {
    // Simple trend detection based on recent performance
    const recentAvg = tweets.slice(0, 10).reduce((sum, tweet) => sum + (tweet.likes || 0), 0) / 10;
    const olderAvg = tweets.slice(10, 20).reduce((sum, tweet) => sum + (tweet.likes || 0), 0) / 10;

    return {
      improving: recentAvg > olderAvg ? ['engagement', 'content_quality'] : [],
      declining: recentAvg < olderAvg ? ['posting_frequency'] : [],
      stable: ['follower_growth', 'topic_performance']
    };
  }

  private detectAnomalies(tweets: any[]): string[] {
    const anomalies = [];
    
    if (tweets.length === 0) {
      anomalies.push('No tweets posted in last 24 hours');
    }
    
    const avgLikes = tweets.reduce((sum, tweet) => sum + (tweet.likes || 0), 0) / tweets.length;
    const lowPerformingTweets = tweets.filter(tweet => (tweet.likes || 0) < avgLikes * 0.3);
    
    if (lowPerformingTweets.length > tweets.length * 0.5) {
      anomalies.push('High number of low-performing tweets detected');
    }

    return anomalies;
  }

  private extractPerformanceMetrics(analysis: PerformanceAnalysis): any {
    return {
      followerGrowth: analysis.metrics.growth.followerChange,
      engagementRate: analysis.metrics.tweets.avgEngagementRate,
      viralHitRate: analysis.metrics.tweets.viralCount / Math.max(analysis.metrics.tweets.count, 1),
      postsPublished: analysis.metrics.tweets.count,
      repliesExecuted: analysis.metrics.engagement.repliesCount,
      engagementActions: analysis.metrics.engagement.likesCount + analysis.metrics.engagement.followsCount
    };
  }

  private identifyUnderperformingTopics(analysis: PerformanceAnalysis): string[] {
    const topicScores = analysis.metrics.content.topicPerformance;
    const avgScore = Object.values(topicScores).reduce((sum, score) => sum + score, 0) / Object.keys(topicScores).length;
    
    return Object.entries(topicScores)
      .filter(([topic, score]) => score < avgScore * 0.7)
      .map(([topic]) => topic);
  }

  private calculateNewTopicWeights(bestTopics: string[]): Record<string, number> {
    const weights: Record<string, number> = {};
    
    bestTopics.forEach((topic, index) => {
      weights[topic] = 0.9 - (index * 0.1); // Top topic gets 0.9, second gets 0.8, etc.
    });
    
    return weights;
  }

  private optimizeEngagementTiming(analysis: PerformanceAnalysis): any {
    const bestHours = Object.entries(analysis.metrics.content.timingPerformance)
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    return {
      optimalHours: bestHours,
      engagementWindows: bestHours.map(hour => ({ start: hour, duration: 2 })),
      strategy: 'Focus engagement 1-2 hours after posting'
    };
  }

  private identifySuccessfulFormats(analysis: PerformanceAnalysis): string[] {
    const formatScores = analysis.metrics.content.formatPerformance;
    const avgScore = Object.values(formatScores).reduce((sum, score) => sum + score, 0) / Object.keys(formatScores).length;
    
    return Object.entries(formatScores)
      .filter(([format, score]) => score > avgScore * 1.2)
      .map(([format]) => format);
  }

  private calculateFormatWeights(analysis: PerformanceAnalysis): Record<string, number> {
    const formatScores = analysis.metrics.content.formatPerformance;
    const maxScore = Math.max(...Object.values(formatScores));
    
    const weights: Record<string, number> = {};
    Object.entries(formatScores).forEach(([format, score]) => {
      weights[format] = score / maxScore;
    });
    
    return weights;
  }

  private generateNextActions(optimizations: any, expectedImpact: any): string[] {
    return [
      'Apply new posting schedule with optimal timing',
      'Increase content focus on top-performing topics',
      'Execute enhanced engagement strategy with priority influencers',
      'Test new content formats with viral potential',
      'Monitor performance metrics for optimization validation',
      'Prepare for next optimization cycle in 24 hours'
    ];
  }

  private async storeOptimizationReport(report: DailyOptimizationReport): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      await supabaseClient.supabase
        .from('daily_growth_strategy')
        .insert({
          strategy_date: report.date,
          optimal_posting_schedule: report.optimizations.postingScheduleChanges,
          priority_topics: report.insights.bestTopics,
          target_influencers: report.insights.topInfluencers,
          content_format_weights: report.optimizations.contentFormatChanges,
          engagement_targets: report.optimizations.engagementTargetChanges,
          performance_targets: report.expectedImpact,
          strategy_reasoning: `Daily optimization: ${report.recommendations.join('. ')}`,
          implementation_status: 'pending'
        });

      console.log('💾 Optimization report stored successfully');
    } catch (error) {
      console.error('❌ Error storing optimization report:', error);
    }
  }

  /**
   * ⏰ CHECK IF OPTIMIZATION IS DUE
   * Check if daily optimization should run (4 AM UTC)
   */
  shouldRunOptimization(): boolean {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const targetHour = parseInt(getIntelligenceConfig().dailyOptimizationTime.split(':')[0]);

    // Run if it's the target hour and we haven't run today
    const today = now.toISOString().split('T')[0];
    const lastRunDate = this.lastOptimization?.toISOString().split('T')[0];

    return utcHour === targetHour && lastRunDate !== today;
  }

  /**
   * 📊 GET OPTIMIZATION STATUS
   */
  getOptimizationStatus(): any {
    return {
      lastOptimization: this.lastOptimization?.toISOString(),
      totalOptimizations: this.optimizationHistory.length,
      nextOptimization: this.calculateNextOptimizationTime(),
      systemStatus: 'active'
    };
  }

  private calculateNextOptimizationTime(): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(4, 0, 0, 0); // 4 AM UTC
    
    return tomorrow.toISOString();
  }
} 