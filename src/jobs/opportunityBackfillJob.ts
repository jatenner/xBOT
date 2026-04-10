/**
 * OPPORTUNITY LOG BACKFILL JOB
 *
 * Fills actual_reward and actual_followers_gained in opportunity_log
 * after metrics arrive (~2h after posting).
 *
 * This teaches the timing/decision brain whether "reply" or "wait" was the right call.
 * Without this, the opportunity scorer has no training data.
 *
 * Run every 30 ticks (~30 min) from the daemon.
 */

import { getSupabaseClient } from '../db';

export async function opportunityBackfillJob(): Promise<{ backfilled: number; checked: number }> {
  const supabase = getSupabaseClient();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // Find opportunity_log entries that need backfilling
  const { data: pendingOpps, error: fetchError } = await supabase
    .from('opportunity_log')
    .select('id, decision_id, action_taken, tick_at')
    .is('actual_reward', null)
    .lt('tick_at', twoHoursAgo)
    .not('decision_id', 'is', null)
    .order('tick_at', { ascending: false })
    .limit(50);

  if (fetchError) {
    console.warn(`[OPP_BACKFILL] Failed to fetch pending opportunities: ${fetchError.message}`);
    return { backfilled: 0, checked: 0 };
  }

  if (!pendingOpps || pendingOpps.length === 0) {
    return { backfilled: 0, checked: 0 };
  }

  const decisionIds = pendingOpps
    .map(o => o.decision_id)
    .filter((id): id is string => id !== null && id !== undefined);

  if (decisionIds.length === 0) {
    return { backfilled: 0, checked: pendingOpps.length };
  }

  // Look up rewards from growth_ledger
  const { data: ledgerEntries } = await supabase
    .from('growth_ledger')
    .select('decision_id, reward, followers_gained')
    .in('decision_id', decisionIds)
    .not('reward', 'is', null);

  const rewardMap = new Map<string, { reward: number; followers: number }>();
  for (const entry of (ledgerEntries || [])) {
    if (entry.decision_id) {
      rewardMap.set(entry.decision_id, {
        reward: entry.reward ?? 0,
        followers: entry.followers_gained ?? 0,
      });
    }
  }

  // Also check outcomes table as fallback
  if (rewardMap.size < decisionIds.length) {
    const missingIds = decisionIds.filter(id => !rewardMap.has(id));
    if (missingIds.length > 0) {
      const { data: outcomeEntries } = await supabase
        .from('outcomes')
        .select('decision_id, views, likes, retweets, replies, followers_gained')
        .in('decision_id', missingIds)
        .gt('views', 0);

      for (const entry of (outcomeEntries || [])) {
        if (entry.decision_id && !rewardMap.has(entry.decision_id)) {
          const views = entry.views ?? 0;
          const likes = entry.likes ?? 0;
          const retweets = entry.retweets ?? 0;
          const replies = entry.replies ?? 0;
          const followers = entry.followers_gained ?? 0;
          const engReward = likes * 0.5 + replies * 1.5 + retweets * 2.0;
          const followerReward = followers * 5.0;
          const norm = views > 0 ? Math.sqrt(views) : 1;
          const reward = (engReward + followerReward) / norm;
          rewardMap.set(entry.decision_id, { reward, followers });
        }
      }
    }
  }

  // Backfill
  let backfilled = 0;
  for (const opp of pendingOpps) {
    const data = opp.decision_id ? rewardMap.get(opp.decision_id) : null;
    if (data) {
      const { error: updateError } = await supabase
        .from('opportunity_log')
        .update({
          actual_reward: data.reward,
          actual_followers_gained: data.followers,
        })
        .eq('id', opp.id);

      if (!updateError) {
        backfilled++;
      }
    } else if (opp.action_taken === 'wait') {
      // For 'wait' decisions, actual_reward is 0 (we did nothing)
      await supabase
        .from('opportunity_log')
        .update({
          actual_reward: 0,
          actual_followers_gained: 0,
        })
        .eq('id', opp.id);
      backfilled++;
    }
  }

  if (backfilled > 0) {
    console.log(`[OPP_BACKFILL] Backfilled ${backfilled}/${pendingOpps.length} opportunity log entries`);
  }

  return { backfilled, checked: pendingOpps.length };
}
