import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';

interface EngagementSnapshot {
  tweet_id: string;
  timestamp: Date;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  engagement_rate: number;
  viral_velocity: number; // Growth rate of engagement
}

interface ViralPattern {
  content_element: string;
  pattern_type: 'hashtag' | 'emoji' | 'phrase' | 'structure' | 'timing' | 'image';
  engagement_boost: number;
  confidence: number;
  sample_size: number;
}

export class RealTimeEngagementTracker {
  private trackingInterval: NodeJS.Timeout | null = null;
  private isTracking: boolean = false;
  private viralPatterns: Map<string, ViralPattern> = new Map();

  constructor() {
    console.log('🎯 Real-Time Engagement Tracker initialized');
  }

  async startTracking(): Promise<void> {
    if (this.isTracking) {
      console.log('⚠️ Engagement tracking already running');
      return;
    }

    console.log('🚀 Starting real-time engagement tracking...');
    this.isTracking = true;

    // 💰 API-CONSCIOUS: Track engagement twice daily to conserve API limits
    this.trackingInterval = setInterval(async () => {
      await this.trackRecentTweets();
    }, 12 * 60 * 60 * 1000); // Every 12 hours instead of 4

    // Initial tracking run
    await this.trackRecentTweets();
  }

  async stopTracking(): Promise<void> {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    this.isTracking = false;
    console.log('🛑 Engagement tracking stopped');
  }

  private async trackRecentTweets(): Promise<void> {
    try {
      console.log('📊 Tracking recent tweet engagement...');

      // Get tweets from last 24 hours for tracking
      const recentTweets = await this.getRecentTweets();

      for (const tweet of recentTweets) {
        await this.updateTweetEngagement(tweet);
        // Analyze viral patterns is handled within updateTweetEngagement
      }

      // Analyze what's working best
      await this.identifyTopPerformers();

    } catch (error) {
      console.error('❌ Error tracking engagement:', error);
    }
  }

  private async getRecentTweets(): Promise<any[]> {
    try {
      // Get user's recent tweets from X API
      const userTweets = await xClient.getMyTweets(20);
      
      if (!userTweets || userTweets.length === 0) {
        console.log('No recent tweets to track');
        return [];
      }

      return userTweets;
    } catch (error: any) {
      // Handle rate limiting gracefully
      if (error.code === 429 || (error.data && error.data.status === 429)) {
        console.warn('📊 Twitter API rate limited - skipping engagement tracking this cycle');
        return [];
      }
      
      console.warn('Failed to get recent tweets for tracking:', error.message || error);
      return [];
    }
  }

  private async updateTweetEngagement(tweetData: any): Promise<void> {
    try {
      const tweetId = tweetData.id;
      const engagement = {
        likes: tweetData.public_metrics?.like_count || 0,
        retweets: tweetData.public_metrics?.retweet_count || 0,
        replies: tweetData.public_metrics?.reply_count || 0,
        impressions: tweetData.public_metrics?.impression_count || 0
      };

      // Calculate engagement rate
      const totalEngagement = engagement.likes + engagement.retweets + engagement.replies;
      const engagementRate = engagement.impressions > 0 
        ? (totalEngagement / engagement.impressions) * 100 
        : 0;

      // Update tweet in database
      await supabaseClient.updateTweetEngagement(tweetId, {
        ...engagement,
        engagement_score: engagementRate
      });

      // Check if this is going viral (high engagement velocity)
      const viralVelocity = await this.calculateViralVelocity(tweetId, totalEngagement);
      
      if (viralVelocity > 50) { // Arbitrary threshold for "viral"
        console.log(`🔥 VIRAL TWEET DETECTED: ${tweetId} (velocity: ${viralVelocity})`);
        await this.analyzeViralContent(tweetData, engagementRate);
      }

    } catch (error) {
      console.warn('Failed to update tweet engagement:', error);
    }
  }

  private async calculateViralVelocity(tweetId: string, currentEngagement: number): Promise<number> {
    try {
      // Get previous engagement snapshot
      const previousSnapshot = await this.getPreviousSnapshot(tweetId);
      
      if (!previousSnapshot) {
        return 0; // No baseline to compare
      }

      const timeDiff = (Date.now() - previousSnapshot.timestamp.getTime()) / 1000 / 60; // minutes
      const engagementDiff = currentEngagement - (previousSnapshot.likes + previousSnapshot.retweets + previousSnapshot.replies);
      
      // Velocity = engagement growth per minute
      return timeDiff > 0 ? engagementDiff / timeDiff : 0;

    } catch (error) {
      return 0;
    }
  }

  private async getPreviousSnapshot(tweetId: string): Promise<EngagementSnapshot | null> {
    // This would query our engagement snapshots table
    // For now, return null since we don't have historical data
    return null;
  }

  private async analyzeViralContent(tweetData: any, engagementRate: number): Promise<void> {
    try {
      const content = tweetData.text;
      console.log(`🧠 Analyzing viral content: "${content}"`);

      // Extract patterns that contributed to virality
      const patterns = this.extractContentPatterns(content);

      for (const pattern of patterns) {
        this.updateViralPattern(pattern, engagementRate);
      }

      // Log viral insights
      console.log(`🎯 Viral patterns identified: ${patterns.map(p => p.content_element).join(', ')}`);

    } catch (error) {
      console.error('Failed to analyze viral content:', error);
    }
  }

