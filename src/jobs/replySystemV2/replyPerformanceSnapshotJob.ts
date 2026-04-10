/**
 * Reply Performance Learning V1: collect metrics snapshots for posted replies.
 * Checkpoints: 30m, 2h, 24h, 72h. Idempotent; uses existing metrics or optional scrape.
 *
 * Optional fallback: set REPLY_PERF_SNAPSHOT_SCRAPE_FALLBACK=true and RUNNER_MODE=true
 * to attempt browser scrape for due checkpoints with no metrics (best-effort, one scrape per tweet_id).
 */

import { getSupabaseClient } from '../../db/index';

const CHECKPOINT_MINUTES = [30, 120, 1440, 4320]; // 30m, 2h, 24h, 72h

const FALLBACK_ENABLED =
  process.env.REPLY_PERF_SNAPSHOT_SCRAPE_FALLBACK === 'true' && process.env.RUNNER_MODE === 'true';

export interface SnapshotRow {
  reply_execution_event_id: string;
  our_reply_tweet_id: string;
  snapshot_at: string;
  minutes_since_post: number;
  impressions: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  bookmarks: number | null;
  engagement_rate: number | null;
  scrape_status: string;
  raw_metrics_json: Record<string, unknown>;
}

/**
 * Find reply_execution_events that have due checkpoints without a snapshot.
 * Returns { event_id, our_reply_tweet_id, posted_at, minutes_since_post }[].
 */
