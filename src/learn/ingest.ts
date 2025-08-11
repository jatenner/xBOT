/**
 * 📈 LEARNING FEEDBACK LOOP
 * 
 * PURPOSE: Ingest metrics and update bandit priors
 * STRATEGY: Periodic analysis of tweet performance
 */

import { GamingBanditManager } from './bandit';
import { EngagementMetricsCalculator, TweetMetrics, HistoricalBaseline } from './metrics';
import { DatabaseManager } from '../lib/db';

export interface TweetData {
  id: string;
  tweetId: string;
  content: string;
  postedAt: Date;
  topic: string;
  tags: string[];
  hour: number;
  metadata: any;
  analytics?: any;
}

export interface LearningUpdate {
  tweetId: string;
  topic: string;
  hour: number;
  tags: string[];
  reward: number;
  confidence: number;
  engagementRate: number;
  timestamp: Date;
}

export interface LearningStats {
  tweetsProcessed: number;
  averageEngagement: number;
  totalRewards: number;
  banditUpdates: number;
  lastRun: Date;
  errors: number;
}

/**
 * Learning metrics ingestion system
 */
export class LearningIngestor {
  private banditManager: GamingBanditManager;
  private metricsCalculator: EngagementMetricsCalculator;
  private dbManager: DatabaseManager;
  private baseline: HistoricalBaseline | null = null;

  constructor() {
    this.banditManager = new GamingBanditManager();
    this.metricsCalculator = new EngagementMetricsCalculator();
    this.dbManager = DatabaseManager.getInstance();
  }

  /**
   * Get tweets from last N hours for analysis
   */
  async getRecentTweets(hours: number = 24): Promise<TweetData[]> {
    try {
      const db = this.dbManager.getSupabase();
      if (!db) {
        throw new Error('Database not available');
      }

      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const { data, error } = await db
        .from('tweets')
        .select('*')
        .gte('posted_at', since.toISOString())
        .order('posted_at', { ascending: false });

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      return (data || []).map(row => ({
        id: row.id.toString(),
        tweetId: row.tweet_id,
        content: row.content,
        postedAt: new Date(row.posted_at),
        topic: row.metadata?.topic || 'unknown',
        tags: row.metadata?.tags || [],
        hour: new Date(row.posted_at).getHours(),
        metadata: row.metadata || {},
        analytics: row.analytics || {}
      }));
    } catch (error: any) {
      console.error('Failed to get recent tweets:', error.message);
      return [];
    }
  }

  /**
   * Calculate historical baseline from tweet data
   */
  async updateBaseline(): Promise<void> {
    try {
      console.log('📊 Updating engagement baseline...');
      
      const recentTweets = await this.getRecentTweets(24 * 7); // Last week
      
      const historicalMetrics = recentTweets
        .filter(tweet => tweet.analytics?.impressions > 0)
        .map(tweet => ({
          engagementRate: this.metricsCalculator.calculateEngagementRate({
            likes: tweet.analytics.likes || 0,
            retweets: tweet.analytics.retweets || 0,
            replies: tweet.analytics.replies || 0,
            bookmarks: tweet.analytics.bookmarks || 0,
            impressions: tweet.analytics.impressions || 1
          }),
          impressions: tweet.analytics.impressions,
          timestamp: tweet.postedAt
        }));

      if (historicalMetrics.length > 0) {
        this.baseline = this.metricsCalculator.calculateBaseline(historicalMetrics);
        console.log(`✅ Updated baseline: median=${this.baseline.medianEngagementRate.toFixed(4)}, n=${this.baseline.totalTweets}`);
      } else {
        console.log('⚠️  No historical data for baseline calculation');
      }
    } catch (error: any) {
      console.error('Failed to update baseline:', error.message);
    }
  }

