/**
 * Growth Action Logger: Decision → Action → Outcome → Learning
 * Inserts a row into growth_action_logs when a reply, post, or thread is executed.
 * Best-effort: does not throw; logs and returns so posting pipeline is not blocked.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type GrowthActionType = 'reply' | 'post' | 'thread';

export interface LogGrowthActionInput {
  decision_id: string;
  action_type: GrowthActionType;
  posted_tweet_id: string;
  executed_at?: string; // ISO; defaults to now
}

/**
 * Fetch decision/target metadata and insert one row into growth_action_logs.
 * For replies: fetches reply_opportunities, candidate_evaluations, reply_decisions, content_metadata.
 * For post/thread: fetches content_metadata only.
 */
export async function logGrowthAction(
  supabase: SupabaseClient,
  input: LogGrowthActionInput
): Promise<{ ok: boolean; log_id?: string; error?: string }> {
  const { decision_id, action_type, posted_tweet_id, executed_at } = input;
  const executedAt = executed_at || new Date().toISOString();
  const execDate = new Date(executedAt);
  const post_time_hour = execDate.getHours();
  const day_of_week = execDate.getDay();

  try {
    const { data: cm } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, raw_topic, angle, tone, format_strategy, bandit_arm, target_tweet_id, target_username')
      .eq('decision_id', decision_id)
      .maybeSingle();

    let arm_name: string | null = (cm?.bandit_arm as string) || null;
    let topic: string | null = (cm?.raw_topic as string) || null;
    let tone: string | null = (cm?.tone as string) || null;
    let format: string | null = (cm?.format_strategy as string) || null;
    const target_tweet_id: string | null = (cm?.target_tweet_id as string) || null;
    const target_author: string | null = (cm?.target_username as string) || null;

    let discovery_bucket: string | null = null;
    let opportunity_upside_score: number | null = null;
    let health_angle_fit_score: number | null = null;
    let target_followers: number | null = null;
    let account_size_tier: string | null = null;
    let target_post_age_minutes: number | null = null;

    if (action_type === 'reply' && target_tweet_id) {
      const { data: opp } = await supabase
        .from('reply_opportunities')
        .select('target_followers, account_size_tier, tweet_posted_at, features')
        .eq('target_tweet_id', target_tweet_id)
        .maybeSingle();

      if (opp?.features && typeof (opp.features as any)?.discovery_bucket === 'string') {
        discovery_bucket = (opp.features as any).discovery_bucket;
      }
      target_followers = opp?.target_followers != null ? Number(opp.target_followers) : null;
      account_size_tier = opp?.account_size_tier ?? null;

      if (opp?.tweet_posted_at) {
        const tweetPostedAt = new Date(opp.tweet_posted_at).getTime();
        target_post_age_minutes = Math.round((execDate.getTime() - tweetPostedAt) / (60 * 1000));
      }

      const { data: evalRow } = await supabase
        .from('candidate_evaluations')
        .select('opportunity_upside_score, health_angle_fit_score')
        .eq('candidate_tweet_id', target_tweet_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      opportunity_upside_score = evalRow?.opportunity_upside_score != null ? Number(evalRow.opportunity_upside_score) : null;
      health_angle_fit_score = evalRow?.health_angle_fit_score != null ? Number(evalRow.health_angle_fit_score) : null;
    }

    const payload = {
      decision_id,
      action_type,
      arm_name,
      discovery_bucket,
      opportunity_upside_score,
      health_angle_fit_score,
      target_tweet_id,
      target_author,
      target_followers,
      account_size_tier,
      target_post_age_minutes,
      posted_tweet_id,
      executed_at: executedAt,
      post_time_hour,
      day_of_week,
      topic,
      tone,
      format,
      impressions: null,
      likes: null,
      replies: null,
      bookmarks: null,
      profile_clicks: null,
      followers_gained: null,
      reply_efficiency: null,
      timing_efficiency: null,
      conversion_rate: null,
    };

    const { data: inserted, error } = await supabase
      .from('growth_action_logs')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.warn(`[GA_LOG] Insert failed (non-blocking): ${error.message}`);
      return { ok: false, error: error.message };
    }

    const targetFollowers = target_followers ?? 0;
    console.log(`[GA_LOG] action_created decision_id=${decision_id} type=${action_type} target_followers=${targetFollowers} log_id=${inserted?.id}`);
    return { ok: true, log_id: inserted?.id };
  } catch (e: any) {
    console.warn(`[GA_LOG] Error (non-blocking): ${e?.message ?? e}`);
    return { ok: false, error: e?.message ?? String(e) };
  }
}
