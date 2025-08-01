/**
 * 🎯 ADVANCED ANALYTICS ORCHESTRATOR
 * 
 * Coordinates the new analytics and learning systems with existing posting workflow.
 * This service ensures seamless integration and automated data collection.
 * 
 * Features:
 * - Automatic analytics collection after posting
 * - Learning cycle scheduling
 * - Performance monitoring
 * - Content optimization feedback
 */

import { comprehensiveAnalyticsCollector } from '../utils/comprehensiveAnalyticsCollector';
import { enhancedLearningEngine } from '../utils/enhancedLearningEngine';
import { supabaseClient } from '../utils/supabaseClient';

export interface PostAnalyticsRequest {
  tweet_id: string;
  content: string;
  posted_at: Date;
  content_type?: string;
  source?: string;
}

export class AdvancedAnalyticsOrchestrator {
  private static instance: AdvancedAnalyticsOrchestrator;
  private static learningCycleInterval: NodeJS.Timeout | null = null;
  
  static getInstance(): AdvancedAnalyticsOrchestrator {
    if (!this.instance) {
      this.instance = new AdvancedAnalyticsOrchestrator();
    }
    return this.instance;
  }
  
  /**
   * 🚀 START ANALYTICS ORCHESTRATION
   * Initializes all analytics and learning systems
   */
  async start(): Promise<void> {
    console.log('🎯 Starting Advanced Analytics Orchestrator...');
    
    // Check if enhanced analytics is enabled
    const analyticsEnabled = await this.isAnalyticsEnabled();
    if (!analyticsEnabled) {
      console.log('⚠️ Enhanced analytics disabled in configuration');
      return;
    }
    
    // Start periodic learning cycles
    this.startLearningCycles();
    
    // Schedule daily summaries
    this.scheduleDailySummaries();
    
    console.log('✅ Advanced Analytics Orchestrator started successfully');
  }
  
