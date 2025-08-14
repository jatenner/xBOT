/**
 * GROWTH ENGINE INTEGRATION
 * 
 * Integrates the Human-Grade Growth Engine with existing xBOT infrastructure
 * - Connects to autonomous posting engine
 * - Manages Twitter trends and news feeds
 * - Handles metrics collection and bandit updates
 * - Coordinates with Playwright posting system
 */

import { HumanGradeGrowthEngine, GrowthEngineInput, GrowthEngineOutput } from './humanGradeGrowthEngine';
import { LongformDetector } from '../utils/longformDetector';
import { EngagementAnalyzer } from '../intelligence/engagementAnalyzer';
import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';
import { AutonomousTwitterPoster } from './autonomousTwitterPoster';
import { getPageWithStorage } from '../utils/browser';
import { Page } from 'playwright';

export interface TwitterTrend {
  phrase: string;
  momentum: number;
  tph: number;
  category: "Health" | "Food" | "Sleep" | "Fitness" | "Stress" | "Other";
}

export interface NewsTrend {
  phrase: string;
  momentum: number;
  source: string;
}

export interface GrowthEngagementMetrics {
  epm_current: number;
  epm_ewma: number;
  format_bandit: {
    single: number;
    thread: number;
    reply: number;
    quote: number;
    longform_single: number;
  };
  persona_hook_bandit: {
    "Scientist/myth_bust": number;
    "Coach/how_to": number;
    "Storyteller/story": number;
    "Curator/checklist": number;
    "Mythbuster/checklist": number;
  };
}

export interface PostingSession {
  sessionId: string;
  startTime: Date;
  engagementBaseline: number;
  trendsSnapshot: TwitterTrend[];
}

export class GrowthEngineIntegration {
  private static instance: GrowthEngineIntegration;
  private growthEngine: HumanGradeGrowthEngine;
  private longformDetector: LongformDetector;
  private engagementAnalyzer: EngagementAnalyzer;
  private db: AdvancedDatabaseManager;
  private poster: AutonomousTwitterPoster;
  private currentSession: PostingSession | null = null;

  private constructor() {
    this.growthEngine = HumanGradeGrowthEngine.getInstance();
    this.longformDetector = LongformDetector.getInstance();
    this.engagementAnalyzer = EngagementAnalyzer.getInstance();
    this.db = AdvancedDatabaseManager.getInstance();
    this.poster = AutonomousTwitterPoster.getInstance();
  }

  public static getInstance(): GrowthEngineIntegration {
    if (!GrowthEngineIntegration.instance) {
      GrowthEngineIntegration.instance = new GrowthEngineIntegration();
    }
    return GrowthEngineIntegration.instance;
  }

  /**
   * Main integration method - orchestrates the entire growth engine process
   */
  public async executeGrowthCycle(): Promise<GrowthEngineOutput> {
    try {
      console.log('🚀 Starting Human-Grade Growth Engine cycle...');
      
      // Step 1: Collect all input data
      const input = await this.collectInputData();
      
      // Step 2: Process through growth engine
      const output = await this.growthEngine.processGrowthDecision(input);
      
      // Step 3: Execute posting if recommended
      if (output.post_now) {
        await this.executePosting(output);
      }
      
      // Step 4: Update metrics and learning
      await this.updateMetricsAndLearning(output);
      
      console.log(`✅ Growth cycle complete: ${output.post_now ? 'POSTED' : 'DEFERRED'}`);
      return output;
      
    } catch (error) {
      console.error('❌ Growth engine cycle failed:', error);
      throw error;
    }
  }

  /**
   * Collect all input data needed for the growth engine
   */
  private async collectInputData(): Promise<GrowthEngineInput> {
    console.log('📊 Collecting growth engine input data...');
    
    const [
      caps,
      recentCounts,
      followers,
      metrics,
      fatigue,
      twitterTrends,
      newsTrends,
      recentPosts,
      longformCapability
    ] = await Promise.all([
      this.getPostingCaps(),
      this.getRecentCounts(),
      this.getFollowerCount(),
      this.getEngagementMetrics(),
      this.getFatigueState(),
      this.getTwitterTrends(),
      this.getNewsTrends(),
      this.getRecentPosts(),
      this.getLongformCapability()
    ]);

    return {
      now_local: new Date().toISOString(),
      caps,
      recent_counts: recentCounts,
      followers,
      metrics,
      fatigue,
      twitter_trends: twitterTrends,
      news_trends: newsTrends,
      trend_policy: {
        fit_min: 0.35,
        prefer_twitter_over_news: true,
        max_offtopic_ratio: 0.15,
        blacklist: ["politics", "war", "nsfw", "celebrity_scandal"]
      },
      recent_posts_text: recentPosts,
      limits: {
        first_visible_chars: 240,
        tweet_max_hard: 275,
        longform_max_chars: 9000
      },
      style: {
        style_jitter: 0.25,
        hedge_prob: 0.15,
        question_prob: 0.25,
        emoji_max: 1,
        no_hashtags: true
      },
      capabilities: {
        longform_available: longformCapability,
        replies_allowed: true,
        quotes_allowed: true
      },
      reply_context: {
        gist: null,
        author: null
      }
    };
  }

