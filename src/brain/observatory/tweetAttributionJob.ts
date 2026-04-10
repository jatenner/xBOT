/**
 * Tweet-to-Follower Attribution Job
 *
 * DB-only job that runs every 60 minutes. No browser needed.
 *
 * For every brain_tweets row from the last 7 days that doesn't yet have an
 * attribution row, AND whose author is interesting/hot/explosive:
 *   1. Find the latest brain_account_snapshots row for that author BEFORE the
 *      tweet posted_at (baseline_followers)
 *   2. Find the first snapshot AFTER the tweet posted_at (next_followers)
 *   3. Compute delta_followers = next_followers - baseline_followers
 *   4. Count how many tweets from the same author share the same window,
 *      set attribution_confidence: high (1), medium (2-5), low (>5)
 *   5. Compute attribution_weight: tweet-type base weight × engagement rank
 *      within the window
 *   6. Upsert into brain_tweet_follower_attribution (tweet_id is UNIQUE)
 *
 * Why restricted to growing accounts: per-tweet attribution for dormant accounts
 * is noise. We only care about accounts that are actually moving. This keeps
 * the table signal-dense and query-fast.
 *
 * Why no fixed windows (24h/48h/7d): census cadence varies by growth_status
 * (6h-168h), so fixed windows would be ~70% null. Storing the actual next-
 * snapshot delta + window_hours lets downstream SQL normalize per-day when
 * needed.
 */

import { getSupabaseClient } from '../../db';

const LOG_PREFIX = '[observatory/tweet-attribution]';

// Tweet type weights — originals and threads drive followers; replies rarely do
const TWEET_TYPE_WEIGHT: Record<string, number> = {
  original: 1.0,
  thread: 1.0,
  quote: 0.5,
  reply: 0.1,
};

// Processing bounds
const LOOKBACK_DAYS = 7;
const MAX_TWEETS_PER_RUN = 500;

interface AttributionInput {
  tweet_id: string;
  author_username: string;
  posted_at: string;
  tweet_type: string | null;
  likes: number | null;
  retweets: number | null;
  views: number | null;
}

interface AttributionResult {
  tweet_id: string;
  author_username: string;
  posted_at: string;
  tweet_type: string;
  baseline_snapshot_id: string | null;
  baseline_followers: number | null;
  baseline_checked_at: string | null;
  next_snapshot_id: string | null;
  next_followers: number | null;
  next_checked_at: string | null;
  window_hours: number | null;
  delta_followers: number | null;
  attribution_weight: number;
  attribution_confidence: 'high' | 'medium' | 'low';
}

