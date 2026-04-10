/**
 * Baseline Builder
 *
 * DB-only job. Runs every 6 hours.
 *
 * Rebuilds the stratified engagement baselines table by computing median + p25 + p75
 * of views and likes, bucketed by (tier, domain, posted_hour_utc) over a rolling
 * 30-day window. Writes to brain_engagement_baselines.
 *
 * Sample-size gate: bucket must have ≥ 20 tweets. Otherwise it's not stored — the
 * outcomeScorer falls back to per-author viral_multiplier when no bucket matches.
 *
 * Fallback cascade on sparse data:
 *   1. (tier, domain, hour) — 20+ tweets — best
 *   2. (tier, domain) — 20+ tweets — good
 *   3. (tier) — 50+ tweets — acceptable
 *   4. nothing stored; outcomeScorer uses per-author baseline
 *
 * All three buckets written side-by-side. outcomeScorer resolves from most-specific
 * to least-specific at query time.
 */

import { getSupabaseClient } from '../../db';

const LOG_PREFIX = '[observatory/baseline-builder]';
const WINDOW_DAYS = 30;
const MIN_SAMPLE_HOUR_BUCKET = 20;
const MIN_SAMPLE_DOMAIN_BUCKET = 20;
const MIN_SAMPLE_TIER_BUCKET = 50;

interface TweetRow {
  tier: string | null;
  domain: string | null;
  posted_hour_utc: number | null;
  views: number | null;
  likes: number | null;
}

