/**
 * 📈 GROWTH METRICS API
 * 
 * GET /api/growth
 * Returns follower growth, top posts, and key growth indicators
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../db';

interface TopPost {
  tweet_id: string;
  content: string;
  posted_at: string;
  follows: number;
  impressions: number;
  fpki: number;
  er: number;
  reward_composite: number;
}

interface GrowthMetricsResponse {
  followers_today: number;
  followers_7d: number;
  fpki_avg_7d: number;
  reply_uplift_7d: number;
  novelty_avg_7d: number;
  top_posts_by_follows: TopPost[];
  engagement_summary: {
    total_posts_7d: number;
    total_impressions_7d: number;
    avg_er_7d: number;
    avg_reward_7d: number;
  };
}

export async function getGrowthMetrics(req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Get follower growth (from outcomes.follows)
    const { data: outcomes7d } = await supabase
      .from('outcomes')
      .select('follows, collected_at')
      .eq('simulated', false)
      .gte('collected_at', sevenDaysAgo.toISOString());

    const { data: outcomes1d } = await supabase
      .from('outcomes')
      .select('follows')
      .eq('simulated', false)
      .gte('collected_at', oneDayAgo.toISOString());

    const followers_7d = (outcomes7d || []).reduce((sum: number, o: any) => 
      sum + (o.follows || 0), 0
    );
    const followers_today = (outcomes1d || []).reduce((sum: number, o: any) => 
      sum + (o.follows || 0), 0
    );

    // 2. Get top posts by follower impact
    const { data: topPosts } = await supabase
      .from('outcomes')
      .select(`
        tweet_id,
        follows,
        impressions,
        likes,
        retweets,
        replies,
        er_calculated,
        reward_composite,
        collected_at
      `)
      .eq('simulated', false)
      .eq('collected_pass', 2) // Only finalized metrics
      .gte('collected_at', sevenDaysAgo.toISOString())
      .order('follows', { ascending: false })
      .limit(10);

    // 3. Join with posted_decisions to get content
    const topPostsWithContent: TopPost[] = [];
    for (const outcome of (topPosts || [])) {
      const { data: posted } = await supabase
        .from('posted_decisions')
        .select('content, posted_at')
        .eq('tweet_id', outcome.tweet_id)
        .single();

      if (posted) {
        topPostsWithContent.push({
          tweet_id: outcome.tweet_id,
          content: (posted.content || '').substring(0, 200),
          posted_at: posted.posted_at,
          follows: outcome.follows || 0,
          impressions: outcome.impressions || 0,
          fpki: (1000 * (outcome.follows || 0)) / Math.max(1, outcome.impressions || 1),
          er: outcome.er_calculated || 0,
          reward_composite: outcome.reward_composite || 0
        });
      }
    }

    // 4. Calculate 7-day averages
    const { data: allOutcomes7d } = await supabase
      .from('outcomes')
      .select('*')
      .eq('simulated', false)
      .gte('collected_at', sevenDaysAgo.toISOString());

    const totalPosts7d = (allOutcomes7d || []).length;
    const totalImpressions7d = (allOutcomes7d || []).reduce((sum: number, o: any) => 
      sum + (o.impressions || 0), 0
    );
    const avgER7d = totalPosts7d > 0
      ? (allOutcomes7d || []).reduce((sum: number, o: any) => 
          sum + (o.er_calculated || 0), 0
        ) / totalPosts7d
      : 0;
    const avgReward7d = totalPosts7d > 0
      ? (allOutcomes7d || []).reduce((sum: number, o: any) => 
          sum + (o.reward_composite || 0), 0
        ) / totalPosts7d
      : 0;
    const fpkiAvg7d = totalImpressions7d > 0
      ? (1000 * followers_7d) / totalImpressions7d
      : 0;

    // 5. Calculate novelty average (from content_metadata features)
    const { data: content7d } = await supabase
      .from('content_metadata')
      .select('novelty')
      .gte('created_at', sevenDaysAgo.toISOString())
      .not('novelty', 'is', null);

    const noveltyAvg7d = (content7d || []).length > 0
      ? (content7d || []).reduce((sum: number, c: any) => 
          sum + (c.novelty || 0), 0
        ) / (content7d || []).length
      : 0;

    // 6. Calculate reply uplift (replies with better ER than avg)
    const { data: replyOutcomes } = await supabase
      .from('outcomes')
      .select('er_calculated')
      .eq('simulated', false)
      .gte('collected_at', sevenDaysAgo.toISOString());

    const replyOutcomesWithDecisions = await Promise.all(
      (replyOutcomes || []).map(async (outcome: any) => {
        const { data: decision } = await supabase
          .from('posted_decisions')
          .select('decision_type')
          .eq('tweet_id', outcome.tweet_id)
          .single();
        return { ...outcome, decision_type: decision?.decision_type };
      })
    );

    const replyERs = replyOutcomesWithDecisions
      .filter((o: any) => o.decision_type === 'reply')
      .map((o: any) => o.er_calculated || 0);
    const avgReplyER = replyERs.length > 0
      ? replyERs.reduce((sum: number, er: number) => sum + er, 0) / replyERs.length
      : 0;
    const replyUplift7d = avgER7d > 0 ? (avgReplyER - avgER7d) / avgER7d : 0;

    const response: GrowthMetricsResponse = {
      followers_today,
      followers_7d,
      fpki_avg_7d: parseFloat(fpkiAvg7d.toFixed(2)),
      reply_uplift_7d: parseFloat((replyUplift7d * 100).toFixed(2)), // Percentage
      novelty_avg_7d: parseFloat(noveltyAvg7d.toFixed(3)),
      top_posts_by_follows: topPostsWithContent,
      engagement_summary: {
        total_posts_7d: totalPosts7d,
        total_impressions_7d: totalImpressions7d,
        avg_er_7d: parseFloat((avgER7d * 100).toFixed(2)), // Percentage
        avg_reward_7d: parseFloat(avgReward7d.toFixed(4))
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('[API] Growth metrics error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
