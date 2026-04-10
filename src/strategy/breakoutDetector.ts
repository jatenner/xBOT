/**
 * BREAKOUT DETECTOR
 *
 * Finds outlier successes in the growth_ledger and analyzes what made them work.
 * One breakout reply that gets 50 likes teaches more than 100 with 0.
 *
 * This is the most important learning signal in the system.
 * Averages wash out signal. Breakouts concentrate it.
 */

import { getSupabaseClient } from '../db';

export interface BreakoutEvent {
  id: string;
  action_type: string;
  reward: number;
  views: number;
  likes: number;
  followers_gained: number;

  // What made it work?
  topic: string | null;
  format_type: string | null;
  hook_type: string | null;
  archetype: string | null;
  target_tier: string | null;
  target_username: string | null;
  discovery_source: string | null;
  discovery_keyword: string | null;
  posted_hour_utc: number | null;
  target_age_minutes: number | null;
  posted_at: string;
}

export interface BreakoutPattern {
  // Most common values across breakout events
  dominant_action_type: string | null;
  dominant_topics: string[];
  dominant_formats: string[];
  dominant_hooks: string[];
  dominant_archetypes: string[];
  dominant_tiers: string[];
  dominant_sources: string[];
  dominant_keywords: string[];
  dominant_hours: number[];
  avg_target_age_minutes: number | null;

  // Stats
  breakout_count: number;
  median_reward: number;
  breakout_threshold: number;
  total_ledger_entries: number;
}

/**
 * Find breakout events — entries with reward > 3x the median.
 * These are the outlier successes that reveal what actually works.
 */
export async function findBreakouts(daysBack: number = 7): Promise<{
  breakouts: BreakoutEvent[];
  pattern: BreakoutPattern;
  medianReward: number;
}> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all ledger entries with reward
  const { data: entries, error } = await supabase
    .from('growth_ledger')
    .select('*')
    .not('reward', 'is', null)
    .gt('reward', 0)
    .gte('posted_at', since)
    .order('reward', { ascending: true });

  if (error || !entries || entries.length === 0) {
    console.log(`[BREAKOUT] No ledger entries with reward in last ${daysBack} days`);
    return { breakouts: [], pattern: emptyPattern(0, 0), medianReward: 0 };
  }

  // Compute median reward
  const rewards = entries.map(e => Number(e.reward));
  const medianReward = median(rewards);
  const breakoutThreshold = Math.max(medianReward * 3, 0.5); // at least 0.5 to avoid noise

  // Find breakouts: reward > 3x median
  const breakouts: BreakoutEvent[] = entries
    .filter(e => Number(e.reward) >= breakoutThreshold)
    .map(e => ({
      id: e.id,
      action_type: e.action_type,
      reward: Number(e.reward),
      views: e.views || 0,
      likes: e.likes || 0,
      followers_gained: e.followers_gained || 0,
      topic: e.topic,
      format_type: e.format_type,
      hook_type: e.hook_type,
      archetype: e.archetype,
      target_tier: e.target_tier,
      target_username: e.target_username,
      discovery_source: e.discovery_source,
      discovery_keyword: e.discovery_keyword,
      posted_hour_utc: e.posted_hour_utc,
      target_age_minutes: e.target_age_minutes,
      posted_at: e.posted_at,
    }));

  console.log(`[BREAKOUT] Found ${breakouts.length} breakout events (threshold=${breakoutThreshold.toFixed(2)}, median=${medianReward.toFixed(2)}, total=${entries.length})`);

  // Extract patterns from breakouts
  const pattern = extractPattern(breakouts, medianReward, breakoutThreshold, entries.length);

  return { breakouts, pattern, medianReward };
}

/**
 * Extract the common factors across breakout events.
 * What do the winners have in common?
 */