interface BucketStats {
  tier: string;
  domain: string;
  posted_hour_utc: number;
  sample_size: number;
  median_views: number;
  p25_views: number;
  p75_views: number;
  median_likes: number;
  p25_likes: number;
  p75_likes: number;
  window_days: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function computeStats(
  tweets: TweetRow[],
  tier: string,
  domain: string,
  hour: number
): BucketStats | null {
  if (tweets.length < MIN_SAMPLE_HOUR_BUCKET) return null;

  const viewsSorted = tweets
    .map(t => t.views ?? 0)
    .sort((a, b) => a - b);
  const likesSorted = tweets
    .map(t => t.likes ?? 0)
    .sort((a, b) => a - b);

  return {
    tier,
    domain,
    posted_hour_utc: hour,
    sample_size: tweets.length,
    median_views: percentile(viewsSorted, 0.5),
    p25_views: percentile(viewsSorted, 0.25),
    p75_views: percentile(viewsSorted, 0.75),
    median_likes: percentile(likesSorted, 0.5),
    p25_likes: percentile(likesSorted, 0.25),
    p75_likes: percentile(likesSorted, 0.75),
    window_days: WINDOW_DAYS,
  };
}

export async function runBaselineBuilder(): Promise<{
  buckets_computed: number;
  tweets_sampled: number;
}> {
  const supabase = getSupabaseClient();
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Pull tweets joined with classifications (domain) and accounts (tier).
  // Done in 2 queries + local join because Supabase JS client joins are limited.

  // Get brain_tweets within window with author + hour + metrics
  const { data: tweets, error: tweetErr } = await supabase
    .from('brain_tweets')
    .select('tweet_id, author_username, posted_hour_utc, views, likes')
    .gte('posted_at', cutoff)
    .limit(50000);

  if (tweetErr || !tweets || tweets.length === 0) {
    console.log(`${LOG_PREFIX} No tweets in window (err=${tweetErr?.message ?? 'none'})`);
    return { buckets_computed: 0, tweets_sampled: 0 };
  }

  // Get classifications for those tweet IDs
  const tweetIds = tweets.map(t => t.tweet_id);
  const classMap = new Map<string, string>();
  for (let i = 0; i < tweetIds.length; i += 500) {
    const chunk = tweetIds.slice(i, i + 500);
    const { data: classes } = await supabase
      .from('brain_classifications')
      .select('tweet_id, domain')
      .in('tweet_id', chunk);
    for (const c of classes ?? []) {
      if (c.domain) classMap.set(c.tweet_id, c.domain);
    }
  }

  // Get tier for every author mentioned
  const authors = Array.from(new Set(tweets.map(t => t.author_username)));
  const tierMap = new Map<string, string>();
  for (let i = 0; i < authors.length; i += 500) {
    const chunk = authors.slice(i, i + 500);
    const { data: accts } = await supabase
      .from('brain_accounts')
      .select('username, tier')
      .in('username', chunk);
    for (const a of accts ?? []) {
      tierMap.set(a.username, a.tier ?? 'C');
    }
  }

  // Join locally, group into buckets
  const hourBuckets = new Map<string, TweetRow[]>(); // key: `${tier}|${domain}|${hour}`
  const domainBuckets = new Map<string, TweetRow[]>(); // key: `${tier}|${domain}`
  const tierBuckets = new Map<string, TweetRow[]>(); // key: `${tier}`

  let skippedNoDomain = 0;
  let skippedNoTier = 0;
  let skippedNoHour = 0;

  for (const t of tweets) {
    const tier = tierMap.get(t.author_username);
    const domain = classMap.get(t.tweet_id);
    const hour = t.posted_hour_utc;

    if (!tier) { skippedNoTier++; continue; }
    if (!domain) { skippedNoDomain++; continue; }
    if (hour === null || hour === undefined) { skippedNoHour++; continue; }

    const row: TweetRow = {
      tier,
      domain,
      posted_hour_utc: hour,
      views: t.views,
      likes: t.likes,
    };

    const hourKey = `${tier}|${domain}|${hour}`;
    const domainKey = `${tier}|${domain}`;
    const tierKey = tier;

    if (!hourBuckets.has(hourKey)) hourBuckets.set(hourKey, []);
    if (!domainBuckets.has(domainKey)) domainBuckets.set(domainKey, []);
    if (!tierBuckets.has(tierKey)) tierBuckets.set(tierKey, []);

    hourBuckets.get(hourKey)!.push(row);
    domainBuckets.get(domainKey)!.push(row);
    tierBuckets.get(tierKey)!.push(row);
  }

  console.log(
    `${LOG_PREFIX} Joined ${tweets.length} tweets: ` +
    `${hourBuckets.size} hour buckets, ${domainBuckets.size} domain buckets, ${tierBuckets.size} tier buckets. ` +
    `Skipped (no_tier=${skippedNoTier}, no_domain=${skippedNoDomain}, no_hour=${skippedNoHour})`
  );

  // Compute stats for each bucket that meets sample-size gate
  const allStats: BucketStats[] = [];

  // Primary: hour-level buckets
  for (const [key, rows] of hourBuckets.entries()) {
    if (rows.length < MIN_SAMPLE_HOUR_BUCKET) continue;
    const [tier, domain, hourStr] = key.split('|');
    const stats = computeStats(rows, tier, domain, parseInt(hourStr, 10));
    if (stats) allStats.push(stats);
  }

  // Fallback 1: domain-level (stored with special hour=-1 marker)
  for (const [key, rows] of domainBuckets.entries()) {
    if (rows.length < MIN_SAMPLE_DOMAIN_BUCKET) continue;
    const [tier, domain] = key.split('|');
    const stats = computeStats(rows, tier, domain, -1); // -1 = domain-level
    if (stats) allStats.push(stats);
  }

  // Fallback 2: tier-level (stored with special hour=-1 and domain='__ANY__')
  for (const [tier, rows] of tierBuckets.entries()) {
    if (rows.length < MIN_SAMPLE_TIER_BUCKET) continue;
    const stats = computeStats(rows, tier, '__ANY__', -1);
    if (stats) allStats.push(stats);
  }

  if (allStats.length === 0) {
    console.log(`${LOG_PREFIX} No buckets met sample-size thresholds; nothing to write`);
    return { buckets_computed: 0, tweets_sampled: tweets.length };
  }

  // Upsert all stats (onConflict=tier,domain,posted_hour_utc,window_days)
  let written = 0;
  for (let i = 0; i < allStats.length; i += 100) {
    const chunk = allStats.slice(i, i + 100);
    const { error: upsertErr } = await supabase
      .from('brain_engagement_baselines')
      .upsert(chunk, { onConflict: 'tier,domain,posted_hour_utc,window_days' });
    if (upsertErr) {
      console.error(`${LOG_PREFIX} Upsert error: ${upsertErr.message}`);
    } else {
      written += chunk.length;
    }
  }

  console.log(`${LOG_PREFIX} Wrote ${written} baseline buckets from ${tweets.length} tweets`);
  return { buckets_computed: written, tweets_sampled: tweets.length };
}
