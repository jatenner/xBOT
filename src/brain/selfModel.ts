/**
 * Brain: Self-Model Manager
 *
 * Maintains a continuous understanding of OUR account:
 * - Current follower count and growth phase
 * - Rolling 7d/30d performance averages
 * - Best and worst performing patterns
 * - Calibrated expectations per action type
 * - Growth velocity and acceleration
 * - Strategy effectiveness and decay detection
 *
 * Updates self_model_state singleton every 30 minutes.
 */

import { getSupabaseClient } from '../db';
import { getSelfModel, updateSelfModel } from './db';
import { getGrowthPhase, type GrowthPhase, type PatternPerformance, type StrategyHealth } from './types';

const LOG_PREFIX = '[brain/self-model]';

const MIN_SAMPLES_FOR_PATTERN = 3;
const DECAY_THRESHOLD = 0.30; // 30% drop from 30d to 7d = decaying
const WORKING_THRESHOLD = 0.50; // 50% above baseline = working

export async function runSelfModelUpdate(): Promise<void> {
  const supabase = getSupabaseClient();

  // ==========================================================================
  // 1. Get current follower count from account_snapshots
  // ==========================================================================
  let followerCount = 0;
  let followingCount = 0;

  try {
    const { data: snapshot } = await supabase
      .from('account_snapshots')
      .select('followers_count, following_count, timestamp')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (snapshot) {
      followerCount = snapshot.followers_count ?? 0;
      followingCount = snapshot.following_count ?? 0;
    }
  } catch {
    // Use existing self-model value as fallback
    const existing = await getSelfModel();
    if (existing) {
      followerCount = existing.follower_count;
      followingCount = existing.following_count;
    }
  }

  const growthPhase = getGrowthPhase(followerCount);

  // ==========================================================================
  // 2. Compute rolling performance averages from outcomes
  // ==========================================================================
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: outcomes7d } = await supabase
    .from('outcomes')
    .select('impressions, likes, er_calculated, decision_id')
    .eq('simulated', false)
    .gte('collected_at', sevenDaysAgo)
    .not('impressions', 'is', null);

  const { data: outcomes30d } = await supabase
    .from('outcomes')
    .select('impressions, likes, er_calculated, decision_id')
    .eq('simulated', false)
    .gte('collected_at', thirtyDaysAgo)
    .not('impressions', 'is', null);

  const avg7d = computeAverages(outcomes7d ?? []);
  const avg30d = computeAverages(outcomes30d ?? []);

  // Count posts vs replies in last 7d/30d
  const { count: posts7d } = await supabase
    .from('growth_ledger')
    .select('id', { count: 'exact', head: true })
    .gte('posted_at', sevenDaysAgo)
    .in('action_type', ['single', 'thread']);

  const { count: replies7d } = await supabase
    .from('growth_ledger')
    .select('id', { count: 'exact', head: true })
    .gte('posted_at', sevenDaysAgo)
    .eq('action_type', 'reply');

  const { count: posts30d } = await supabase
    .from('growth_ledger')
    .select('id', { count: 'exact', head: true })
    .gte('posted_at', thirtyDaysAgo)
    .in('action_type', ['single', 'thread']);

  const { count: replies30d } = await supabase
    .from('growth_ledger')
    .select('id', { count: 'exact', head: true })
    .gte('posted_at', thirtyDaysAgo)
    .eq('action_type', 'reply');

  // ==========================================================================
  // 3. Best/worst patterns from growth_ledger
  // ==========================================================================
  const { data: ledger30d } = await supabase
    .from('growth_ledger')
    .select('action_type, topic, format_type, hook_type, archetype, posted_hour_utc, reward, views, likes, engagement_rate')
    .gte('posted_at', thirtyDaysAgo)
    .not('reward', 'is', null);

  const bestFormats = aggregatePatterns(ledger30d ?? [], 'format_type');
  const bestTopics = aggregatePatterns(ledger30d ?? [], 'topic');
  const bestHooks = aggregatePatterns(ledger30d ?? [], 'hook_type');
  const bestArchetypes = aggregatePatterns(ledger30d ?? [], 'archetype');
  const bestHours = aggregatePatterns(ledger30d ?? [], 'posted_hour_utc');

  const worstFormats = aggregatePatterns(ledger30d ?? [], 'format_type', 'worst');
  const worstTopics = aggregatePatterns(ledger30d ?? [], 'topic', 'worst');

  // ==========================================================================
  // 4. Calibrated expectations
  // ==========================================================================
  const postOutcomes = (outcomes30d ?? []).filter(o => o.decision_id); // all outcomes
  const expectedViewsPerPost = avg30d.avgViews;
  const expectedLikesPerPost = avg30d.avgLikes;
  const expectedEngagementRate = avg30d.avgEngagementRate;

  // Separate reply vs post expectations from ledger
  const replyLedger = (ledger30d ?? []).filter(e => e.action_type === 'reply');
  const postLedger = (ledger30d ?? []).filter(e => e.action_type !== 'reply');

  const expectedViewsPerReply = replyLedger.length >= MIN_SAMPLES_FOR_PATTERN
    ? replyLedger.reduce((s, e) => s + (e.views ?? 0), 0) / replyLedger.length
    : null;
  const expectedLikesPerReply = replyLedger.length >= MIN_SAMPLES_FOR_PATTERN
    ? replyLedger.reduce((s, e) => s + (e.likes ?? 0), 0) / replyLedger.length
    : null;

  // ==========================================================================
  // 5. Growth velocity
  // ==========================================================================
  let followersGained7d = 0;
  let followersGained30d = 0;
  let growthRateDaily: number | null = null;
  let growthAcceleration: number | null = null;

  try {
    // Followers 7 days ago
    const { data: snap7d } = await supabase
      .from('account_snapshots')
      .select('followers_count')
      .lte('timestamp', sevenDaysAgo)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (snap7d) {
      followersGained7d = followerCount - (snap7d.followers_count ?? followerCount);
    }

    // Followers 30 days ago
    const { data: snap30d } = await supabase
      .from('account_snapshots')
      .select('followers_count')
      .lte('timestamp', thirtyDaysAgo)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (snap30d) {
      followersGained30d = followerCount - (snap30d.followers_count ?? followerCount);
      growthRateDaily = followersGained30d / 30;
    }

    // Acceleration: compare last 7d rate vs previous 7d rate
    if (followersGained7d !== 0 && followersGained30d !== 0) {
      const rate7d = followersGained7d / 7;
      const ratePrev = (followersGained30d - followersGained7d) / 23; // remaining 23 days
      if (ratePrev > 0) {
        growthAcceleration = (rate7d - ratePrev) / ratePrev; // positive = accelerating
      }
    }
  } catch {
    // Non-critical
  }

  // ==========================================================================
  // 6. Strategy effectiveness and decay detection
  // ==========================================================================
  const { working, decaying, untested } = detectStrategyHealth(ledger30d ?? [], sevenDaysAgo);

  // ==========================================================================
  // 7. Write self_model_state
  // ==========================================================================
  await updateSelfModel({
    follower_count: followerCount,
    following_count: followingCount,
    growth_phase: growthPhase,

    avg_views_7d: avg7d.avgViews,
    avg_likes_7d: avg7d.avgLikes,
    avg_engagement_rate_7d: avg7d.avgEngagementRate,
    total_posts_7d: posts7d ?? 0,
    total_replies_7d: replies7d ?? 0,

    avg_views_30d: avg30d.avgViews,
    avg_likes_30d: avg30d.avgLikes,
    avg_engagement_rate_30d: avg30d.avgEngagementRate,
    total_posts_30d: posts30d ?? 0,
    total_replies_30d: replies30d ?? 0,

    best_formats: bestFormats,
    best_topics: bestTopics,
    best_hooks: bestHooks,
    best_posting_hours: bestHours,
    best_archetypes: bestArchetypes,
    worst_formats: worstFormats,
    worst_topics: worstTopics,

    expected_views_per_post: expectedViewsPerPost,
    expected_likes_per_post: expectedLikesPerPost,
    expected_views_per_reply: expectedViewsPerReply,
    expected_likes_per_reply: expectedLikesPerReply,
    expected_engagement_rate: expectedEngagementRate,

    followers_gained_7d: followersGained7d,
    followers_gained_30d: followersGained30d,
    growth_rate_daily: growthRateDaily,
    growth_acceleration: growthAcceleration,

    working_strategies: working,
    decaying_strategies: decaying,
    untested_strategies: untested as any,
  });

  console.log(
    `${LOG_PREFIX} Updated: ${followerCount} followers (${growthPhase}), ` +
    `7d avg ${Math.round(avg7d.avgViews ?? 0)} views, ` +
    `+${followersGained7d} followers/7d, ` +
    `${working.length} working / ${decaying.length} decaying strategies`
  );

  // ==========================================================================
  // 8. Behavioral comparison: compare our behavior vs data-proven recommendations
  // ==========================================================================
  try {
    const { data: behavioralPatterns } = await supabase
      .from('external_patterns')
      .select('pattern_type, target_tier, ext_avg_engagement_rate, ext_avg_likes, ext_avg_views, confidence')
      .in('pattern_type', ['content_mix', 'reply_targeting'])
      .eq('direction', 'do_more')
      .in('confidence', ['medium', 'high'])
      .limit(5);

    if (behavioralPatterns && behavioralPatterns.length > 0) {
      // Check content mix alignment
      const mixPattern = behavioralPatterns.find((p: any) => p.pattern_type === 'content_mix');
      if (mixPattern) {
        const recommendedReplyPct = (mixPattern.ext_avg_engagement_rate ?? 0.7) * 100;
        const ourTotal = (posts7d ?? 0) + (replies7d ?? 0);
        const ourReplyPct = ourTotal > 0 ? ((replies7d ?? 0) / ourTotal) * 100 : 0;

        if (ourTotal >= 5 && Math.abs(ourReplyPct - recommendedReplyPct) > 15) {
          const direction = ourReplyPct < recommendedReplyPct ? 'more replies' : 'more original posts';
          console.log(
            `${LOG_PREFIX} Behavioral gap: Our reply ratio is ${ourReplyPct.toFixed(0)}% vs recommended ${recommendedReplyPct.toFixed(0)}%. Consider ${direction}.`
          );
        }
      }
    }
  } catch {
    // Behavioral comparison is non-fatal
  }
}

