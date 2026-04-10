/**
 * Persist CDP-discovered tweets into reply_opportunities.
 * Dedupe on target_tweet_id, enforce freshness, log buckets and skip reasons.
 * Persists target_followers and account_size_tier when author_follower_count is available.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CdpNormalizedTweet } from './cdpDiscovery';
import { CDP_DISCOVERY_FRESHNESS_MAX_AGE_MS } from './cdpDiscovery';

/** Derive account_size_tier from follower count for source learning and scoring. */
export function accountSizeTierFromFollowerCount(count: number | null): string | null {
  if (count == null || count < 0) return null;
  if (count >= 1e6) return 'MEGA';
  if (count >= 100e3) return 'LARGE';
  if (count >= 10e3) return 'MEDIUM';
  if (count >= 1e3) return 'SMALL';
  return 'TINY';
}

const FRESHNESS_MS =
  (typeof process.env.CDP_DISCOVERY_FRESHNESS_MAX_AGE_MS !== 'undefined' &&
    parseInt(process.env.CDP_DISCOVERY_FRESHNESS_MAX_AGE_MS, 10) > 0)
    ? parseInt(process.env.CDP_DISCOVERY_FRESHNESS_MAX_AGE_MS, 10)
    : CDP_DISCOVERY_FRESHNESS_MAX_AGE_MS;

export interface CdpPersistenceResult {
  accepted_total: number;
  skipped_stale: number;
  skipped_duplicate: number;
  skipped_invalid: number;
  errors: number;
  freshness_buckets: { under_10m: number; under_30m: number; under_60m: number; under_3h: number; over_3h: number };
}

/**
 * Persist CDP-normalized tweets to reply_opportunities.
 * Only accepts tweets with posted_at within freshness window; skips invalid/duplicate.
 */
export async function persistCdpOpportunities(
  supabase: SupabaseClient,
  tweets: CdpNormalizedTweet[],
  discoverySource: string
): Promise<CdpPersistenceResult> {
  const now = Date.now();
  const cutoff = new Date(now - FRESHNESS_MS);
  const buckets = { under_10m: 0, under_30m: 0, under_60m: 0, under_3h: 0, over_3h: 0 };
  let accepted_total = 0;
  let accepted_with_followers = 0;
  let skipped_stale = 0;
  let skipped_duplicate = 0;
  let skipped_invalid = 0;
  let errors = 0;

  for (const t of tweets) {
    const tweetId = (t.tweet_id || '').trim();
    if (!tweetId || tweetId.startsWith('consent_wall_')) {
      skipped_invalid++;
      continue;
    }

    const postedAt = t.posted_at ? new Date(t.posted_at) : null;
    if (!postedAt || isNaN(postedAt.getTime())) {
      skipped_invalid++;
      continue;
    }

    const ageMs = now - postedAt.getTime();
    if (ageMs <= 10 * 60 * 1000) buckets.under_10m++;
    else if (ageMs <= 30 * 60 * 1000) buckets.under_30m++;
    else if (ageMs <= 60 * 60 * 1000) buckets.under_60m++;
    else if (ageMs <= 3 * 60 * 60 * 1000) buckets.under_3h++;
    else buckets.over_3h++;

    if (postedAt.getTime() < cutoff.getTime()) {
      skipped_stale++;
      continue;
    }

    try {
      const followerCount = t.author_follower_count != null ? t.author_follower_count : null;
      const accountSizeTier = accountSizeTierFromFollowerCount(followerCount ?? null);
      const payload: Record<string, unknown> = {
        target_tweet_id: tweetId,
        target_tweet_url: `https://x.com/i/status/${tweetId}`,
        target_username: (t.author_username || 'unknown').trim(),
        target_tweet_content: (t.content || '').substring(0, 500) || null,
        tweet_posted_at: postedAt.toISOString(),
        replied_to: false,
        is_root_tweet: true,
        root_tweet_id: tweetId,
        like_count: t.like_count ?? 0,
        reply_count: t.reply_count ?? 0,
        status: 'pending',
        discovery_source: discoverySource,
        accessibility_status: 'unknown',
        target_followers: followerCount,
        account_size_tier: accountSizeTier,
      };

      const { error } = await supabase
        .from('reply_opportunities')
        .upsert(payload, { onConflict: 'target_tweet_id' });

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
          skipped_duplicate++;
        } else {
          errors++;
          console.warn(`[CDP_PERSIST] ${discoverySource} ${tweetId}: ${error.message}`);
        }
      } else {
        accepted_total++;
        if (followerCount != null) accepted_with_followers++;
      }
    } catch (e: any) {
      errors++;
      console.warn(`[CDP_PERSIST] ${discoverySource} ${tweetId}: ${e?.message || e}`);
    }
  }

  console.log(
    `[CDP_DISCOVERY] ${discoverySource} discovered_total=${tweets.length} accepted_total=${accepted_total} skipped_stale=${skipped_stale} skipped_duplicate=${skipped_duplicate} skipped_invalid=${skipped_invalid} errors=${errors}`
  );
  console.log(
    `[CDP_DISCOVERY] freshness_buckets <10m=${buckets.under_10m} <30m=${buckets.under_30m} <60m=${buckets.under_60m} <3h=${buckets.under_3h} >3h=${buckets.over_3h}`
  );
  if (accepted_total > 0) {
    console.log(`[CDP_DISCOVERY] account_metadata: accepted_with_followers=${accepted_with_followers} of ${accepted_total}`);
  }

  return {
    accepted_total,
    skipped_stale,
    skipped_duplicate,
    skipped_invalid,
    errors,
    freshness_buckets: buckets,
  };
}