async function getDueCheckpoints(supabase: ReturnType<typeof getSupabaseClient>, limit: number): Promise<Array<{
  id: string;
  our_reply_tweet_id: string;
  posted_at: string;
  minutes_since_post: number;
}>> {
  const now = new Date();
  const nowMs = now.getTime();
  const due: Array<{ id: string; our_reply_tweet_id: string; posted_at: string; minutes_since_post: number }> = [];

  const { data: events } = await supabase
    .from('reply_execution_events')
    .select('id, our_reply_tweet_id, posted_at')
    .eq('dry_run', false)
    .not('posted_at', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(500);

  if (!events?.length) return due;

  const { data: existing } = await supabase
    .from('reply_performance_snapshots')
    .select('reply_execution_event_id, minutes_since_post')
    .in('reply_execution_event_id', events.map((e: any) => e.id));

  const existingSet = new Set(
    (existing || []).map((r: any) => `${r.reply_execution_event_id}:${r.minutes_since_post}`)
  );

  for (const ev of events) {
    const postedAt = new Date(ev.posted_at).getTime();
    for (const mins of CHECKPOINT_MINUTES) {
      const checkpointAt = postedAt + mins * 60 * 1000;
      if (checkpointAt > nowMs) continue;
      if (existingSet.has(`${ev.id}:${mins}`)) continue;
      due.push({
        id: ev.id,
        our_reply_tweet_id: ev.our_reply_tweet_id,
        posted_at: ev.posted_at,
        minutes_since_post: mins,
      });
      if (due.length >= limit) return due;
    }
  }
  return due;
}

export type MetricsResult = {
  impressions?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  bookmarks?: number;
  engagement_rate?: number;
} | null;

/**
 * Try to get metrics for a reply tweet from content_metadata or outcomes.
 */
async function getExistingMetrics(
  supabase: ReturnType<typeof getSupabaseClient>,
  ourReplyTweetId: string
): Promise<MetricsResult> {
  const { data: cm } = await supabase
    .from('content_metadata')
    .select('actual_impressions, actual_likes, actual_replies, actual_retweets, actual_engagement_rate')
    .eq('tweet_id', ourReplyTweetId)
    .maybeSingle();

  if (cm) {
    return {
      impressions: typeof cm.actual_impressions === 'number' ? cm.actual_impressions : undefined,
      likes: typeof cm.actual_likes === 'number' ? cm.actual_likes : undefined,
      replies: typeof cm.actual_replies === 'number' ? cm.actual_replies : undefined,
      reposts: typeof cm.actual_retweets === 'number' ? cm.actual_retweets : undefined,
      engagement_rate: typeof cm.actual_engagement_rate === 'number' ? cm.actual_engagement_rate : undefined,
    };
  }

  const { data: outcome } = await supabase
    .from('outcomes')
    .select('impressions, likes, replies, retweets, bookmarks, engagement_rate')
    .eq('tweet_id', ourReplyTweetId)
    .order('collected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (outcome) {
    return {
      impressions: outcome.impressions ?? undefined,
      likes: outcome.likes ?? undefined,
      replies: outcome.replies ?? undefined,
      reposts: outcome.retweets ?? undefined,
      bookmarks: outcome.bookmarks ?? undefined,
      engagement_rate: outcome.engagement_rate ?? undefined,
    };
  }
  return null;
}

/**
 * Optional fallback: scrape one reply tweet via browser. Best-effort; returns null on any failure.
 * Only call when REPLY_PERF_SNAPSHOT_SCRAPE_FALLBACK=true and RUNNER_MODE=true.
 */
async function scrapeReplyMetricsFallback(tweetId: string): Promise<{
  metrics: MetricsResult;
  raw: Record<string, unknown>;
  status: 'ok' | 'partial' | 'failed';
}> {
  try {
    const { UnifiedBrowserPool } = await import('../../browser/UnifiedBrowserPool');
    const { BulletproofTwitterScraper } = await import('../../scrapers/bulletproofTwitterScraper');
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('reply_perf_snapshot_fallback');
    try {
      const scraper = BulletproofTwitterScraper.getInstance();
      const result = await scraper.scrapeTweetMetrics(page, tweetId, 1, {
        isReply: true,
        useAnalytics: false,
        tweetUrl: `https://x.com/i/status/${tweetId}`,
      });
      if (!result.success || !result.metrics) {
        return {
          metrics: null,
          raw: { source: 'scrape_fallback', error: result.error || 'no metrics' },
          status: 'failed',
        };
      }
      const m = result.metrics;
      const totalEngagement = (m.likes || 0) + (m.replies || 0) + (m.retweets || 0);
      const engagement_rate = m.views && m.views > 0 ? totalEngagement / m.views : undefined;
      const metrics: NonNullable<MetricsResult> = {
        impressions: m.views ?? undefined,
        likes: m.likes ?? undefined,
        replies: m.replies ?? undefined,
        reposts: m.retweets ?? undefined,
        bookmarks: m.bookmarks ?? undefined,
        engagement_rate,
      };
      const hasAny = metrics.impressions != null || metrics.likes != null || metrics.replies != null || metrics.reposts != null;
      return {
        metrics,
        raw: { source: 'scrape_fallback', ...m, engagement_rate },
        status: hasAny ? (metrics.impressions != null || metrics.engagement_rate != null ? 'ok' : 'partial') : 'failed',
      };
    } finally {
      await pool.releasePage(page);
    }
  } catch (e: any) {
    console.warn(`[REPLY_PERF_SNAPSHOT] scrape_fallback tweet_id=${tweetId} error=${e?.message ?? e}`);
    return {
      metrics: null,
      raw: { source: 'scrape_fallback', error: e?.message ?? String(e) },
      status: 'failed',
    };
  }
}

/**
 * Insert one snapshot row. Idempotent via UNIQUE (reply_execution_event_id, minutes_since_post).
 */
async function insertSnapshot(
  supabase: ReturnType<typeof getSupabaseClient>,
  row: SnapshotRow
): Promise<boolean> {
  const { error } = await supabase.from('reply_performance_snapshots').insert({
    reply_execution_event_id: row.reply_execution_event_id,
    our_reply_tweet_id: row.our_reply_tweet_id,
    snapshot_at: row.snapshot_at,
    minutes_since_post: row.minutes_since_post,
    impressions: row.impressions,
    likes: row.likes,
    replies: row.replies,
    reposts: row.reposts,
    bookmarks: row.bookmarks,
    engagement_rate: row.engagement_rate,
    scrape_status: row.scrape_status,
    raw_metrics_json: row.raw_metrics_json,
  });
  if (error) {
    if (error.code === '23505') return true; // duplicate, idempotent
    throw error;
  }
  return true;
}

/**
 * Run the reply performance snapshot job: find due checkpoints, fill from existing metrics or (optional) scrape fallback, or mark pending.
 */
export async function runReplyPerformanceSnapshotJob(options?: { maxSnapshots?: number }): Promise<{
  due: number;
  inserted: number;
  failed: number;
  coverage: Record<string, number>;
  fallback_used?: number;
}> {
  const supabase = getSupabaseClient();
  const maxSnapshots = options?.maxSnapshots ?? 50;
  const coverage: Record<string, number> = { '30m': 0, '2h': 0, '24h': 0, '72h': 0 };
  let fallbackUsed = 0;

  const due = await getDueCheckpoints(supabase, maxSnapshots);
  console.log(`[REPLY_PERF_SNAPSHOT] due_checkpoints=${due.length} fallback_enabled=${FALLBACK_ENABLED}`);

  // Group by our_reply_tweet_id so we only lookup/scrape once per tweet
  const byTweetId = new Map<string, typeof due>();
  for (const d of due) {
    const list = byTweetId.get(d.our_reply_tweet_id) || [];
    list.push(d);
    byTweetId.set(d.our_reply_tweet_id, list);
  }

  let inserted = 0;
  let failed = 0;

  for (const [tweetId, checkpoints] of byTweetId) {
    let metrics: MetricsResult = await getExistingMetrics(supabase, tweetId);
    let scrape_status: string;
    let raw_metrics_json: Record<string, unknown>;

    if (metrics) {
      const hasAny =
        metrics.impressions != null ||
        metrics.likes != null ||
        metrics.replies != null ||
        metrics.reposts != null ||
        metrics.bookmarks != null ||
        metrics.engagement_rate != null;
      scrape_status = hasAny ? (metrics.impressions != null || metrics.engagement_rate != null ? 'ok' : 'partial') : 'pending';
      raw_metrics_json = { source: 'content_metadata_or_outcomes', ...metrics };
    } else if (FALLBACK_ENABLED) {
      const scraped = await scrapeReplyMetricsFallback(tweetId);
      metrics = scraped.metrics;
      scrape_status = scraped.status;
      raw_metrics_json = scraped.raw;
      if (scraped.status !== 'failed') fallbackUsed++;
    } else {
      scrape_status = 'pending';
      raw_metrics_json = {};
    }

    for (const d of checkpoints) {
      try {
        const snapshotAt = new Date(new Date(d.posted_at).getTime() + d.minutes_since_post * 60 * 1000).toISOString();
        await insertSnapshot(supabase, {
          reply_execution_event_id: d.id,
          our_reply_tweet_id: d.our_reply_tweet_id,
          snapshot_at: snapshotAt,
          minutes_since_post: d.minutes_since_post,
          impressions: metrics?.impressions ?? null,
          likes: metrics?.likes ?? null,
          replies: metrics?.replies ?? null,
          reposts: metrics?.reposts ?? null,
          bookmarks: metrics?.bookmarks ?? null,
          engagement_rate: metrics?.engagement_rate ?? null,
          scrape_status,
          raw_metrics_json,
        });
        inserted++;
        const key = d.minutes_since_post === 30 ? '30m' : d.minutes_since_post === 120 ? '2h' : d.minutes_since_post === 1440 ? '24h' : '72h';
        coverage[key] = (coverage[key] || 0) + 1;
      } catch (e: any) {
        failed++;
        console.warn(`[REPLY_PERF_SNAPSHOT] failed event_id=${d.id} mins=${d.minutes_since_post}: ${e?.message ?? e}`);
      }
    }
  }

  if (fallbackUsed > 0) {
    console.log(`[REPLY_PERF_SNAPSHOT] fallback_used=${fallbackUsed} tweet_ids`);
  }
  console.log(`[REPLY_PERF_SNAPSHOT] inserted=${inserted} failed=${failed} coverage=${JSON.stringify(coverage)}`);
  return { due: due.length, inserted, failed, coverage, fallback_used: FALLBACK_ENABLED ? fallbackUsed : undefined };
}