// =============================================================================
// Helpers
// =============================================================================

function computeAverages(outcomes: { impressions: number | null; likes: number | null; er_calculated: number | null }[]): {
  avgViews: number | null;
  avgLikes: number | null;
  avgEngagementRate: number | null;
} {
  if (outcomes.length === 0) return { avgViews: null, avgLikes: null, avgEngagementRate: null };

  const views = outcomes.map(o => o.impressions ?? 0);
  const likes = outcomes.map(o => o.likes ?? 0);
  const ers = outcomes.filter(o => o.er_calculated != null).map(o => o.er_calculated!);

  return {
    avgViews: views.reduce((s, v) => s + v, 0) / views.length,
    avgLikes: likes.reduce((s, v) => s + v, 0) / likes.length,
    avgEngagementRate: ers.length > 0 ? ers.reduce((s, v) => s + v, 0) / ers.length : null,
  };
}

function aggregatePatterns(
  entries: any[],
  dimension: string,
  mode: 'best' | 'worst' = 'best',
): PatternPerformance[] {
  const groups: Record<string, { views: number[]; likes: number[]; ers: number[]; lastUsed: string | null }> = {};

  for (const entry of entries) {
    const key = String(entry[dimension] ?? 'unknown');
    if (key === 'unknown' || key === 'null' || key === 'undefined') continue;

    if (!groups[key]) groups[key] = { views: [], likes: [], ers: [], lastUsed: null };
    groups[key].views.push(entry.views ?? 0);
    groups[key].likes.push(entry.likes ?? 0);
    if (entry.engagement_rate != null) groups[key].ers.push(entry.engagement_rate);
    if (entry.posted_at && (!groups[key].lastUsed || entry.posted_at > groups[key].lastUsed)) {
      groups[key].lastUsed = entry.posted_at;
    }
  }

  const patterns: PatternPerformance[] = Object.entries(groups)
    .filter(([_, g]) => g.views.length >= MIN_SAMPLES_FOR_PATTERN)
    .map(([name, g]) => ({
      name,
      avg_views: g.views.reduce((s, v) => s + v, 0) / g.views.length,
      avg_likes: g.likes.reduce((s, v) => s + v, 0) / g.likes.length,
      avg_engagement_rate: g.ers.length > 0 ? g.ers.reduce((s, v) => s + v, 0) / g.ers.length : 0,
      sample_size: g.views.length,
      last_used: g.lastUsed,
    }));

  // Sort: best = highest avg_views, worst = lowest
  patterns.sort((a, b) =>
    mode === 'best' ? b.avg_views - a.avg_views : a.avg_views - b.avg_views
  );

  return patterns.slice(0, 10);
}

