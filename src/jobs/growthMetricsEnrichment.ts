/**
 * Growth Metrics Enrichment Job
 * Finds growth_action_logs rows where impressions IS NULL, fetches metrics from outcomes
 * (or learning_posts/tweet_metrics), then updates rows and computes derived metrics.
 */

import { getSupabaseClient } from '../db/index';

const BATCH_SIZE = 50;

export interface GrowthEnrichmentResult {
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * Fetch metrics for a decision: try outcomes by decision_id, then learning_posts/tweet_metrics by posted_tweet_id.
 */
async function getMetricsForAction(
  supabase: ReturnType<typeof getSupabaseClient>,
  decisionId: string,
  postedTweetId: string | null
): Promise<{
  impressions: number;
  likes: number;
  replies: number;
  bookmarks: number;
  profile_clicks: number;
  followers_gained: number;
} | null> {
  const { data: outcome } = await supabase
    .from('outcomes')
    .select('impressions, likes, retweets, replies, bookmarks, profile_clicks, profile_visits, follows, followers_gained')
    .eq('decision_id', decisionId)
    .order('collected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (outcome) {
    const impressions = Number(outcome.impressions) ?? 0;
    const likes = Number(outcome.likes) ?? 0;
    const replies = Number(outcome.replies) ?? 0;
    const bookmarks = Number(outcome.bookmarks) ?? 0;
    const profile_clicks = Number((outcome as any).profile_clicks ?? (outcome as any).profile_visits) ?? 0;
    const followers_gained = Number((outcome as any).followers_gained ?? (outcome as any).follows) ?? 0;
    return {
      impressions,
      likes,
      replies,
      bookmarks,
      profile_clicks,
      followers_gained,
    };
  }

  if (!postedTweetId) return null;

  const { data: lp } = await supabase
    .from('learning_posts')
    .select('impressions_count, likes_count, replies_count, bookmarks_count')
    .eq('tweet_id', postedTweetId)
    .maybeSingle();

  if (lp) {
    return {
      impressions: Number(lp.impressions_count) ?? 0,
      likes: Number(lp.likes_count) ?? 0,
      replies: Number(lp.replies_count) ?? 0,
      bookmarks: Number(lp.bookmarks_count) ?? 0,
      profile_clicks: 0,
      followers_gained: 0,
    };
  }

  const { data: tm } = await supabase
    .from('tweet_metrics')
    .select('impressions_count, likes_count, replies_count')
    .eq('tweet_id', postedTweetId)
    .maybeSingle();

  if (tm) {
    return {
      impressions: Number(tm.impressions_count) ?? 0,
      likes: Number(tm.likes_count) ?? 0,
      replies: Number(tm.replies_count) ?? 0,
      bookmarks: 0,
      profile_clicks: 0,
      followers_gained: 0,
    };
  }

  return null;
}

/**
 * Run one enrichment cycle: find rows with impressions IS NULL, fetch metrics, update and compute derived.
 */
export async function runGrowthMetricsEnrichment(): Promise<GrowthEnrichmentResult> {
  const supabase = getSupabaseClient();
  const result: GrowthEnrichmentResult = { processed: 0, updated: 0, skipped: 0, errors: 0 };

  const { data: rows, error: fetchError } = await supabase
    .from('growth_action_logs')
    .select('id, decision_id, posted_tweet_id, target_post_likes, target_post_age_minutes, impressions')
    .is('impressions', null)
    .order('executed_at', { ascending: false })
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error(`[GA_ENRICH] Fetch failed: ${fetchError.message}`);
    return result;
  }

  if (!rows || rows.length === 0) {
    console.log('[GA_ENRICH] No rows to enrich');
    return result;
  }

  console.log(`[GA_ENRICH] Processing ${rows.length} rows`);

  for (const row of rows) {
    result.processed++;

    const metrics = await getMetricsForAction(
      supabase,
      row.decision_id,
      row.posted_tweet_id ?? null
    );

    if (!metrics) {
      result.skipped++;
      continue;
    }

    const targetPostLikes = row.target_post_likes != null ? Number(row.target_post_likes) : null;
    const targetPostAgeMinutes = row.target_post_age_minutes != null ? Number(row.target_post_age_minutes) : null;

    const reply_efficiency =
      targetPostLikes != null && targetPostLikes > 0 && metrics.impressions != null
        ? metrics.impressions / targetPostLikes
        : null;

    const timing_efficiency =
      targetPostAgeMinutes != null && targetPostAgeMinutes >= 1 && metrics.impressions != null
        ? metrics.impressions / targetPostAgeMinutes
        : null;

    const conversion_rate =
      metrics.impressions != null && metrics.impressions >= 1 && metrics.followers_gained != null
        ? metrics.followers_gained / metrics.impressions
        : null;

    const { error: updateError } = await supabase
      .from('growth_action_logs')
      .update({
        impressions: metrics.impressions,
        likes: metrics.likes,
        replies: metrics.replies,
        bookmarks: metrics.bookmarks,
        profile_clicks: metrics.profile_clicks,
        followers_gained: metrics.followers_gained,
        reply_efficiency,
        timing_efficiency,
        conversion_rate,
      })
      .eq('id', row.id);

    if (updateError) {
      console.warn(`[GA_ENRICH] Update failed action_id=${row.id}: ${updateError.message}`);
      result.errors++;
      continue;
    }

    result.updated++;
    console.log(`[GA_ENRICH] updated action_id=${row.id} impressions=${metrics.impressions} likes=${metrics.likes}`);
  }

  return result;
}