  /**
   * Process a single tweet for learning
   */
  async processTweetLearning(tweet: TweetData): Promise<LearningUpdate | null> {
    try {
      // Check if we have sufficient analytics data
      if (!tweet.analytics || !tweet.analytics.impressions) {
        return null;
      }

      const metrics: TweetMetrics = {
        likes: tweet.analytics.likes || 0,
        retweets: tweet.analytics.retweets || 0,
        replies: tweet.analytics.replies || 0,
        bookmarks: tweet.analytics.bookmarks || 0,
        impressions: tweet.analytics.impressions,
        quotes: tweet.analytics.quotes || 0
      };

      // Calculate time since posting
      const hoursAgo = (Date.now() - tweet.postedAt.getTime()) / (1000 * 60 * 60);
      
      // Skip if too recent (< 2 hours for meaningful data)
      if (hoursAgo < 2) {
        return null;
      }

      // Check if we have sufficient data
      if (!this.metricsCalculator.hasSufficientData(metrics, hoursAgo)) {
        return null;
      }

      // Generate reward with context
      const tweetData = {
        topic: tweet.topic,
        tags: tweet.tags,
        hour: tweet.hour,
        length: tweet.content.length,
        hasMedia: tweet.metadata?.mediaHint !== 'none'
      };

      const rewardResult = this.metricsCalculator.generateRewardWithContext(
        metrics,
        hoursAgo,
        tweetData,
        this.baseline
      );

      // Update bandit arms
      await Promise.all([
        this.banditManager.updateTopic(tweet.topic, rewardResult.reward, rewardResult.context),
        this.banditManager.updateHour(tweet.hour, rewardResult.reward, rewardResult.context),
        ...tweet.tags.map(tag => 
          this.banditManager.updateTag(tag, rewardResult.reward, rewardResult.context)
        )
      ]);

      const learningUpdate: LearningUpdate = {
        tweetId: tweet.tweetId,
        topic: tweet.topic,
        hour: tweet.hour,
        tags: tweet.tags,
        reward: rewardResult.reward,
        confidence: rewardResult.confidence,
        engagementRate: rewardResult.analysis.engagementRate,
        timestamp: new Date()
      };

      console.log(`🧠 Learning update: ${tweet.tweetId} → reward=${rewardResult.reward} (${rewardResult.analysis.performanceTier})`);
      
      return learningUpdate;
    } catch (error: any) {
      console.error(`Failed to process learning for tweet ${tweet.tweetId}:`, error.message);
      return null;
    }
  }

  /**
   * Update tweet analytics in database
   */
  async updateTweetAnalytics(tweet: TweetData, metrics: TweetMetrics): Promise<void> {
    try {
      const db = this.dbManager.getSupabase();
      if (!db) {
        throw new Error('Database not available');
      }

      const engagementRate = this.metricsCalculator.calculateEngagementRate(metrics);
      const performanceTier = this.metricsCalculator.determinePerformanceTier(engagementRate);

      const updatedAnalytics = {
        ...tweet.analytics,
        ...metrics,
        engagement_rate: engagementRate,
        performance_tier: performanceTier,
        last_updated: new Date().toISOString()
      };

      const { error } = await db
        .from('tweets')
        .update({ analytics: updatedAnalytics })
        .eq('tweet_id', tweet.tweetId);

      if (error) {
        throw new Error(`Analytics update failed: ${error.message}`);
      }
    } catch (error: any) {
      console.error(`Failed to update analytics for ${tweet.tweetId}:`, error.message);
    }
  }

  /**
   * Log learning summary to audit_log
   */
  async logLearningSummary(stats: LearningStats, updates: LearningUpdate[]): Promise<void> {
    try {
      const db = this.dbManager.getSupabase();
      if (!db) {
        return;
      }

      const summaryData = {
        tweets_processed: stats.tweetsProcessed,
        average_engagement: stats.averageEngagement,
        total_rewards: stats.totalRewards,
        bandit_updates: stats.banditUpdates,
        baseline_median: this.baseline?.medianEngagementRate || 0,
        top_topics: this.getTopTopicsFromUpdates(updates),
        best_hours: this.getBestHoursFromUpdates(updates)
      };

      const contextData = {
        learning_engine: 'v2',
        timestamp: new Date().toISOString(),
        baseline_tweets: this.baseline?.totalTweets || 0
      };

      const { error } = await db
        .from('audit_log')
        .insert({
          event_type: 'LEARNING_CYCLE_COMPLETE',
          component: 'learning_engine_v2',
          event_data: summaryData,
          context: contextData
        });

      if (error) {
        console.error('Failed to log learning summary:', error.message);
      } else {
        console.log('📝 Logged learning summary to audit_log');
      }
    } catch (error: any) {
      console.error('Failed to log learning summary:', error.message);
    }
  }

  /**
   * Extract top topics from learning updates
   */
  private getTopTopicsFromUpdates(updates: LearningUpdate[]): Array<{ topic: string; avgReward: number; count: number }> {
    const topicStats: Record<string, { totalReward: number; count: number }> = {};
    
    updates.forEach(update => {
      if (!topicStats[update.topic]) {
        topicStats[update.topic] = { totalReward: 0, count: 0 };
      }
      topicStats[update.topic].totalReward += update.reward;
      topicStats[update.topic].count += 1;
    });

    return Object.entries(topicStats)
      .map(([topic, stats]) => ({
        topic,
        avgReward: stats.totalReward / stats.count,
        count: stats.count
      }))
      .sort((a, b) => b.avgReward - a.avgReward)
      .slice(0, 5);
  }

