/**
 * Velocity Snapshot Worker
 *
 * Captures the algorithm's first-distribution-window velocity — the only window
 * that materially affects how widely a tweet is distributed (+5m / +15m / +60m).
 *
 * Reads due rows from `pending_velocity_snapshots`, navigates to each tweet,
 * captures current metrics, computes velocity_{N}m vs first_scrape baseline,
 * writes to brain_tweets, also writes a brain_tweet_snapshots row, deletes
 * the queue row.
 *
 * Design notes:
 * - target_offset_min IS the bucket. A late firing (worker behind by 12min on
 *   a +5m row) still writes to velocity_5m — the intended bucket.
 * - claim-and-reclaim semantics: claimed_at older than 2min is reclaimable,
 *   handles crashed/restarted workers without losing snapshots.
 * - One browser task per tweet — visit once, fulfill ALL due offsets that
 *   tweet has, write atomically.
 */
import { getSupabaseClient } from '../../db';
import { submitBatch } from '../feeds/brainBrowserPool';
import { brainGoto } from '../feeds/brainNavigator';
import { extractTweetsFromPage } from '../discoveryEngine';
import type { Page } from 'playwright';

const LOG_PREFIX = '[brain/observatory/velocity-worker]';

const MAX_TWEETS_PER_RUN = 30;
const RECLAIM_AFTER_MS = 2 * 60 * 1000;
const PER_PAGE_TIMEOUT_MS = 25000;

interface DueRow {
  id: string;
  tweet_id: string;
  target_offset_min: number;
  attempts: number;
}

