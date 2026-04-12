/**
 * Content Evolution Detector
 *
 * Detects when accounts shift their content strategy. Compares the distribution
 * of classified tweet dimensions (hook_type, tone, format, domain) between
 * two time windows to detect significant shifts.
 *
 * Key insight: Accounts that grow often shift their content strategy right
 * before or during a growth event. This job detects those shifts and records
 * whether they correlate with growth.
 *
 * Runs every 12 hours. For each account with ≥20 classified tweets:
 * 1. Compare last 14 days vs previous 14 days
 * 2. For each classification dimension, compute distribution
 * 3. If dominant value changed, record as evolution event
 * 4. Cross-reference with follower snapshots to detect growth correlation
 */

import { getSupabaseClient } from '../../db';
import { getFollowerRange } from '../types';

const LOG_PREFIX = '[observatory/content-evolution]';
const BATCH_SIZE = 100;
const WINDOW_DAYS = 14;
const MIN_SAMPLES = 8;

const TRACKED_DIMENSIONS = ['domain', 'hook_type', 'tone', 'format', 'emotional_trigger'];

export async function runContentEvolutionDetector(): Promise<{
  accounts_analyzed: number;
  evolutions_detected: number;
  growth_correlated: number;
}> {
  const supabase = getSupabaseClient();
  const now = new Date();
  let analyzed = 0;
  let detected = 0;
  let growthCorrelated = 0;

  // Get accounts with enough classified tweets
  const { data: accounts, error } = await supabase
    .from('brain_accounts')
    .select('username, followers_count, growth_rate_7d')
    .eq('is_active', true)
    .gte('tweets_collected_count', 20)
    .order('updated_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error || !accounts || accounts.length === 0) {
    return { accounts_analyzed: 0, evolutions_detected: 0, growth_correlated: 0 };
  }

  for (const account of accounts) {
    try {
      const evolutions = await analyzeAccountEvolution(supabase, account, now);
      if (evolutions > 0) {
        analyzed++;
        detected += evolutions;
      }
    } catch (err: any) {
      console.warn(`${LOG_PREFIX} Error for @${account.username}: ${err.message}`);
    }
  }

  if (detected > 0) {
    console.log(
      `${LOG_PREFIX} Analyzed ${analyzed} accounts, detected ${detected} evolutions, ` +
      `${growthCorrelated} growth-correlated`
    );
  }

  return { accounts_analyzed: analyzed, evolutions_detected: detected, growth_correlated: growthCorrelated };
}

