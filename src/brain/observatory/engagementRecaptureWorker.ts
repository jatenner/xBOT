/**
 * External-Tweet Engagement Recapture Worker
 *
 * Captures the engagement *curve* of S/A-tier accounts' tweets at log-spaced
 * ages (5m, 15m, 1h, 6h, 24h, 7d). The curve is the unit of analysis every
 * cascade-prediction paper uses (Cheng et al. 2014, SEISMIC, TiDeH/Hawkes).
 *
 * Without per-tweet curves we can only see terminal counts — we can't
 * distinguish "this tweet broke out fast" from "this tweet drifted up
 * slowly", and we can't fit cascade-growth models that predict final size
 * from a 1-hour observation window.
 *
 * Architecture mirrors the velocity-snapshot worker (sprint Phase 2D) but
 * extends to external tweets. Producer enqueues 6 rows per fresh tweet.
 * Worker polls every 60s, claims due rows, captures metrics via brainGoto,
 * computes per-bucket velocity vs the previous bucket, writes to
 * brain_tweet_engagement_snapshots, deletes the queue row.
 *
 * Crash-safe: claim-and-reclaim semantics. Bucket-on-late-fire: the row's
 * age_bucket IS the bucket — a worker firing 12min late on a 5m row still
 * writes to the 5m bucket, preserving causal interpretability.
 *
 * Producer side lives in discoveryEngine.ts:ingestFeedResults — for new
 * tweets posted in the last 90min from S/A-tier accounts, enqueue 6 rows.
 */
import { getSupabaseClient } from '../../db/index';
import { submitBatch } from '../feeds/brainBrowserPool';
import { brainGoto } from '../feeds/brainNavigator';
import { extractTweetsFromPage } from '../discoveryEngine';
import type { Page } from 'playwright';

const LOG_PREFIX = '[brain/observatory/engagement-recapture]';

const MAX_TWEETS_PER_RUN = 25;
const RECLAIM_AFTER_MS = 2 * 60 * 1000;
const PER_PAGE_TIMEOUT_MS = 25000;

const AGE_BUCKETS = ['5m', '15m', '1h', '6h', '24h', '7d'] as const;
type AgeBucket = (typeof AGE_BUCKETS)[number];

const BUCKET_MINUTES: Record<AgeBucket, number> = {
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '6h': 360,
  '24h': 1440,
  '7d': 10080,
};

interface DueRow {
  id: string;
  tweet_id: string;
  age_bucket: AgeBucket;
  attempts: number;
}

