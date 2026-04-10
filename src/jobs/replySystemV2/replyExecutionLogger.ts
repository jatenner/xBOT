/**
 * Reply Performance Learning V1: log successful reply posts to reply_execution_events.
 * Called from postingQueue after post confirmation; insert is best-effort (log and continue on failure).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface LogReplyExecutionInput {
  decision_id: string;
  target_tweet_id: string;
  target_username: string | null;
  our_reply_tweet_id: string;
  posted_at: string; // ISO
  dry_run: boolean;
}

/**
 * Fetch opportunity and evaluation data, then insert one row into reply_execution_events.
 * Does not throw; logs and returns on failure so posting pipeline is not blocked.
 */
export async function logReplyExecutionEvent(
  supabase: SupabaseClient,
  input: LogReplyExecutionInput
): Promise<{ ok: boolean; event_id?: string; error?: string }> {
  const {
    decision_id,
    target_tweet_id,
    target_username,
    our_reply_tweet_id,
    posted_at,
    dry_run,
  } = input;

  try {
    // Fetch reply_opportunities BEFORE it may be deleted (by target_tweet_id)
    const { data: opp } = await supabase
      .from('reply_opportunities')
      .select('id, target_followers, account_size_tier, discovery_source, tweet_posted_at, features')
      .eq('target_tweet_id', target_tweet_id)
      .maybeSingle();

    const tweetPostedAt = opp?.tweet_posted_at ? new Date(opp.tweet_posted_at).getTime() : null;
    const postedAtMs = new Date(posted_at).getTime();
    const target_tweet_age_minutes =
      tweetPostedAt != null && !isNaN(tweetPostedAt)
        ? (postedAtMs - tweetPostedAt) / (60 * 1000)
        : null;

    // Fetch candidate_evaluations for scores (by candidate_tweet_id = target_tweet_id)
    const { data: evalRow } = await supabase
      .from('candidate_evaluations')
      .select('overall_score, author_signal_score, velocity_score, recency_score, topic_relevance_score, spam_score, opportunity_upside_score, health_angle_fit_score')
      .eq('candidate_tweet_id', target_tweet_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const discovery_bucket = (opp?.features as { discovery_bucket?: string } | null)?.discovery_bucket ?? null;

    // Reply decision metadata
    const { data: rdRow } = await supabase
      .from('reply_decisions')
      .select('created_at, template_id, prompt_version')
      .eq('decision_id', decision_id)
      .maybeSingle();

    const selected_at = rdRow?.created_at ?? null;
    const reply_style = rdRow?.template_id ?? null;
    const reply_format = rdRow?.prompt_version ?? null;

    const scoring_version = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || null;
    const model_version = process.env.OPENAI_MODEL || null;
    const our_account = process.env.TWITTER_USERNAME || null;

    const payload = {
      reply_opportunity_id: opp?.id ?? null,
      target_tweet_id,
      target_username: target_username ?? null,
      target_followers: opp?.target_followers ?? null,
      account_size_tier: opp?.account_size_tier ?? null,
      discovery_source: opp?.discovery_source ?? null,
      discovery_bucket: discovery_bucket ?? null,
      health_angle_fit_score: evalRow?.health_angle_fit_score ?? null,
      opportunity_upside_score: evalRow?.opportunity_upside_score ?? null,
      target_tweet_age_minutes,
      reply_style,
      reply_format,
      scoring_version,
      model_version,
      score_total: evalRow?.overall_score ?? null,
      author_signal_score: evalRow?.author_signal_score ?? null,
      timing_score: evalRow?.velocity_score ?? null,
      content_score: evalRow?.topic_relevance_score ?? null,
      risk_score: evalRow?.spam_score != null ? evalRow.spam_score : null,
      selected_at,
      posted_at,
      our_reply_tweet_id,
      our_account,
      dry_run,
      metadata_json: {
        decision_id,
        recency_score: evalRow?.recency_score ?? null,
      },
    };

    const { data: inserted, error } = await supabase
      .from('reply_execution_events')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.warn(`[REPLY_EXECUTION_LOG] Insert failed (non-blocking): ${error.message}`);
      return { ok: false, error: error.message };
    }
    console.log(`[REPLY_EXECUTION_LOG] event_id=${inserted?.id} target=${target_tweet_id} our_reply=${our_reply_tweet_id} dry_run=${dry_run}`);
    return { ok: true, event_id: inserted?.id };
  } catch (e: any) {
    console.warn(`[REPLY_EXECUTION_LOG] Error (non-blocking): ${e?.message ?? e}`);
    return { ok: false, error: e?.message ?? String(e) };
  }
}
