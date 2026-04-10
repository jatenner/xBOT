/**
 * Feed → reply_opportunities sync
 *
 * Ensures fresh tweets discovered by orchestrator feeds are written to
 * reply_opportunities so queue refresh can use them (freshness-first).
 * Idempotent: upsert on target_tweet_id.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const FRESHNESS_MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3h default
const FRESHNESS_MAX_AGE_MS_ENV = process.env.REPLY_OPP_FRESHNESS_MAX_AGE_MS
  ? parseInt(process.env.REPLY_OPP_FRESHNESS_MAX_AGE_MS, 10)
  : FRESHNESS_MAX_AGE_MS;

export interface FeedTweet {
  tweet_id: string;
  author_username: string;
  content: string;
  posted_at: string;
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
  /** Discovery bucket (direct_health | health_adjacent_lifestyle | broad_viral_cultural) when set by feed. */
  discovery_bucket?: 'direct_health' | 'health_adjacent_lifestyle' | 'broad_viral_cultural';
  /** Author follower count when available (e.g. from profile page); used for target_followers and account_size_tier. */
  author_follower_count?: number | null;
}

/**
 * Ensure reply_opportunities rows exist for fresh feed tweets.
 * Only considers tweets with posted_at within REPLY_OPP_FRESHNESS_MAX_AGE_MS (default 3h).
 * Uses upsert on target_tweet_id for dedupe/idempotency.
 */
export async function ensureReplyOpportunitiesFromFeedTweets(
  supabase: SupabaseClient,
  tweets: FeedTweet[],
  sourceName: string
): Promise<{ ensured: number; skipped_stale: number; errors: number }> {
  const now = Date.now();
  const cutoff = new Date(now - (FRESHNESS_MAX_AGE_MS_ENV > 0 ? FRESHNESS_MAX_AGE_MS_ENV : FRESHNESS_MAX_AGE_MS));
  const discoverySource = `orchestrator_${sourceName}`;

  let ensured = 0;
  let skippedStale = 0;
  let errors = 0;

  for (const t of tweets) {
    const tweetId = (t.tweet_id || '').trim();
    if (!tweetId || tweetId.startsWith('consent_wall_')) continue;

    const postedAt = t.posted_at ? new Date(t.posted_at) : null;
    if (!postedAt || postedAt.getTime() < cutoff.getTime()) {
      skippedStale++;
      continue;
    }

    try {
      // Minimal payload; target_tweet_url is required by schema
      const targetTweetUrl = `https://x.com/i/status/${tweetId}`;
      const payload: Record<string, unknown> = {
        target_tweet_id: tweetId,
        target_tweet_url: targetTweetUrl,
        target_username: (t.author_username || 'unknown').trim(),
        target_tweet_content: (t.content || '').substring(0, 500) || null,
        tweet_posted_at: postedAt.toISOString(),
        replied_to: false,
        is_root_tweet: true,
        root_tweet_id: tweetId,
        like_count: t.like_count ?? 0,
        reply_count: t.reply_count ?? 0,
        status: 'pending',
      };
      const followers = t.author_follower_count != null && t.author_follower_count >= 0 ? t.author_follower_count : undefined;
      if (followers != null) {
        payload.target_followers = followers;
        payload.account_size_tier =
          followers >= 1e6 ? 'mega' : followers >= 100e3 ? 'large' : followers >= 10e3 ? 'medium' : followers >= 1e3 ? 'small' : 'tiny';
      }
      // Optional columns (present after 20260129_add_accessibility_status migration)
      payload.discovery_source = discoverySource;
      payload.accessibility_status = 'unknown';
      const bucket = (t as FeedTweet & { discovery_bucket?: string }).discovery_bucket
        ?? (sourceName === 'viral_watcher' ? 'broad_viral_cultural' : sourceName === 'keyword_search' ? 'direct_health' : undefined);
      if (bucket) {
        payload.features = { discovery_bucket: bucket };
      }

      const { error } = await supabase
        .from('reply_opportunities')
        .upsert(payload, { onConflict: 'target_tweet_id' });

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
          ensured++;
        } else if (
          error.message?.includes('discovery_source') ||
          error.message?.includes('accessibility_status') ||
          error.message?.includes('features') ||
          error.message?.includes('schema cache') ||
          error.message?.includes('does not exist')
        ) {
          // Retry without optional columns when DB lacks them (features, discovery_source, accessibility_status)
          const fallbackPayload: Record<string, unknown> = {
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
          };
          if (followers != null) {
            fallbackPayload.target_followers = followers;
            fallbackPayload.account_size_tier =
              followers >= 1e6 ? 'mega' : followers >= 100e3 ? 'large' : followers >= 10e3 ? 'medium' : followers >= 1e3 ? 'small' : 'tiny';
          }
          const { error: err2 } = await supabase
            .from('reply_opportunities')
            .upsert(fallbackPayload, { onConflict: 'target_tweet_id' });
          if (err2) {
            errors++;
            console.warn(`[FEED_OPP_SYNC] ${sourceName} ${tweetId} (fallback): ${err2.message}`);
          } else {
            ensured++;
          }
        } else {
          errors++;
          console.warn(`[FEED_OPP_SYNC] ${sourceName} ${tweetId}: ${error.message}`);
        }
      } else {
        ensured++;
      }
    } catch (e: any) {
      errors++;
      console.warn(`[FEED_OPP_SYNC] ${sourceName} ${tweetId}: ${e?.message || e}`);
    }
  }

  if (ensured > 0 || skippedStale > 0 || errors > 0) {
    console.log(
      `[FEED_OPP_SYNC] ${sourceName} ensured=${ensured} skipped_stale=${skippedStale} errors=${errors}`
    );
  }
  return { ensured, skipped_stale: skippedStale, errors };
}