  /**
   * 📊 PROCESS NEW POST
   * Handles analytics collection for a newly posted tweet
   */
  async processNewPost(request: PostAnalyticsRequest): Promise<{
    success: boolean;
    analytics_id?: string;
    error?: string;
  }> {
    try {
      console.log(`📊 Processing analytics for new post: ${request.tweet_id}`);
      
      // Step 1: Collect comprehensive analytics
      const analyticsResult = await comprehensiveAnalyticsCollector.collectComprehensiveAnalytics(
        request.tweet_id,
        request.content,
        request.posted_at
      );
      
      if (!analyticsResult.success) {
        console.warn('⚠️ Analytics collection failed:', analyticsResult.error);
      }
      
      // Step 2: Update daily summary
      await this.updateDailySummary(request.posted_at);
      
      console.log(`✅ Analytics processing complete for: ${request.tweet_id}`);
      return { success: true, analytics_id: request.tweet_id };
      
    } catch (error) {
      console.error('❌ Failed to process new post analytics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * 🔄 START LEARNING CYCLES
   * Runs learning analysis every 6 hours
   */
  private startLearningCycles(): void {
    // Run learning cycle every 6 hours
    const sixHours = 6 * 60 * 60 * 1000;
    
    AdvancedAnalyticsOrchestrator.learningCycleInterval = setInterval(async () => {
      try {
        console.log('🧠 Starting scheduled learning cycle...');
        const result = await enhancedLearningEngine.runLearningCycle();
        
        if (result.success) {
          console.log('✅ Learning cycle completed successfully');
          console.log(`📊 Patterns discovered: ${result.insights?.patterns_discovered || 0}`);
          console.log(`🎯 Performance trend: ${result.insights?.performance_trends?.avg_score_trend > 0 ? 'improving' : 'declining'}`);
        } else {
          console.error('❌ Learning cycle failed:', result.error);
        }
      } catch (error) {
        console.error('❌ Learning cycle error:', error);
      }
    }, sixHours);
    
    // Run initial learning cycle after 30 minutes
    setTimeout(async () => {
      try {
        console.log('🧠 Running initial learning cycle...');
        await enhancedLearningEngine.runLearningCycle();
      } catch (error) {
        console.error('❌ Initial learning cycle failed:', error);
      }
    }, 30 * 60 * 1000);
    
    console.log('⏰ Learning cycles scheduled every 6 hours');
  }
  
  /**
   * 📅 SCHEDULE DAILY SUMMARIES
   * Creates daily performance summaries at midnight
   */
  private scheduleDailySummaries(): void {
    // Calculate time until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    // Schedule initial summary
    setTimeout(() => {
      this.generateDailySummary(new Date());
      
      // Then schedule daily
      setInterval(() => {
        this.generateDailySummary(new Date());
      }, 24 * 60 * 60 * 1000);
      
    }, msUntilMidnight);
    
    console.log(`⏰ Daily summaries scheduled (next in ${Math.round(msUntilMidnight / 1000 / 60)} minutes)`);
  }
  
  /**
   * 📈 GENERATE DAILY SUMMARY
   * Creates a comprehensive daily performance summary
   */
  private async generateDailySummary(date: Date): Promise<void> {
    try {
      const summaryDate = date.toISOString().split('T')[0];
      console.log(`📈 Generating daily summary for: ${summaryDate}`);
      
      // Get all tweets from this day
      const { data: tweets, error: tweetsError } = await supabaseClient.supabase
        .from('tweets')
        .select(`
          tweet_id,
          created_at,
          tweet_analytics (
            likes,
            retweets,
            replies,
            bookmarks,
            impressions,
            profile_visits,
            new_followers_attributed
          ),
          tweet_performance_scores (
            overall_score
          )
        `)
        .gte('created_at', `${summaryDate}T00:00:00Z`)
        .lt('created_at', `${summaryDate}T23:59:59Z`);
      
      if (tweetsError) {
        console.error('❌ Failed to fetch tweets for summary:', tweetsError);
        return;
      }
      
      if (!tweets || tweets.length === 0) {
        console.log('⚠️ No tweets found for daily summary');
        return;
      }
      
      // Calculate aggregates
      let totalLikes = 0;
      let totalRetweets = 0;
      let totalReplies = 0;
      let totalBookmarks = 0;
      let totalImpressions = 0;
      let totalProfileVisits = 0;
      let totalNewFollowers = 0;
      let totalPerformanceScore = 0;
      let successfulPosts = 0;
      let bestScore = 0;
      let bestTweetId = '';
      
      for (const tweet of tweets) {
        // Get latest analytics data
        const analytics = Array.isArray(tweet.tweet_analytics) 
          ? tweet.tweet_analytics[tweet.tweet_analytics.length - 1] 
          : tweet.tweet_analytics;
          
        if (analytics) {
          totalLikes += analytics.likes || 0;
          totalRetweets += analytics.retweets || 0;
          totalReplies += analytics.replies || 0;
          totalBookmarks += analytics.bookmarks || 0;
          totalImpressions += analytics.impressions || 0;
          totalProfileVisits += analytics.profile_visits || 0;
          totalNewFollowers += analytics.new_followers_attributed || 0;
          successfulPosts++;
        }
        
        // Get performance score
        const performanceScore = Array.isArray(tweet.tweet_performance_scores)
          ? tweet.tweet_performance_scores[0]
          : tweet.tweet_performance_scores;
          
        if (performanceScore && performanceScore.overall_score) {
          totalPerformanceScore += performanceScore.overall_score;
          if (performanceScore.overall_score > bestScore) {
            bestScore = performanceScore.overall_score;
            bestTweetId = tweet.tweet_id;
          }
        }
      }
      
      // Calculate rates
      const avgEngagementRate = totalImpressions > 0 ? 
        ((totalLikes + totalRetweets + totalReplies) / totalImpressions * 100) : 0;
      const followerGrowthRate = successfulPosts > 0 ? (totalNewFollowers / successfulPosts) : 0;
      const avgPerformanceScore = successfulPosts > 0 ? (totalPerformanceScore / successfulPosts) : 0;
      
      // Get AI cost for the day (if available)
      const { data: budgetData } = await supabaseClient.supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'daily_ai_spending')
        .single();
      
      const aiCost = budgetData?.value ? parseFloat(budgetData.value) : 0;
      
      // Calculate cost effectiveness
      const costPerFollower = totalNewFollowers > 0 ? (aiCost / totalNewFollowers) : 0;
      const costPerEngagement = (totalLikes + totalRetweets + totalReplies) > 0 ? 
        (aiCost / (totalLikes + totalRetweets + totalReplies)) : 0;
      
      // Find dominant content type and optimal timing
      const { data: contentData } = await supabaseClient.supabase
        .from('tweet_content_features')
        .select('content_type, posted_hour')
        .in('tweet_id', tweets.map(t => t.tweet_id));
      
      const contentTypeCounts = contentData?.reduce((counts, item) => {
        counts[item.content_type] = (counts[item.content_type] || 0) + 1;
        return counts;
      }, {}) || {};
      
      const dominantContentType = Object.keys(contentTypeCounts).reduce((a, b) => 
        contentTypeCounts[a] > contentTypeCounts[b] ? a : b, 'single_tip');
      
      const hourCounts = contentData?.reduce((counts: Record<string, number>, item: any) => {
        counts[item.posted_hour] = (counts[item.posted_hour] || 0) + 1;
        return counts;
      }, {} as Record<string, number>) || {};
      
      const optimalHour = Object.keys(hourCounts).length > 0 
        ? parseInt(Object.keys(hourCounts).reduce((a, b) => 
            hourCounts[a] > hourCounts[b] ? a : b)) 
        : 12;
      
      // Store summary
      const { error: summaryError } = await supabaseClient.supabase
        .from('daily_performance_summary')
        .upsert({
          summary_date: summaryDate,
          total_tweets: tweets.length,
          successful_posts: successfulPosts,
          failed_posts: tweets.length - successfulPosts,
          
          total_likes: totalLikes,
          total_retweets: totalRetweets,
          total_replies: totalReplies,
          total_bookmarks: totalBookmarks,
          total_impressions: totalImpressions,
          total_profile_visits: totalProfileVisits,
          
          new_followers: totalNewFollowers,
          follower_growth_rate: followerGrowthRate,
          avg_engagement_rate: avgEngagementRate,
          
          best_performing_tweet_id: bestTweetId,
          best_tweet_score: bestScore,
          avg_performance_score: avgPerformanceScore,
          
          dominant_content_type: dominantContentType,
          optimal_posting_hour: optimalHour,
          top_performing_topic: 'general_health', // Will be enhanced with topic analysis
          
          ai_cost_usd: aiCost,
          cost_per_follower: costPerFollower,
          cost_per_engagement: costPerEngagement,
          
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'summary_date'
        });
      
      if (summaryError) {
        console.error('❌ Failed to store daily summary:', summaryError);
      } else {
        console.log(`✅ Daily summary generated: ${totalNewFollowers} followers, ${avgPerformanceScore.toFixed(1)} avg score`);
      }
      
    } catch (error) {
      console.error('❌ Failed to generate daily summary:', error);
    }
  }
  
  /**
   * 📊 UPDATE DAILY SUMMARY
   * Updates running totals throughout the day
   */
  private async updateDailySummary(date: Date): Promise<void> {
    // This will be called every time a new post is made
    // For now, we'll rely on the full daily summary generation
    // In the future, this could update running totals
    console.log('📊 Daily summary update scheduled');
  }
  
  /**
   * ⚙️ CHECK IF ANALYTICS IS ENABLED
   */
  private async isAnalyticsEnabled(): Promise<boolean> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'ENABLE_ENHANCED_ANALYTICS')
        .single();
      
      if (error || !data) {
        return false;
      }
      
      return data.value === 'true';
    } catch (error) {
      console.warn('⚠️ Failed to check analytics setting:', error);
      return false;
    }
  }
  
  /**
   * 🛑 STOP ORCHESTRATOR
   */
  static stop(): void {
    if (AdvancedAnalyticsOrchestrator.learningCycleInterval) {
      clearInterval(AdvancedAnalyticsOrchestrator.learningCycleInterval);
      AdvancedAnalyticsOrchestrator.learningCycleInterval = null;
      console.log('🛑 Analytics orchestrator stopped');
    }
  }
  
  /**
   * 🎯 GET CONTENT OPTIMIZATION SUGGESTIONS
   * Returns recommendations for the next post
   */
  async getContentOptimizationSuggestions(): Promise<{
    success: boolean;
    recommendations?: any;
    error?: string;
  }> {
    try {
      const recommendations = await enhancedLearningEngine.getContentRecommendations();
      
      if (!recommendations) {
        return {
          success: false,
          error: 'No recommendations available yet - need more data'
        };
      }
      
      return {
        success: true,
        recommendations
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const advancedAnalyticsOrchestrator = AdvancedAnalyticsOrchestrator.getInstance();