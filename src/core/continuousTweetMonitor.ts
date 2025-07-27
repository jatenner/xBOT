/**
 * 🔄 CONTINUOUS TWEET PERFORMANCE MONITOR
 * 
 * This system ensures our database CONSTANTLY reflects real Twitter performance.
 * No tweet performance data goes stale - everything is continuously updated.
 * 
 * CRITICAL FOR AI LEARNING:
 * - Real-time engagement tracking
 * - Viral detection within minutes
 * - Immediate performance feedback
 * - Continuous learning data flow
 */

import { secureSupabaseClient } from '../utils/secureSupabaseClient';
import { xClient } from '../utils/xClient';

interface TweetPerformanceData {
  tweet_id: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  impressions: number;
  engagement_rate: number;
  viral_velocity: number;
  performance_trend: 'rising' | 'stable' | 'declining';
  last_updated: Date;
}

interface MonitoringConfig {
  // Frequency settings
  fresh_tweet_interval_minutes: number;    // Track new tweets every X minutes
  active_tweet_interval_minutes: number;   // Track active tweets every X minutes  
  viral_tweet_interval_minutes: number;    // Track viral tweets every X minutes
  
  // Performance thresholds
  viral_threshold: number;                 // Engagement velocity for viral detection
  active_hours: number;                    // Hours to consider a tweet "active"
  max_tweets_per_check: number;           // API rate limiting
  
  // Intelligence settings
  learning_feedback_enabled: boolean;      // Send data to AI learning systems
  real_time_optimization: boolean;         // Real-time content optimization
}

export class ContinuousTweetMonitor {
  private static instance: ContinuousTweetMonitor;
  private monitoringActive = false;
  private intervals: NodeJS.Timeout[] = [];
  
  private readonly config: MonitoringConfig = {
    fresh_tweet_interval_minutes: 30,     // Check new tweets every 30 minutes (rate limit friendly)
    active_tweet_interval_minutes: 60,    // Check active tweets every hour
    viral_tweet_interval_minutes: 15,     // Check viral tweets every 15 minutes
    viral_threshold: 50,                  // 50+ engagement velocity = viral
    active_hours: 48,                     // Monitor tweets for 48 hours
    max_tweets_per_check: 5,              // Reduced to respect API limits
    learning_feedback_enabled: true,      // Enable AI learning
    real_time_optimization: true          // Enable optimization
  };

  private constructor() {
    console.log('🔄 Continuous Tweet Monitor initialized');
  }

  static getInstance(): ContinuousTweetMonitor {
    if (!ContinuousTweetMonitor.instance) {
      ContinuousTweetMonitor.instance = new ContinuousTweetMonitor();
    }
    return ContinuousTweetMonitor.instance;
  }

  /**
   * 🚀 START CONTINUOUS MONITORING
   */
  async startMonitoring(): Promise<void> {
    if (this.monitoringActive) {
      console.log('⚠️ Continuous monitoring already active');
      return;
    }

    console.log('🔄 === STARTING CONTINUOUS TWEET MONITORING ===');
    console.log(`📊 Fresh tweets: Every ${this.config.fresh_tweet_interval_minutes} minutes`);
    console.log(`⚡ Active tweets: Every ${this.config.active_tweet_interval_minutes} minutes`);
    console.log(`🔥 Viral tweets: Every ${this.config.viral_tweet_interval_minutes} minutes`);
    console.log(`🧠 AI Learning: ${this.config.learning_feedback_enabled ? 'ENABLED' : 'DISABLED'}`);

    try {
      // Start fresh tweet monitoring (most important)
      const freshInterval = setInterval(async () => {
        await this.monitorFreshTweets();
      }, this.config.fresh_tweet_interval_minutes * 60 * 1000);

      // Start active tweet monitoring
      const activeInterval = setInterval(async () => {
        await this.monitorActiveTweets();
      }, this.config.active_tweet_interval_minutes * 60 * 1000);

      // Start viral tweet monitoring (highest priority)
      const viralInterval = setInterval(async () => {
        await this.monitorViralTweets();
      }, this.config.viral_tweet_interval_minutes * 60 * 1000);

      this.intervals = [freshInterval, activeInterval, viralInterval];
      this.monitoringActive = true;

      // Run initial monitoring immediately
      console.log('🎯 Running initial monitoring sweep...');
      await this.runInitialSweep();

      console.log('✅ CONTINUOUS MONITORING ACTIVE - Database will stay in sync!');

    } catch (error) {
      console.error('❌ Failed to start continuous monitoring:', error);
      throw error;
    }
  }

