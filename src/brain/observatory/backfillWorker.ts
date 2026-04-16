/**
 * Backfill Worker — historical deep-scrape for accounts that crossed growth thresholds.
 *
 * Reads one row at a time from `brain_backfill_queue`. For each row:
 *   1. Loads profile with authed context (for /with_replies depth) — falls back
 *      to anonymous if session unavailable.
 *   2. Scrolls the profile in batches, extracting tweets after each batch.
 *   3. Stops when oldest extracted tweet is older than target_date_cutoff,
 *      or when hard caps are reached (MAX_TWEETS, MAX_SCROLLS, MAX_DURATION_MS).
 *   4. Upserts captured tweets via ingestFeedResults (DB handles dedup).
 *   5. Marks the queue row done/failed.
 *
 * Runs every 30 min. Processes one account per run to keep latency bounded and
 * avoid stacking long scroll sessions behind each other.
 */

import { getSupabaseClient } from '../../db';
import { getBrainPage, getBrainAuthPage, brainGoto, waitForTweets } from '../feeds/brainNavigator';
import { extractTweetsFromPage, ingestFeedResults, type FeedResult } from '../discoveryEngine';

const LOG_PREFIX = '[observatory/backfill]';

const MAX_TWEETS_PER_BACKFILL = 500;
const MAX_SCROLLS = 50;
const MAX_DURATION_MS = 20 * 60 * 1000; // 20 minutes
const SCROLL_BATCH_SIZE = 5;
const SCROLL_DELAY_MS = 1500;
const MAX_ATTEMPTS = 3;

interface BackfillQueueRow {
  id: string;
  username: string;
  from_stage: string;
  to_stage: string;
  target_date_cutoff: string | null;
  attempt_count: number;
}