  /**
   * Get posting caps from database or config
   */
  private async getPostingCaps() {
    try {
      const config = await this.db.queryRaw(`
        SELECT config_value 
        FROM bot_config 
        WHERE config_key = 'posting_caps'
        ORDER BY created_at DESC 
        LIMIT 1
      `);

      if (config && config.length > 0) {
        return JSON.parse(config[0].config_value);
      }
    } catch (error) {
      console.log('⚠️ Using default posting caps:', error.message);
    }

    // Default caps
    return {
      max_day: 100,
      max_hour: 8,
      min_gap: 6,
      min_gap_same: 20,
      thread_cooldown: 15,
      min_posts_per_2h: 1
    };
  }

  /**
   * Get recent posting counts
   */
  private async getRecentCounts() {
    try {
      const counts = await this.db.queryRaw(`
        SELECT 
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as hour_count,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as day_count,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '2 hours' THEN 1 END) as two_hour_count,
          EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/60 as last_post_min_ago,
          (SELECT content_type FROM tweets WHERE created_at = MAX(tweets.created_at) LIMIT 1) as last_format
        FROM tweets 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `);

      if (counts && counts.length > 0) {
        const row = counts[0];
        return {
          hour: parseInt(row.hour_count) || 0,
          day: parseInt(row.day_count) || 0,
          last_post_min_ago: parseInt(row.last_post_min_ago) || 999,
          last_format: row.last_format || "single",
          since_last_2h: parseInt(row.two_hour_count) || 0
        };
      }
    } catch (error) {
      console.log('⚠️ Using default recent counts:', error.message);
    }

    return {
      hour: 0,
      day: 0,
      last_post_min_ago: 999,
      last_format: "single" as const,
      since_last_2h: 0
    };
  }

  /**
   * Get current follower count
   */
  private async getFollowerCount(): Promise<number> {
    try {
      const result = await this.db.queryRaw(`
        SELECT follower_count 
        FROM daily_analytics 
        ORDER BY analytics_date DESC 
        LIMIT 1
      `);

      if (result && result.length > 0) {
        return parseInt(result[0].follower_count) || 0;
      }
    } catch (error) {
      console.log('⚠️ Using default follower count:', error.message);
    }

    return 17; // Default small account
  }

  /**
   * Get engagement metrics for bandits
   */
  private async getEngagementMetrics() {
    try {
      // Get current EPM (engagements per minute)
      const epmData = await this.engagementAnalyzer.calculateCurrentEPM();
      
      // Get bandit probabilities from database
      const bandits = await this.db.queryRaw(`
        SELECT bandit_type, arm_name, probability 
        FROM bandit_arms 
        WHERE updated_at >= NOW() - INTERVAL '7 days'
        ORDER BY updated_at DESC
      `);

      const formatBandit: Record<string, number> = {
        single: 0.25,
        thread: 0.35,
        reply: 0.15,
        quote: 0.1,
        longform_single: 0.15
      };

      const personaBandit: Record<string, number> = {
        "Scientist/myth_bust": 0.22,
        "Coach/how_to": 0.28,
        "Storyteller/story": 0.18,
        "Curator/checklist": 0.18,
        "Mythbuster/checklist": 0.14
      };

      // Update with actual bandit data if available
      for (const bandit of bandits || []) {
        if (bandit.bandit_type === 'format') {
          formatBandit[bandit.arm_name] = parseFloat(bandit.probability);
        } else if (bandit.bandit_type === 'persona_hook') {
          personaBandit[bandit.arm_name] = parseFloat(bandit.probability);
        }
      }

      return {
        epm_current: epmData?.current || 0.9,
        epm_ewma: epmData?.ewma || 0.6,
        format_bandit: formatBandit,
        persona_hook_bandit: personaBandit
      };

    } catch (error) {
      console.log('⚠️ Using default engagement metrics:', error.message);
      return {
        epm_current: 0.9,
        epm_ewma: 0.6,
        format_bandit: {
          single: 0.25,
          thread: 0.35,
          reply: 0.15,
          quote: 0.1,
          longform_single: 0.15
        },
        persona_hook_bandit: {
          "Scientist/myth_bust": 0.22,
          "Coach/how_to": 0.28,
          "Storyteller/story": 0.18,
          "Curator/checklist": 0.18,
          "Mythbuster/checklist": 0.14
        }
      };
    }
  }