  /**
   * Extract best hours from learning updates
   */
  private getBestHoursFromUpdates(updates: LearningUpdate[]): Array<{ hour: number; avgReward: number; count: number }> {
    const hourStats: Record<number, { totalReward: number; count: number }> = {};
    
    updates.forEach(update => {
      if (!hourStats[update.hour]) {
        hourStats[update.hour] = { totalReward: 0, count: 0 };
      }
      hourStats[update.hour].totalReward += update.reward;
      hourStats[update.hour].count += 1;
    });

    return Object.entries(hourStats)
      .map(([hour, stats]) => ({
        hour: parseInt(hour),
        avgReward: stats.totalReward / stats.count,
        count: stats.count
      }))
      .sort((a, b) => b.avgReward - a.avgReward)
      .slice(0, 6);
  }

  /**
   * Run complete learning cycle
   */
  async runLearningCycle(): Promise<LearningStats> {
    console.log('🧠 Starting learning cycle...');
    
    const startTime = Date.now();
    const stats: LearningStats = {
      tweetsProcessed: 0,
      averageEngagement: 0,
      totalRewards: 0,
      banditUpdates: 0,
      lastRun: new Date(),
      errors: 0
    };

    try {
      // Update baseline first
      await this.updateBaseline();

      // Get recent tweets
      const recentTweets = await this.getRecentTweets(24);
      console.log(`📊 Processing ${recentTweets.length} recent tweets...`);

      const learningUpdates: LearningUpdate[] = [];
      let totalEngagement = 0;

      // Process each tweet
      for (const tweet of recentTweets) {
        try {
          const update = await this.processTweetLearning(tweet);
          
          if (update) {
            learningUpdates.push(update);
            totalEngagement += update.engagementRate;
            stats.totalRewards += update.reward;
            stats.banditUpdates += 1 + update.tags.length; // Topic + hour + tags
          }
          
          stats.tweetsProcessed++;
        } catch (error: any) {
          console.error(`Learning error for tweet ${tweet.tweetId}:`, error.message);
          stats.errors++;
        }
      }

      // Calculate statistics
      stats.averageEngagement = stats.tweetsProcessed > 0 ? 
        totalEngagement / learningUpdates.length : 0;

      // Log summary
      await this.logLearningSummary(stats, learningUpdates);

      const duration = (Date.now() - startTime) / 1000;
      console.log(`✅ Learning cycle complete in ${duration.toFixed(1)}s:`);
      console.log(`   - Processed: ${stats.tweetsProcessed} tweets`);
      console.log(`   - Avg engagement: ${(stats.averageEngagement * 100).toFixed(2)}%`);
      console.log(`   - Total rewards: ${stats.totalRewards}`);
      console.log(`   - Bandit updates: ${stats.banditUpdates}`);
      console.log(`   - Errors: ${stats.errors}`);

      return stats;
    } catch (error: any) {
      console.error('Learning cycle failed:', error.message);
      stats.errors++;
      return stats;
    }
  }

  /**
   * Start continuous learning loop
   */
  async startContinuousLearning(intervalMinutes: number = 15): Promise<void> {
    console.log(`🧠 Starting continuous learning loop (${intervalMinutes}min intervals)...`);
    
    // Run initial cycle
    await this.runLearningCycle();
    
    // Set up interval
    setInterval(async () => {
      try {
        await this.runLearningCycle();
      } catch (error: any) {
        console.error('Learning cycle error:', error.message);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Get learning system status
   */
  async getSystemStatus(): Promise<{
    baselineStatus: 'current' | 'stale' | 'missing';
    recentTweets: number;
    banditHealth: any;
    lastUpdate: Date | null;
  }> {
    try {
      const recentTweets = await this.getRecentTweets(24);
      const banditHealth = await this.banditManager.getPerformanceReport();
      
      let baselineStatus: 'current' | 'stale' | 'missing' = 'missing';
      if (this.baseline) {
        const hoursOld = (Date.now() - this.baseline.lastUpdated.getTime()) / (1000 * 60 * 60);
        baselineStatus = hoursOld < 24 ? 'current' : 'stale';
      }

      return {
        baselineStatus,
        recentTweets: recentTweets.length,
        banditHealth,
        lastUpdate: null // Would track in production
      };
    } catch (error: any) {
      console.error('Failed to get learning system status:', error.message);
      return {
        baselineStatus: 'missing',
        recentTweets: 0,
        banditHealth: null,
        lastUpdate: null
      };
    }
  }
}