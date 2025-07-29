/**
 * 📊 ENGAGEMENT FEEDBACK ENGINE
 * 
 * Real-time learning system that:
 * - Tracks tweet performance continuously
 * - Analyzes engagement patterns
 * - Updates learning models with feedback
 * - Adjusts generation strategies based on results
 * 
 * This creates a continuous improvement loop for tweet quality.
 */

import { chromium, Browser, Page } from 'playwright';
import { SecureSupabaseClient } from '../utils/secureSupabaseClient';
import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';
import { getChromiumLaunchOptions } from '../utils/playwrightUtils';
import * as path from 'path';
import * as fs from 'fs';

interface TweetPerformanceSnapshot {
  timestamp: Date;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  views: number;
  engagement_rate: number;
}

interface EngagementAnalysis {
  peak_engagement_hour: number;
  growth_rate_likes: number;
  growth_rate_retweets: number;
  engagement_velocity: number;
  is_viral: boolean;
  is_successful: boolean;
  performance_tier: 'viral' | 'high' | 'medium' | 'low';
  lessons_learned: string[];
}

interface LearningInsight {
  insight_type: 'format' | 'timing' | 'topic' | 'tone' | 'length';
  insight_description: string;
  confidence_score: number;
  supporting_data: any;
  actionable_recommendation: string;
}

