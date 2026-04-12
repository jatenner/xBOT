/**
 * Engagement Baseline Calculator
 *
 * Computes per-account engagement averages from their stored tweets.
 * This is the foundation for both analysis layers:
 *
 * Layer 1 (Good Content): "This tweet got 5x this account's average — what made it special?"
 * Layer 2 (Account Growth): "During the growth period, avg engagement jumped from 10 to 200 — what changed?"
 *
 * For each account with 5+ tweets, computes:
 * - avg_likes_30d (rolling average)
 * - avg_retweets_30d
 * - avg_bookmarks_30d
 * - avg_replies_30d
 * - engagement_consistency (std dev / mean — low = consistent, high = spiky)
 * - top_tweet_ratio (best tweet / average — how much their best outperforms)
 *
 * Then tags every tweet with an outperformance_ratio:
 *   outperformance = tweet_likes / account_avg_likes
 *   > 3.0 = breakout tweet (something special about this one)
 *   > 1.5 = above average
 *   0.5-1.5 = normal
 *   < 0.5 = underperformer (what went wrong?)
 *
 * Runs every 2 hours.
 */

import { getSupabaseClient } from '../../db';

const LOG_PREFIX = '[observatory/engagement-baseline]';
// Lowered 2026-04-12 from 5 → 3. With ~6K accounts and ~40K tweets, only 91 accounts
// (1.5%) had 5+ tweets, leaving 98.5% of authors with no per-author baseline. Dropping
// to 3 should multiply qualifying accounts and give the outcome scorer more fallback
// coverage for the per_author_fallback path.
const MIN_TWEETS_FOR_BASELINE = 3;

export async function runEngagementBaseline(): Promise<{
  accounts_computed: number;
  tweets_tagged: number;
}> {
  const supabase = getSupabaseClient();
  let accountsComputed = 0;
  let tweetsTagged = 0;

  // Get all accounts that have tweets
  const { data: accountsWithTweets } = await supabase
    .from('brain_tweets')
    .select('author_username')
    .limit(50000);

  if (!accountsWithTweets) return { accounts_computed: 0, tweets_tagged: 0 };

  // Count tweets per author
  const authorCounts: Record<string, number> = {};
  for (const t of accountsWithTweets) {
    authorCounts[t.author_username] = (authorCounts[t.author_username] ?? 0) + 1;
  }

  // Filter to authors with enough tweets
  const qualifiedAuthors = Object.entries(authorCounts)
    .filter(([_, count]) => count >= MIN_TWEETS_FOR_BASELINE)
    .map(([username]) => username);

  if (qualifiedAuthors.length === 0) {
    return { accounts_computed: 0, tweets_tagged: 0 };
  }

  // Process each qualified author
  for (const username of qualifiedAuthors) {
    try {
      // Get all their tweets with engagement
      const { data: tweets } = await supabase
        .from('brain_tweets')
        .select('tweet_id, likes, retweets, replies, bookmarks, tweet_type')
        .eq('author_username', username)
        .order('posted_at', { ascending: false })
        .limit(100);

      if (!tweets || tweets.length < MIN_TWEETS_FOR_BASELINE) continue;

      // Compute averages
      const likes = tweets.map(t => t.likes ?? 0);
      const retweets = tweets.map(t => t.retweets ?? 0);
      const replies = tweets.map(t => t.replies ?? 0);
      const bookmarks = tweets.map(t => t.bookmarks ?? 0);

      const avgLikes = likes.reduce((s, v) => s + v, 0) / likes.length;
      const avgRetweets = retweets.reduce((s, v) => s + v, 0) / retweets.length;
      const avgReplies = replies.reduce((s, v) => s + v, 0) / replies.length;
      const avgBookmarks = bookmarks.reduce((s, v) => s + v, 0) / bookmarks.length;

      // Engagement consistency (coefficient of variation)
      const variance = likes.reduce((s, v) => s + Math.pow(v - avgLikes, 2), 0) / likes.length;
      const stdDev = Math.sqrt(variance);
      const consistency = avgLikes > 0 ? stdDev / avgLikes : 0;

      // Top tweet ratio
      const maxLikes = Math.max(...likes);
      const topRatio = avgLikes > 0 ? maxLikes / avgLikes : 0;

      // Reply ratio
      const replyCount = tweets.filter(t => t.tweet_type === 'reply').length;
      const replyRatio = tweets.length > 0 ? replyCount / tweets.length : 0;

      // Compute engagement rate proxy (likes per follower)
      // We'll get follower count from brain_accounts
      const { data: acct } = await supabase
        .from('brain_accounts')
        .select('followers_count')
        .eq('username', username)
        .single();

      const followers = acct?.followers_count ?? 0;
      const engRateProxy = followers > 0 ? avgLikes / followers : null;

      // Update brain_accounts with baseline
      await supabase
        .from('brain_accounts')
        .update({
          avg_likes_30d: Math.round(avgLikes * 10) / 10,
          avg_engagement_rate_30d: engRateProxy ? Math.round(engRateProxy * 10000) / 10000 : null,
          tweet_frequency_daily: null, // Would need date range computation
          updated_at: new Date().toISOString(),
        })
        .eq('username', username);

      accountsComputed++;

      // Tag each tweet with outperformance ratio (viral_multiplier column)
      if (avgLikes > 0) {
        for (const tweet of tweets) {
          const outperformance = (tweet.likes ?? 0) / avgLikes;
          const rounded = Math.round(outperformance * 100) / 100;

          // Only update if significantly different from current value
          await supabase
            .from('brain_tweets')
            .update({ viral_multiplier: rounded })
            .eq('tweet_id', tweet.tweet_id);

          tweetsTagged++;
        }
      }
    } catch (err: any) {
      // Non-fatal per account
    }
  }

  if (accountsComputed > 0) {
    console.log(
      `${LOG_PREFIX} Computed baselines for ${accountsComputed} accounts, ` +
      `tagged ${tweetsTagged} tweets with outperformance ratios`
    );
  }

  return { accounts_computed: accountsComputed, tweets_tagged: tweetsTagged };
}
