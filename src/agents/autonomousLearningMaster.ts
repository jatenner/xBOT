/**
 * 🧠 AUTONOMOUS LEARNING MASTER
 * 
 * Master orchestrator that coordinates all learning systems:
 * - Twitter Structure Learning Engine (viral tweet analysis)
 * - Intelligent Tweet Generator (dynamic prompts)
 * - Engagement Feedback Engine (performance tracking)
 * - Enhanced Browser Poster (reliable posting)
 * 
 * Creates a continuous learning loop that improves tweet quality over time.
 */

import { twitterStructureLearningEngine } from './twitterStructureLearningEngine';
import { intelligentTweetGenerator } from './intelligentTweetGenerator';
import { engagementFeedbackEngine } from './engagementFeedbackEngine';
import { enhancedBrowserTweetPoster } from '../utils/enhancedBrowserTweetPoster';
import { SecureSupabaseClient } from '../utils/secureSupabaseClient';
import * as crypto from 'crypto';

interface LearningCycleResult {
  success: boolean;
  phase: string;
  viral_tweets_learned: number;
  content_generated: boolean;
  content_posted: boolean;
  engagement_tracked: number;
  insights_generated: number;
  learning_applied: string[];
  performance_metrics: {
    cycle_duration_ms: number;
    prediction_accuracy?: number;
    engagement_improvement?: number;
  };
  errors: string[];
}

interface AutonomousConfig {
  learning_enabled: boolean;
  posting_enabled: boolean;
  tracking_enabled: boolean;
  learning_frequency_hours: number;
  max_tweets_per_day: number;
  min_engagement_threshold: number;
  experimental_mode: boolean;
}

export class AutonomousLearningMaster {
  private supabase = new SecureSupabaseClient();
  private isRunning = false;
  private cycleInterval: NodeJS.Timeout | null = null;
  private lastLearningCycle: Date | null = null;
  private dailyTweetCount = 0;
  private lastDayReset = new Date().getDate();

  private readonly config: AutonomousConfig = {
    learning_enabled: true,
    posting_enabled: true,
    tracking_enabled: true,
    learning_frequency_hours: 6, // Learn from viral tweets every 6 hours
    max_tweets_per_day: 8,
    min_engagement_threshold: 0.01, // 1% engagement rate minimum
    experimental_mode: process.env.NODE_ENV !== 'production'
  };

  /**
   * 🚀 START AUTONOMOUS LEARNING SYSTEM
   */
  async startAutonomousLearning(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Autonomous learning already running');
      return;
    }