  /**
   * Get current fatigue state
   */
  private async getFatigueState() {
    try {
      const fatigue = await this.db.queryRaw(`
        SELECT 
          format_streak,
          GREATEST(0, thread_cooldown_until - EXTRACT(EPOCH FROM NOW())/60) as thread_cooldown_remaining
        FROM posting_fatigue 
        ORDER BY updated_at DESC 
        LIMIT 1
      `);

      if (fatigue && fatigue.length > 0) {
        return {
          format_streak: parseInt(fatigue[0].format_streak) || 0,
          thread_cooldown_remaining: parseInt(fatigue[0].thread_cooldown_remaining) || 0
        };
      }
    } catch (error) {
      console.log('⚠️ Using default fatigue state:', error.message);
    }

    return {
      format_streak: 1,
      thread_cooldown_remaining: 0
    };
  }

  /**
   * Get Twitter trends (health-focused)
   */
  private async getTwitterTrends(): Promise<TwitterTrend[]> {
    try {
      // Try to get real Twitter trends if available
      const trends = await this.db.queryRaw(`
        SELECT phrase, momentum, tweets_per_hour as tph, category
        FROM twitter_trends 
        WHERE category IN ('Health', 'Food', 'Sleep', 'Fitness', 'Other')
        AND created_at >= NOW() - INTERVAL '1 hour'
        ORDER BY momentum DESC, tweets_per_hour DESC
        LIMIT 10
      `);

      if (trends && trends.length > 0) {
        return trends.map(trend => ({
          phrase: trend.phrase,
          momentum: parseFloat(trend.momentum),
          tph: parseInt(trend.tph) || 0,
          category: trend.category as "Health" | "Food" | "Sleep" | "Fitness" | "Other"
        }));
      }
    } catch (error) {
      console.log('⚠️ Using fallback Twitter trends:', error.message);
    }

    // Fallback health trends
    return [
      { phrase: "sleep debt", momentum: 0.72, tph: 180, category: "Sleep" },
      { phrase: "morning light exposure", momentum: 0.58, tph: 95, category: "Sleep" },
      { phrase: "vitamin D deficiency", momentum: 0.45, tph: 67, category: "Health" },
      { phrase: "stress eating", momentum: 0.38, tph: 43, category: "Stress" },
      { phrase: "walking benefits", momentum: 0.33, tph: 28, category: "Fitness" }
    ];
  }

  /**
   * Get news trends
   */
  private async getNewsTrends(): Promise<NewsTrend[]> {
    try {
      const trends = await this.db.queryRaw(`
        SELECT phrase, momentum, source
        FROM news_trends 
        WHERE created_at >= NOW() - INTERVAL '2 hours'
        ORDER BY momentum DESC
        LIMIT 5
      `);

      if (trends && trends.length > 0) {
        return trends.map(trend => ({
          phrase: trend.phrase,
          momentum: parseFloat(trend.momentum),
          source: trend.source
        }));
      }
    } catch (error) {
      console.log('⚠️ No recent news trends found:', error.message);
    }

    return []; // Empty if no news trends
  }

  /**
   * Get recent posts for redundancy checking
   */
  private async getRecentPosts(): Promise<string[]> {
    try {
      const posts = await this.db.queryRaw(`
        SELECT content
        FROM tweets 
        WHERE created_at >= NOW() - INTERVAL '48 hours'
        ORDER BY created_at DESC
        LIMIT 10
      `);

      if (posts && posts.length > 0) {
        return posts.map(post => post.content || '');
      }
    } catch (error) {
      console.log('⚠️ Using empty recent posts:', error.message);
    }

    return [];
  }

  /**
   * Check longform capability
   */
  private async getLongformCapability(): Promise<boolean> {
    try {
      // Get cached result first
      const cached = this.longformDetector.getCachedResult();
      if (cached) {
        return cached.available;
      }

      // If no cache, do a quick detection
      const page = await getPageWithStorage();
      const result = await this.longformDetector.detectLongformAvailable(page);
      await page.close();
      
      return result;
    } catch (error) {
      console.log('⚠️ Longform detection failed, defaulting to false:', error.message);
      return false;
    }
  }

