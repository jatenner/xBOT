/**
 * 🎯 TITAN TARGETING SYSTEM
 * 
 * Strategic reply system that targets high-value accounts ("titans")
 * for maximum follower growth through engagement
 */

import { getSupabaseClient } from '../db/index';

interface TitanAccount {
  username: string;
  display_name: string;
  follower_count: number;
  category: string; // health, neuroscience, nutrition, etc
  engagement_rate: number;
  typical_post_times: number[]; // Hours when they usually post
  estimated_reach: number;
  
  // Performance tracking
  times_we_replied: number;
  times_they_engaged: number; // Liked/replied back
  followers_gained_from_them: number;
  conversion_rate: number; // followers / times_we_replied
}

interface ReplyOpportunity {
  titan: TitanAccount;
  tweet_url: string;
  tweet_content: string;
  posted_minutes_ago: number;
  opportunity_score: number; // 0-100, how good is this opportunity
  reply_strategy: 'add_study' | 'counterpoint' | 'extend_insight' | 'ask_question';
}

export class TitanTargetingSystem {
  private static instance: TitanTargetingSystem;
  private supabase = getSupabaseClient();
  private titans: Map<string, TitanAccount> = new Map();

  private constructor() {
    this.initializeTitans();
  }

  public static getInstance(): TitanTargetingSystem {
    if (!TitanTargetingSystem.instance) {
      TitanTargetingSystem.instance = new TitanTargetingSystem();
    }
    return TitanTargetingSystem.instance;
  }

  /**
   * Initialize with curated list of health titans
   */
  private initializeTitans(): void {
    const titansList: Omit<TitanAccount, 'times_we_replied' | 'times_they_engaged' | 'followers_gained_from_them' | 'conversion_rate'>[] = [
      // Neuroscience & Longevity
      {
        username: 'hubermanlab',
        display_name: 'Andrew Huberman',
        follower_count: 2500000,
        category: 'neuroscience',
        engagement_rate: 0.03,
        typical_post_times: [8, 12, 18],
        estimated_reach: 75000
      },
      {
        username: 'PeterAttiaMD',
        display_name: 'Peter Attia',
        follower_count: 500000,
        category: 'longevity',
        engagement_rate: 0.04,
        typical_post_times: [7, 14, 19],
        estimated_reach: 20000
      },
      {
        username: 'foundmyfitness',
        display_name: 'Rhonda Patrick',
        follower_count: 400000,
        category: 'nutrition',
        engagement_rate: 0.035,
        typical_post_times: [8, 13, 17],
        estimated_reach: 14000
      },
      // Health & Wellness
      {
        username: 'kevinrose',
        display_name: 'Kevin Rose',
        follower_count: 1600000,
        category: 'wellness',
        engagement_rate: 0.02,
        typical_post_times: [9, 15, 20],
        estimated_reach: 32000
      },
      {
        username: 'naval',
        display_name: 'Naval',
        follower_count: 2000000,
        category: 'health_mindset',
        engagement_rate: 0.025,
        typical_post_times: [10, 16, 21],
        estimated_reach: 50000
      },
      // Fitness & Performance
      {
        username: 'BenBergeron',
        display_name: 'Ben Bergeron',
        follower_count: 200000,
        category: 'fitness',
        engagement_rate: 0.045,
        typical_post_times: [6, 12, 18],
        estimated_reach: 9000
      },
      {
        username: 'MarkSisson',
        display_name: 'Mark Sisson',
        follower_count: 150000,
        category: 'nutrition',
        engagement_rate: 0.05,
        typical_post_times: [8, 14, 19],
        estimated_reach: 7500
      },
      // Sleep & Recovery
      {
        username: 'drmichaelbreus',
        display_name: 'Dr. Michael Breus',
        follower_count: 100000,
        category: 'sleep',
        engagement_rate: 0.04,
        typical_post_times: [7, 13, 20],
        estimated_reach: 4000
      },
      // Mental Health
      {
        username: 'Dr_Malesevic',
        display_name: 'Dr. Alok Kanojia',
        follower_count: 300000,
        category: 'mental_health',
        engagement_rate: 0.038,
        typical_post_times: [11, 16, 21],
        estimated_reach: 11400
      },
      // Biohacking
      {
        username: 'BenGreenfieldFitness',
        display_name: 'Ben Greenfield',
        follower_count: 250000,
        category: 'biohacking',
        engagement_rate: 0.042,
        typical_post_times: [7, 13, 19],
        estimated_reach: 10500
      }
    ];

    // Load from database or initialize
    titansList.forEach(titan => {
      this.titans.set(titan.username, {
        ...titan,
        times_we_replied: 0,
        times_they_engaged: 0,
        followers_gained_from_them: 0,
        conversion_rate: 0
      });
    });

    console.log(`[TITAN_TARGETING] ✅ Initialized with ${this.titans.size} titans`);
  }

