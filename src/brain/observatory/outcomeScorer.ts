/**
 * Outcome Scorer
 *
 * DB-only job. Runs every 30 minutes.
 *
 * For every brain_tweets row that doesn't yet have a brain_tweet_outcomes row,
 * look up the expected engagement from brain_engagement_baselines (using a
 * fallback cascade: hour-level → domain-level → tier-level), classify the actual
 * performance relative to expected, and write brain_tweet_outcomes.
 *
 * If no stratified baseline is available (early days, sparse classification),
 * fall back to per-author: compare against brain_accounts.avg_likes_30d set by
 * runEngagementBaseline. This is the "baseline_source='per_author_fallback'" path.
 *
 * Outcome classes:
 *   breakout = actual >= p75 × 1.5
 *   above    = p75 <= actual < p75 × 1.5
 *   expected = p25 <= actual < p75
 *   below    = p25 × 0.5 <= actual < p25
 *   failure  = actual < p25 × 0.5
 *
 * This job is the SOLE writer of brain_tweet_outcomes — do not write from
 * other jobs. This avoids the circular dependency with Stage 2 classification
 * (classification writes domain, this reads domain; if classification also
 * wrote outcomes, we'd have a cycle).
 */

import { getSupabaseClient } from '../../db';

const LOG_PREFIX = '[observatory/outcome-scorer]';
const MAX_TWEETS_PER_RUN = 2000;

interface Baseline {
  median_likes: number;
  p25_likes: number;
  p75_likes: number;
  median_views: number;
  p25_views: number;
  p75_views: number;
}

function classify(actualLikes: number, baseline: Baseline): string {
  const p25 = baseline.p25_likes;
  const p75 = baseline.p75_likes;
  if (actualLikes >= p75 * 1.5) return 'breakout';
  if (actualLikes >= p75) return 'above';
  if (actualLikes >= p25) return 'expected';
  if (actualLikes >= p25 * 0.5) return 'below';
  return 'failure';
}

