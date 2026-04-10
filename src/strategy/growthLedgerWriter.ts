/**
 * GROWTH LEDGER WRITER
 *
 * Records every action and outcome to the growth_ledger table.
 * This is the single source of truth for all 5 learning dimensions.
 *
 * Two entry points:
 * - recordAction(): called after posting (records what we did)
 * - updateOutcomes(): called after scraping metrics (records what happened)
 *
 * Fire-and-forget — never throws, never blocks the caller.
 */

import { getSupabaseClient } from '../db';

export interface ActionRecord {
  action_type: 'reply' | 'single' | 'thread';
  decision_id?: string;
  tweet_id?: string;

  // Content signals
  topic?: string;
  format_type?: string;
  hook_type?: string;
  archetype?: string;
  content_length?: number;

  // Target signals (for replies)
  target_username?: string;
  target_followers?: number;
  target_tier?: string;
  discovery_source?: string;
  discovery_keyword?: string;

  // Timing
  posted_at: Date;
  target_age_minutes?: number;

  // Reply timing & position (Phase 1)
  reply_position?: number;
  reply_delay_minutes?: number;
  target_tweet_posted_at?: Date;
  target_topic?: string;
}

export interface OutcomeUpdate {
  views?: number;
  likes?: number;
  replies?: number;
  retweets?: number;
  bookmarks?: number;
  engagement_rate?: number;
  followers_gained?: number;

  // OP engagement signals (Phase 1)
  op_liked?: boolean;
  op_replied?: boolean;

  // Engagement velocity (Phase 1)
  velocity_1h?: number;
  velocity_6h?: number;
  engagement_curve?: Record<string, any>;
}

/**
 * Record an action to the growth ledger after posting.
 */
export async function recordAction(action: ActionRecord): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const postedAt = action.posted_at;

    await supabase.from('growth_ledger').insert({
      action_type: action.action_type,
      decision_id: action.decision_id,
      tweet_id: action.tweet_id,

      topic: action.topic,
      format_type: action.format_type,
      hook_type: action.hook_type,
      archetype: action.archetype,
      content_length: action.content_length,

      target_username: action.target_username,
      target_followers: action.target_followers,
      target_tier: action.target_tier,
      discovery_source: action.discovery_source,
      discovery_keyword: action.discovery_keyword,

      posted_at: postedAt.toISOString(),
      posted_hour_utc: postedAt.getUTCHours(),
      posted_day_of_week: postedAt.getUTCDay(),
      target_age_minutes: action.target_age_minutes,

      // Reply timing & position (Phase 1)
      reply_position: action.reply_position,
      reply_delay_minutes: action.reply_delay_minutes,
      target_tweet_posted_at: action.target_tweet_posted_at?.toISOString(),
      target_topic: action.target_topic,

      data_source: 'system',
    });

    console.log(`[GROWTH_LEDGER] Recorded ${action.action_type} action (decision=${action.decision_id})`);
  } catch (err: any) {
    console.warn(`[GROWTH_LEDGER] Failed to record action (non-fatal): ${err.message}`);
  }
}

/**
 * Update outcomes for a growth_ledger entry after metrics are scraped.
 * Matches by decision_id or tweet_id.
 */
export async function updateOutcomes(
  identifier: { decision_id?: string; tweet_id?: string },
  outcomes: OutcomeUpdate
): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    // Compute unified reward signal
    const likes = outcomes.likes ?? 0;
    const replies = outcomes.replies ?? 0;
    const retweets = outcomes.retweets ?? 0;
    const bookmarks = outcomes.bookmarks ?? 0;
    const views = outcomes.views ?? 0;
    const followersGained = outcomes.followers_gained ?? 0;

    // Reward formula: engagement + follower_delta (dominant signal)
    const engagementReward = likes * 0.5 + replies * 1.5 + retweets * 2.0 + bookmarks * 0.2;
    const followerReward = followersGained * 5.0;
    const impressionNorm = views > 0 ? Math.sqrt(views) : 1;
    const reward = (engagementReward + followerReward) / impressionNorm;

    // Build query — match by decision_id or tweet_id
    let query = supabase.from('growth_ledger').update({
      views: outcomes.views,
      likes: outcomes.likes,
      replies: outcomes.replies,
      retweets: outcomes.retweets,
      bookmarks: outcomes.bookmarks,
      engagement_rate: outcomes.engagement_rate,
      followers_gained: outcomes.followers_gained,
      reward,
      outcomes_collected_at: new Date().toISOString(),
      // OP engagement & velocity (Phase 1)
      ...(outcomes.op_liked !== undefined && { op_liked: outcomes.op_liked }),
      ...(outcomes.op_replied !== undefined && { op_replied: outcomes.op_replied }),
      ...(outcomes.velocity_1h !== undefined && { velocity_1h: outcomes.velocity_1h }),
      ...(outcomes.velocity_6h !== undefined && { velocity_6h: outcomes.velocity_6h }),
      ...(outcomes.engagement_curve && { engagement_curve: outcomes.engagement_curve }),
    });

    if (identifier.decision_id) {
      query = query.eq('decision_id', identifier.decision_id);
    } else if (identifier.tweet_id) {
      query = query.eq('tweet_id', identifier.tweet_id);
    } else {
      console.warn('[GROWTH_LEDGER] updateOutcomes called without decision_id or tweet_id');
      return;
    }

    const { error } = await query;
    if (error) {
      console.warn(`[GROWTH_LEDGER] Failed to update outcomes: ${error.message}`);
    } else {
      console.log(`[GROWTH_LEDGER] Updated outcomes (reward=${reward.toFixed(3)}, views=${views}, followers=${followersGained})`);
    }
  } catch (err: any) {
    console.warn(`[GROWTH_LEDGER] Failed to update outcomes (non-fatal): ${err.message}`);
  }
}
