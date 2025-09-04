import { TwitterAnalyticsScraper } from '../analytics/twitterAnalyticsScraper';
import { ContentPerformanceLearner } from '../learning/contentPerformanceLearner';
import { admin as supabase } from '../lib/supabaseClients';

/**
 * AUTOMATED ANALYTICS COLLECTION SYSTEM
 * 
 * Runs every 30 minutes to:
 * 1. Scrape Twitter engagement data
 * 2. Update performance tracking
 * 3. Feed insights back to AI content generation
 * 4. Track follower growth and engagement trends
 */

export class AnalyticsScheduler {
  private static instance: AnalyticsScheduler;
  private scraper: TwitterAnalyticsScraper;
  private learner: ContentPerformanceLearner;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  private constructor() {
    this.scraper = new TwitterAnalyticsScraper();
    this.learner = ContentPerformanceLearner.getInstance();
  }

  public static getInstance(): AnalyticsScheduler {
    if (!AnalyticsScheduler.instance) {
      AnalyticsScheduler.instance = new AnalyticsScheduler();
    }
    return AnalyticsScheduler.instance;
  }

  /**
   * Start automated analytics collection every 30 minutes
   */
  start(): void {
    if (this.isRunning) {
      console.log('📊 ANALYTICS_SCHEDULER: Already running');
      return;
    }

    this.isRunning = true;
    console.log('🤖 ANALYTICS_SCHEDULER: Starting automated data collection every 30 minutes...');

    // Run immediately on start
    this.runAnalyticsCollection();

    // Schedule every 30 minutes
    this.intervalId = setInterval(() => {
      this.runAnalyticsCollection();
    }, 30 * 60 * 1000); // 30 minutes

    console.log('✅ ANALYTICS_SCHEDULER: Automated collection started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 ANALYTICS_SCHEDULER: Stopped');
  }

  /**
   * Run a complete analytics collection cycle
   */
  private async runAnalyticsCollection(): Promise<void> {
    const startTime = Date.now();
    console.log('⏰ SCHEDULED_ANALYTICS: Starting comprehensive data collection...');

    try {
      // 1. Scrape current Twitter analytics
      const analyticsData = await this.scraper.scrapeAllAnalytics();
      
      console.log(`📊 ANALYTICS_SCRAPED: ${analyticsData.tweets.length} tweets, ${analyticsData.totalEngagement} total engagement`);

      // 2. Update learning system with fresh data
      const learningInsights = await this.learner.analyzeContentPerformance();
      console.log(`🧠 LEARNING_UPDATED: Performance analysis completed`);

      // 3. Store performance tracking data
      await this.storePerformanceTracking(analyticsData);

      // 4. Generate insights for next content decisions
      const insights = await this.scraper.getAnalyticsInsights();
      console.log(`🎯 INSIGHTS_GENERATED: Avg engagement ${insights.averageEngagement.toFixed(2)}%`);

      // 5. Update follower growth tracking
      await this.trackFollowerGrowth(analyticsData.profile.followers);

      const duration = Date.now() - startTime;
      console.log(`✅ ANALYTICS_CYCLE_COMPLETE: ${duration}ms - Data fresh for AI decisions`);

    } catch (error: any) {
      console.error('❌ ANALYTICS_COLLECTION_ERROR:', error.message);
      
      // Store error for monitoring
      await this.logAnalyticsError(error.message);
    }
  }