  /**
   * 🆕 MONITOR FRESH TWEETS (Last 2 hours)
   */
  private async monitorFreshTweets(): Promise<void> {
    try {
      console.log('\n🆕 === MONITORING FRESH TWEETS ===');

      // Get tweets from last 2 hours
      const freshTweets = await this.getFreshTweets();
      
      if (freshTweets.length === 0) {
        console.log('📭 No fresh tweets to monitor');
        return;
      }

      console.log(`📊 Monitoring ${freshTweets.length} fresh tweets...`);

      for (const tweet of freshTweets) {
        try {
          const performance = await this.fetchTweetPerformance(tweet.tweet_id);
          
          if (performance) {
            await this.updateTweetPerformance(tweet.tweet_id, performance);
            
            // Check for early viral indicators
            if (performance.viral_velocity > this.config.viral_threshold) {
              console.log(`🔥 EARLY VIRAL DETECTED: ${tweet.tweet_id} (velocity: ${performance.viral_velocity})`);
              await this.handleViralDetection(tweet.tweet_id, performance);
            }
          }

          // Rate limiting between requests
          await this.sleep(500);

        } catch (error) {
          console.warn(`⚠️ Error monitoring fresh tweet ${tweet.tweet_id}:`, error.message);
        }
      }

      console.log('✅ Fresh tweet monitoring completed');

    } catch (error) {
      console.error('❌ Fresh tweet monitoring error:', error);
    }
  }

  /**
   * ⚡ MONITOR ACTIVE TWEETS (Last 24 hours)
   */
  private async monitorActiveTweets(): Promise<void> {
    try {
      console.log('\n⚡ === MONITORING ACTIVE TWEETS ===');

      // Get tweets from last 24 hours that aren't fresh
      const activeTweets = await this.getActiveTweets();

      if (activeTweets.length === 0) {
        console.log('📭 No active tweets to monitor');
        return;
      }

      console.log(`📊 Monitoring ${activeTweets.length} active tweets...`);

      for (const tweet of activeTweets) {
        try {
          const performance = await this.fetchTweetPerformance(tweet.tweet_id);
          
          if (performance) {
            await this.updateTweetPerformance(tweet.tweet_id, performance);
            
            // Analyze performance trends
            const trend = await this.analyzeTrend(tweet.tweet_id, performance);
            
            if (trend === 'rising' && performance.viral_velocity > this.config.viral_threshold * 0.7) {
              console.log(`📈 RISING PERFORMANCE: ${tweet.tweet_id} (trend: ${trend})`);
            }
          }

          // Rate limiting
          await this.sleep(1000);

        } catch (error) {
          console.warn(`⚠️ Error monitoring active tweet ${tweet.tweet_id}:`, error.message);
        }
      }

      console.log('✅ Active tweet monitoring completed');

    } catch (error) {
      console.error('❌ Active tweet monitoring error:', error);
    }
  }