  /**
   * Execute posting based on growth engine output
   */
  private async executePosting(output: GrowthEngineOutput): Promise<void> {
    try {
      console.log(`📝 Executing ${output.decision.format} post: ${output.decision.topic}`);
      
      if (output.decision.format === 'thread') {
        await this.postThread(output);
      } else {
        await this.postSingle(output);
      }
      
    } catch (error) {
      console.error('❌ Posting execution failed:', error);
      throw error;
    }
  }

  /**
   * Post a single tweet
   */
  private async postSingle(output: GrowthEngineOutput): Promise<void> {
    const tweet = output.draft.tweets[0];
    if (!tweet) throw new Error('No tweet content provided');

    const result = await this.poster.createAndPostContent({
      theme: output.decision.topic,
      pillar: output.decision.pillar,
      format: output.decision.format as any
    });

    if (result.success) {
      await this.logPostToDatabase(output, result.tweetId);
      console.log('✅ Single tweet posted successfully');
    } else {
      throw new Error(`Posting failed: ${result.error}`);
    }
  }

  /**
   * Post a thread
   */
  private async postThread(output: GrowthEngineOutput): Promise<void> {
    const tweetTexts = output.draft.tweets.map(t => t.text);
    
    const result = await this.poster.postThread(tweetTexts);
    
    await this.logThreadToDatabase(output, result.rootTweetId, result.replyIds);
    console.log('✅ Thread posted successfully');
  }