  /**
   * Store performance tracking data for AI learning
   */
  private async storePerformanceTracking(analyticsData: any): Promise<void> {
    try {
      for (const tweet of analyticsData.tweets) {
        // Calculate performance metrics
        const actualEngagement = tweet.engagementRate;
        const followerImpact = tweet.followersGained || 0;

        // Store in performance tracking table
        const { error } = await supabase
          .from('content_performance_tracking')
          .upsert([{
            tweet_id: tweet.tweetId,
            content_type: tweet.content.length > 200 ? 'thread' : 'single',
            actual_engagement: actualEngagement,
            follower_delta: followerImpact,
            quality_score: this.calculateQualityScore(tweet),
            learning_insights: {
              views: tweet.views || 0,
              likes: tweet.likes,
              reposts: tweet.reposts,
              replies: tweet.replies,
              engagement_rate: actualEngagement,
              content_length: tweet.content.length,
              posting_hour: new Date().getHours(),
              scraped_at: new Date().toISOString()
            }
          }], {
            onConflict: 'tweet_id'
          });

        if (error) {
          console.warn(`⚠️ PERFORMANCE_TRACKING_ERROR for ${tweet.tweetId}:`, error.message);
        }
      }

      console.log(`💾 PERFORMANCE_TRACKING: ${analyticsData.tweets.length} tweets stored for learning`);

    } catch (error: any) {
      console.error('❌ PERFORMANCE_STORAGE_ERROR:', error.message);
    }
  }

  /**
   * Track follower growth over time
   */
  private async trackFollowerGrowth(currentFollowers: number): Promise<void> {
    try {
      // Get previous follower count
      const { data: previousData } = await supabase
        .from('profile_analytics')
        .select('followers')
        .order('scraped_at', { ascending: false })
        .limit(1);

      const previousFollowers = previousData?.[0]?.followers || 0;
      const followerGrowth = currentFollowers - previousFollowers;

      if (followerGrowth !== 0) {
        console.log(`📈 FOLLOWER_GROWTH: ${followerGrowth > 0 ? '+' : ''}${followerGrowth} followers (${currentFollowers} total)`);
        
        // Store growth insights
        const { error } = await supabase
          .from('analytics_insights')
          .insert([{
            insight_type: 'follower_growth',
            insight_data: {
              current_followers: currentFollowers,
              previous_followers: previousFollowers,
              growth: followerGrowth,
              growth_rate: previousFollowers > 0 ? (followerGrowth / previousFollowers) * 100 : 0,
              tracked_at: new Date().toISOString()
            },
            performance_score: followerGrowth
          }]);

        if (error) {
          console.warn('⚠️ FOLLOWER_TRACKING_ERROR:', error.message);
        }
      }

    } catch (error: any) {
      console.error('❌ FOLLOWER_GROWTH_ERROR:', error.message);
    }
  }

  /**
   * Calculate quality score based on engagement metrics
   */
  private calculateQualityScore(tweet: any): number {
    const engagementRate = tweet.engagementRate || 0;
    const likes = tweet.likes || 0;
    const reposts = tweet.reposts || 0;
    const replies = tweet.replies || 0;

    // Quality formula: engagement rate + interaction diversity
    const diversityBonus = (likes > 0 ? 0.1 : 0) + (reposts > 0 ? 0.2 : 0) + (replies > 0 ? 0.3 : 0);
    
    return Math.min(10, engagementRate + diversityBonus);
  }

  /**
   * Log analytics errors for monitoring
   */
  private async logAnalyticsError(errorMessage: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('analytics_insights')
        .insert([{
          insight_type: 'collection_error',
          insight_data: {
            error: errorMessage,
            timestamp: new Date().toISOString(),
            recovery_action: 'Will retry on next cycle'
          },
          performance_score: -1
        }]);

      if (error) {
        console.warn('⚠️ ERROR_LOGGING_ERROR:', error.message);
      }
    } catch (error: any) {
      console.error('❌ ERROR_LOG_STORAGE_ERROR:', error.message);
    }
  }

  /**
   * Get current analytics status
   */
  getStatus(): {
    isRunning: boolean;
    lastRun?: Date;
    nextRun?: Date;
  } {
    return {
      isRunning: this.isRunning,
      lastRun: new Date(), // TODO: Track actual last run time
      nextRun: this.isRunning ? new Date(Date.now() + 30 * 60 * 1000) : undefined
    };
  }

  /**
   * Manual analytics collection trigger
   */
  async runNow(): Promise<void> {
    console.log('🔄 MANUAL_ANALYTICS: Running immediate data collection...');
    await this.runAnalyticsCollection();
  }
}
