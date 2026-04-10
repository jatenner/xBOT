/**
 * ADAPTIVE STRATEGY
 *
 * The system's brain. Every tick asks: "What's the single best thing to do RIGHT NOW?"
 *
 * Reads strategy_state (learned operating playbook) and computes a per-action
 * score for reply/single/thread/wait. Picks the highest.
 *
 * No hardcoded limits — only safety constraints are fixed.
 * Volume, timing, mix, and content preferences are all learned from data.
 */

import { getSupabaseClient } from '../db';
import { getRecentActionHealth } from './breakoutDetector';
import { checkGradualRamp } from '../safety/gradualRamp';

// ─── Types ───

export interface StrategyState {
  // Volume
  target_replies_per_day: number;
  target_singles_per_day: number;
  target_threads_per_day: number;
  reply_pacing_minutes: number;
  post_pacing_minutes: number;

  // Timing
  active_hours: number[];
  peak_hours: number[];
  peak_volume_multiplier: number;

  // Mix weights
  reply_weight: number;
  single_weight: number;
  thread_weight: number;

  // Content preferences
  preferred_topics: string[];
  preferred_formats: string[];
  preferred_hooks: string[];
  preferred_archetypes: string[];
  avoided_topics: string[];

  // Discovery preferences
  preferred_tiers: string[];
  preferred_sources: Record<string, number>;
  keyword_performance: Record<string, number>;

  // Meta
  generation: number;
  total_outcomes: number;
  last_updated_at: string;
}

export type ActionType = 'reply' | 'single' | 'thread' | 'wait';

export interface ActionDecision {
  action: ActionType;
  score: number;
  scores: Record<ActionType, number>;
  reason: string;
  strategy_generation: number;
}

export interface TickContext {
  // Today's counts
  replies_today: number;
  singles_today: number;
  threads_today: number;

  // Pacing
  minutes_since_last_reply: number;
  minutes_since_last_post: number;

  // Availability
  reply_candidates_available: number;
  queued_content_available: number;

  // Safety
  safety_ok: boolean;
  x_actions_enabled: boolean;
  heartbeat_ok: boolean;

  // Time
  current_hour_utc: number;
}

// ─── Strategy Cache ───

let cachedStrategy: StrategyState | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Read the current strategy from DB (cached 5 min).
 */
export async function getStrategy(): Promise<StrategyState> {
  if (cachedStrategy && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedStrategy;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('strategy_state')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) {
      console.warn(`[STRATEGY] Failed to read strategy_state: ${error?.message || 'no data'}, using defaults`);
      return getDefaultStrategy();
    }

    cachedStrategy = {
      target_replies_per_day: data.target_replies_per_day,
      target_singles_per_day: data.target_singles_per_day,
      target_threads_per_day: data.target_threads_per_day,
      reply_pacing_minutes: data.reply_pacing_minutes,
      post_pacing_minutes: data.post_pacing_minutes,
      active_hours: Array.isArray(data.active_hours) ? data.active_hours : [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22],
      peak_hours: Array.isArray(data.peak_hours) ? data.peak_hours : [14,15,16,17,18],
      peak_volume_multiplier: Number(data.peak_volume_multiplier) || 1.5,
      reply_weight: Number(data.reply_weight) || 3.0,
      single_weight: Number(data.single_weight) || 1.0,
      thread_weight: Number(data.thread_weight) || 0.5,
      preferred_topics: data.preferred_topics || [],
      preferred_formats: data.preferred_formats || [],
      preferred_hooks: data.preferred_hooks || [],
      preferred_archetypes: data.preferred_archetypes || [],
      avoided_topics: data.avoided_topics || [],
      preferred_tiers: data.preferred_tiers || ['medium', 'large'],
      preferred_sources: data.preferred_sources || {},
      keyword_performance: data.keyword_performance || {},
      generation: data.generation || 0,
      total_outcomes: data.total_outcomes || 0,
      last_updated_at: data.last_updated_at,
    };
    cacheTime = Date.now();
    return cachedStrategy;
  } catch (err: any) {
    console.warn(`[STRATEGY] Error reading strategy: ${err.message}, using defaults`);
    return getDefaultStrategy();
  }
}