export async function runTweetAttribution(): Promise<{
  tweets_processed: number;
  attributions_written: number;
  tweets_skipped_no_baseline: number;
  tweets_skipped_no_next: number;
}> {
  const supabase = getSupabaseClient();
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Step 1: Get growing accounts we care about
  const { data: growingAccounts, error: acctErr } = await supabase
    .from('brain_accounts')
    .select('username')
    .in('growth_status', ['interesting', 'hot', 'explosive']);

  if (acctErr || !growingAccounts || growingAccounts.length === 0) {
    console.log(`${LOG_PREFIX} No growing accounts to process (err=${acctErr?.message ?? 'none'})`);
    return { tweets_processed: 0, attributions_written: 0, tweets_skipped_no_baseline: 0, tweets_skipped_no_next: 0 };
  }

  const growingSet = new Set(growingAccounts.map(a => a.username));
  console.log(`${LOG_PREFIX} Processing tweets from ${growingSet.size} growing accounts (last ${LOOKBACK_DAYS}d)`);

  // Step 2: Get already-attributed tweet IDs so we skip them
  const { data: existingAttrs } = await supabase
    .from('brain_tweet_follower_attribution')
    .select('tweet_id')
    .gte('posted_at', cutoff);
  const alreadyAttributed = new Set((existingAttrs ?? []).map(r => r.tweet_id));

  // Step 3: Get tweets to process (scoped to growing accounts)
  // Note: Supabase .in() has limits; batch if needed. For now assume <1000 growing accounts.
  const usernames = Array.from(growingSet);
  const { data: tweets, error: tweetErr } = await supabase
    .from('brain_tweets')
    .select('tweet_id, author_username, posted_at, tweet_type, likes, retweets, views')
    .in('author_username', usernames)
    .gte('posted_at', cutoff)
    .order('posted_at', { ascending: true })
    .limit(MAX_TWEETS_PER_RUN * 2); // room to filter out already-attributed

  if (tweetErr || !tweets) {
    console.error(`${LOG_PREFIX} Tweet fetch error: ${tweetErr?.message}`);
    return { tweets_processed: 0, attributions_written: 0, tweets_skipped_no_baseline: 0, tweets_skipped_no_next: 0 };
  }

  const toProcess: AttributionInput[] = tweets
    .filter(t => !alreadyAttributed.has(t.tweet_id))
    .slice(0, MAX_TWEETS_PER_RUN);

  if (toProcess.length === 0) {
    console.log(`${LOG_PREFIX} Nothing to process — all recent tweets already attributed`);
    return { tweets_processed: 0, attributions_written: 0, tweets_skipped_no_baseline: 0, tweets_skipped_no_next: 0 };
  }

  // Step 4: Group by author so we can compute per-author windows efficiently
  const tweetsByAuthor = new Map<string, AttributionInput[]>();
  for (const t of toProcess) {
    if (!tweetsByAuthor.has(t.author_username)) tweetsByAuthor.set(t.author_username, []);
    tweetsByAuthor.get(t.author_username)!.push(t);
  }

  let tweetsProcessed = 0;
  let attributionsWritten = 0;
  let skippedNoBaseline = 0;
  let skippedNoNext = 0;
  const allResults: AttributionResult[] = [];

  // Step 5: For each author, fetch all their snapshots in the window and process their tweets
  for (const [username, authorTweets] of tweetsByAuthor.entries()) {
    // Get all snapshots for this author covering the tweet window (with a little padding on each side)
    const earliestTweet = authorTweets[0].posted_at;
    const latestTweet = authorTweets[authorTweets.length - 1].posted_at;
    const snapshotStart = new Date(new Date(earliestTweet).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const snapshotEnd = new Date(new Date(latestTweet).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: snapshots } = await supabase
      .from('brain_account_snapshots')
      .select('id, followers_count, checked_at')
      .eq('username', username)
      .gte('checked_at', snapshotStart)
      .lte('checked_at', snapshotEnd)
      .order('checked_at', { ascending: true });

    if (!snapshots || snapshots.length === 0) {
      skippedNoBaseline += authorTweets.length;
      continue;
    }

    // Process each tweet from this author
    for (const tweet of authorTweets) {
      tweetsProcessed += 1;
      const tweetTime = new Date(tweet.posted_at).getTime();

      // Find baseline = latest snapshot BEFORE tweet
      const baseline = [...snapshots].reverse().find(s => new Date(s.checked_at).getTime() <= tweetTime);
      // Find next = first snapshot AFTER tweet
      const next = snapshots.find(s => new Date(s.checked_at).getTime() > tweetTime);

      if (!baseline) {
        skippedNoBaseline += 1;
        continue;
      }
      if (!next) {
        skippedNoNext += 1;
        continue;
      }

      // Count how many tweets from this author share the same window (baseline..next)
      const baselineTime = new Date(baseline.checked_at).getTime();
      const nextTime = new Date(next.checked_at).getTime();
      const windowSharers = authorTweets.filter(t => {
        const tt = new Date(t.posted_at).getTime();
        return tt > baselineTime && tt <= nextTime;
      });

      // Attribution confidence
      let confidence: 'high' | 'medium' | 'low';
      if (windowSharers.length === 1) confidence = 'high';
      else if (windowSharers.length <= 5) confidence = 'medium';
      else confidence = 'low';

      // Attribution weight: tweet-type base × engagement rank within window
      const tweetType = tweet.tweet_type ?? 'original';
      const baseWeight = TWEET_TYPE_WEIGHT[tweetType] ?? 0.3;

      // Rank this tweet's engagement against siblings in the window
      const engagementScore = (tweet.likes ?? 0) + (tweet.retweets ?? 0) * 2;
      const siblingScores = windowSharers.map(t => {
        const weight = TWEET_TYPE_WEIGHT[t.tweet_type ?? 'original'] ?? 0.3;
        const score = (t.likes ?? 0) + (t.retweets ?? 0) * 2;
        return score * weight;
      });
      const thisWeightedScore = engagementScore * baseWeight;
      const totalWeightedScore = siblingScores.reduce((a, b) => a + b, 0);
      const attributionWeight = totalWeightedScore > 0 ? thisWeightedScore / totalWeightedScore : baseWeight;

      const windowHours = (nextTime - baselineTime) / (1000 * 60 * 60);
      const deltaFollowers = (next.followers_count ?? 0) - (baseline.followers_count ?? 0);

      allResults.push({
        tweet_id: tweet.tweet_id,
        author_username: tweet.author_username,
        posted_at: tweet.posted_at,
        tweet_type: tweetType,
        baseline_snapshot_id: baseline.id,
        baseline_followers: baseline.followers_count,
        baseline_checked_at: baseline.checked_at,
        next_snapshot_id: next.id,
        next_followers: next.followers_count,
        next_checked_at: next.checked_at,
        window_hours: windowHours,
        delta_followers: deltaFollowers,
        attribution_weight: attributionWeight,
        attribution_confidence: confidence,
      });
    }
  }

  // Step 6: Bulk upsert results (onConflict=tweet_id)
  if (allResults.length > 0) {
    // Chunk to avoid payload size issues
    for (let i = 0; i < allResults.length; i += 100) {
      const chunk = allResults.slice(i, i + 100);
      const { error: upsertErr } = await supabase
        .from('brain_tweet_follower_attribution')
        .upsert(chunk, { onConflict: 'tweet_id' });
      if (upsertErr) {
        console.error(`${LOG_PREFIX} Upsert error on chunk: ${upsertErr.message}`);
      } else {
        attributionsWritten += chunk.length;
      }
    }
  }

  console.log(
    `${LOG_PREFIX} Processed ${tweetsProcessed} tweets, wrote ${attributionsWritten} attributions ` +
    `(skipped ${skippedNoBaseline} no-baseline, ${skippedNoNext} no-next)`
  );

  return {
    tweets_processed: tweetsProcessed,
    attributions_written: attributionsWritten,
    tweets_skipped_no_baseline: skippedNoBaseline,
    tweets_skipped_no_next: skippedNoNext,
  };
}
