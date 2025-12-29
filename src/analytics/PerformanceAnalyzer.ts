/**
 * 📊 PERFORMANCE ANALYZER
 * 
 * Aggregates reply performance across multiple dimensions for adaptive learning
 * 
 * Dimensions:
 * - engagement_tier (EXTREME_VIRAL, ULTRA_VIRAL, MEGA_VIRAL, VIRAL, TRENDING, POPULAR)
 * - account_size (<100K, 100K-500K, 500K-1M, 1M+)
 * - timing_window (<2h, 2-6h, 6-24h, 24h+)
 * - generator (ResearchSynthesizer, ExpertOrchestrator, etc.)
 * 
 * Metrics:
 * - Average followers gained per reply
 * - ROI score (vs baseline)
 * - Confidence score (sample size / 30)
 * - Performance tier (excellent/good/moderate/poor)
 */

import { getSupabaseClient } from '../db/index.js';

interface TierAnalysis {
  tier: string;
  replyCount: number;
  avgFollowersGained: number;
  avgReplyLikes: number;
  avgImpressions: number;
  confidenceScore: number;
  roiScore: number;
  performanceTier: 'excellent' | 'good' | 'moderate' | 'poor';
}

interface TopPerformer {
  tier: string;
  avgFollowersGained: number;
  replyCount: number;
  confidenceScore: number;
}

export class PerformanceAnalyzer {
  private static instance: PerformanceAnalyzer;

  private constructor() {}

  static getInstance(): PerformanceAnalyzer {
    if (!this.instance) {
      this.instance = new PerformanceAnalyzer();
    }
    return this.instance;
  }

  /**
   * Analyze performance by engagement tier
   */
  async analyzeEngagementTiers(windowDays: number = 30): Promise<TierAnalysis[]> {
    console.log(`[PERF_ANALYZER] Analyzing engagement tiers (last ${windowDays} days)...`);

    const supabase = getSupabaseClient();
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    // Query posted replies
    const { data: replies, error } = await supabase
      .from('content_metadata')
      .select(`
        decision_id,
        target_tweet_id,
        posted_at,
        metadata
      `)
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', cutoff);

    if (error) {
      console.error(`[PERF_ANALYZER] Error querying replies:`, error);
      return [];
    }

    if (!replies || replies.length === 0) {
      console.log(`[PERF_ANALYZER] No replies found in last ${windowDays} days`);
      return [];
    }

    console.log(`[PERF_ANALYZER] Found ${replies.length} replies`);

    // Get reply opportunities to find engagement tier
    const tweetIds = replies
      .map(r => r.target_tweet_id)
      .filter(id => id && id !== 'null' && id.trim().length > 0);

    let tierMap = new Map<string, { followers: number[]; likes: number[]; impressions: number[] }>();

    if (tweetIds.length > 0) {
      // Query reply_opportunities for engagement_tier
      const { data: opportunities } = await supabase
        .from('reply_opportunities')
        .select('target_tweet_id, engagement_tier, like_count')
        .in('target_tweet_id', tweetIds);

      // Create map of tweet_id -> engagement_tier
      const tweetTierMap = new Map<string, { tier: string; likes: number }>();
      if (opportunities) {
        for (const opp of opportunities) {
          tweetTierMap.set(opp.target_tweet_id, {
            tier: opp.engagement_tier || 'UNKNOWN',
            likes: opp.like_count || 0
          });
        }
      }

      // Group by tier
      for (const reply of replies) {
        const tweetId = reply.target_tweet_id;
        if (!tweetId || tweetId === 'null') continue;

        const oppData = tweetTierMap.get(tweetId);
        const tier = oppData?.tier || 'UNKNOWN';

        if (!tierMap.has(tier)) {
          tierMap.set(tier, { followers: [], likes: [], impressions: [] });
        }

        // Extract metrics from metadata
        const metadata = reply.metadata as any || {};
        const followersGained = Number(metadata.followers_gained) || 0;
        const replyLikes = Number(metadata.reply_likes) || 0;
        const impressions = Number(metadata.impressions) || 0;

        tierMap.get(tier)!.followers.push(followersGained);
        tierMap.get(tier)!.likes.push(replyLikes);
        tierMap.get(tier)!.impressions.push(impressions);
      }
    }

    // Calculate stats per tier
    const results: TierAnalysis[] = [];
    const baseline = 5; // Baseline followers per reply

    for (const [tier, metrics] of tierMap.entries()) {
      if (metrics.followers.length === 0) continue;

      const avgFollowers = metrics.followers.reduce((a, b) => a + b, 0) / metrics.followers.length;
      const avgLikes = metrics.likes.reduce((a, b) => a + b, 0) / metrics.likes.length;
      const avgImpressions = metrics.impressions.reduce((a, b) => a + b, 0) / metrics.impressions.length;

      const analysis: TierAnalysis = {
        tier,
        replyCount: metrics.followers.length,
        avgFollowersGained: Math.round(avgFollowers * 10) / 10,
        avgReplyLikes: Math.round(avgLikes * 10) / 10,
        avgImpressions: Math.round(avgImpressions),
        confidenceScore: this.calculateConfidence(metrics.followers.length),
        roiScore: Math.round(((avgFollowers / baseline) * 100) * 10) / 10,
        performanceTier: this.getPerformanceTier((avgFollowers / baseline) * 100)
      };

      results.push(analysis);
    }

    // Sort by ROI descending
    results.sort((a, b) => b.roiScore - a.roiScore);

    return results;
  }