function getDefaultStrategy(): StrategyState {
  return {
    target_replies_per_day: 5,
    target_singles_per_day: 3,
    target_threads_per_day: 1,
    reply_pacing_minutes: 30,
    post_pacing_minutes: 60,
    active_hours: [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22],
    peak_hours: [14,15,16,17,18],
    peak_volume_multiplier: 1.5,
    reply_weight: 3.0,
    single_weight: 1.0,
    thread_weight: 0.5,
    preferred_topics: [],
    preferred_formats: [],
    preferred_hooks: [],
    preferred_archetypes: [],
    avoided_topics: [],
    preferred_tiers: ['medium', 'large'],
    preferred_sources: {},
    keyword_performance: {},
    generation: 0,
    total_outcomes: 0,
    last_updated_at: new Date().toISOString(),
  };
}

/**
 * Pick the single best action to take RIGHT NOW.
 *
 * Computes a score for each action type based on:
 * - Budget remaining (today's count vs target)
 * - Pacing (time since last action of that type)
 * - Time of day (active hours, peak multiplier)
 * - Learned weights (reply_weight vs single_weight vs thread_weight)
 * - Availability (are there candidates/queued content?)
 * - Safety (is it safe to act?)
 */
export async function pickNextAction(strategy: StrategyState, context: TickContext): Promise<ActionDecision> {
  const scores: Record<ActionType, number> = { reply: 0, single: 0, thread: 0, wait: 0 };
  const reasons: string[] = [];

  // Safety check — overrides everything
  if (!context.safety_ok || !context.x_actions_enabled) {
    reasons.push('safety_blocked');
    return { action: 'wait', score: 100, scores: { ...scores, wait: 100 }, reason: reasons.join('; '), strategy_generation: strategy.generation };
  }

  if (!context.heartbeat_ok) {
    reasons.push('heartbeat_failed');
    return { action: 'wait', score: 100, scores: { ...scores, wait: 100 }, reason: reasons.join('; '), strategy_generation: strategy.generation };
  }

  // Gradual ramp — new accounts start slow (day 1: 2 actions, day 5: 15, day 6+: unlimited)
  try {
    const ramp = await checkGradualRamp();
    if (!ramp.canAct) {
      reasons.push(`gradual_ramp: ${ramp.reason} (day ${ramp.dayNumber}, ${ramp.actionsToday}/${ramp.maxActions})`);
      return { action: 'wait', score: 100, scores: { ...scores, wait: 100 }, reason: reasons.join('; '), strategy_generation: strategy.generation };
    }
    if (ramp.maxActions !== null) {
      reasons.push(`ramp_day_${ramp.dayNumber}: ${ramp.actionsToday}/${ramp.maxActions} used`);
    }
  } catch (rampErr) {
    // Non-fatal: if ramp check fails, continue (don't block on DB errors)
    reasons.push('gradual_ramp: check_failed (allowing action)');
  }

  // 🧠 Load tick advisor recommendations (non-fatal)
  let tickAdvice: any = null;
  try {
    const { getTickAdvice } = await import('../intelligence/tickAdvisor');
    tickAdvice = await getTickAdvice();
    if (tickAdvice && tickAdvice.confidence > 0.3) {
      reasons.push(`tick_advisor: confidence=${tickAdvice.confidence.toFixed(2)}`);
    }
  } catch { /* non-fatal */ }

  // 🔍 FAST WATCHDOG: Check recent outcomes for dead streaks / hot streaks / safety events
  let watchdog = { reply_multiplier: 1.0, single_multiplier: 1.0, thread_multiplier: 1.0, reason: 'normal' };
  try {
    watchdog = await getRecentActionHealth();
    if (watchdog.reason !== 'normal') {
      reasons.push(`watchdog: ${watchdog.reason}`);
    }
  } catch { /* non-fatal, use defaults */ }

  // 🐢 BOOTSTRAP PACING FLOOR: New accounts (< 500 followers) must wait at least 120 min
  // between ANY actions to avoid looking like a bot. Overrides strategy pacing if lower.
  let ourFollowers = 0;
  try {
    const { getFollowerCountFromDB } = await import('../utils/followerCountHelper');
    ourFollowers = await getFollowerCountFromDB();
  } catch { /* fallback to 0 */ }
  const isBootstrapStage = ourFollowers < 500;
  // Add random jitter so we don't post at exact intervals (anti-detection)
  const jitter = Math.floor(Math.random() * 60) - 30; // ±30 min randomness
  const BOOTSTRAP_MIN_PACING_MINUTES = 45 + jitter; // 15-75 min range

  const effectiveReplyPacing = isBootstrapStage
    ? Math.max(strategy.reply_pacing_minutes, BOOTSTRAP_MIN_PACING_MINUTES)
    : strategy.reply_pacing_minutes;
  const effectivePostPacing = isBootstrapStage
    ? Math.max(strategy.post_pacing_minutes, BOOTSTRAP_MIN_PACING_MINUTES)
    : strategy.post_pacing_minutes;

  if (isBootstrapStage) {
    reasons.push(`bootstrap_pacing: ${BOOTSTRAP_MIN_PACING_MINUTES}min floor (${ourFollowers} followers)`);
  }

  // Check if current hour is in active hours
  const isActiveHour = strategy.active_hours.includes(context.current_hour_utc);
  const isPeakHour = strategy.peak_hours.includes(context.current_hour_utc);

  if (!isActiveHour) {
    reasons.push(`hour=${context.current_hour_utc} not in active_hours`);
    scores.wait = 50;
    // Still allow some activity outside active hours at reduced weight
  }

  // 🐢 BOOTSTRAP: Check time since ANY action (not just same-type action)
  const minutesSinceAnyAction = Math.min(context.minutes_since_last_reply, context.minutes_since_last_post);
  const bootstrapGlobalPacingOk = !isBootstrapStage || minutesSinceAnyAction >= BOOTSTRAP_MIN_PACING_MINUTES;

  if (isBootstrapStage && !bootstrapGlobalPacingOk) {
    reasons.push(`bootstrap_global_pacing: ${minutesSinceAnyAction.toFixed(0)}m since last action < ${BOOTSTRAP_MIN_PACING_MINUTES}m`);
    return { action: 'wait', score: 100, scores: { ...scores, wait: 100 }, reason: reasons.join('; '), strategy_generation: strategy.generation };
  }

  // ─── REPLY SCORE ───
  const replyBudgetFactor = strategy.target_replies_per_day > 0
    ? Math.max(0, 1 - (context.replies_today / strategy.target_replies_per_day))
    : 0;
  const replyPacingOk = context.minutes_since_last_reply >= effectiveReplyPacing;
  const replyCandidatesOk = context.reply_candidates_available > 0;

  if (replyBudgetFactor > 0 && replyPacingOk && replyCandidatesOk && isActiveHour) {
    scores.reply = strategy.reply_weight * replyBudgetFactor;
    if (isPeakHour) scores.reply *= strategy.peak_volume_multiplier;
    // Tick advisor boost: if current hour matches preferred_hour_buckets, add +0.5
    if (tickAdvice && tickAdvice.confidence > 0.3 && tickAdvice.targeting_preferences?.preferred_hour_buckets?.length) {
      const hourStr = String(context.current_hour_utc);
      if (tickAdvice.targeting_preferences.preferred_hour_buckets.some((b: string) => b.includes(hourStr))) {
        scores.reply += 0.5;
        reasons.push('tick_advisor_reply_boost: +0.5');
      }
    }
    reasons.push(`reply: weight=${strategy.reply_weight} budget=${replyBudgetFactor.toFixed(2)} peak=${isPeakHour}`);
  } else {
    if (!replyPacingOk) reasons.push(`reply: pacing (${context.minutes_since_last_reply}m < ${effectiveReplyPacing}m)`);
    if (!replyCandidatesOk) reasons.push('reply: no_candidates');
    if (replyBudgetFactor <= 0) reasons.push(`reply: budget_exhausted (${context.replies_today}/${strategy.target_replies_per_day})`);
  }

  // ─── SINGLE SCORE ───
  const singleBudgetFactor = strategy.target_singles_per_day > 0
    ? Math.max(0, 1 - (context.singles_today / strategy.target_singles_per_day))
    : 0;
  const singlePacingOk = context.minutes_since_last_post >= effectivePostPacing;
  const contentOk = context.queued_content_available > 0;

  if (singleBudgetFactor > 0 && singlePacingOk && contentOk && isActiveHour) {
    scores.single = strategy.single_weight * singleBudgetFactor;
    if (isPeakHour) scores.single *= strategy.peak_volume_multiplier;
    reasons.push(`single: weight=${strategy.single_weight} budget=${singleBudgetFactor.toFixed(2)}`);
  }

  // ─── THREAD SCORE ───
  const threadBudgetFactor = strategy.target_threads_per_day > 0
    ? Math.max(0, 1 - (context.threads_today / strategy.target_threads_per_day))
    : 0;

  if (threadBudgetFactor > 0 && singlePacingOk && contentOk && isActiveHour) {
    scores.thread = strategy.thread_weight * threadBudgetFactor;
    if (isPeakHour) scores.thread *= strategy.peak_volume_multiplier;
    reasons.push(`thread: weight=${strategy.thread_weight} budget=${threadBudgetFactor.toFixed(2)}`);
  }

  // ─── POSTING MIX GUARANTEE ───
  // Ensure minimum singles/threads per day even when replies dominate.
  // If we've done lots of replies but few singles, boost single score to guarantee profile content.
  const singleDeficit = (strategy.target_singles_per_day || 3) - context.singles_today;
  const threadDeficit = (strategy.target_threads_per_day || 1) - context.threads_today;
  if (singleDeficit > 0 && context.replies_today >= 3 && scores.single === 0 && contentOk && isActiveHour && singlePacingOk) {
    // Force single when we're reply-heavy but profile has no fresh content
    scores.single = Math.max(scores.reply * 0.8, strategy.single_weight);
    reasons.push(`mix_guarantee: single boosted (${context.singles_today}/${strategy.target_singles_per_day} singles, ${context.replies_today} replies)`);
  }
  if (threadDeficit > 0 && context.replies_today >= 5 && scores.thread === 0 && contentOk && isActiveHour && singlePacingOk) {
    scores.thread = Math.max(scores.reply * 0.6, strategy.thread_weight);
    reasons.push(`mix_guarantee: thread boosted (${context.threads_today}/${strategy.target_threads_per_day} threads)`);
  }

  // ─── WAIT SCORE ───
  // Base wait score — only wins when nothing else scores
  scores.wait = 0.1;

  // ─── FAST WATCHDOG MULTIPLIERS ───
  // React to recent outcomes: dead streaks kill scores, hot streaks boost them
  scores.reply *= watchdog.reply_multiplier;
  scores.single *= watchdog.single_multiplier;
  scores.thread *= watchdog.thread_multiplier;

  // ─── PICK WINNER ───
  const entries = Object.entries(scores) as [ActionType, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const winner = entries[0];

  const decision: ActionDecision = {
    action: winner[0],
    score: winner[1],
    scores,
    reason: reasons.join('; '),
    strategy_generation: strategy.generation,
  };

  console.log(`[STRATEGY] action=${decision.action} score=${decision.score.toFixed(2)} scores=${JSON.stringify(scores)} gen=${strategy.generation}`);
  if (decision.reason) {
    console.log(`[STRATEGY] reasons: ${decision.reason}`);
  }

  return decision;
}
