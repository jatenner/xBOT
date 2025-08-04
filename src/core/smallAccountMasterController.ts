/**
 * 🎯 SMALL ACCOUNT MASTER CONTROLLER
 * ==================================
 * Specialized controller for accounts with <50 followers
 * Replaces high-volume posting with quality-focused growth strategy
 */

import { supabaseClient } from '../utils/supabaseClient';
import { smallAccountOptimizer } from '../growth/smallAccountOptimizer';
import { viralHealthContentGenerator } from '../content/viralHealthContentGenerator';
import { communityEngagementBot } from '../engagement/communityEngagementBot';

export interface SmallAccountOperations {
  content_generation: boolean;
  community_engagement: boolean;
  follower_tracking: boolean;
  quality_control: boolean;
  posting_optimization: boolean;
}

export interface DailyGrowthMetrics {
  followers_start: number;
  followers_end: number;
  followers_gained: number;
  tweets_posted: number;
  engagement_actions: number;
  avg_likes_per_tweet: number;
  success_rate: number;
  growth_velocity: number;
}

export class SmallAccountMasterController {
  private static instance: SmallAccountMasterController;
  
  private operations: SmallAccountOperations = {
    content_generation: true,
    community_engagement: true,
    follower_tracking: true,
    quality_control: true,
    posting_optimization: true
  };

  private currentFollowers = 17;
  private targetFollowers = 50;
  private dailyMetrics: DailyGrowthMetrics = {
    followers_start: 17,
    followers_end: 17,
    followers_gained: 0,
    tweets_posted: 0,
    engagement_actions: 0,
    avg_likes_per_tweet: 0,
    success_rate: 0,
    growth_velocity: 0
  };

  private constructor() {}

  static getInstance(): SmallAccountMasterController {
    if (!SmallAccountMasterController.instance) {
      SmallAccountMasterController.instance = new SmallAccountMasterController();
    }
    return SmallAccountMasterController.instance;
  }

  /**
   * 🚀 START SMALL ACCOUNT GROWTH SYSTEM
   */
  async startGrowthSystem(): Promise<void> {
    try {
      console.log('🚀 STARTING SMALL ACCOUNT GROWTH SYSTEM');
      console.log('======================================');
      console.log(`Current: ${this.currentFollowers} followers → Target: ${this.targetFollowers} followers`);

      // Initialize daily metrics
      await this.initializeDailyMetrics();

      // Start growth cycles
      this.startContentGenerationCycle();
      this.startCommunityEngagementCycle();
      this.startFollowerTrackingCycle();
      this.startQualityControlCycle();

      console.log('✅ All growth systems activated');

    } catch (error) {
      console.error('❌ Failed to start growth system:', error);
      throw error;
    }
  }

  /**
   * 🎯 CONTENT GENERATION CYCLE (Quality over Quantity)
   */
  private startContentGenerationCycle(): void {
    // Check for content generation every 2 hours (instead of every 30 minutes)
    setInterval(async () => {
      if (!this.operations.content_generation) return;

      try {
        await this.executeQualityContentGeneration();
      } catch (error) {
        console.error('❌ Content generation cycle failed:', error);
      }
    }, 2 * 60 * 60 * 1000); // 2 hours

    console.log('🎯 Content generation cycle started (every 2 hours)');
  }

  /**
   * 🤝 COMMUNITY ENGAGEMENT CYCLE
   */
  private startCommunityEngagementCycle(): void {
    // Run community engagement 3 times per day
    const engagementTimes = [9, 13, 20]; // 9 AM, 1 PM, 8 PM

    engagementTimes.forEach(hour => {
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hour, 0, 0, 0);

      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      const delay = scheduledTime.getTime() - now.getTime();

      setTimeout(() => {
        setInterval(async () => {
          if (!this.operations.community_engagement) return;

          try {
            await this.executeCommunityEngagement();
          } catch (error) {
            console.error('❌ Community engagement failed:', error);
          }
        }, 24 * 60 * 60 * 1000); // Daily
      }, delay);
    });