export async function runVelocitySnapshotWorker(): Promise<{
  tweets_processed: number;
  rows_completed: number;
  rows_errored: number;
  rows_reclaimed: number;
}> {
  const supabase = getSupabaseClient();
  const now = new Date();

  // Reclaim stale claims — worker died mid-task or container restarted.
  const reclaimCutoffIso = new Date(now.getTime() - RECLAIM_AFTER_MS).toISOString();
  const { data: reclaimed } = await supabase
    .from('pending_velocity_snapshots')
    .update({ claimed_at: null })
    .lt('claimed_at', reclaimCutoffIso)
    .select('id');
  const rowsReclaimed = reclaimed?.length ?? 0;

  // Pull due rows.
  const { data: dueRows, error: selectErr } = await supabase
    .from('pending_velocity_snapshots')
    .select('id, tweet_id, target_offset_min, attempts')
    .lte('due_at', now.toISOString())
    .is('claimed_at', null)
    .order('due_at', { ascending: true })
    .limit(MAX_TWEETS_PER_RUN * 3); // up to 3 offsets per tweet

  if (selectErr) {
    console.error(`${LOG_PREFIX} select due failed: ${selectErr.message}`);
    return { tweets_processed: 0, rows_completed: 0, rows_errored: 0, rows_reclaimed: rowsReclaimed };
  }

  if (!dueRows || dueRows.length === 0) {
    return { tweets_processed: 0, rows_completed: 0, rows_errored: 0, rows_reclaimed: rowsReclaimed };
  }

  // Group by tweet_id — one navigation per tweet, fulfill all its due offsets.
  const byTweet = new Map<string, DueRow[]>();
  for (const row of dueRows as DueRow[]) {
    const arr = byTweet.get(row.tweet_id) ?? [];
    arr.push(row);
    byTweet.set(row.tweet_id, arr);
  }
  // Cap distinct tweets per run.
  const tweetIds = Array.from(byTweet.keys()).slice(0, MAX_TWEETS_PER_RUN);
  const claimedRows = tweetIds.flatMap(id => byTweet.get(id)!);

  // Mark all claimed rows.
  await supabase
    .from('pending_velocity_snapshots')
    .update({ claimed_at: now.toISOString() })
    .in('id', claimedRows.map(r => r.id));

  // Per-tweet metadata for navigation + baseline.
  const { data: tweetRows } = await supabase
    .from('brain_tweets')
    .select('tweet_id, author_username, first_scrape_likes, first_scrape_at, likes, posted_at')
    .in('tweet_id', tweetIds);
  const tweetMeta = new Map<string, any>(
    (tweetRows ?? []).map((r: any) => [r.tweet_id, r]),
  );

  let rowsCompleted = 0;
  let rowsErrored = 0;
  const startedAt = Date.now();

  const tasks = tweetIds.map(tweetId => async (page: Page) => {
    const dueForThisTweet = byTweet.get(tweetId)!;
    const meta = tweetMeta.get(tweetId);

    if (!meta || !meta.author_username) {
      await markRowsError(supabase, dueForThisTweet, 'tweet metadata missing');
      rowsErrored += dueForThisTweet.length;
      return;
    }

    const url = `https://x.com/${meta.author_username}/status/${tweetId}`;
    const nav = await brainGoto(page, url, PER_PAGE_TIMEOUT_MS);
    if (!nav.success) {
      await markRowsError(supabase, dueForThisTweet, 'nav failed');
      rowsErrored += dueForThisTweet.length;
      return;
    }

    try {
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
    } catch {
      await markRowsError(supabase, dueForThisTweet, 'no article');
      rowsErrored += dueForThisTweet.length;
      return;
    }

    // Reuse the existing single-tweet extractor to get current metrics.
    const tweets = await extractTweetsFromPage(page, { maxTweets: 1, skipReplies: false });
    const current = tweets.length > 0 ? tweets[0] : null;
    if (!current || current.tweet_id !== tweetId) {
      await markRowsError(supabase, dueForThisTweet, 'extract failed');
      rowsErrored += dueForThisTweet.length;
      return;
    }

    const baselineLikes: number = meta.first_scrape_likes ?? meta.likes ?? 0;
    const updates: Record<string, any> = {
      last_rescrape_at: new Date().toISOString(),
    };

    for (const row of dueForThisTweet) {
      const offset = row.target_offset_min;
      const delta = (current.likes ?? 0) - baselineLikes;
      // velocity = delta / offset minutes — likes per minute over the window
      const velocity = offset > 0 ? delta / offset : 0;
      const rounded = Math.round(velocity * 1000) / 1000;
      updates[`velocity_${offset}m`] = rounded;
    }

    // Write velocity onto the tweet.
    const { error: tweetUpdateErr } = await supabase
      .from('brain_tweets')
      .update(updates)
      .eq('tweet_id', tweetId);
    if (tweetUpdateErr) {
      await markRowsError(supabase, dueForThisTweet, `tweet update: ${tweetUpdateErr.message}`);
      rowsErrored += dueForThisTweet.length;
      return;
    }

    // Add a snapshot row for the trajectory store. Reuses the same convention
    // as the rescrape job — the rescrape job will skip this tweet if recent.
    await supabase
      .from('brain_tweet_snapshots')
      .insert({
        tweet_id: tweetId,
        likes: current.likes ?? 0,
        views: current.views ?? null,
        retweets: current.retweets ?? 0,
        replies: current.replies ?? 0,
        bookmarks: current.bookmarks ?? 0,
        quotes: current.quotes ?? 0,
      });

    // Delete the claimed queue rows on success.
    const { error: deleteErr } = await supabase
      .from('pending_velocity_snapshots')
      .delete()
      .in('id', dueForThisTweet.map(r => r.id));
    if (deleteErr) {
      console.warn(`${LOG_PREFIX} delete queue rows failed: ${deleteErr.message}`);
    }

    rowsCompleted += dueForThisTweet.length;
  });

  await submitBatch('low', tasks);

  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  if (rowsCompleted > 0 || rowsErrored > 0 || rowsReclaimed > 0) {
    console.log(
      `${LOG_PREFIX} ${tweetIds.length} tweets — ${rowsCompleted} rows ok, ${rowsErrored} errored, ${rowsReclaimed} reclaimed, ${elapsedSec}s`,
    );
  }

  return {
    tweets_processed: tweetIds.length,
    rows_completed: rowsCompleted,
    rows_errored: rowsErrored,
    rows_reclaimed: rowsReclaimed,
  };
}

async function markRowsError(
  supabase: any,
  rows: DueRow[],
  msg: string,
): Promise<void> {
  // Release the claim and bump attempts. After enough attempts, downstream
  // analytics can ignore zombies via the attempts column. We don't auto-delete
  // because a transient X outage shouldn't lose intent.
  for (const row of rows) {
    await supabase
      .from('pending_velocity_snapshots')
      .update({
        claimed_at: null,
        attempts: row.attempts + 1,
        last_error: msg.substring(0, 200),
      })
      .eq('id', row.id);
  }
}
