/**
 * Growth Path Analyzer
 *
 * DB-only job. Finds accounts that have crossed follower range boundaries
 * and reconstructs their growth path to understand what changed at each transition.
 *
 * Example: An account went from nano (100 followers) → micro (600) → small (3,000).
 * This job extracts: what did they do to go nano→micro? Then micro→small?
 * Were the strategies different?
 *
 * Writes to brain_range_transitions — aggregated patterns per transition type.
 *
 * Runs every 12 hours.
 */

import { getSupabaseClient } from '../../db';
import { FOLLOWER_RANGE_ORDER, getFollowerRange, type FollowerRange } from '../types';

const LOG_PREFIX = '[observatory/growth-path]';
const MIN_SAMPLES_PER_TRANSITION = 2;

export async function runGrowthPathAnalyzer(): Promise<{
  transitions_analyzed: number;
  transitions_updated: number;
}> {
  const supabase = getSupabaseClient();
  let transitionsAnalyzed = 0;
  let transitionsUpdated = 0;

  // Find accounts that crossed range boundaries
  // (follower_range_at_first_snapshot != current follower_range)
  const { data: crossedAccounts } = await supabase
    .from('brain_accounts')
    .select('username, follower_range, follower_range_at_first_snapshot, followers_count, growth_rate_7d')
    .eq('is_active', true)
    .not('follower_range', 'is', null)
    .not('follower_range_at_first_snapshot', 'is', null)
    .limit(5000);

  if (!crossedAccounts || crossedAccounts.length === 0) {
    return { transitions_analyzed: 0, transitions_updated: 0 };
  }

  // Filter to accounts that actually crossed at least one range boundary
  const movers = crossedAccounts.filter(a => a.follower_range !== a.follower_range_at_first_snapshot);

  if (movers.length === 0) {
    return { transitions_analyzed: 0, transitions_updated: 0 };
  }

  // Group by transition type (from_range → to_range)
  const transitionGroups: Record<string, Array<{
    username: string;
    followers_count: number;
    growth_rate_7d: number | null;
  }>> = {};

  for (const acct of movers) {
    const fromIdx = FOLLOWER_RANGE_ORDER.indexOf(acct.follower_range_at_first_snapshot as FollowerRange);
    const toIdx = FOLLOWER_RANGE_ORDER.indexOf(acct.follower_range as FollowerRange);

    if (fromIdx === -1 || toIdx === -1 || toIdx <= fromIdx) continue; // Only forward transitions

    // Record each step in the path (nano→micro, micro→small, etc.)
    for (let step = fromIdx; step < toIdx; step++) {
      const from = FOLLOWER_RANGE_ORDER[step];
      const to = FOLLOWER_RANGE_ORDER[step + 1];
      const key = `${from}→${to}`;

      if (!transitionGroups[key]) transitionGroups[key] = [];
      transitionGroups[key].push({
        username: acct.username,
        followers_count: acct.followers_count,
        growth_rate_7d: acct.growth_rate_7d,
      });
    }
  }

  // For each transition type with enough samples, analyze what accounts did
  for (const [key, accounts] of Object.entries(transitionGroups)) {
    if (accounts.length < MIN_SAMPLES_PER_TRANSITION) continue;

    const [fromRange, toRange] = key.split('→');
    transitionsAnalyzed++;

    try {
      const analysis = await analyzeTransition(supabase, fromRange, toRange, accounts);
      if (!analysis) continue;

      // Upsert into brain_range_transitions
      const { data: existing } = await supabase
        .from('brain_range_transitions')
        .select('id')
        .eq('from_range', fromRange)
        .eq('to_range', toRange)
        .is('niche', null)
        .single();

      const record = {
        from_range: fromRange,
        to_range: toRange,
        niche: null,
        sample_size: accounts.length,
        avg_days_to_transition: analysis.avg_days,
        common_strategies: analysis.common_strategies,
        content_patterns: analysis.content_patterns,
        engagement_patterns: analysis.engagement_patterns,
        timing_patterns: analysis.timing_patterns,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase
          .from('brain_range_transitions')
          .update(record)
          .eq('id', existing.id);
      } else {
        await supabase.from('brain_range_transitions').insert(record);
      }

      transitionsUpdated++;
      console.log(`${LOG_PREFIX} ${key}: ${accounts.length} accounts analyzed`);
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error analyzing ${key}: ${err.message}`);
    }
  }

  if (transitionsUpdated > 0) {
    console.log(`${LOG_PREFIX} Updated ${transitionsUpdated} transitions from ${transitionsAnalyzed} analyzed`);
  }

  return { transitions_analyzed: transitionsAnalyzed, transitions_updated: transitionsUpdated };
}

async function analyzeTransition(
  supabase: any,
  fromRange: string,
  toRange: string,
  accounts: Array<{ username: string; followers_count: number; growth_rate_7d: number | null }>,
): Promise<{
  avg_days: number | null;
  common_strategies: Record<string, unknown>;
  content_patterns: Record<string, unknown>;
  engagement_patterns: Record<string, unknown>;
  timing_patterns: Record<string, unknown>;
} | null> {
  const contentStats: any[] = [];
  const daysList: number[] = [];

  for (const acct of accounts.slice(0, 30)) {
    // Get snapshot history to compute time in transition
    const { data: snapshots } = await supabase
      .from('brain_account_snapshots')
      .select('followers_count, checked_at')
      .eq('username', acct.username)
      .order('checked_at', { ascending: true })
      .limit(100);

    if (!snapshots || snapshots.length < 2) continue;

    // Find when they entered the "from" range and left it
    const fromBounds = getRangeBounds(fromRange);
    const toBounds = getRangeBounds(toRange);

    let enteredFrom: Date | null = null;
    let exitedTo: Date | null = null;

    for (const snap of snapshots) {
      const f = snap.followers_count ?? 0;
      if (f >= fromBounds.min && f < fromBounds.max && !enteredFrom) {
        enteredFrom = new Date(snap.checked_at);
      }
      if (f >= toBounds.min && enteredFrom && !exitedTo) {
        exitedTo = new Date(snap.checked_at);
      }
    }

    if (enteredFrom && exitedTo) {
      const days = (exitedTo.getTime() - enteredFrom.getTime()) / (24 * 60 * 60 * 1000);
      if (days > 0) daysList.push(days);
    }

    // Get their tweet data during the transition period
    const { data: tweets } = await supabase
      .from('brain_tweets')
      .select('tweet_type, likes, retweets, replies, views, content, posted_hour_utc')
      .eq('author_username', acct.username)
      .limit(50);

    if (!tweets || tweets.length < 3) continue;

    const total = tweets.length;
    const replyCount = tweets.filter((t: any) => t.tweet_type === 'reply').length;
    const threadCount = tweets.filter((t: any) => t.tweet_type === 'thread').length;
    const avgLikes = tweets.reduce((s: number, t: any) => s + (t.likes ?? 0), 0) / total;
    const avgViews = tweets.reduce((s: number, t: any) => s + (t.views ?? 0), 0) / total;
    const avgWords = tweets.reduce((s: number, t: any) => s + ((t.content ?? '').split(/\s+/).length), 0) / total;

    // Hours distribution
    const hours: Record<number, number> = {};
    for (const t of tweets) {
      if (t.posted_hour_utc != null) {
        hours[t.posted_hour_utc] = (hours[t.posted_hour_utc] ?? 0) + 1;
      }
    }

    contentStats.push({
      reply_ratio: replyCount / total,
      thread_ratio: threadCount / total,
      avg_likes: avgLikes,
      avg_views: avgViews,
      avg_word_count: avgWords,
      tweets_count: total,
      hours,
    });
  }

  if (contentStats.length === 0) return null;

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  // Aggregate hours
  const allHours: Record<number, number> = {};
  for (const s of contentStats) {
    for (const [h, c] of Object.entries(s.hours)) {
      allHours[Number(h)] = (allHours[Number(h)] ?? 0) + (c as number);
    }
  }
  const topHours = Object.entries(allHours)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([h]) => Number(h));

  return {
    avg_days: daysList.length > 0 ? Math.round(avg(daysList)) : null,
    common_strategies: {
      avg_reply_ratio: Math.round(avg(contentStats.map(s => s.reply_ratio)) * 100) / 100,
      avg_thread_ratio: Math.round(avg(contentStats.map(s => s.thread_ratio)) * 100) / 100,
      avg_tweets_collected: Math.round(avg(contentStats.map(s => s.tweets_count))),
    },
    content_patterns: {
      avg_word_count: Math.round(avg(contentStats.map(s => s.avg_word_count))),
      avg_likes: Math.round(avg(contentStats.map(s => s.avg_likes))),
      avg_views: Math.round(avg(contentStats.map(s => s.avg_views))),
    },
    engagement_patterns: {
      avg_likes: Math.round(avg(contentStats.map(s => s.avg_likes))),
      avg_views: Math.round(avg(contentStats.map(s => s.avg_views))),
    },
    timing_patterns: {
      peak_hours_utc: topHours,
    },
  };
}

function getRangeBounds(range: string): { min: number; max: number } {
  const bounds: Record<string, { min: number; max: number }> = {
    nano: { min: 0, max: 500 },
    micro: { min: 500, max: 2_000 },
    small: { min: 2_000, max: 10_000 },
    mid: { min: 10_000, max: 50_000 },
    large: { min: 50_000, max: 200_000 },
    mega: { min: 200_000, max: 1_000_000 },
    celebrity: { min: 1_000_000, max: Infinity },
  };
  return bounds[range] ?? { min: 0, max: Infinity };
}