  /**
   * 🔥 MONITOR VIRAL TWEETS (High priority)
   */
  private async monitorViralTweets(): Promise<void> {
    try {
      console.log('\n🔥 === MONITORING VIRAL TWEETS ===');

      // Get currently viral tweets
      const viralTweets = await this.getViralTweets();

      if (viralTweets.length === 0) {
        console.log('📭 No viral tweets to monitor');
        return;
      }

      console.log(`🔥 Monitoring ${viralTweets.length} viral tweets...`);

      for (const tweet of viralTweets) {
        try {
          const performance = await this.fetchTweetPerformance(tweet.tweet_id);
          
          if (performance) {
            await this.updateTweetPerformance(tweet.tweet_id, performance);
            
            // Analyze viral patterns for learning
            if (this.config.learning_feedback_enabled) {
              await this.analyzeViralPatterns(tweet.tweet_id, performance);
            }
            
            console.log(`🔥 Viral update: ${tweet.tweet_id} - ${performance.likes} likes, ${performance.viral_velocity} velocity`);
          }

          // Minimal delay for viral tweets (high priority)
          await this.sleep(200);

        } catch (error) {
          console.warn(`⚠️ Error monitoring viral tweet ${tweet.tweet_id}:`, error.message);
        }
      }

      console.log('✅ Viral tweet monitoring completed');

    } catch (error) {
      console.error('❌ Viral tweet monitoring error:', error);
    }
  }

  /**
   * 📊 FETCH REAL TWEET PERFORMANCE FROM TWITTER
   */
  private async fetchTweetPerformance(tweetId: string): Promise<TweetPerformanceData | null> {
    try {
      const tweetResult = await xClient.getTweetById(tweetId);
      
      if (!tweetResult || !tweetResult.success || !tweetResult.data) {
        return null;
      }

      const tweetData = tweetResult.data;
      const metrics = tweetData.public_metrics || {};

      const likes = metrics.like_count || 0;
      const retweets = metrics.retweet_count || 0;
      const replies = metrics.reply_count || 0;
      const quotes = metrics.quote_count || 0;
      const impressions = metrics.impression_count || 0;

      const totalEngagement = likes + retweets + replies + quotes;
      const engagement_rate = impressions > 0 ? (totalEngagement / impressions) * 100 : 0;

      // Calculate viral velocity (engagement per hour since posting)
      const createdAt = new Date(tweetData.created_at || Date.now());
      const hoursAge = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      const viral_velocity = hoursAge > 0 ? totalEngagement / hoursAge : totalEngagement;

      return {
        tweet_id: tweetId,
        likes,
        retweets,
        replies,
        quotes,
        impressions,
        engagement_rate,
        viral_velocity,
        performance_trend: 'stable', // Will be calculated in analyzeTrend
        last_updated: new Date()
      };

    } catch (error) {
      console.warn(`⚠️ Failed to fetch performance for ${tweetId}:`, error.message);
      return null;
    }
  }

  /**
   * 💾 UPDATE TWEET PERFORMANCE IN DATABASE
   */
  private async updateTweetPerformance(tweetId: string, performance: TweetPerformanceData): Promise<void> {
    try {
      // Update main tweets table
      const { error: tweetsError } = await secureSupabaseClient.supabase
        ?.from('tweets')
        .update({
          likes_count: performance.likes,
          retweets_count: performance.retweets,
          replies_count: performance.replies,
          quotes_count: performance.quotes,
          impressions_count: performance.impressions,
          engagement_score: performance.engagement_rate,
          viral_velocity: performance.viral_velocity,
          updated_at: performance.last_updated.toISOString()
        })
        .eq('tweet_id', tweetId);

      if (tweetsError) {
        console.warn(`⚠️ Error updating tweets table for ${tweetId}:`, tweetsError.message);
      }

      // Update tweet_metrics table for historical tracking
      const { error: metricsError } = await secureSupabaseClient.supabase
        ?.from('tweet_metrics')
        .upsert({
          tweet_id: tweetId,
          like_count: performance.likes,
          retweet_count: performance.retweets,
          reply_count: performance.replies,
          quote_count: performance.quotes,
          impression_count: performance.impressions,
          engagement_rate: performance.engagement_rate,
          viral_velocity: performance.viral_velocity,
          captured_at: performance.last_updated.toISOString()
        }, {
          onConflict: 'tweet_id'
        });

      if (metricsError) {
        console.warn(`⚠️ Error updating metrics table for ${tweetId}:`, metricsError.message);
      } else {
        console.log(`📊 Updated performance for ${tweetId}: ${performance.likes} likes, ${performance.engagement_rate.toFixed(1)}% rate`);
      }

    } catch (error) {
      console.error(`❌ Failed to update performance for ${tweetId}:`, error);
    }
  }