export async function runOutcomeScorer(): Promise<{
  tweets_scored: number;
  stratified_hits: number;
  per_author_fallbacks: number;
  unscorable: number;
}> {
  const supabase = getSupabaseClient();

  // Load all current stratified baselines into memory for fast lookup
  const { data: baselines } = await supabase
    .from('brain_engagement_baselines')
    .select('tier, domain, posted_hour_utc, median_likes, p25_likes, p75_likes, median_views, p25_views, p75_views');

  // Build lookup maps (most-specific to least-specific)
  const hourMap = new Map<string, Baseline>(); // tier|domain|hour
  const domainMap = new Map<string, Baseline>(); // tier|domain
  const tierMap = new Map<string, Baseline>(); // tier

  for (const b of baselines ?? []) {
    const bl: Baseline = {
      median_likes: b.median_likes ?? 0,
      p25_likes: b.p25_likes ?? 0,
      p75_likes: b.p75_likes ?? 0,
      median_views: b.median_views ?? 0,
      p25_views: b.p25_views ?? 0,
      p75_views: b.p75_views ?? 0,
    };
    if (b.domain === '__ANY__' && b.posted_hour_utc === -1) {
      tierMap.set(b.tier, bl);
    } else if (b.posted_hour_utc === -1) {
      domainMap.set(`${b.tier}|${b.domain}`, bl);
    } else {
      hourMap.set(`${b.tier}|${b.domain}|${b.posted_hour_utc}`, bl);
    }
  }

  console.log(
    `${LOG_PREFIX} Loaded ${hourMap.size} hour buckets, ${domainMap.size} domain buckets, ${tierMap.size} tier buckets`
  );

  // Get unscored tweets — use exclusion via NOT IN (left-anti-join pattern)
  const { data: scoredSoFar } = await supabase
    .from('brain_tweet_outcomes')
    .select('tweet_id')
    .order('computed_at', { ascending: false })
    .limit(10000); // recent window
  const scoredSet = new Set((scoredSoFar ?? []).map(r => r.tweet_id));

  const { data: tweets } = await supabase
    .from('brain_tweets')
    .select('tweet_id, author_username, posted_hour_utc, views, likes')
    .order('scraped_at', { ascending: false })
    .limit(MAX_TWEETS_PER_RUN * 3); // room to filter out already-scored

  if (!tweets || tweets.length === 0) {
    return { tweets_scored: 0, stratified_hits: 0, per_author_fallbacks: 0, unscorable: 0 };
  }

  const toScore = tweets.filter(t => !scoredSet.has(t.tweet_id)).slice(0, MAX_TWEETS_PER_RUN);
  if (toScore.length === 0) {
    console.log(`${LOG_PREFIX} Nothing new to score`);
    return { tweets_scored: 0, stratified_hits: 0, per_author_fallbacks: 0, unscorable: 0 };
  }

  // Need classification + tier for each tweet
  const tweetIds = toScore.map(t => t.tweet_id);
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

  const authors = Array.from(new Set(toScore.map(t => t.author_username)));
  const tierMap2 = new Map<string, { tier: string; avg_likes: number | null }>();
  for (let i = 0; i < authors.length; i += 500) {
    const chunk = authors.slice(i, i + 500);
    const { data: accts } = await supabase
      .from('brain_accounts')
      .select('username, tier, avg_likes_30d')
      .in('username', chunk);
    for (const a of accts ?? []) {
      tierMap2.set(a.username, { tier: a.tier ?? 'C', avg_likes: a.avg_likes_30d });
    }
  }

  // Score each tweet
  const outcomes: any[] = [];
  let stratifiedHits = 0;
  let fallbacks = 0;
  let unscorable = 0;

  for (const t of toScore) {
    const acct = tierMap2.get(t.author_username);
    if (!acct) { unscorable++; continue; }

    const tier = acct.tier;
    const domain = classMap.get(t.tweet_id);
    const hour = t.posted_hour_utc;
    const actualLikes = t.likes ?? 0;
    const actualViews = t.views ?? 0;

    // Fallback cascade
    let baseline: Baseline | undefined;
    let source: string | undefined;

    if (domain && hour !== null && hour !== undefined) {
      baseline = hourMap.get(`${tier}|${domain}|${hour}`);
      if (baseline) source = 'stratified';
    }
    if (!baseline && domain) {
      baseline = domainMap.get(`${tier}|${domain}`);
      if (baseline) source = 'stratified';
    }
    if (!baseline) {
      baseline = tierMap.get(tier);
      if (baseline) source = 'stratified';
    }

    // Final fallback: per-author avg_likes_30d
    if (!baseline && acct.avg_likes !== null && acct.avg_likes !== undefined) {
      const avg = acct.avg_likes;
      baseline = {
        median_likes: avg,
        p25_likes: avg * 0.5,
        p75_likes: avg * 1.5,
        median_views: 0,
        p25_views: 0,
        p75_views: 0,
      };
      source = 'per_author_fallback';
    }

    if (!baseline || !source) { unscorable++; continue; }

    if (source === 'stratified') stratifiedHits++;
    else fallbacks++;

    const outcomeClass = classify(actualLikes, baseline);

    outcomes.push({
      tweet_id: t.tweet_id,
      expected_views: baseline.median_views,
      expected_likes: baseline.median_likes,
      actual_views: actualViews,
      actual_likes: actualLikes,
      outcome_class: outcomeClass,
      baseline_source: source,
      computed_at: new Date().toISOString(),
    });
  }

  // Bulk upsert
  let written = 0;
  for (let i = 0; i < outcomes.length; i += 100) {
    const chunk = outcomes.slice(i, i + 100);
    const { error } = await supabase
      .from('brain_tweet_outcomes')
      .upsert(chunk, { onConflict: 'tweet_id' });
    if (error) {
      console.error(`${LOG_PREFIX} Upsert error: ${error.message}`);
    } else {
      written += chunk.length;
    }
  }

  console.log(
    `${LOG_PREFIX} Scored ${written} tweets (${stratifiedHits} stratified, ${fallbacks} per-author fallback, ${unscorable} unscorable)`
  );
  return {
    tweets_scored: written,
    stratified_hits: stratifiedHits,
    per_author_fallbacks: fallbacks,
    unscorable,
  };
}