  /**
   * Log post to database
   */
  private async logPostToDatabase(output: GrowthEngineOutput, tweetId?: string): Promise<void> {
    try {
      await this.db.queryRaw(`
        INSERT INTO tweets (
          tweet_id, content, content_type, pillar, persona, topic, 
          engagement_score_prediction, sources, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        tweetId || `growth_${Date.now()}`,
        output.draft.tweets[0]?.text || '',
        output.decision.format,
        output.decision.pillar,
        output.decision.persona,
        output.decision.topic,
        output.decision.pacing.opportunity,
        JSON.stringify(output.draft.sources)
      ]);
    } catch (error) {
      console.error('⚠️ Failed to log post to database:', error);
    }
  }

  /**
   * Log thread to database
   */
  private async logThreadToDatabase(output: GrowthEngineOutput, rootId: string, replyIds: string[]): Promise<void> {
    try {
      // Log root tweet
      await this.logPostToDatabase(output, rootId);
      
      // Log reply tweets
      for (let i = 1; i < output.draft.tweets.length; i++) {
        await this.db.queryRaw(`
          INSERT INTO tweets (
            tweet_id, content, content_type, pillar, persona, topic,
            parent_tweet_id, thread_position, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
          replyIds[i-1] || `thread_${rootId}_${i}`,
          output.draft.tweets[i].text,
          'thread_reply',
          output.decision.pillar,
          output.decision.persona,
          output.decision.topic,
          rootId,
          i + 1
        ]);
      }
    } catch (error) {
      console.error('⚠️ Failed to log thread to database:', error);
    }
  }

  /**
   * Update metrics and learning after posting
   */
  private async updateMetricsAndLearning(output: GrowthEngineOutput): Promise<void> {
    try {
      // Update format bandit if posted
      if (output.post_now) {
        await this.updateFormatBandit(output.decision.format);
      }
      
      // Update fatigue state
      await this.updateFatigueState(output);
      
      // Store decision for analysis
      await this.logDecisionAnalytics(output);
      
    } catch (error) {
      console.error('⚠️ Failed to update metrics:', error);
    }
  }

  /**
   * Update format bandit probabilities
   */
  private async updateFormatBandit(format: string): Promise<void> {
    try {
      await this.db.queryRaw(`
        INSERT INTO bandit_arms (bandit_type, arm_name, pulls, updated_at)
        VALUES ('format', $1, 1, NOW())
        ON CONFLICT (bandit_type, arm_name) 
        DO UPDATE SET pulls = bandit_arms.pulls + 1, updated_at = NOW()
      `, [format]);
    } catch (error) {
      console.error('⚠️ Failed to update format bandit:', error);
    }
  }

  /**
   * Update fatigue state
   */
  private async updateFatigueState(output: GrowthEngineOutput): Promise<void> {
    try {
      if (output.post_now) {
        const isThread = output.decision.format === 'thread';
        const threadCooldownUntil = isThread ? Date.now() + (15 * 60 * 1000) : 0; // 15 min cooldown
        
        await this.db.queryRaw(`
          INSERT INTO posting_fatigue (
            format_streak, thread_cooldown_until, last_format, updated_at
          ) VALUES ($1, $2, $3, NOW())
          ON CONFLICT (id) DO UPDATE SET
            format_streak = CASE 
              WHEN posting_fatigue.last_format = $3 THEN posting_fatigue.format_streak + 1
              ELSE 1
            END,
            thread_cooldown_until = $2,
            last_format = $3,
            updated_at = NOW()
        `, [1, new Date(threadCooldownUntil), output.decision.format]);
      }
    } catch (error) {
      console.error('⚠️ Failed to update fatigue state:', error);
    }
  }

  /**
   * Log decision analytics for learning
   */
  private async logDecisionAnalytics(output: GrowthEngineOutput): Promise<void> {
    try {
      await this.db.queryRaw(`
        INSERT INTO growth_decisions (
          posted, reason, format, topic, pillar, persona, 
          opportunity_score, z_epm, fatigue_penalty, 
          human_vibe_score, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `, [
        output.post_now,
        output.reason,
        output.decision.format,
        output.decision.topic,
        output.decision.pillar,
        output.decision.persona,
        output.decision.pacing.opportunity,
        output.decision.pacing.z_epm,
        output.decision.pacing.fatigue_penalty,
        output.qc.human_vibe_score
      ]);
    } catch (error) {
      console.error('⚠️ Failed to log decision analytics:', error);
    }
  }

  /**
   * Manual testing function - processes example input
   */
  public async testWithExampleInput(): Promise<GrowthEngineOutput> {
    const exampleInput: GrowthEngineInput = {
      now_local: "2025-08-13T22:40:00-04:00",
      caps: { max_day: 100, max_hour: 8, min_gap: 6, min_gap_same: 20, thread_cooldown: 15, min_posts_per_2h: 1 },
      recent_counts: { hour: 0, day: 3, last_post_min_ago: 137, last_format: "single", since_last_2h: 0 },
      followers: 17,
      metrics: {
        epm_current: 0.9,
        epm_ewma: 0.6,
        format_bandit: { single: 0.25, thread: 0.35, reply: 0.15, quote: 0.1, longform_single: 0.15 },
        persona_hook_bandit: { "Scientist/myth_bust": 0.22, "Coach/how_to": 0.28, "Storyteller/story": 0.18, "Curator/checklist": 0.18, "Mythbuster/checklist": 0.14 }
      },
      fatigue: { format_streak: 1, thread_cooldown_remaining: 0 },
      twitter_trends: [
        { phrase: "sleep debt", momentum: 0.72, tph: 180, category: "Sleep" },
        { phrase: "morning light exposure", momentum: 0.58, tph: 95, category: "Sleep" }
      ],
      news_trends: [],
      trend_policy: { fit_min: 0.35, prefer_twitter_over_news: true, max_offtopic_ratio: 0.15, blacklist: ["politics", "war", "nsfw", "celebrity_scandal"] },
      recent_posts_text: ["Hydrate before caffeine", "Stress micro-breaks"],
      limits: { first_visible_chars: 240, tweet_max_hard: 275, longform_max_chars: 9000 },
      style: { style_jitter: 0.25, hedge_prob: 0.15, question_prob: 0.25, emoji_max: 1, no_hashtags: true },
      capabilities: { longform_available: false, replies_allowed: true, quotes_allowed: true },
      reply_context: { gist: null, author: null }
    };

    console.log('🧪 Testing Growth Engine with example input...');
    const output = await this.growthEngine.processGrowthDecision(exampleInput);
    
    console.log('📋 Test Results:');
    console.log('Post now:', output.post_now);
    console.log('Reason:', output.reason);
    console.log('Format:', output.decision.format);
    console.log('Topic:', output.decision.topic);
    console.log('Content preview:', output.draft.tweets[0]?.text.substring(0, 100) + '...');
    console.log('Human vibe score:', output.qc.human_vibe_score);
    
    return output;
  }
}

/**
 * Convenience function for quick growth engine execution
 */
export async function executeGrowthEngine(): Promise<GrowthEngineOutput> {
  const integration = GrowthEngineIntegration.getInstance();
  return await integration.executeGrowthCycle();
}

/**
 * Test function for development
 */
export async function testGrowthEngine(): Promise<GrowthEngineOutput> {
  const integration = GrowthEngineIntegration.getInstance();
  return await integration.testWithExampleInput();
}