export async function runEngagementRecaptureWorker(): Promise<{
  tweets_processed: number;
  rows_completed: number;
  rows_errored: number;
  rows_reclaimed: number;
}> {
  const supabase = getSupabaseClient();
  const now = new Date();

  // Reclaim stale claims from a crashed worker.
  const reclaimCutoff = new Date(now.getTime() - RECLAIM_AFTER_MS).toISOString();
  const { data: reclaimed } = await supabase
    .from('pending_engagement_recaptures')
    .update({ claimed_at: null })
    .lt('claimed_at', reclaimCutoff)
    .select('id');
  const rowsReclaimed = reclaimed?.length ?? 0;

  // Pull due rows. Prefer S-tier > A-tier > others via account_tier snapshot
  // recorded at enqueue time. Within the same priority, oldest-due-first.
  const { data: dueRows, error: selectErr } = await supabase
    .from('pending_engagement_recaptures')
    .select('id, tweet_id, age_bucket, attempts')
    .lte('due_at', now.toISOString())
    .is('claimed_at', null)
    .order('account_tier', { ascending: true, nullsFirst: false }) // S < A < B alphabetically
    .order('due_at', { ascending: true })
    .limit(MAX_TWEETS_PER_RUN * 3);

  if (selectErr) {
    console.error(`${LOG_PREFIX} select due failed: ${selectErr.message}`);
    return { tweets_processed: 0, rows_completed: 0, rows_errored: 0, rows_reclaimed: rowsReclaimed };
  }

  if (!dueRows || dueRows.length === 0) {
    return { tweets_processed: 0, rows_completed: 0, rows_errored: 0, rows_reclaimed: rowsReclaimed };
  }

  // Group rows by tweet_id — one navigation, fulfill all due buckets.
  const byTweet = new Map<string, DueRow[]>();
  for (const row of dueRows as DueRow[]) {
    const arr = byTweet.get(row.tweet_id) ?? [];
    arr.push(row);
    byTweet.set(row.tweet_id, arr);
  }
  const tweetIds = Array.from(byTweet.keys()).slice(0, MAX_TWEETS_PER_RUN);
  const claimedIds = tweetIds.flatMap(id => byTweet.get(id)!.map(r => r.id));

  await supabase
    .from('pending_engagement_recaptures')
    .update({ claimed_at: now.toISOString() })
    .in('id', claimedIds);

  // Fetch author_username for navigation. The recapture queue doesn't store
  // authors, so we look them up from brain_tweets.
  const { data: tweetMeta } = await supabase
    .from('brain_tweets')
    .select('tweet_id, author_username')
    .in('tweet_id', tweetIds);
  const metaByTweet = new Map<string, string>(
    (tweetMeta ?? [])
      .filter((r: any) => r.author_username)
      .map((r: any) => [r.tweet_id as string, r.author_username as string]),
  );

  // Previous-bucket lookup — we need it to compute per-minute velocity.
  // Fetch the prior snapshot rows for these tweets in one query.
  const { data: priorSnaps } = await supabase
    .from('brain_tweet_engagement_snapshots')
    .select('tweet_id, age_bucket, captured_at, likes, replies')
    .in('tweet_id', tweetIds);
  const priorByTweet = new Map<string, any[]>();
  for (const r of priorSnaps ?? []) {
    const arr = priorByTweet.get((r as any).tweet_id) ?? [];
    arr.push(r);
    priorByTweet.set((r as any).tweet_id, arr);
  }

  let rowsCompleted = 0;
  let rowsErrored = 0;
  const startedAt = Date.now();

  const tasks = tweetIds.map(tweetId => async (page: Page) => {
    const dueForThisTweet = byTweet.get(tweetId)!;
    const author = metaByTweet.get(tweetId);

    if (!author) {
      await markRowsError(supabase, dueForThisTweet, 'author missing');
      rowsErrored += dueForThisTweet.length;
      return;
    }

    const url = `https://x.com/${author}/status/${tweetId}`;
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

    const tweets = await extractTweetsFromPage(page, { maxTweets: 1, skipReplies: false });
    const current = tweets.length > 0 ? tweets[0] : null;
    if (!current || current.tweet_id !== tweetId) {
      await markRowsError(supabase, dueForThisTweet, 'extract failed');
      rowsErrored += dueForThisTweet.length;
      return;
    }

    const capturedAtIso = new Date().toISOString();
    const priorSnaps = priorByTweet.get(tweetId) ?? [];

    // Build snapshot rows for each due bucket. Velocity = delta vs prior snapshot.
    const snapshotRows = dueForThisTweet.map(row => {
      const prior = priorSnaps
        .filter((p: any) => BUCKET_MINUTES[p.age_bucket as AgeBucket] < BUCKET_MINUTES[row.age_bucket])
        .sort((a: any, b: any) => BUCKET_MINUTES[b.age_bucket as AgeBucket] - BUCKET_MINUTES[a.age_bucket as AgeBucket])[0];

      let likesPerMin: number | null = null;
      let repliesPerMin: number | null = null;
      if (prior) {
        const elapsedMin = BUCKET_MINUTES[row.age_bucket] - BUCKET_MINUTES[prior.age_bucket as AgeBucket];
        if (elapsedMin > 0) {
          likesPerMin = Math.round(((current.likes ?? 0) - (prior.likes ?? 0)) / elapsedMin * 1000) / 1000;
          repliesPerMin = Math.round(((current.replies ?? 0) - (prior.replies ?? 0)) / elapsedMin * 1000) / 1000;
        }
      }

      return {
        tweet_id: tweetId,
        age_bucket: row.age_bucket,
        captured_at: capturedAtIso,
        age_minutes_actual: BUCKET_MINUTES[row.age_bucket], // approximation; producer pinned the bucket
        likes: current.likes ?? 0,
        retweets: current.retweets ?? 0,
        replies: current.replies ?? 0,
        bookmarks: current.bookmarks ?? 0,
        quotes: current.quotes ?? 0,
        views: current.views ?? null,
        likes_per_minute: likesPerMin,
        replies_per_minute: repliesPerMin,
      };
    });

    const { error: insertErr } = await supabase
      .from('brain_tweet_engagement_snapshots')
      .upsert(snapshotRows, { onConflict: 'tweet_id,age_bucket', ignoreDuplicates: true });
    if (insertErr) {
      await markRowsError(supabase, dueForThisTweet, `insert: ${insertErr.message}`);
      rowsErrored += dueForThisTweet.length;
      return;
    }

    // Delete the claimed queue rows on success.
    const { error: deleteErr } = await supabase
      .from('pending_engagement_recaptures')
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
      `${LOG_PREFIX} ${tweetIds.length} tweets — ${rowsCompleted} rows ok, ` +
      `${rowsErrored} errored, ${rowsReclaimed} reclaimed, ${elapsedSec}s`,
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
  for (const row of rows) {
    await supabase
      .from('pending_engagement_recaptures')
      .update({
        claimed_at: null,
        attempts: row.attempts + 1,
        last_error: msg.substring(0, 200),
      })
      .eq('id', row.id);
  }
}