    console.log('🤝 Community engagement scheduled for 9 AM, 1 PM, 8 PM daily');
  }

  /**
   * 📈 FOLLOWER TRACKING CYCLE
   */
  private startFollowerTrackingCycle(): void {
    // Track followers every 6 hours
    setInterval(async () => {
      if (!this.operations.follower_tracking) return;

      try {
        await this.trackFollowerProgress();
      } catch (error) {
        console.error('❌ Follower tracking failed:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours

    console.log('📈 Follower tracking cycle started (every 6 hours)');
  }

  /**
   * 🔍 QUALITY CONTROL CYCLE
   */
  private startQualityControlCycle(): void {
    // Quality analysis every 4 hours
    setInterval(async () => {
      if (!this.operations.quality_control) return;

      try {
        await this.executeQualityAnalysis();
      } catch (error) {
        console.error('❌ Quality control failed:', error);
      }
    }, 4 * 60 * 60 * 1000); // 4 hours

    console.log('🔍 Quality control cycle started (every 4 hours)');
  }

  /**
   * 📝 EXECUTE QUALITY CONTENT GENERATION
   */
  private async executeQualityContentGeneration(): Promise<void> {
    try {
      console.log('📝 === QUALITY CONTENT GENERATION ===');

      // Check if we should post (daily limits and quality gates)
      const analysis = await smallAccountOptimizer.analyzeGrowthPotential();
      
      const mockContent = "Why your doctor won't tell you about vitamin D deficiency - it keeps you coming back for more visits. 🤔";
      const contentEvaluation = await smallAccountOptimizer.shouldPostContent(mockContent, analysis);

      if (!contentEvaluation.should_post) {
        console.log(`⏸️ Content posting paused: ${contentEvaluation.reasoning}`);
        return;
      }

      // Generate viral health content
      const viralContent = await viralHealthContentGenerator.generateControversialTake();
      
      console.log('🔥 Generated viral content:');
      console.log(`   Content: "${viralContent.content}"`);
      console.log(`   Viral Score: ${viralContent.viral_score}/10`);
      console.log(`   Strategy: ${viralContent.posting_strategy}`);

      // Additional quality check
      const finalEvaluation = await smallAccountOptimizer.shouldPostContent(viralContent.content, analysis);
      
      if (finalEvaluation.should_post && finalEvaluation.viral_score >= 7) {
        // Post the content (would integrate with existing posting system)
        await this.postQualityContent(viralContent.content, viralContent.viral_score);
        this.dailyMetrics.tweets_posted++;
        
        console.log(`✅ Quality content posted (Score: ${finalEvaluation.viral_score})`);
      } else {
        console.log(`❌ Content failed quality gate - improvements needed:`);
        finalEvaluation.improvements_needed.forEach(improvement => {
          console.log(`   - ${improvement}`);
        });
      }

    } catch (error) {
      console.error('❌ Quality content generation failed:', error);
    }
  }

  /**
   * 🤝 EXECUTE COMMUNITY ENGAGEMENT
   */
  private async executeCommunityEngagement(): Promise<void> {
    try {
      console.log('🤝 === COMMUNITY ENGAGEMENT EXECUTION ===');

      const result = await communityEngagementBot.executeDailyEngagementPlan();
      
      this.dailyMetrics.engagement_actions += result.actions_completed;
      this.dailyMetrics.followers_gained += result.followers_gained;

      console.log(`✅ Community engagement complete:`);
      console.log(`   Actions: ${result.actions_completed}`);
      console.log(`   Est. followers gained: ${result.followers_gained}`);
      console.log(`   Summary: ${result.engagement_summary}`);

    } catch (error) {
      console.error('❌ Community engagement failed:', error);
    }
  }

  /**
   * 📊 TRACK FOLLOWER PROGRESS
   */
  private async trackFollowerProgress(): Promise<void> {
    try {
      console.log('📊 === FOLLOWER PROGRESS TRACKING ===');

      const progress = await smallAccountOptimizer.trackGrowthProgress();
      
      this.currentFollowers = progress.current_metrics.current_followers;
      this.dailyMetrics.followers_end = this.currentFollowers;
      
      console.log(`📈 Growth Progress:`);
      console.log(`   Current: ${progress.current_metrics.current_followers}/${progress.current_metrics.target_followers} followers`);
      console.log(`   Progress: ${progress.progress_percentage.toFixed(1)}%`);
      console.log(`   Days remaining: ${progress.days_remaining}`);
      console.log(`   On track: ${progress.on_track ? 'Yes' : 'No'}`);

      if (!progress.on_track) {
        console.log('⚠️ Adjustments needed:');
        progress.adjustments_needed.forEach(adjustment => {
          console.log(`   - ${adjustment}`);
        });
      }

      // Log progress to database
      await this.logGrowthProgress(progress);

    } catch (error) {
      console.error('❌ Follower tracking failed:', error);
    }
  }

  /**
   * 🔍 EXECUTE QUALITY ANALYSIS
   */
  private async executeQualityAnalysis(): Promise<void> {
    try {
      console.log('🔍 === QUALITY ANALYSIS ===');

      // Analyze recent tweet performance
      const { data: recentTweets, error } = await supabaseClient.supabase
        .from('tweets')
        .select('likes, retweets, replies, impressions, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch recent tweets:', error);
        return;
      }

      const tweets = recentTweets || [];
      const totalLikes = tweets.reduce((sum, tweet) => sum + (tweet.likes || 0), 0);
      const tweetsWithLikes = tweets.filter(tweet => (tweet.likes || 0) > 0).length;
      
      this.dailyMetrics.avg_likes_per_tweet = tweets.length > 0 ? totalLikes / tweets.length : 0;
      this.dailyMetrics.success_rate = tweets.length > 0 ? (tweetsWithLikes / tweets.length) * 100 : 0;

      console.log(`📊 Quality metrics (24h):`);
      console.log(`   Tweets posted: ${tweets.length}`);
      console.log(`   Avg likes per tweet: ${this.dailyMetrics.avg_likes_per_tweet.toFixed(2)}`);
      console.log(`   Success rate: ${this.dailyMetrics.success_rate.toFixed(1)}%`);

      // Quality recommendations
      if (this.dailyMetrics.avg_likes_per_tweet < 0.5) {
        console.log('⚠️ Quality alert: Low engagement detected');
        console.log('   Recommendation: Focus on more controversial content');
      }

      if (tweets.length > 4) {
        console.log('⚠️ Volume alert: Too many posts per day');
        console.log('   Recommendation: Reduce posting frequency, increase quality');
      }

    } catch (error) {
      console.error('❌ Quality analysis failed:', error);
    }
  }

  /**
   * 📤 POST QUALITY CONTENT
   */
  private async postQualityContent(content: string, viralScore: number): Promise<void> {
    try {
      // Store the content for posting (would integrate with existing posting system)
      await supabaseClient.supabase
        .from('tweets')
        .insert({
          tweet_id: `small_account_${Date.now()}`,
          content: content,
          viral_score: viralScore,
          content_type: 'quality_optimized',
          created_at: new Date().toISOString(),
          posted: false // Will be posted by existing system
        });

      console.log(`📤 Quality content queued for posting (Viral Score: ${viralScore})`);

    } catch (error) {
      console.error('❌ Failed to queue content:', error);
    }
  }

  /**
   * 📋 INITIALIZE DAILY METRICS
   */
  private async initializeDailyMetrics(): Promise<void> {
    try {
      this.dailyMetrics = {
        followers_start: this.currentFollowers,
        followers_end: this.currentFollowers,
        followers_gained: 0,
        tweets_posted: 0,
        engagement_actions: 0,
        avg_likes_per_tweet: 0,
        success_rate: 0,
        growth_velocity: 0
      };

      console.log('📋 Daily metrics initialized');

    } catch (error) {
      console.error('❌ Failed to initialize metrics:', error);
    }
  }

  /**
   * 📊 LOG GROWTH PROGRESS
   */
  private async logGrowthProgress(progress: any): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('small_account_growth_log')
        .insert({
          date: new Date().toISOString().split('T')[0],
          followers_count: progress.current_metrics.current_followers,
          target_followers: progress.current_metrics.target_followers,
          progress_percentage: progress.progress_percentage,
          days_remaining: progress.days_remaining,
          on_track: progress.on_track,
          avg_likes_per_tweet: this.dailyMetrics.avg_likes_per_tweet,
          tweets_posted_today: this.dailyMetrics.tweets_posted,
          engagement_actions_today: this.dailyMetrics.engagement_actions,
          adjustments_needed: progress.adjustments_needed
        });

      console.log('📊 Growth progress logged to database');

    } catch (error) {
      console.error('❌ Failed to log progress:', error);
    }
  }

  /**
   * 📈 GET DAILY SUMMARY
   */
  async getDailySummary(): Promise<string> {
    try {
      const growthVelocity = this.dailyMetrics.followers_gained / Math.max(1, this.dailyMetrics.tweets_posted);
      
      return `🎯 Small Account Growth Summary:
📊 Followers: ${this.dailyMetrics.followers_start} → ${this.dailyMetrics.followers_end} (+${this.dailyMetrics.followers_gained})
📝 Quality tweets posted: ${this.dailyMetrics.tweets_posted}
🤝 Engagement actions: ${this.dailyMetrics.engagement_actions}
📈 Avg likes per tweet: ${this.dailyMetrics.avg_likes_per_tweet.toFixed(2)}
🎯 Success rate: ${this.dailyMetrics.success_rate.toFixed(1)}%
⚡ Growth velocity: ${growthVelocity.toFixed(2)} followers/tweet

Progress to 50 followers: ${((this.currentFollowers / this.targetFollowers) * 100).toFixed(1)}%`;

    } catch (error) {
      console.error('❌ Failed to generate summary:', error);
      return 'Summary generation failed';
    }
  }

  /**
   * ⚙️ TOGGLE OPERATIONS
   */
  toggleOperation(operation: keyof SmallAccountOperations, enabled: boolean): void {
    this.operations[operation] = enabled;
    console.log(`${enabled ? '✅' : '❌'} ${operation} ${enabled ? 'enabled' : 'disabled'}`);
  }
}

export const smallAccountMasterController = SmallAccountMasterController.getInstance();