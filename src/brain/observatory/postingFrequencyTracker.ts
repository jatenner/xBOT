/**
 * Posting Frequency Tracker
 *
 * DB-only observatory job that computes rolling posting frequency for all
 * tracked accounts with enough tweet data. Stores as time-series so we can
 * detect cadence changes that correlate with growth.
 *
 * Key insight: Many accounts accelerate their posting frequency BEFORE a
 * growth event. This job tracks that signal.
 *
 * Runs every 6 hours. For each account with ≥10 tweets:
 * 1. Count posts in 7d/14d/30d windows
 * 2. Count replies in same windows
 * 3. Compute rates and reply ratio
 * 4. Compare to last measurement to detect trend (accelerating/stable/decelerating/sporadic)
 * 5. Store in brain_posting_frequency
 */

import { getSupabaseClient } from '../../db';
import { getFollowerRange } from '../types';

const LOG_PREFIX = '[observatory/posting-frequency]';
const BATCH_SIZE = 200;

export async function runPostingFrequencyTracker(): Promise<{
  accounts_measured: number;
  accelerating: number;
  decelerating: number;
}> {
  const supabase = getSupabaseClient();
  const now = new Date();
  let measured = 0;
  let accelerating = 0;
  let decelerating = 0;

  // Get accounts with enough tweet data (at least 10 tweets)
  const { data: accounts, error: acctErr } = await supabase
    .from('brain_accounts')
    .select('username, followers_count, tweets_collected_count')
    .eq('is_active', true)
    .gte('tweets_collected_count', 10)
    .order('updated_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (acctErr || !accounts || accounts.length === 0) {
    return { accounts_measured: 0, accelerating: 0, decelerating: 0 };
  }

  for (const account of accounts) {
    try {
      const result = await measureAccountFrequency(supabase, account.username, account.followers_count, now);
      if (result) {
        measured++;
        if (result.frequency_trend === 'accelerating') accelerating++;
        if (result.frequency_trend === 'decelerating') decelerating++;
      }
    } catch (err: any) {
      // Non-fatal per account
      console.warn(`${LOG_PREFIX} Error for @${account.username}: ${err.message}`);
    }
  }

  if (measured > 0) {
    console.log(
      `${LOG_PREFIX} Measured ${measured} accounts: ` +
      `${accelerating} accelerating, ${decelerating} decelerating`
    );
  }

  return { accounts_measured: measured, accelerating, decelerating };
}

async function measureAccountFrequency(
  supabase: any,
  username: string,
  followersCount: number | null,
  now: Date,
): Promise<{ frequency_trend: string } | null> {
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Count posts and replies in each window
  const [posts7, posts14, posts30, replies7, replies14, replies30, threads7] = await Promise.all([
    countTweets(supabase, username, d7, 'original'),
    countTweets(supabase, username, d14, 'original'),
    countTweets(supabase, username, d30, 'original'),
    countTweets(supabase, username, d7, 'reply'),
    countTweets(supabase, username, d14, 'reply'),
    countTweets(supabase, username, d30, 'reply'),
    countTweets(supabase, username, d7, 'thread'),
  ]);

  // Need at least some data in 30d window
  if (posts30 + replies30 < 5) return null;

  const postsPerDay7 = posts7 / 7;
  const postsPerDay14 = posts14 / 14;
  const postsPerDay30 = posts30 / 30;
  const replyRatio7 = (posts7 + replies7) > 0 ? replies7 / (posts7 + replies7) : 0;

  // Get previous measurement for trend detection
  const { data: prevMeasurement } = await supabase
    .from('brain_posting_frequency')
    .select('posts_per_day_7d')
    .eq('username', username)
    .order('measured_at', { ascending: false })
    .limit(1)
    .single();

  const prevRate = prevMeasurement?.posts_per_day_7d ?? null;
  const frequencyDelta = prevRate !== null ? postsPerDay7 - prevRate : null;

  // Classify trend
  let frequencyTrend: string;
  if (frequencyDelta === null) {
    frequencyTrend = 'stable'; // First measurement
  } else if (frequencyDelta > 0.3) {
    frequencyTrend = 'accelerating';
  } else if (frequencyDelta < -0.3) {
    frequencyTrend = 'decelerating';
  } else {
    // Check variance — sporadic if 7d rate differs a lot from 30d rate
    const variance = Math.abs(postsPerDay7 - postsPerDay30);
    frequencyTrend = variance > postsPerDay30 * 0.5 ? 'sporadic' : 'stable';
  }

  const followerRange = followersCount ? getFollowerRange(followersCount) : null;

  const { error } = await supabase.from('brain_posting_frequency').upsert({
    username,
    measured_at: now.toISOString(),
    posts_7d: posts7,
    posts_14d: posts14,
    posts_30d: posts30,
    replies_7d: replies7,
    replies_14d: replies14,
    replies_30d: replies30,
    threads_7d: threads7,
    posts_per_day_7d: Math.round(postsPerDay7 * 100) / 100,
    posts_per_day_14d: Math.round(postsPerDay14 * 100) / 100,
    posts_per_day_30d: Math.round(postsPerDay30 * 100) / 100,
    reply_ratio_7d: Math.round(replyRatio7 * 100) / 100,
    frequency_delta_7d: frequencyDelta !== null ? Math.round(frequencyDelta * 100) / 100 : null,
    frequency_trend: frequencyTrend,
    followers_at_measurement: followersCount,
    follower_range: followerRange,
  }, { onConflict: 'username,measured_at' });

  if (error) {
    if (error.message?.includes('relation') || error.message?.includes('schema cache')) {
      console.warn(`${LOG_PREFIX} brain_posting_frequency table not ready yet — skipping`);
      return null;
    }
    console.error(`${LOG_PREFIX} Upsert error for @${username}:`, error.message);
    return null;
  }

  return { frequency_trend: frequencyTrend };
}

async function countTweets(
  supabase: any,
  username: string,
  sinceDate: string,
  tweetType: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('brain_tweets')
    .select('*', { count: 'exact', head: true })
    .eq('author_username', username)
    .gte('posted_at', sinceDate)
    .eq('tweet_type', tweetType);

  if (error) return 0;
  return count ?? 0;
}