async function analyzeAccountEvolution(
  supabase: any,
  account: { username: string; followers_count: number | null; growth_rate_7d: number | null },
  now: Date,
): Promise<number> {
  const recentStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const beforeStart = new Date(now.getTime() - WINDOW_DAYS * 2 * 24 * 60 * 60 * 1000).toISOString();

  // Get classified tweets in both windows
  const { data: recentTweets } = await supabase
    .from('brain_classifications')
    .select('tweet_id, domain, hook_type, tone, format, emotional_trigger')
    .in('tweet_id',
      supabase
        .from('brain_tweets')
        .select('tweet_id')
        .eq('author_username', account.username)
        .gte('posted_at', recentStart)
    );

  // Supabase doesn't support subqueries like this — use a different approach
  // Get tweet IDs for each window, then get classifications
  const { data: recentTweetIds } = await supabase
    .from('brain_tweets')
    .select('tweet_id')
    .eq('author_username', account.username)
    .gte('posted_at', recentStart)
    .limit(200);

  const { data: beforeTweetIds } = await supabase
    .from('brain_tweets')
    .select('tweet_id')
    .eq('author_username', account.username)
    .gte('posted_at', beforeStart)
    .lt('posted_at', recentStart)
    .limit(200);

  if (!recentTweetIds || recentTweetIds.length < MIN_SAMPLES) return 0;
  if (!beforeTweetIds || beforeTweetIds.length < MIN_SAMPLES) return 0;

  const recentIds = recentTweetIds.map((t: any) => t.tweet_id);
  const beforeIds = beforeTweetIds.map((t: any) => t.tweet_id);

  const { data: recentClassifications } = await supabase
    .from('brain_classifications')
    .select('domain, hook_type, tone, format, emotional_trigger')
    .in('tweet_id', recentIds);

  const { data: beforeClassifications } = await supabase
    .from('brain_classifications')
    .select('domain, hook_type, tone, format, emotional_trigger')
    .in('tweet_id', beforeIds);

  if (!recentClassifications || recentClassifications.length < MIN_SAMPLES) return 0;
  if (!beforeClassifications || beforeClassifications.length < MIN_SAMPLES) return 0;

  // Get follower counts for growth correlation
  const { data: followersBefore } = await supabase
    .from('brain_account_snapshots')
    .select('followers_count')
    .eq('username', account.username)
    .gte('checked_at', beforeStart)
    .lt('checked_at', recentStart)
    .order('checked_at', { ascending: true })
    .limit(1)
    .single();

  const { data: followersAfter } = await supabase
    .from('brain_account_snapshots')
    .select('followers_count')
    .eq('username', account.username)
    .gte('checked_at', recentStart)
    .order('checked_at', { ascending: false })
    .limit(1)
    .single();

  const followersBef = followersBefore?.followers_count ?? account.followers_count;
  const followersAft = followersAfter?.followers_count ?? account.followers_count;
  const growthRateBefore = 0; // Would need more data
  const growthRateAfter = followersBef && followersBef > 0
    ? ((followersAft ?? 0) - followersBef) / followersBef
    : 0;

  let evolutionsDetected = 0;

  for (const dimension of TRACKED_DIMENSIONS) {
    const beforeDist = computeDistribution(beforeClassifications, dimension);
    const recentDist = computeDistribution(recentClassifications, dimension);

    const oldPrimary = getDominant(beforeDist);
    const newPrimary = getDominant(recentDist);

    // Only record if the dominant value changed
    if (!oldPrimary || !newPrimary || oldPrimary === newPrimary) continue;

    // Check if the shift is significant (not just noise)
    const oldShare = beforeDist[oldPrimary] ?? 0;
    const newShareOfOld = recentDist[oldPrimary] ?? 0;
    if (Math.abs(oldShare - newShareOfOld) < 0.15) continue; // Less than 15% shift — noise

    const growthCorrelated = growthRateAfter > 0.02; // 2%+ growth in recent window
    const followerRange = account.followers_count ? getFollowerRange(account.followers_count) : null;

    const { error } = await supabase.from('brain_content_evolution').insert({
      username: account.username,
      dimension,
      old_primary: oldPrimary,
      new_primary: newPrimary,
      old_distribution: beforeDist,
      new_distribution: recentDist,
      window_days: WINDOW_DAYS,
      sample_size_before: beforeClassifications.length,
      sample_size_after: recentClassifications.length,
      followers_before: followersBef,
      followers_after: followersAft,
      follower_range: followerRange,
      growth_rate_before: growthRateBefore,
      growth_rate_after: Math.round(growthRateAfter * 10000) / 10000,
      growth_correlated: growthCorrelated,
    });

    if (error) {
      if (error.message?.includes('relation') || error.message?.includes('schema cache')) {
        console.warn(`${LOG_PREFIX} brain_content_evolution not ready yet — skipping`);
        return 0;
      }
      console.error(`${LOG_PREFIX} Insert error:`, error.message);
      continue;
    }

    evolutionsDetected++;
    console.log(
      `${LOG_PREFIX} @${account.username} ${dimension}: ${oldPrimary} → ${newPrimary}` +
      (growthCorrelated ? ' (GROWTH CORRELATED)' : '')
    );
  }

  return evolutionsDetected;
}

function computeDistribution(items: any[], dimension: string): Record<string, number> {
  const counts: Record<string, number> = {};
  let total = 0;

  for (const item of items) {
    const value = item[dimension];
    if (!value || value === 'other') continue;
    counts[value] = (counts[value] ?? 0) + 1;
    total++;
  }

  if (total === 0) return {};

  const dist: Record<string, number> = {};
  for (const [key, count] of Object.entries(counts)) {
    dist[key] = Math.round((count / total) * 100) / 100;
  }
  return dist;
}

function getDominant(dist: Record<string, number>): string | null {
  let maxVal = 0;
  let maxKey: string | null = null;
  for (const [key, val] of Object.entries(dist)) {
    if (val > maxVal) {
      maxVal = val;
      maxKey = key;
    }
  }
  return maxKey;
}