function detectStrategyHealth(
  ledger: any[],
  sevenDaysAgo: string,
): { working: StrategyHealth[]; decaying: StrategyHealth[]; untested: StrategyHealth[] } {
  const working: StrategyHealth[] = [];
  const decaying: StrategyHealth[] = [];
  const untested: StrategyHealth[] = [];

  // Analyze key dimensions for decay
  const dimensions = ['format_type', 'hook_type', 'archetype', 'topic'];

  for (const dim of dimensions) {
    const groups: Record<string, { recent: number[]; older: number[] }> = {};

    for (const entry of ledger) {
      const key = String(entry[dim] ?? '');
      if (!key || key === 'null' || key === 'undefined') continue;

      if (!groups[key]) groups[key] = { recent: [], older: [] };

      const reward = Number(entry.reward ?? 0);
      if (entry.posted_at >= sevenDaysAgo) {
        groups[key].recent.push(reward);
      } else {
        groups[key].older.push(reward);
      }
    }

    for (const [value, { recent, older }] of Object.entries(groups)) {
      const recentAvg = recent.length > 0 ? recent.reduce((s, v) => s + v, 0) / recent.length : null;
      const olderAvg = older.length > 0 ? older.reduce((s, v) => s + v, 0) / older.length : null;
      const totalSamples = recent.length + older.length;

      if (totalSamples < MIN_SAMPLES_FOR_PATTERN) continue;

      // Compute overall avg for baseline
      const allRewards = [...recent, ...older];
      const overallAvg = allRewards.reduce((s, v) => s + v, 0) / allRewards.length;

      const entry: StrategyHealth = {
        strategy: value,
        dimension: dim,
        effectiveness_7d: recentAvg ?? 0,
        effectiveness_30d: overallAvg,
        sample_size: totalSamples,
        trend: 'stable',
        started_at: '',
        last_confirmed: new Date().toISOString(),
      };

      if (recentAvg === null || recent.length < 2) {
        // Not enough recent data to judge
        if (older.length >= MIN_SAMPLES_FOR_PATTERN && olderAvg! > overallAvg * WORKING_THRESHOLD) {
          entry.trend = 'stable';
          untested.push(entry);
        }
        continue;
      }

      if (olderAvg !== null && olderAvg > 0) {
        const changeRatio = (recentAvg - olderAvg) / olderAvg;

        if (changeRatio < -DECAY_THRESHOLD) {
          entry.trend = 'declining';
          decaying.push(entry);
        } else if (recentAvg > overallAvg * (1 + WORKING_THRESHOLD)) {
          entry.trend = 'improving';
          working.push(entry);
        } else if (recentAvg >= olderAvg * 0.8) {
          entry.trend = 'stable';
          working.push(entry);
        }
      } else if (recentAvg > 0) {
        entry.trend = 'improving';
        working.push(entry);
      }
    }
  }

  return { working, decaying, untested };
}