export async function runBackfillWorker(): Promise<{
  processed: number;
  tweets_captured: number;
  status: 'done' | 'failed' | 'idle';
}> {
  const supabase = getSupabaseClient();

  // Pull the oldest pending row (or a failed row due for retry)
  const { data: pending, error: queueErr } = await supabase
    .from('brain_backfill_queue')
    .select('id, username, from_stage, to_stage, target_date_cutoff, attempt_count')
    .eq('status', 'pending')
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(1);

  if (queueErr) {
    console.error(`${LOG_PREFIX} Queue query failed: ${queueErr.message}`);
    return { processed: 0, tweets_captured: 0, status: 'failed' };
  }

  const row = (pending ?? [])[0] as BackfillQueueRow | undefined;
  if (!row) {
    return { processed: 0, tweets_captured: 0, status: 'idle' };
  }

  // Claim the row
  await supabase
    .from('brain_backfill_queue')
    .update({
      status: 'in_progress',
      attempt_count: row.attempt_count + 1,
      last_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  console.log(
    `${LOG_PREFIX} Starting backfill for @${row.username} ` +
      `(${row.from_stage}→${row.to_stage}, cutoff=${row.target_date_cutoff ?? 'none'})`,
  );

  const cutoffMs = row.target_date_cutoff ? new Date(row.target_date_cutoff).getTime() : 0;
  const startedAt = Date.now();

  let page: any = null;
  let usingAuth = false;
  try {
    try {
      page = await getBrainAuthPage();
      usingAuth = true;
    } catch {
      page = await getBrainPage();
      usingAuth = false;
    }

    const profileUrl = `https://x.com/${row.username}${usingAuth ? '/with_replies' : ''}`;
    const nav = await brainGoto(page, profileUrl);

    if (nav.loginWall && usingAuth) {
      // Auth session dead — retry with anon on main profile
      try { await page.close(); } catch {}
      page = await getBrainPage();
      usingAuth = false;
      const anonNav = await brainGoto(page, `https://x.com/${row.username}`);
      if (!anonNav.success) {
        return await markFailed(supabase, row.id, 'Nav failed after auth fallback', 0);
      }
    } else if (!nav.success) {
      return await markFailed(supabase, row.id, 'Navigation failed', 0);
    }

    const initialTweets = await waitForTweets(page, 10000);
    if (initialTweets === 0) {
      return await markFailed(supabase, row.id, 'No tweets loaded', 0);
    }

    // Scroll in batches, extracting and checking cutoff after each batch.
    let capturedMap = new Map<string, any>();
    let scrolls = 0;
    let stopReason = 'unknown';

    while (true) {
      if (scrolls >= MAX_SCROLLS) { stopReason = 'max_scrolls'; break; }
      if (Date.now() - startedAt > MAX_DURATION_MS) { stopReason = 'max_duration'; break; }
      if (capturedMap.size >= MAX_TWEETS_PER_BACKFILL) { stopReason = 'max_tweets'; break; }

      // Scroll one batch
      for (let s = 0; s < SCROLL_BATCH_SIZE; s++) {
        await page.evaluate('window.scrollBy(0, 1200)');
        await page.waitForTimeout(SCROLL_DELAY_MS);
        scrolls++;
        if (scrolls >= MAX_SCROLLS) break;
      }

      // Extract current DOM state
      const visible = await extractTweetsFromPage(page, {
        maxTweets: MAX_TWEETS_PER_BACKFILL,
        skipReplies: false,
      });

      for (const t of visible) {
        if (t.tweet_id && !capturedMap.has(t.tweet_id)) {
          capturedMap.set(t.tweet_id, t);
        }
      }

      // Check cutoff — oldest visible tweet older than cutoff means we're done
      const oldestMs = oldestTweetMs(visible);
      if (cutoffMs > 0 && oldestMs > 0 && oldestMs < cutoffMs) {
        stopReason = 'reached_cutoff';
        break;
      }

      // If no new tweets loaded after a full batch, Twitter stopped paginating
      if (scrolls > SCROLL_BATCH_SIZE && visible.length < capturedMap.size) {
        // DOM lost some tweets as we scrolled past them — that's fine,
        // we've accumulated them in capturedMap. Keep going.
      }
    }

    const captured = Array.from(capturedMap.values());
    for (const t of captured) {
      t.author_username = row.username;
    }

    let tweetsIngested = 0;
    if (captured.length > 0) {
      const feedResult: FeedResult = {
        source: 'backfill',
        feed_run_id: `backfill_${row.id}`,
        tweets: captured,
      };
      const ingested = await ingestFeedResults([feedResult]);
      tweetsIngested = ingested.total_ingested;
    }

    await supabase
      .from('brain_backfill_queue')
      .update({
        status: 'done',
        tweets_captured: captured.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    console.log(
      `${LOG_PREFIX} @${row.username} done: ${captured.length} tweets captured ` +
        `(${tweetsIngested} newly ingested), stop=${stopReason}, scrolls=${scrolls}, ` +
        `auth=${usingAuth}`,
    );

    return { processed: 1, tweets_captured: captured.length, status: 'done' };
  } catch (err: any) {
    return await markFailed(supabase, row.id, err.message ?? String(err), 0);
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
  }
}

function oldestTweetMs(tweets: any[]): number {
  let oldest = Number.MAX_SAFE_INTEGER;
  for (const t of tweets) {
    if (t.posted_at) {
      const ms = new Date(t.posted_at).getTime();
      if (Number.isFinite(ms) && ms < oldest) oldest = ms;
    }
  }
  return oldest === Number.MAX_SAFE_INTEGER ? 0 : oldest;
}

async function markFailed(
  supabase: any,
  id: string,
  reason: string,
  tweetsCaptured: number,
): Promise<{ processed: number; tweets_captured: number; status: 'failed' }> {
  console.warn(`${LOG_PREFIX} Backfill failed (id=${id}): ${reason}`);
  await supabase
    .from('brain_backfill_queue')
    .update({
      status: 'pending', // Allow retry (bounded by MAX_ATTEMPTS on next query)
      last_error: reason,
      tweets_captured: tweetsCaptured,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  return { processed: 1, tweets_captured: tweetsCaptured, status: 'failed' };
}