  private extractContentPatterns(content: string): ViralPattern[] {
    const patterns: ViralPattern[] = [];

    // Extract hashtags
    const hashtags = content.match(/#\w+/g) || [];
    hashtags.forEach(hashtag => {
      patterns.push({
        content_element: hashtag,
        pattern_type: 'hashtag',
        engagement_boost: 0,
        confidence: 0.7,
        sample_size: 1
      });
    });

    // Extract emojis
    const emojis = content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || [];
    emojis.forEach(emoji => {
      patterns.push({
        content_element: emoji,
        pattern_type: 'emoji',
        engagement_boost: 0,
        confidence: 0.6,
        sample_size: 1
      });
    });

    // Extract attention-grabbing phrases
    const viralPhrases = [
      'BREAKING', 'SHOCKING', 'CONTROVERSIAL', 'UNPOPULAR OPINION',
      'HOT TAKE', 'REALITY CHECK', 'MINDBLOWING', 'GAME-CHANGER'
    ];

    viralPhrases.forEach(phrase => {
      if (content.toUpperCase().includes(phrase)) {
        patterns.push({
          content_element: phrase,
          pattern_type: 'phrase',
          engagement_boost: 0,
          confidence: 0.8,
          sample_size: 1
        });
      }
    });

    // Extract question patterns
    if (content.includes('?')) {
      patterns.push({
        content_element: 'question_format',
        pattern_type: 'structure',
        engagement_boost: 0,
        confidence: 0.5,
        sample_size: 1
      });
    }

    return patterns;
  }

  private updateViralPattern(pattern: ViralPattern, engagementRate: number): void {
    const key = `${pattern.pattern_type}:${pattern.content_element}`;
    const existing = this.viralPatterns.get(key);

    if (existing) {
      // Update running average
      const totalSamples = existing.sample_size + 1;
      const newBoost = ((existing.engagement_boost * existing.sample_size) + engagementRate) / totalSamples;
      
      this.viralPatterns.set(key, {
        ...existing,
        engagement_boost: newBoost,
        sample_size: totalSamples,
        confidence: Math.min(0.95, existing.confidence + 0.05) // Increase confidence with more samples
      });
    } else {
      // New pattern
      this.viralPatterns.set(key, {
        ...pattern,
        engagement_boost: engagementRate
      });
    }
  }

  private async identifyTopPerformers(): Promise<void> {
    try {
      // Sort patterns by engagement boost
      const topPatterns = Array.from(this.viralPatterns.values())
        .filter(pattern => pattern.sample_size >= 3) // Only patterns with enough data
        .sort((a, b) => b.engagement_boost - a.engagement_boost)
        .slice(0, 10);

      if (topPatterns.length > 0) {
        console.log('🏆 TOP PERFORMING PATTERNS:');
        topPatterns.forEach((pattern, index) => {
          console.log(`${index + 1}. ${pattern.content_element} (${pattern.pattern_type}): ${pattern.engagement_boost.toFixed(1)}% avg engagement`);
        });

        // Store insights for the engagement maximizer to use
        await this.storeEngagementInsights(topPatterns);
      }

    } catch (error) {
      console.error('Failed to identify top performers:', error);
    }
  }

  private async storeEngagementInsights(patterns: ViralPattern[]): Promise<void> {
    try {
      // Store these insights locally for the engagement maximizer to use
      console.log(`💾 Would store ${patterns.length} viral patterns for future use`);
      
      // For now, just log the insights since database method doesn't exist
      patterns.forEach((pattern, i) => {
        console.log(`  ${i + 1}. ${pattern.content_element} (${pattern.pattern_type}): ${pattern.engagement_boost.toFixed(1)}% boost`);
      });

    } catch (error) {
      console.warn('Failed to store engagement insights:', error);
    }
  }

  // Public methods for engagement maximizer integration
  async getTopViralPatterns(limit: number = 10): Promise<ViralPattern[]> {
    return Array.from(this.viralPatterns.values())
      .filter(pattern => pattern.sample_size >= 2)
      .sort((a, b) => b.engagement_boost - a.engagement_boost)
      .slice(0, limit);
  }

  async getPatternPerformance(pattern: string, type: string): Promise<number> {
    const key = `${type}:${pattern}`;
    const data = this.viralPatterns.get(key);
    return data ? data.engagement_boost : 0;
  }

  async getCurrentViralTrends(): Promise<string[]> {
    const topPatterns = await this.getTopViralPatterns(5);
    return topPatterns
      .filter(p => p.pattern_type === 'hashtag' || p.pattern_type === 'phrase')
      .map(p => p.content_element);
  }

  // Analytics and reporting
  async generateEngagementReport(): Promise<any> {
    const patterns = Array.from(this.viralPatterns.values());
    const totalPatterns = patterns.length;
    const highPerformingPatterns = patterns.filter(p => p.engagement_boost > 10).length;
    
    return {
      total_patterns_tracked: totalPatterns,
      high_performing_patterns: highPerformingPatterns,
      top_viral_elements: await this.getTopViralPatterns(5),
      tracking_duration: this.isTracking ? 'Active' : 'Stopped',
      last_update: new Date().toISOString()
    };
  }
} 