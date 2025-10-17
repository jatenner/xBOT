/**
 * 🚀 TWITTER ALGORITHM OPTIMIZER
 * 
 * Understands and optimizes for Twitter's ranking algorithm
 * 
 * Key Insights:
 * - First 15 minutes determine if tweet goes viral
 * - Engagement velocity (likes/min) is critical
 * - Retweets = 2x weight vs likes
 * - Profile clicks = strongest signal
 * 
 * Budget: ~$0.01/day (tracking only, no AI calls)
 */

import { getSupabaseClient } from '../db/index';

export interface EngagementVelocity {
  tweet_id: string;
  posted_at: string;
  
  // Velocity at different time windows
  velocity_5min: number;   // likes per minute in first 5 min
  velocity_15min: number;  // likes per minute in first 15 min
  velocity_30min: number;  // likes per minute in first 30 min
  
  // Weighted engagement score
  weighted_score: number;  // retweets*2 + replies*1.5 + likes*1
  
  // Virality prediction
  viral_potential: number; // 0-1 score
  is_viral: boolean;       // velocity_15min > 5 likes/min
  
  // Twitter signals
  profile_clicks?: number;
  follow_through_rate?: number; // clicks that led to follows
}

export interface TwitterAlgorithmInsights {
  optimal_velocity_threshold: number; // e.g., 5 likes/min = viral
  avg_viral_velocity: number;
  avg_dead_velocity: number;
  retweet_multiplier: number;
  reply_multiplier: number;
  
  // Time-based insights
  best_viral_times: string[];  // ["2 PM", "6 PM"]
  worst_times: string[];       // ["3 AM"]
  
  // Content insights
  viral_content_patterns: string[];
  dead_content_patterns: string[];
}

export class TwitterAlgorithmOptimizer {
  private static instance: TwitterAlgorithmOptimizer;
  private supabase = getSupabaseClient();

  private constructor() {}

  public static getInstance(): TwitterAlgorithmOptimizer {
    if (!TwitterAlgorithmOptimizer.instance) {
      TwitterAlgorithmOptimizer.instance = new TwitterAlgorithmOptimizer();
    }
    return TwitterAlgorithmOptimizer.instance;
  }

  /**
   * Track engagement velocity for a post
   */
  async trackVelocity(tweetId: string, postedAt: string): Promise<void> {
    console.log(`[TWITTER_ALGO] 📊 Tracking velocity for tweet ${tweetId}`);

    try {
      // Get engagement data at different time windows
      const { data: post } = await this.supabase
        .from('content_decisions')
        .select('actual_performance, created_at')
        .eq('tweet_id', tweetId)
        .single();

      if (!post) return;

      const perf = post.actual_performance as any || {};
      const posted = new Date(String(postedAt));
      const now = new Date();
      const minutesElapsed = (now.getTime() - posted.getTime()) / (1000 * 60);

      // Calculate velocity (likes per minute)
      const likes = Number(perf.likes) || 0;
      const velocity = minutesElapsed > 0 
        ? likes / minutesElapsed 
        : 0;

      // Weighted engagement score (Twitter's priorities)
      const weightedScore = 
        (Number(perf.retweets) || 0) * 2.0 +
        (Number(perf.replies) || 0) * 1.5 +
        (Number(perf.likes) || 0) * 1.0;

      // Viral prediction (based on velocity)
      const viralPotential = this.calculateViralPotential(velocity, minutesElapsed);
      const isViral = velocity > 5; // 5 likes/min = viral threshold

      const velocityData: EngagementVelocity = {
        tweet_id: tweetId,
        posted_at: postedAt,
        velocity_5min: minutesElapsed >= 5 ? velocity : 0,
        velocity_15min: minutesElapsed >= 15 ? velocity : 0,
        velocity_30min: minutesElapsed >= 30 ? velocity : 0,
        weighted_score: weightedScore,
        viral_potential: viralPotential,
        is_viral: isViral,
        profile_clicks: perf.profile_clicks || 0,
        follow_through_rate: perf.profile_clicks > 0
          ? (perf.followers_gained || 0) / perf.profile_clicks
          : 0
      };

      // Store velocity data
      await this.supabase
        .from('engagement_velocity')
        .upsert({
          tweet_id: tweetId,
          ...velocityData,
          tracked_at: new Date().toISOString()
        }, {
          onConflict: 'tweet_id'
        });

      if (isViral) {
        console.log(`[TWITTER_ALGO] 🔥 VIRAL TWEET DETECTED! Velocity: ${velocity.toFixed(2)} likes/min`);
      }

    } catch (error: any) {
      console.error('[TWITTER_ALGO] ❌ Error tracking velocity:', error.message);
    }
  }

  /**
   * Calculate viral potential (0-1)
   */
  private calculateViralPotential(velocity: number, minutesElapsed: number): number {
    // First 15 minutes are critical
    if (minutesElapsed > 15) {
      // After 15 min, viral potential is mostly determined
      return Math.min(velocity / 10, 1.0); // 10 likes/min = 1.0 potential
    }

    // In first 15 min, scale based on velocity
    const velocityScore = Math.min(velocity / 10, 1.0);
    const timeWeight = 1.0 - (minutesElapsed / 15) * 0.3; // Earlier = more weight
    
    return velocityScore * timeWeight;
  }