function extractPattern(breakouts: BreakoutEvent[], medianReward: number, threshold: number, totalEntries: number): BreakoutPattern {
  if (breakouts.length === 0) {
    return emptyPattern(medianReward, totalEntries);
  }

  return {
    dominant_action_type: findDominant(breakouts.map(b => b.action_type)),
    dominant_topics: findTopN(breakouts.map(b => b.topic).filter(Boolean) as string[], 5),
    dominant_formats: findTopN(breakouts.map(b => b.format_type).filter(Boolean) as string[], 3),
    dominant_hooks: findTopN(breakouts.map(b => b.hook_type).filter(Boolean) as string[], 3),
    dominant_archetypes: findTopN(breakouts.map(b => b.archetype).filter(Boolean) as string[], 3),
    dominant_tiers: findTopN(breakouts.map(b => b.target_tier).filter(Boolean) as string[], 3),
    dominant_sources: findTopN(breakouts.map(b => b.discovery_source).filter(Boolean) as string[], 3),
    dominant_keywords: findTopN(breakouts.map(b => b.discovery_keyword).filter(Boolean) as string[], 5),
    dominant_hours: findTopNNumbers(breakouts.map(b => b.posted_hour_utc).filter(h => h !== null) as number[], 5),
    avg_target_age_minutes: breakouts.filter(b => b.target_age_minutes != null).length > 0
      ? Math.round(breakouts.filter(b => b.target_age_minutes != null).reduce((s, b) => s + b.target_age_minutes!, 0) / breakouts.filter(b => b.target_age_minutes != null).length)
      : null,
    breakout_count: breakouts.length,
    median_reward: medianReward,
    breakout_threshold: threshold,
    total_ledger_entries: totalEntries,
  };
}

/**
 * Check recent outcomes for fast watchdog signals.
 * Returns score multipliers for each action type.
 */
export async function getRecentActionHealth(): Promise<{
  reply_multiplier: number;
  single_multiplier: number;
  thread_multiplier: number;
  reason: string;
}> {
  const supabase = getSupabaseClient();
  const result = { reply_multiplier: 1.0, single_multiplier: 1.0, thread_multiplier: 1.0, reason: '' };
  const reasons: string[] = [];

  try {
    // Check for recent 429/consent wall events (last 30 min)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { count: recentSafetyEvents } = await supabase
      .from('system_events')
      .select('*', { count: 'exact', head: true })
      .in('event_type', ['rate_limit_429', 'consent_wall_detected', 'reply_v2_feed_consent_failed'])
      .gte('created_at', thirtyMinAgo);

    if ((recentSafetyEvents || 0) > 0) {
      result.reply_multiplier *= 0.3;
      result.single_multiplier *= 0.3;
      result.thread_multiplier *= 0.3;
      reasons.push(`safety_events=${recentSafetyEvents}_in_30m`);
    }

    // Check last 3 outcomes per action type
    for (const actionType of ['reply', 'single', 'thread'] as const) {
      const { data: recent } = await supabase
        .from('growth_ledger')
        .select('views, reward')
        .eq('action_type', actionType)
        .not('views', 'is', null)
        .order('posted_at', { ascending: false })
        .limit(3);

      if (recent && recent.length >= 3) {
        const allZeroViews = recent.every(r => (r.views || 0) === 0);
        const hasBreakout = recent.some(r => (r.views || 0) > 50);

        if (allZeroViews) {
          // Dead streak — pause this action type
          const key = `${actionType}_multiplier` as keyof typeof result;
          (result as any)[key] = 0;
          reasons.push(`${actionType}_dead_streak`);
        } else if (hasBreakout) {
          // Hot streak — boost this action type
          const key = `${actionType}_multiplier` as keyof typeof result;
          (result as any)[key] = 1.5;
          reasons.push(`${actionType}_hot_streak`);
        }
      }
    }

    result.reason = reasons.join('; ') || 'normal';
  } catch (err: any) {
    console.warn(`[BREAKOUT] Fast watchdog check failed (non-fatal): ${err.message}`);
    result.reason = 'watchdog_error';
  }

  if (reasons.length > 0) {
    console.log(`[BREAKOUT_WATCHDOG] ${result.reason} → reply=${result.reply_multiplier} single=${result.single_multiplier} thread=${result.thread_multiplier}`);
  }

  return result;
}

// ─── Helpers ───

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function findDominant(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  if (counts.size === 0) return null;
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

function findTopN(values: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(e => e[0]);
}

function findTopNNumbers(values: number[], n: number): number[] {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(e => e[0]);
}

function emptyPattern(medianReward: number, totalEntries: number): BreakoutPattern {
  return {
    dominant_action_type: null,
    dominant_topics: [],
    dominant_formats: [],
    dominant_hooks: [],
    dominant_archetypes: [],
    dominant_tiers: [],
    dominant_sources: [],
    dominant_keywords: [],
    dominant_hours: [],
    avg_target_age_minutes: null,
    breakout_count: 0,
    median_reward: medianReward,
    breakout_threshold: 0,
    total_ledger_entries: totalEntries,
  };
}