  /**
   * Get top titans to target based on performance
   */
  async getTopTitans(limit: number = 10): Promise<TitanAccount[]> {
    // Load performance data from database
    await this.loadPerformanceData();

    // Sort by combination of reach and conversion rate
    const scored = Array.from(this.titans.values()).map(titan => ({
      titan,
      score: (titan.estimated_reach / 1000) * (1 + titan.conversion_rate * 10)
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.titan);
  }

  /**
   * Find current reply opportunities from titans
   */
  async findReplyOpportunities(): Promise<ReplyOpportunity[]> {
    console.log('[TITAN_TARGETING] 🎯 Finding reply opportunities from titans...');

    const opportunities: ReplyOpportunity[] = [];
    const topTitans = await this.getTopTitans(10); // Increased for aggressive mode

    for (const titan of topTitans) {
      try {
        // In real implementation, this would check their latest tweets
        // For now, create mock opportunity for demonstration
        const mockOpportunity: ReplyOpportunity = {
          titan,
          tweet_url: `https://twitter.com/${titan.username}/status/mock`,
          tweet_content: `[Latest tweet from @${titan.username} about ${titan.category}]`,
          posted_minutes_ago: Math.floor(Math.random() * 30),
          opportunity_score: this.calculateOpportunityScore(titan, Math.floor(Math.random() * 30)),
          reply_strategy: this.selectReplyStrategy(titan.category)
        };

        if (mockOpportunity.opportunity_score > 60) {
          opportunities.push(mockOpportunity);
        }
      } catch (error: any) {
        console.error(`[TITAN_TARGETING] ⚠️ Error checking ${titan.username}:`, error.message);
      }
    }

    console.log(`[TITAN_TARGETING] ✅ Found ${opportunities.length} high-value opportunities`);
    return opportunities.sort((a, b) => b.opportunity_score - a.opportunity_score);
  }

  /**
   * Calculate how good a reply opportunity is
   */
  private calculateOpportunityScore(titan: TitanAccount, minutesAgo: number): number {
    let score = 50; // Base score

    // Recency (reply within 5 min = +40, within 30 min = +20)
    if (minutesAgo <= 5) {
      score += 40;
    } else if (minutesAgo <= 30) {
      score += 20;
    }

    // Titan's reach (+0-30 based on followers)
    score += Math.min(30, (titan.estimated_reach / 1000));

    // Historical conversion rate (+0-20)
    score += titan.conversion_rate * 200;

    // Engagement likelihood (+0-10)
    score += titan.engagement_rate * 200;

    return Math.min(100, Math.round(score));
  }

  /**
   * Select optimal reply strategy based on titan's category
   */
  private selectReplyStrategy(category: string): 'add_study' | 'counterpoint' | 'extend_insight' | 'ask_question' {
    const strategies: Record<string, ('add_study' | 'counterpoint' | 'extend_insight' | 'ask_question')> = {
      neuroscience: 'add_study',
      longevity: 'extend_insight',
      nutrition: 'counterpoint',
      fitness: 'extend_insight',
      sleep: 'add_study',
      mental_health: 'ask_question',
      biohacking: 'add_study',
      wellness: 'extend_insight',
      health_mindset: 'ask_question'
    };

    return strategies[category] || 'extend_insight';
  }

  /**
   * Track performance of a reply to a titan
   */
  async trackReplyPerformance(
    titanUsername: string,
    replyId: string,
    metrics: {
      titan_engaged: boolean;
      profile_clicks: number;
      followers_gained: number;
    }
  ): Promise<void> {
    const titan = this.titans.get(titanUsername);
    if (!titan) return;

    // Update titan statistics
    titan.times_we_replied++;
    if (metrics.titan_engaged) {
      titan.times_they_engaged++;
    }
    titan.followers_gained_from_them += metrics.followers_gained;
    titan.conversion_rate = titan.followers_gained_from_them / titan.times_we_replied;

    // Store in database
    try {
      await this.supabase
        .from('titan_reply_performance')
        .insert({
          titan_username: titanUsername,
          reply_id: replyId,
          titan_engaged: metrics.titan_engaged,
          profile_clicks: metrics.profile_clicks,
          followers_gained: metrics.followers_gained,
          created_at: new Date().toISOString()
        });

      await this.supabase
        .from('titan_accounts')
        .upsert({
          username: titanUsername,
          times_replied: titan.times_we_replied,
          times_engaged: titan.times_they_engaged,
          followers_gained: titan.followers_gained_from_them,
          conversion_rate: titan.conversion_rate,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'username'
        });

      console.log(`[TITAN_TARGETING] 📊 Tracked reply to @${titanUsername}: +${metrics.followers_gained} followers`);
    } catch (error: any) {
      console.error('[TITAN_TARGETING] ❌ Error tracking performance:', error.message);
    }
  }

  /**
   * Load historical performance data
   */
  private async loadPerformanceData(): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('titan_accounts')
        .select('*');

      if (data) {
        data.forEach((record: any) => {
          const titan = this.titans.get(String(record.username));
          if (titan) {
            titan.times_we_replied = Number(record.times_replied) || 0;
            titan.times_they_engaged = Number(record.times_engaged) || 0;
            titan.followers_gained_from_them = Number(record.followers_gained) || 0;
            titan.conversion_rate = Number(record.conversion_rate) || 0;
          }
        });
      }
    } catch (error: any) {
      console.error('[TITAN_TARGETING] ⚠️ Error loading performance data:', error.message);
    }
  }

  /**
   * Get status for monitoring
   */
  async getStatus(): Promise<{
    total_titans: number;
    top_performers: TitanAccount[];
    total_replies: number;
    total_followers_gained: number;
    avg_conversion_rate: number;
  }> {
    await this.loadPerformanceData();

    const titans = Array.from(this.titans.values());
    const totalReplies = titans.reduce((sum, t) => sum + t.times_we_replied, 0);
    const totalFollowers = titans.reduce((sum, t) => sum + t.followers_gained_from_them, 0);
    const avgConversion = totalReplies > 0 ? totalFollowers / totalReplies : 0;

    return {
      total_titans: titans.length,
      top_performers: titans
        .filter(t => t.times_we_replied > 0)
        .sort((a, b) => b.conversion_rate - a.conversion_rate)
        .slice(0, 5),
      total_replies: totalReplies,
      total_followers_gained: totalFollowers,
      avg_conversion_rate: avgConversion
    };
  }
}

export const getTitanTargeting = () => TitanTargetingSystem.getInstance();