export class EngagementFeedbackEngine {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private sessionPath = path.join(process.cwd(), 'twitter-auth.json');
  private supabase = new SecureSupabaseClient();
  private openai = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY!);
  
  private trackingInterval: NodeJS.Timeout | null = null;
  private readonly TRACKING_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly VIRAL_THRESHOLD_LIKES = 100;
  private readonly VIRAL_THRESHOLD_RETWEETS = 25;
  private readonly SUCCESS_THRESHOLD_ENGAGEMENT = 0.02; // 2%

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      console.log('📊 Initializing Engagement Feedback Engine...');

      // Launch browser for Twitter monitoring
      const launchOptions = getChromiumLaunchOptions();
      this.browser = await chromium.launch(launchOptions);

      this.page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York'
      });

      // Setup stealth mode
      await this.setupStealthMode();

      // Load Twitter session
      await this.loadTwitterSession();

      this.isInitialized = true;
      console.log('✅ Engagement Feedback Engine initialized');
      return true;

    } catch (error: any) {
      console.error('❌ Failed to initialize feedback engine:', error);
      await this.cleanup();
      return false;
    }
  }

  /**
   * 🚀 START CONTINUOUS ENGAGEMENT TRACKING
   */
  async startContinuousTracking(): Promise<void> {
    if (!await this.initialize()) {
      throw new Error('Failed to initialize feedback engine');
    }

    console.log('🔄 Starting continuous engagement tracking...');

    // Initial tracking run
    await this.runTrackingCycle();

    // Setup interval for continuous tracking
    this.trackingInterval = setInterval(async () => {
      try {
        await this.runTrackingCycle();
      } catch (error) {
        console.error('❌ Tracking cycle error:', error);
      }
    }, this.TRACKING_INTERVAL_MS);

    console.log(`✅ Continuous tracking started (${this.TRACKING_INTERVAL_MS / 60000} min intervals)`);
  }

  /**
   * 🔄 RUN SINGLE TRACKING CYCLE
   */
  async runTrackingCycle(): Promise<{
    success: boolean;
    tweets_tracked: number;
    insights_generated: number;
    patterns_updated: number;
  }> {
    try {
      console.log('📊 === ENGAGEMENT TRACKING CYCLE ===');

      // 1. Get tweets that need tracking
      const tweetsToTrack = await this.getTweetsNeedingTracking();
      console.log(`📝 Found ${tweetsToTrack.length} tweets to track`);

      let tweetsTracked = 0;
      let insightsGenerated = 0;
      let patternsUpdated = 0;

      // 2. Track each tweet's current performance
      for (const tweet of tweetsToTrack) {
        try {
          const currentMetrics = await this.scrapeCurrentMetrics(tweet.tweet_id);
          
          if (currentMetrics) {
            // Update tracking record
            await this.updateTrackingRecord(tweet.id, currentMetrics);
            tweetsTracked++;

            // Analyze if ready for insights
            if (this.isReadyForAnalysis(tweet, currentMetrics)) {
              const analysis = await this.analyzeEngagementPattern(tweet, currentMetrics);
              const insights = await this.generateLearningInsights(tweet, analysis);
              
              if (insights.length > 0) {
                await this.applyLearningInsights(insights);
                insightsGenerated += insights.length;
              }

              // Update patterns and formats
              const updatedPatterns = await this.updatePerformancePatterns(tweet, analysis);
              patternsUpdated += updatedPatterns;
            }
          }

        } catch (trackError: any) {
          console.error(`❌ Error tracking tweet ${tweet.tweet_id}:`, trackError.message);
        }
      }

      // 3. Update prompt evolution based on performance
      await this.updatePromptEvolution();

      // 4. Clean up old tracking data
      await this.cleanupOldTrackingData();

      console.log('✅ === TRACKING CYCLE COMPLETE ===');
      console.log(`📊 Tracked: ${tweetsTracked}, Insights: ${insightsGenerated}, Patterns: ${patternsUpdated}`);

      return {
        success: true,
        tweets_tracked: tweetsTracked,
        insights_generated: insightsGenerated,
        patterns_updated: patternsUpdated
      };

    } catch (error: any) {
      console.error('❌ Tracking cycle failed:', error);
      return {
        success: false,
        tweets_tracked: 0,
        insights_generated: 0,
        patterns_updated: 0
      };
    }
  }

  /**
   * 📝 GET TWEETS THAT NEED TRACKING
   */
  private async getTweetsNeedingTracking(): Promise<any[]> {
    try {
      // Get tweets posted in last 48 hours that need tracking
      const { data, error } = await this.supabase.client
        .from('engagement_feedback_tracking')
        .select('*')
        .gte('posted_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .eq('analysis_completed', false)
        .order('posted_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('❌ Error fetching tweets to track:', error);
        return [];
      }

      return data || [];

    } catch (error: any) {
      console.error('❌ Error getting tweets to track:', error);
      return [];
    }
  }

  /**
   * 🔍 SCRAPE CURRENT METRICS FOR A TWEET
   */
  private async scrapeCurrentMetrics(tweetId: string): Promise<TweetPerformanceSnapshot | null> {
    try {
      if (!this.page) return null;

      // Navigate to the tweet URL
      const tweetUrl = `https://twitter.com/SignalAndSynapse/status/${tweetId}`;
      await this.page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for tweet to load
      await this.page.waitForSelector('[data-testid="tweet"]', { timeout: 15000 });

      // Extract engagement metrics
      const metrics = await this.page.evaluate(() => {
        const tweet = document.querySelector('[data-testid="tweet"]');
        if (!tweet) return null;

        // Extract likes
        const likeElement = tweet.querySelector('[data-testid="like"]');
        const likesText = likeElement?.textContent || '0';
        const likes = this.parseMetricText(likesText);

        // Extract retweets
        const retweetElement = tweet.querySelector('[data-testid="retweet"]');
        const retweetsText = retweetElement?.textContent || '0';
        const retweets = this.parseMetricText(retweetsText);

        // Extract replies
        const replyElement = tweet.querySelector('[data-testid="reply"]');
        const repliesText = replyElement?.textContent || '0';
        const replies = this.parseMetricText(repliesText);

        return { likes, retweets, replies };
      });

      if (!metrics) return null;

      // Estimate views and calculate engagement rate
      const estimatedViews = Math.max(metrics.likes * 20, 100);
      const totalEngagement = metrics.likes + metrics.retweets + metrics.replies;
      const engagementRate = estimatedViews > 0 ? totalEngagement / estimatedViews : 0;

      return {
        timestamp: new Date(),
        likes: metrics.likes,
        retweets: metrics.retweets,
        replies: metrics.replies,
        quotes: 0, // Hard to scrape quotes consistently
        views: estimatedViews,
        engagement_rate: engagementRate
      };

    } catch (error: any) {
      console.error(`❌ Error scraping metrics for tweet ${tweetId}:`, error);
      return null;
    }
  }

  /**
   * 💾 UPDATE TRACKING RECORD WITH NEW METRICS
   */
  private async updateTrackingRecord(trackingId: string, metrics: TweetPerformanceSnapshot): Promise<void> {
    try {
      // Get current tracking record
      const { data: currentRecord, error: fetchError } = await this.supabase.client
        .from('engagement_feedback_tracking')
        .select('engagement_snapshots')
        .eq('id', trackingId)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching tracking record:', fetchError);
        return;
      }

      // Add new snapshot to history
      const snapshots = currentRecord?.engagement_snapshots || [];
      snapshots.push({
        timestamp: metrics.timestamp,
        likes: metrics.likes,
        retweets: metrics.retweets,
        replies: metrics.replies,
        quotes: metrics.quotes,
        views: metrics.views,
        engagement_rate: metrics.engagement_rate
      });

      // Calculate growth rates
      const growthRates = this.calculateGrowthRates(snapshots);

      // Update record
      const { error: updateError } = await this.supabase.client
        .from('engagement_feedback_tracking')
        .update({
          engagement_snapshots: snapshots,
          current_likes: metrics.likes,
          current_retweets: metrics.retweets,
          current_replies: metrics.replies,
          current_quotes: metrics.quotes,
          current_views: metrics.views,
          current_engagement_rate: metrics.engagement_rate,
          likes_growth_rate: growthRates.likes,
          retweets_growth_rate: growthRates.retweets,
          engagement_velocity: growthRates.overall,
          last_updated_at: new Date(),
          is_viral: this.isViral(metrics),
          is_successful: this.isSuccessful(metrics)
        })
        .eq('id', trackingId);

      if (updateError) {
        console.error('❌ Error updating tracking record:', updateError);
      }

    } catch (error: any) {
      console.error('❌ Error updating tracking record:', error);
    }
  }

  /**
   * 📈 ANALYZE ENGAGEMENT PATTERN
   */
  private async analyzeEngagementPattern(tweet: any, currentMetrics: TweetPerformanceSnapshot): Promise<EngagementAnalysis> {
    try {
      const snapshots = tweet.engagement_snapshots || [];
      const postedTime = new Date(tweet.posted_at);
      const hoursActive = (Date.now() - postedTime.getTime()) / (1000 * 60 * 60);

      // Calculate peak engagement hour
      let peakHour = 0;
      let maxEngagement = 0;
      
      snapshots.forEach((snapshot: any, index: number) => {
        const snapshotTime = new Date(snapshot.timestamp);
        const hoursSincePost = (snapshotTime.getTime() - postedTime.getTime()) / (1000 * 60 * 60);
        const totalEngagement = snapshot.likes + snapshot.retweets * 2 + snapshot.replies;
        
        if (totalEngagement > maxEngagement) {
          maxEngagement = totalEngagement;
          peakHour = Math.floor(hoursSincePost);
        }
      });

      // Performance classification
      const isViral = currentMetrics.likes >= this.VIRAL_THRESHOLD_LIKES && 
                     currentMetrics.retweets >= this.VIRAL_THRESHOLD_RETWEETS;
      const isSuccessful = currentMetrics.engagement_rate >= this.SUCCESS_THRESHOLD_ENGAGEMENT;
      
      let performanceTier: 'viral' | 'high' | 'medium' | 'low' = 'low';
      if (isViral) performanceTier = 'viral';
      else if (currentMetrics.likes > 50 || currentMetrics.engagement_rate > 0.03) performanceTier = 'high';
      else if (currentMetrics.likes > 10 || currentMetrics.engagement_rate > 0.01) performanceTier = 'medium';

      // Generate AI insights about performance
      const lessonsLearned = await this.generatePerformanceLessons(tweet, currentMetrics, hoursActive);

      return {
        peak_engagement_hour: peakHour,
        growth_rate_likes: tweet.likes_growth_rate || 0,
        growth_rate_retweets: tweet.retweets_growth_rate || 0,
        engagement_velocity: tweet.engagement_velocity || 0,
        is_viral: isViral,
        is_successful: isSuccessful,
        performance_tier: performanceTier,
        lessons_learned: lessonsLearned
      };

    } catch (error: any) {
      console.error('❌ Error analyzing engagement pattern:', error);
      return {
        peak_engagement_hour: 0,
        growth_rate_likes: 0,
        growth_rate_retweets: 0,
        engagement_velocity: 0,
        is_viral: false,
        is_successful: false,
        performance_tier: 'low',
        lessons_learned: []
      };
    }
  }

  /**
   * 🧠 GENERATE LEARNING INSIGHTS FROM PERFORMANCE
   */
  private async generateLearningInsights(tweet: any, analysis: EngagementAnalysis): Promise<LearningInsight[]> {
    try {
      const insights: LearningInsight[] = [];

      // Format performance insight
      if (analysis.performance_tier !== 'low') {
        insights.push({
          insight_type: 'format',
          insight_description: `${tweet.format_type} format achieved ${analysis.performance_tier} performance`,
          confidence_score: analysis.performance_tier === 'viral' ? 0.9 : 0.7,
          supporting_data: { 
            format: tweet.format_type, 
            engagement_rate: tweet.current_engagement_rate,
            likes: tweet.current_likes
          },
          actionable_recommendation: `Increase usage of ${tweet.format_type} format by 20%`
        });
      }

      // Timing insight
      if (analysis.peak_engagement_hour > 0) {
        const postedHour = new Date(tweet.posted_at).getHours();
        insights.push({
          insight_type: 'timing',
          insight_description: `Peak engagement occurred ${analysis.peak_engagement_hour} hours after posting at ${postedHour}:00`,
          confidence_score: 0.6,
          supporting_data: { 
            posted_hour: postedHour, 
            peak_hour: analysis.peak_engagement_hour,
            engagement_velocity: analysis.engagement_velocity
          },
          actionable_recommendation: `Consider posting at hour ${(postedHour + analysis.peak_engagement_hour) % 24} for immediate impact`
        });
      }

      // Topic resonance insight
      if (tweet.topic && analysis.is_successful) {
        insights.push({
          insight_type: 'topic',
          insight_description: `Topic "${tweet.topic}" resonated well with audience`,
          confidence_score: 0.8,
          supporting_data: { 
            topic: tweet.topic, 
            engagement_rate: tweet.current_engagement_rate 
          },
          actionable_recommendation: `Create more content about ${tweet.topic} with variations`
        });
      }

      // Length insight
      const contentLength = tweet.content?.length || 0;
      if (contentLength > 0) {
        let lengthPerformance = 'optimal';
        if (contentLength < 100) lengthPerformance = 'too_short';
        else if (contentLength > 250) lengthPerformance = 'too_long';

        if (analysis.is_successful && lengthPerformance === 'optimal') {
          insights.push({
            insight_type: 'length',
            insight_description: `Content length of ${contentLength} characters performed well`,
            confidence_score: 0.6,
            supporting_data: { 
              length: contentLength, 
              engagement_rate: tweet.current_engagement_rate 
            },
            actionable_recommendation: `Target content length between ${contentLength - 20} and ${contentLength + 20} characters`
          });
        }
      }

      return insights;

    } catch (error: any) {
      console.error('❌ Error generating learning insights:', error);
      return [];
    }
  }

  /**
   * 🔄 APPLY LEARNING INSIGHTS TO SYSTEM
   */
  private async applyLearningInsights(insights: LearningInsight[]): Promise<void> {
    try {
      for (const insight of insights) {
        // Store insight in performance patterns table
        await this.supabase.client
          .from('performance_patterns_learned')
          .upsert({
            pattern_type: insight.insight_type,
            pattern_name: `auto_learned_${insight.insight_type}_${Date.now()}`,
            pattern_description: insight.insight_description,
            confidence_score: insight.confidence_score,
            pattern_data: insight.supporting_data,
            discovered_date: new Date(),
            still_effective: true
          });

        // Update topic resonance if applicable
        if (insight.insight_type === 'topic' && insight.supporting_data.topic) {
          await this.updateTopicResonance(
            insight.supporting_data.topic,
            insight.supporting_data.engagement_rate
          );
        }

        // Update format fingerprints if applicable
        if (insight.insight_type === 'format' && insight.supporting_data.format) {
          await this.updateFormatFingerprint(
            insight.supporting_data.format,
            insight.supporting_data.engagement_rate
          );
        }
      }

      console.log(`✅ Applied ${insights.length} learning insights to system`);

    } catch (error: any) {
      console.error('❌ Error applying learning insights:', error);
    }
  }

  /**
   * 🛠️ UTILITY FUNCTIONS
   */
  private parseMetricText(text: string): number {
    const cleanText = text.replace(/[^\d.KM]/g, '');
    if (cleanText.includes('K')) {
      return Math.floor(parseFloat(cleanText) * 1000);
    } else if (cleanText.includes('M')) {
      return Math.floor(parseFloat(cleanText) * 1000000);
    }
    return parseInt(cleanText) || 0;
  }

  private calculateGrowthRates(snapshots: any[]): { likes: number; retweets: number; overall: number } {
    if (snapshots.length < 2) {
      return { likes: 0, retweets: 0, overall: 0 };
    }

    const latest = snapshots[snapshots.length - 1];
    const previous = snapshots[snapshots.length - 2];
    const timeDiff = (new Date(latest.timestamp).getTime() - new Date(previous.timestamp).getTime()) / (1000 * 60 * 60); // hours

    const likesGrowth = timeDiff > 0 ? (latest.likes - previous.likes) / timeDiff : 0;
    const retweetsGrowth = timeDiff > 0 ? (latest.retweets - previous.retweets) / timeDiff : 0;
    const overallGrowth = (likesGrowth + retweetsGrowth * 2) / 3;

    return {
      likes: likesGrowth,
      retweets: retweetsGrowth,
      overall: overallGrowth
    };
  }

  private isViral(metrics: TweetPerformanceSnapshot): boolean {
    return metrics.likes >= this.VIRAL_THRESHOLD_LIKES && 
           metrics.retweets >= this.VIRAL_THRESHOLD_RETWEETS;
  }

  private isSuccessful(metrics: TweetPerformanceSnapshot): boolean {
    return metrics.engagement_rate >= this.SUCCESS_THRESHOLD_ENGAGEMENT;
  }

  private isReadyForAnalysis(tweet: any, currentMetrics: TweetPerformanceSnapshot): boolean {
    const hoursActive = (Date.now() - new Date(tweet.posted_at).getTime()) / (1000 * 60 * 60);
    return hoursActive >= 2 && !tweet.analysis_completed; // Analyze after 2 hours
  }

  private async generatePerformanceLessons(tweet: any, metrics: TweetPerformanceSnapshot, hoursActive: number): Promise<string[]> {
    try {
      const prompt = `Analyze this tweet's performance and extract 3-5 key lessons:

TWEET: "${tweet.content}"
FORMAT: ${tweet.format_type}
PERFORMANCE: ${metrics.likes} likes, ${metrics.retweets} retweets, ${metrics.replies} replies
ENGAGEMENT RATE: ${(metrics.engagement_rate * 100).toFixed(2)}%
TIME ACTIVE: ${hoursActive.toFixed(1)} hours

What worked well? What could be improved? What patterns emerge?

Respond with JSON array of lessons:
["lesson 1", "lesson 2", "lesson 3"]`;

      const response = await this.openai.generateContent(
        prompt,
        'low',
        'performance_analysis',
        { maxTokens: 200, temperature: 0.3 }
      );

      return JSON.parse(response) || [];

    } catch (error) {
      return [`Performance: ${metrics.engagement_rate > 0.02 ? 'Strong' : 'Moderate'} engagement after ${hoursActive.toFixed(1)} hours`];
    }
  }

  private async updateTopicResonance(topic: string, engagementRate: number): Promise<void> {
    try {
      const { data: existing } = await this.supabase.client
        .from('topic_resonance_tracking')
        .select('*')
        .eq('topic', topic)
        .single();

      if (existing) {
        // Update existing topic performance
        const newAvgEngagement = (existing.avg_engagement_rate + engagementRate) / 2;
        await this.supabase.client
          .from('topic_resonance_tracking')
          .update({
            total_tweets: existing.total_tweets + 1,
            avg_engagement_rate: newAvgEngagement,
            last_posted: new Date()
          })
          .eq('topic', topic);
      } else {
        // Create new topic record
        await this.supabase.client
          .from('topic_resonance_tracking')
          .insert({
            topic,
            total_tweets: 1,
            avg_engagement_rate: engagementRate,
            last_posted: new Date()
          });
      }
    } catch (error) {
      console.error('❌ Error updating topic resonance:', error);
    }
  }

  private async updateFormatFingerprint(format: string, engagementRate: number): Promise<void> {
    try {
      const { data: existing } = await this.supabase.client
        .from('content_format_fingerprints')
        .select('*')
        .eq('format_name', format)
        .single();

      if (existing) {
        const newAvgEngagement = (existing.avg_engagement + engagementRate) / 2;
        await this.supabase.client
          .from('content_format_fingerprints')
          .update({
            usage_count: existing.usage_count + 1,
            avg_engagement: newAvgEngagement,
            last_successful_use: new Date()
          })
          .eq('format_name', format);
      }
    } catch (error) {
      console.error('❌ Error updating format fingerprint:', error);
    }
  }

  private async updatePerformancePatterns(tweet: any, analysis: EngagementAnalysis): Promise<number> {
    // Simplified pattern update - could be enhanced
    try {
      if (analysis.is_successful) {
        await this.supabase.client
          .from('performance_patterns_learned')
          .insert({
            pattern_type: 'success_factor',
            pattern_name: `${tweet.format_type}_success`,
            pattern_description: `${tweet.format_type} format achieved ${analysis.performance_tier} performance`,
            confidence_score: 0.7,
            pattern_data: { format: tweet.format_type, engagement_rate: tweet.current_engagement_rate }
          });
        return 1;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  private async updatePromptEvolution(): Promise<void> {
    // Placeholder for prompt evolution updates
    // This would analyze which prompts led to better performance
  }

  private async cleanupOldTrackingData(): Promise<void> {
    try {
      // Mark analysis as completed for tweets older than 48 hours
      const cutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      await this.supabase.client
        .from('engagement_feedback_tracking')
        .update({ analysis_completed: true })
        .lt('posted_at', cutoffDate.toISOString())
        .eq('analysis_completed', false);

    } catch (error) {
      console.error('❌ Error cleaning up tracking data:', error);
    }
  }

  private async setupStealthMode(): Promise<void> {
    if (!this.page) return;

    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });
  }

  private async loadTwitterSession(): Promise<void> {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
        await this.page!.context().addCookies(sessionData.cookies);
        console.log('✅ Twitter session loaded for tracking');
      }
    } catch (error) {
      console.log('⚠️ No valid Twitter session found for tracking');
    }
  }

  async stopTracking(): Promise<void> {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
      console.log('⏹️ Engagement tracking stopped');
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await this.stopTracking();
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.page = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }
}

// Export singleton instance
export const engagementFeedbackEngine = new EngagementFeedbackEngine();