  /**
   * Get Twitter algorithm insights from historical data
   */
  async getAlgorithmInsights(): Promise<TwitterAlgorithmInsights> {
    try {
      const { data: velocityData } = await this.supabase
        .from('engagement_velocity')
        .select('*')
        .order('tracked_at', { ascending: false })
        .limit(100);

      if (!velocityData || velocityData.length === 0) {
        return this.getDefaultInsights();
      }

      // Separate viral and dead tweets
      const viralTweets = velocityData.filter(v => Boolean(v.is_viral));
      const deadTweets = velocityData.filter(v => !v.is_viral && Number(v.velocity_15min) < 1);

      // Calculate average velocities
      let viralSum = 0;
      viralTweets.forEach(v => viralSum += Number(v.velocity_15min) || 0);
      const avgViralVelocity = viralTweets.length > 0 ? viralSum / viralTweets.length : 5;

      let deadSum = 0;
      deadTweets.forEach(v => deadSum += Number(v.velocity_15min) || 0);
      const avgDeadVelocity = deadTweets.length > 0 ? deadSum / deadTweets.length : 0.5;

      // Analyze timing patterns
      const viralTimes = viralTweets.map(v => {
        const hour = new Date(String(v.posted_at)).getHours();
        return `${hour}:00`;
      });

      const timeFrequency: Record<string, number> = {};
      viralTimes.forEach(time => {
        timeFrequency[time] = (timeFrequency[time] || 0) + 1;
      });

      const bestTimes = Object.entries(timeFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([time]) => time);

      return {
        optimal_velocity_threshold: 5, // 5 likes/min = viral
        avg_viral_velocity: avgViralVelocity,
        avg_dead_velocity: avgDeadVelocity,
        retweet_multiplier: 2.0,
        reply_multiplier: 1.5,
        best_viral_times: bestTimes.length > 0 ? bestTimes : ['14:00', '18:00'],
        worst_times: ['3:00', '4:00', '5:00'],
        viral_content_patterns: [
          'Controversial opening',
          'Specific numbers/data',
          'Thread format',
          'Strong hook'
        ],
        dead_content_patterns: [
          'Generic advice',
          'No hook',
          'Too long',
          'Boring'
        ]
      };

    } catch (error: any) {
      console.error('[TWITTER_ALGO] ❌ Error getting insights:', error.message);
      return this.getDefaultInsights();
    }
  }

  /**
   * Predict if content will go viral BEFORE posting
   */
  async predictViralPotential(content: {
    topic: string;
    format: 'single' | 'thread';
    has_controversy: boolean;
    has_numbers: boolean;
    hook_strength: number;
    scheduled_time?: string;
  }): Promise<{
    viral_score: number;
    predicted_velocity: number;
    recommendation: string;
  }> {
    const insights = await this.getAlgorithmInsights();

    let score = 0.5; // Base score

    // Factor 1: Content type
    if (content.format === 'thread') score += 0.15; // Threads perform better
    if (content.has_controversy) score += 0.20; // Controversy drives engagement
    if (content.has_numbers) score += 0.10; // Specificity helps

    // Factor 2: Hook strength
    score += content.hook_strength * 0.25;

    // Factor 3: Timing
    if (content.scheduled_time) {
      const hour = new Date(content.scheduled_time).getHours();
      const timeString = `${hour}:00`;
      
      if (insights.best_viral_times.includes(timeString)) {
        score += 0.15; // Good timing
      } else if (insights.worst_times.some(t => t.startsWith(String(hour)))) {
        score -= 0.20; // Bad timing
      }
    }

    // Cap at 1.0
    score = Math.min(score, 1.0);

    // Predict velocity based on score
    const predictedVelocity = score * insights.avg_viral_velocity;

    let recommendation = '';
    if (score >= 0.8) {
      recommendation = '🔥 HIGH viral potential! Post at optimal time.';
    } else if (score >= 0.6) {
      recommendation = '✅ GOOD potential. Should perform well.';
    } else if (score >= 0.4) {
      recommendation = '⚠️ MEDIUM potential. Consider improving hook or timing.';
    } else {
      recommendation = '❌ LOW potential. Regenerate content or change timing.';
    }

    return {
      viral_score: score,
      predicted_velocity: predictedVelocity,
      recommendation
    };
  }

  /**
   * Get default insights when no data available
   */
  private getDefaultInsights(): TwitterAlgorithmInsights {
    return {
      optimal_velocity_threshold: 5,
      avg_viral_velocity: 8,
      avg_dead_velocity: 0.5,
      retweet_multiplier: 2.0,
      reply_multiplier: 1.5,
      best_viral_times: ['14:00', '18:00', '20:00'],
      worst_times: ['3:00', '4:00', '5:00'],
      viral_content_patterns: [
        'Controversial opening',
        'Specific numbers/data',
        'Thread format',
        'Strong hook'
      ],
      dead_content_patterns: [
        'Generic advice',
        'No hook',
        'Too vague'
      ]
    };
  }

  /**
   * Should we boost this post? (double down on viral content)
   */
  async shouldBoostPost(tweetId: string): Promise<boolean> {
    try {
      const { data: velocity } = await this.supabase
        .from('engagement_velocity')
        .select('is_viral, velocity_15min')
        .eq('tweet_id', tweetId)
        .single();

      if (!velocity) return false;

      // If tweet is going viral, boost it!
      return Boolean(velocity.is_viral) && Number(velocity.velocity_15min) > 5;

    } catch (error) {
      return false;
    }
  }
}

export const getTwitterAlgorithmOptimizer = () => TwitterAlgorithmOptimizer.getInstance();