  /**
   * 🎯 RUN INITIAL MONITORING SWEEP
   */
  private async runInitialSweep(): Promise<void> {
    console.log('🎯 Running comprehensive initial monitoring sweep...');
    
    // Monitor all categories immediately
    await this.monitorFreshTweets();
    await this.sleep(2000);
    await this.monitorActiveTweets();
    await this.sleep(2000); 
    await this.monitorViralTweets();
    
    console.log('✅ Initial monitoring sweep completed');
  }

  // Helper methods
  private async getFreshTweets(): Promise<{tweet_id: string, created_at: string}[]> {
    const { data, error } = await secureSupabaseClient.supabase
      ?.from('tweets')
      .select('tweet_id, created_at')
      .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Last 2 hours
      .order('created_at', { ascending: false })
      .limit(this.config.max_tweets_per_check);

    return error ? [] : (data || []);
  }

  private async getActiveTweets(): Promise<{tweet_id: string, created_at: string}[]> {
    const { data, error } = await secureSupabaseClient.supabase
      ?.from('tweets')
      .select('tweet_id, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .lt('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // But not fresh
      .order('created_at', { ascending: false })
      .limit(this.config.max_tweets_per_check);

    return error ? [] : (data || []);
  }

  private async getViralTweets(): Promise<{tweet_id: string, viral_velocity: number}[]> {
    const { data, error } = await secureSupabaseClient.supabase
      ?.from('tweets')
      .select('tweet_id, viral_velocity')
      .gte('viral_velocity', this.config.viral_threshold)
      .gte('created_at', new Date(Date.now() - this.config.active_hours * 60 * 60 * 1000).toISOString())
      .order('viral_velocity', { ascending: false })
      .limit(this.config.max_tweets_per_check);

    return error ? [] : (data || []);
  }

  private async analyzeTrend(tweetId: string, current: TweetPerformanceData): Promise<'rising' | 'stable' | 'declining'> {
    // Simple trend analysis - could be enhanced with historical data
    return current.viral_velocity > this.config.viral_threshold ? 'rising' : 'stable';
  }

  private async handleViralDetection(tweetId: string, performance: TweetPerformanceData): Promise<void> {
    console.log(`🚨 VIRAL TWEET DETECTED: ${tweetId}`);
    console.log(`   📊 Performance: ${performance.likes} likes, ${performance.viral_velocity.toFixed(1)} velocity`);
    
    // Could trigger immediate content analysis, pattern learning, etc.
  }

  private async analyzeViralPatterns(tweetId: string, performance: TweetPerformanceData): Promise<void> {
    // Analyze what makes this tweet viral for future content optimization
    console.log(`🧠 Analyzing viral patterns for ${tweetId}...`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 🛑 STOP MONITORING
   */
  async stopMonitoring(): Promise<void> {
    console.log('🛑 Stopping continuous tweet monitoring...');
    
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    this.monitoringActive = false;
    
    console.log('✅ Continuous monitoring stopped');
  }

  /**
   * 📊 GET MONITORING STATUS
   */
  getStatus(): {
    active: boolean;
    config: MonitoringConfig;
    intervals_running: number;
  } {
    return {
      active: this.monitoringActive,
      config: this.config,
      intervals_running: this.intervals.length
    };
  }
}

// Export singleton instance
export const continuousTweetMonitor = ContinuousTweetMonitor.getInstance(); 