  /**
   * Analyze performance by generator type
   */
  async analyzeGeneratorPerformance(windowDays: number = 30): Promise<TierAnalysis[]> {
    console.log(`[PERF_ANALYZER] Analyzing generator performance (last ${windowDays} days)...`);

    const supabase = getSupabaseClient();
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    // Query posted replies
    const { data: replies, error } = await supabase
      .from('content_metadata')
      .select(`
        decision_id,
        posted_at,
        metadata
      `)
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', cutoff);

    if (error) {
      console.error(`[PERF_ANALYZER] Error querying replies:`, error);
      return [];
    }

    if (!replies || replies.length === 0) {
      console.log(`[PERF_ANALYZER] No replies found in last ${windowDays} days`);
      return [];
    }

    // Group by generator
    const generatorMap = new Map<string, { followers: number[]; likes: number[]; impressions: number[] }>();

    for (const reply of replies) {
      const metadata = reply.metadata as any || {};
      const generator = metadata.generator || metadata.content_generator || 'Unknown';
      const followersGained = Number(metadata.followers_gained) || 0;
      const replyLikes = Number(metadata.reply_likes) || 0;
      const impressions = Number(metadata.impressions) || 0;

      if (!generatorMap.has(generator)) {
        generatorMap.set(generator, { followers: [], likes: [], impressions: [] });
      }

      generatorMap.get(generator)!.followers.push(followersGained);
      generatorMap.get(generator)!.likes.push(replyLikes);
      generatorMap.get(generator)!.impressions.push(impressions);
    }

    // Calculate stats per generator
    const results: TierAnalysis[] = [];
    const baseline = 5;

    for (const [generator, metrics] of generatorMap.entries()) {
      if (metrics.followers.length === 0) continue;

      const avgFollowers = metrics.followers.reduce((a, b) => a + b, 0) / metrics.followers.length;
      const avgLikes = metrics.likes.reduce((a, b) => a + b, 0) / metrics.likes.length;
      const avgImpressions = metrics.impressions.reduce((a, b) => a + b, 0) / metrics.impressions.length;

      const analysis: TierAnalysis = {
        tier: generator,
        replyCount: metrics.followers.length,
        avgFollowersGained: Math.round(avgFollowers * 10) / 10,
        avgReplyLikes: Math.round(avgLikes * 10) / 10,
        avgImpressions: Math.round(avgImpressions),
        confidenceScore: this.calculateConfidence(metrics.followers.length),
        roiScore: Math.round(((avgFollowers / baseline) * 100) * 10) / 10,
        performanceTier: this.getPerformanceTier((avgFollowers / baseline) * 100)
      };

      results.push(analysis);
    }

    // Sort by ROI descending
    results.sort((a, b) => b.roiScore - a.roiScore);

    return results;
  }

  /**
   * Calculate confidence score (0-1) based on sample size
   * Need 30 samples for 100% confidence
   */
  calculateConfidence(sampleSize: number): number {
    return Math.min(sampleSize / 30, 1.0);
  }

  /**
   * Determine performance tier based on ROI
   */
  getPerformanceTier(roi: number): 'excellent' | 'good' | 'moderate' | 'poor' {
    if (roi >= 150) return 'excellent'; // 1.5x+ baseline
    if (roi >= 100) return 'good';      // 1x baseline
    if (roi >= 50) return 'moderate';   // 0.5x baseline
    return 'poor';                       // <0.5x baseline
  }

  /**
   * Store analytics in database
   */
  async storeAnalytics(
    analyses: TierAnalysis[],
    dimensionType: string,
    timeWindow: { start: Date; end: Date }
  ): Promise<void> {
    if (analyses.length === 0) {
      console.log(`[PERF_ANALYZER] No analytics to store for ${dimensionType}`);
      return;
    }

    const supabase = getSupabaseClient();

    const records = analyses.map(a => ({
      dimension_type: dimensionType,
      dimension_value: a.tier,
      reply_count: a.replyCount,
      avg_followers_gained: a.avgFollowersGained,
      avg_reply_likes: a.avgReplyLikes,
      avg_impressions: a.avgImpressions,
      confidence_score: a.confidenceScore,
      roi_score: a.roiScore,
      performance_tier: a.performanceTier,
      measurement_start: timeWindow.start.toISOString(),
      measurement_end: timeWindow.end.toISOString(),
      metadata: {},
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('reply_performance_analytics')
      .upsert(records, {
        onConflict: 'dimension_type,dimension_value,measurement_start',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`[PERF_ANALYZER] Error storing analytics:`, error);
    } else {
      console.log(`[PERF_ANALYZER] ✅ Stored ${records.length} analytics records for ${dimensionType}`);
    }
  }

  /**
   * Get top performing tier for a dimension
   */
  async getTopTier(dimensionType: string): Promise<TopPerformer | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('reply_performance_analytics')
      .select('*')
      .eq('dimension_type', dimensionType)
      .gte('confidence_score', 0.5) // Need at least 15 samples
      .order('roi_score', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      tier: data.dimension_value,
      avgFollowersGained: Number(data.avg_followers_gained),
      replyCount: data.reply_count,
      confidenceScore: Number(data.confidence_score)
    };
  }

  /**
   * Get all tiers with high confidence (for decision making)
   */
  async getHighConfidenceTiers(dimensionType: string, minConfidence: number = 0.7): Promise<TopPerformer[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('reply_performance_analytics')
      .select('*')
      .eq('dimension_type', dimensionType)
      .gte('confidence_score', minConfidence)
      .order('roi_score', { ascending: false })
      .limit(5);

    if (error || !data) return [];

    return data.map(d => ({
      tier: d.dimension_value,
      avgFollowersGained: Number(d.avg_followers_gained),
      replyCount: d.reply_count,
      confidenceScore: Number(d.confidence_score)
    }));
  }
}

