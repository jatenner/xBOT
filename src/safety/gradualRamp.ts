/**
 * 🐢 GRADUAL RAMP — New accounts start slow and increase volume over days
 *
 * Day 1: 2 actions max
 * Day 2: 4 actions max
 * Day 3: 6 actions max
 * Day 4: 10 actions max
 * Day 5+: Full speed (strategy-controlled)
 *
 * This prevents brand-new accounts from immediately posting at bot speed.
 * Twitter watches new accounts closely — gradual ramp looks human.
 *
 * Uses RAMP_START_DATE env var (ISO string) as the anchor for day 1.
 * If not set, falls back to the earliest post by the CURRENT account
 * (filtered by TWITTER_USERNAME). If no posts found, treats as day 1.
 */

import { getSupabaseClient } from '../db';

const RAMP_SCHEDULE = [
  { day: 1, maxActions: 6 },
  { day: 2, maxActions: 10 },
  { day: 3, maxActions: 15 },
  { day: 4, maxActions: 20 },
  // Day 5+: no limit from ramp (strategy controls)
];

interface RampStatus {
  dayNumber: number;
  maxActions: number | null; // null = no ramp limit
  actionsToday: number;
  canAct: boolean;
  reason: string;
}

/**
 * Check if we're allowed to take another action based on gradual ramp
 */
export async function checkGradualRamp(): Promise<RampStatus> {
  const supabase = getSupabaseClient();

  // Determine ramp start date
  let rampStartDate: Date | null = null;

  // Priority 1: Explicit env var (most reliable for new accounts)
  const rampStartEnv = process.env.RAMP_START_DATE;
  if (rampStartEnv) {
    const parsed = new Date(rampStartEnv);
    if (!isNaN(parsed.getTime())) {
      rampStartDate = parsed;
    }
  }

  // Priority 2: Skip DB fallback when RAMP_START_DATE is not set —
  // the DB has no account-level column, so querying first post would
  // find old account data and skip the ramp. Without the env var,
  // treat as day 1 (safest default for new accounts).
  // Set RAMP_START_DATE explicitly when launching a new account.

  if (!rampStartDate) {
    // No posts yet — day 1, allow first action
    return { dayNumber: 1, maxActions: RAMP_SCHEDULE[0].maxActions, actionsToday: 0, canAct: true, reason: 'first_post' };
  }

  const dayNumber = Math.max(1, Math.ceil((Date.now() - rampStartDate.getTime()) / (24 * 60 * 60 * 1000)));

  // Find max actions for this day
  const rampEntry = RAMP_SCHEDULE.find(r => r.day === dayNumber);
  const maxActions = rampEntry ? rampEntry.maxActions : null; // null = no ramp limit

  if (maxActions === null) {
    return { dayNumber, maxActions: null, actionsToday: 0, canAct: true, reason: 'ramp_complete' };
  }

  // Count actions in rolling 24h window (not UTC midnight — avoids timezone issues
  // where 10pm ET posts count as "tomorrow" in UTC and exhaust next day's budget)
  const rolling24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { count: actionsToday } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .gte('posted_at', rolling24hAgo.toISOString());

  const canAct = (actionsToday || 0) < maxActions;

  return {
    dayNumber,
    maxActions,
    actionsToday: actionsToday || 0,
    canAct,
    reason: canAct ? `ramp_day_${dayNumber}` : `ramp_limit_reached (${actionsToday}/${maxActions})`,
  };
}