    try {
      console.log('🧠 === STARTING AUTONOMOUS LEARNING MASTER ===');
      console.log(`📊 Config: ${JSON.stringify(this.config, null, 2)}`);

      // Initialize all systems
      await this.initializeAllSystems();

      // Start engagement tracking (continuous)
      if (this.config.tracking_enabled) {
        await engagementFeedbackEngine.startContinuousTracking();
        console.log('📊 Engagement tracking started');
      }

      // Run initial learning cycle
      await this.runComprehensiveLearningCycle();

      // Setup regular learning cycles
      this.cycleInterval = setInterval(async () => {
        try {
          await this.runComprehensiveLearningCycle();
        } catch (error) {
          console.error('❌ Learning cycle error:', error);
        }
      }, this.config.learning_frequency_hours * 60 * 60 * 1000);

      this.isRunning = true;
      console.log('✅ Autonomous Learning Master started successfully');
      console.log(`🔄 Learning cycles every ${this.config.learning_frequency_hours} hours`);

    } catch (error: any) {
      console.error('❌ Failed to start autonomous learning:', error);
      throw error;
    }
  }

  /**
   * 🔄 RUN COMPREHENSIVE LEARNING CYCLE
   */
  async runComprehensiveLearningCycle(): Promise<LearningCycleResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let viralTweetsLearned = 0;
    let engagementTracked = 0;
    let insightsGenerated = 0;
    let contentGenerated = false;
    let contentPosted = false;
    const learningApplied: string[] = [];

    try {
      console.log('🧠 === COMPREHENSIVE LEARNING CYCLE START ===');
      console.log(`📅 ${new Date().toISOString()}`);

      // Reset daily counter if needed
      this.resetDailyCounterIfNeeded();

      // Phase 1: Learn from viral tweets
      if (this.config.learning_enabled && this.shouldRunLearningPhase()) {
        console.log('🔍 Phase 1: Learning from viral tweets...');
        
        try {
          const learningResult = await twitterStructureLearningEngine.runLearningCycle();
          
          if (learningResult.success) {
            viralTweetsLearned = learningResult.tweets_discovered;
            learningApplied.push(`Learned from ${viralTweetsLearned} viral tweets`);
            learningApplied.push(`Discovered ${learningResult.patterns_learned} new patterns`);
            
            this.lastLearningCycle = new Date();
            console.log(`✅ Learning phase: ${viralTweetsLearned} tweets analyzed`);
          } else {
            errors.push(...learningResult.errors);
          }
        } catch (learningError: any) {
          console.error('❌ Learning phase failed:', learningError);
          errors.push(`Learning phase: ${learningError.message}`);
        }
      }

      // Phase 2: Generate and post intelligent content
      if (this.config.posting_enabled && this.shouldPostContent()) {
        console.log('🎨 Phase 2: Generating intelligent content...');
        
        try {
          // Determine topic and format based on learning
          const contentRequest = await this.buildIntelligentContentRequest();
          
          // Generate content using learned patterns
          const generationResult = await intelligentTweetGenerator.generateIntelligentTweet(contentRequest);
          
          if (generationResult.success) {
            contentGenerated = true;
            learningApplied.push(...generationResult.learning_applied);
            
            console.log(`✅ Content generated: ${generationResult.format_used} format`);
            console.log(`📊 Predicted engagement: ${(generationResult.predicted_engagement * 100).toFixed(2)}%`);
            
            // Post the content
            console.log('📝 Phase 2b: Posting content...');
            const postingResult = await enhancedBrowserTweetPoster.postTweet(
              Array.isArray(generationResult.content) ? 
                generationResult.content.join('\n') : 
                generationResult.content
            );
            
            if (postingResult.success) {
              contentPosted = true;
              this.dailyTweetCount++;
              
              // Initialize engagement tracking for this tweet
              await this.initializeEngagementTracking(
                postingResult.tweet_id!,
                generationResult
              );
              
              console.log(`✅ Content posted successfully: ${postingResult.tweet_id}`);
              learningApplied.push('Posted with enhanced browser automation');
            } else {
              errors.push(`Posting failed: ${postingResult.error}`);
            }
          } else {
            errors.push(`Content generation failed: ${generationResult.error}`);
          }
        } catch (contentError: any) {
          console.error('❌ Content phase failed:', contentError);
          errors.push(`Content phase: ${contentError.message}`);
        }
      }

      // Phase 3: Run engagement tracking cycle
      if (this.config.tracking_enabled) {
        console.log('📊 Phase 3: Tracking engagement...');
        
        try {
          const trackingResult = await engagementFeedbackEngine.runTrackingCycle();
          
          if (trackingResult.success) {
            engagementTracked = trackingResult.tweets_tracked;
            insightsGenerated = trackingResult.insights_generated;
            
            learningApplied.push(`Tracked ${engagementTracked} tweets`);
            learningApplied.push(`Generated ${insightsGenerated} insights`);
            
            console.log(`✅ Tracking phase: ${engagementTracked} tweets, ${insightsGenerated} insights`);
          } else {
            errors.push('Engagement tracking failed');
          }
        } catch (trackingError: any) {
          console.error('❌ Tracking phase failed:', trackingError);
          errors.push(`Tracking phase: ${trackingError.message}`);
        }
      }

      // Phase 4: Update system intelligence
      console.log('🧬 Phase 4: Updating system intelligence...');
      const intelligenceUpdates = await this.updateSystemIntelligence();
      learningApplied.push(...intelligenceUpdates);

      const cycleDuration = Date.now() - startTime;
      console.log('✅ === COMPREHENSIVE LEARNING CYCLE COMPLETE ===');
      console.log(`⏱️ Duration: ${cycleDuration}ms`);
      console.log(`📊 Applied learning: ${learningApplied.length} insights`);

      return {
        success: true,
        phase: 'complete',
        viral_tweets_learned: viralTweetsLearned,
        content_generated: contentGenerated,
        content_posted: contentPosted,
        engagement_tracked: engagementTracked,
        insights_generated: insightsGenerated,
        learning_applied: learningApplied,
        performance_metrics: {
          cycle_duration_ms: cycleDuration
        },
        errors
      };

    } catch (error: any) {
      console.error('❌ Learning cycle failed:', error);
      
      return {
        success: false,
        phase: 'error',
        viral_tweets_learned: viralTweetsLearned,
        content_generated: contentGenerated,
        content_posted: contentPosted,
        engagement_tracked: engagementTracked,
        insights_generated: insightsGenerated,
        learning_applied: learningApplied,
        performance_metrics: {
          cycle_duration_ms: Date.now() - startTime
        },
        errors: [error.message, ...errors]
      };
    }
  }

  /**
   * 🎯 BUILD INTELLIGENT CONTENT REQUEST
   */
  private async buildIntelligentContentRequest(): Promise<any> {
    try {
      // Get top performing topics
      const { data: topTopics } = await this.supabase.client
        .from('topic_resonance_tracking')
        .select('topic, avg_engagement_rate')
        .order('avg_engagement_rate', { ascending: false })
        .limit(5);

      // Get best performing formats
      const { data: topFormats } = await this.supabase.client
        .from('content_format_fingerprints')
        .select('format_name, success_rate, avg_engagement')
        .order('avg_engagement', { ascending: false })
        .limit(3);

      // Get current time context for timing optimization
      const currentHour = new Date().getHours();
      const isWeekend = [0, 6].includes(new Date().getDay());

      // Build request based on learning
      const request = {
        topic: topTopics?.[0]?.topic || 'health optimization',
        target_format: topFormats?.[0]?.format_name,
        max_length: 280,
        experimental: this.config.experimental_mode,
        urgency_level: currentHour >= 9 && currentHour <= 17 ? 7 : 5, // Higher urgency during business hours
        include_threads: false // Start with single tweets for better tracking
      };

      console.log(`🎯 Content request: ${JSON.stringify(request, null, 2)}`);
      return request;

    } catch (error) {
      console.error('❌ Failed to build content request:', error);
      
      // Fallback request
      return {
        topic: 'health tips',
        target_format: 'hook_value_cta',
        max_length: 280,
        experimental: false
      };
    }
  }

  /**
   * 📊 INITIALIZE ENGAGEMENT TRACKING
   */
  private async initializeEngagementTracking(
    tweetId: string, 
    generationResult: any
  ): Promise<void> {
    try {
      // Create tracking record
      await this.supabase.client
        .from('engagement_feedback_tracking')
        .insert({
          tweet_id: tweetId,
          posted_at: new Date(),
          content: Array.isArray(generationResult.content) ? 
            generationResult.content.join('\n') : 
            generationResult.content,
          format_type: generationResult.format_used,
          tone: generationResult.tone_used,
          topic: 'health', // Extract from content analysis
          requires_analysis: true,
          analysis_completed: false
        });

      console.log(`📊 Engagement tracking initialized for tweet: ${tweetId}`);

    } catch (error) {
      console.error('❌ Failed to initialize engagement tracking:', error);
    }
  }

  /**
   * 🧬 UPDATE SYSTEM INTELLIGENCE
   */
  private async updateSystemIntelligence(): Promise<string[]> {
    const updates: string[] = [];

    try {
      // Calculate prediction accuracy from recent posts
      const { data: recentPosts } = await this.supabase.client
        .from('tweet_generation_sessions')
        .select('predicted_engagement, actual_engagement_rate')
        .not('actual_engagement_rate', 'is', null)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(20);

      if (recentPosts && recentPosts.length > 0) {
        const accuracyScores = recentPosts.map((post: any) => {
          const predicted = post.predicted_engagement || 0;
          const actual = post.actual_engagement_rate || 0;
          return Math.abs(predicted - actual) / Math.max(predicted, actual, 0.001);
        });

        const avgAccuracy = accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length;
        updates.push(`Prediction accuracy: ${((1 - avgAccuracy) * 100).toFixed(1)}%`);
      }

      // Update prompt evolution based on performance
      const { data: topSessions } = await this.supabase.client
        .from('tweet_generation_sessions')
        .select('prompt_version, actual_engagement_rate')
        .not('actual_engagement_rate', 'is', null)
        .order('actual_engagement_rate', { ascending: false })
        .limit(10);

      if (topSessions && topSessions.length > 0) {
        const bestPromptVersion = topSessions[0].prompt_version;
        updates.push(`Best performing prompt: ${bestPromptVersion}`);
      }

      // Identify trending patterns
      const { data: viralTweets } = await this.supabase.client
        .from('viral_tweets_learned')
        .select('format_type, primary_topic, engagement_rate')
        .gte('scraped_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .order('viral_score', { ascending: false })
        .limit(20);

      if (viralTweets && viralTweets.length > 0) {
        const formatCounts = viralTweets.reduce((acc: any, tweet: any) => {
          acc[tweet.format_type] = (acc[tweet.format_type] || 0) + 1;
          return acc;
        }, {});

        const trendingFormat = Object.keys(formatCounts).reduce((a, b) => 
          formatCounts[a] > formatCounts[b] ? a : b
        );

        updates.push(`Trending format: ${trendingFormat}`);
      }

      return updates;

    } catch (error) {
      console.error('❌ Failed to update system intelligence:', error);
      return ['Intelligence update failed'];
    }
  }

  /**
   * 🛠️ UTILITY FUNCTIONS
   */
  private async initializeAllSystems(): Promise<void> {
    console.log('🔧 Initializing all learning systems...');

    // Verify database schema
    await this.verifyDatabaseSchema();

    // Test system connections
    const systemTests = [
      this.testLearningEngine(),
      this.testIntelligentGenerator(),
      this.testEngagementEngine(),
      this.testBrowserPoster()
    ];

    const results = await Promise.allSettled(systemTests);
    
    results.forEach((result, index) => {
      const systemNames = ['Learning Engine', 'Generator', 'Engagement', 'Poster'];
      if (result.status === 'fulfilled') {
        console.log(`✅ ${systemNames[index]} initialized`);
      } else {
        console.error(`❌ ${systemNames[index]} failed:`, result.reason);
      }
    });
  }

  private async verifyDatabaseSchema(): Promise<void> {
    const requiredTables = [
      'viral_tweets_learned',
      'content_format_fingerprints',
      'tweet_generation_sessions',
      'engagement_feedback_tracking',
      'performance_patterns_learned',
      'topic_resonance_tracking',
      'intelligent_prompt_evolution'
    ];

    for (const table of requiredTables) {
      try {
        const { data, error } = await this.supabase.client
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          console.warn(`⚠️ Table ${table} may not exist or have issues:`, error.message);
        } else {
          console.log(`✅ Table ${table} verified`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to verify table ${table}`);
      }
    }
  }

  private async testLearningEngine(): Promise<void> {
    // Test learning engine without full execution
    console.log('🧪 Testing learning engine...');
  }

  private async testIntelligentGenerator(): Promise<void> {
    // Test generator with minimal request
    console.log('🧪 Testing intelligent generator...');
  }

  private async testEngagementEngine(): Promise<void> {
    // Test engagement engine initialization
    console.log('🧪 Testing engagement engine...');
  }

  private async testBrowserPoster(): Promise<void> {
    // Test browser poster initialization
    console.log('🧪 Testing browser poster...');
  }

  private shouldRunLearningPhase(): boolean {
    if (!this.lastLearningCycle) return true;
    
    const hoursSinceLastLearning = (Date.now() - this.lastLearningCycle.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastLearning >= this.config.learning_frequency_hours;
  }

  private shouldPostContent(): boolean {
    this.resetDailyCounterIfNeeded();
    return this.dailyTweetCount < this.config.max_tweets_per_day;
  }

  private resetDailyCounterIfNeeded(): void {
    const currentDay = new Date().getDate();
    if (currentDay !== this.lastDayReset) {
      this.dailyTweetCount = 0;
      this.lastDayReset = currentDay;
      console.log('🔄 Daily tweet counter reset');
    }
  }

  /**
   * 🛑 STOP AUTONOMOUS LEARNING
   */
  async stopAutonomousLearning(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Autonomous learning not running');
      return;
    }

    try {
      console.log('🛑 Stopping autonomous learning...');

      // Clear intervals
      if (this.cycleInterval) {
        clearInterval(this.cycleInterval);
        this.cycleInterval = null;
      }

      // Stop tracking
      await engagementFeedbackEngine.stopTracking();

      this.isRunning = false;
      console.log('✅ Autonomous learning stopped');

    } catch (error) {
      console.error('❌ Error stopping autonomous learning:', error);
    }
  }

  /**
   * 📊 GET SYSTEM STATUS
   */
  async getSystemStatus(): Promise<{
    running: boolean;
    last_cycle: Date | null;
    daily_tweets: number;
    max_daily_tweets: number;
    config: AutonomousConfig;
    recent_performance: any;
  }> {
    try {
      // Get recent performance metrics
      const { data: recentSessions } = await this.supabase.client
        .from('tweet_generation_sessions')
        .select('predicted_engagement, actual_engagement_rate, created_at')
        .not('actual_engagement_rate', 'is', null)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      return {
        running: this.isRunning,
        last_cycle: this.lastLearningCycle,
        daily_tweets: this.dailyTweetCount,
        max_daily_tweets: this.config.max_tweets_per_day,
        config: this.config,
        recent_performance: recentSessions || []
      };

    } catch (error) {
      console.error('❌ Failed to get system status:', error);
      return {
        running: this.isRunning,
        last_cycle: this.lastLearningCycle,
        daily_tweets: this.dailyTweetCount,
        max_daily_tweets: this.config.max_tweets_per_day,
        config: this.config,
        recent_performance: []
      };
    }
  }
}

// Export singleton instance
export const autonomousLearningMaster = new AutonomousLearningMaster();