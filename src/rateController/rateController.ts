/**
 * 🎯 RATE CONTROLLER
 * 
 * Autonomous rate controller that adapts posting/reply rates based on:
 * - Recent outcomes (yield)
 * - Recent failures (429, login walls, errors)
 * - Budgets remaining
 * - Backoff state
 * 
 * Outputs hourly targets with mode: WARMUP | GROWTH | COOLDOWN
 */

import { getSupabaseClient } from '../db/index';
import { isBlocked } from '../utils/backoffStore';
import { getBudgets } from '../utils/budgetStore';

export type ControllerMode = 'WARMUP' | 'GROWTH' | 'COOLDOWN';

export interface RateControllerOutput {
  mode: ControllerMode;
  target_replies_this_hour: number;
  target_posts_this_hour: number;
  allow_search: boolean;
  risk_score: number;
  yield_score: number;
  budgets_remaining: { nav: number; search: number };
  blocked_until: Date | null;
}

interface RecentOutcome {
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  impressions: number;
  posted_at: Date;
}

interface RecentFailure {
  error_type: string;
  occurred_at: Date;
}

const MAX_REPLIES_PER_HOUR = 6;
const MAX_POSTS_PER_HOUR = 2;
const PEAK_BURST_POSTS_PER_HOUR = 2; // Only if safe

// Active hours (America/New_York timezone)
const PEAK_HOURS = [7, 8, 9, 12, 13, 18, 19, 20, 21, 22]; // 7-10am, 12-2pm, 6-10pm
const OFF_PEAK_REDUCTION = 0.5; // 50% reduction off-peak

// Yield thresholds
const LOW_YIELD_THRESHOLD = 0.01; // 1% engagement rate
const HIGH_YIELD_THRESHOLD = 0.05; // 5% engagement rate

/**
 * Get current hour in America/New_York timezone
 */
function getCurrentHourET(): number {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return etTime.getHours();
}

/**
 * Check if current hour is peak
 */
function isPeakHour(hour: number): boolean {
  return PEAK_HOURS.includes(hour);
}

/**
 * Calculate yield score from recent outcomes
 */
function calculateYieldScore(outcomes: RecentOutcome[]): number {
  if (outcomes.length === 0) return 0.5; // Default neutral

  let totalScore = 0;
  for (const outcome of outcomes) {
    // Weighted engagement: likes + retweets*2 + replies*3 + bookmarks*0.5
    const engagement = outcome.likes + outcome.retweets * 2 + outcome.replies * 3 + outcome.bookmarks * 0.5;
    const impressions = Math.max(1, outcome.impressions || 1);
    const engagementRate = engagement / impressions;
    totalScore += engagementRate;
  }

  return totalScore / outcomes.length;
}

/**
 * Calculate risk score from recent failures
 */
function calculateRiskScore(failures: RecentFailure[]): number {
  if (failures.length === 0) return 0;

  const recentFailures = failures.filter(f => {
    const ageHours = (Date.now() - f.occurred_at.getTime()) / (1000 * 60 * 60);
    return ageHours < 24; // Last 24 hours
  });

  // Weight failures by type
  let riskScore = 0;
  for (const failure of recentFailures) {
    if (failure.error_type === '429') {
      riskScore += 0.5; // High risk
    } else if (failure.error_type === 'login_wall') {
      riskScore += 0.3; // Medium-high risk
    } else if (failure.error_type === 'posting_error') {
      riskScore += 0.1; // Low risk
    }
  }

  return Math.min(1, riskScore); // Cap at 1.0
}

/**
 * Main rate controller function
 */
export async function computeRateTargets(): Promise<RateControllerOutput> {
  const supabase = getSupabaseClient();
  const currentHour = getCurrentHourET();
  const isPeak = isPeakHour(currentHour);

  // 1. Check backoff state
  const backoffCheck = await isBlocked('harvest_search');
  const budgets = await getBudgets();

  // 2. Fetch recent outcomes (last 20 posts/replies)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { data: recentContent } = await supabase
    .from('content_metadata')
    .select('actual_likes, actual_retweets, actual_replies, actual_impressions, posted_at')
    .eq('status', 'posted')
    .gte('posted_at', twentyFourHoursAgo.toISOString())
    .order('posted_at', { ascending: false })
    .limit(20);

  const outcomes: RecentOutcome[] = (recentContent || []).map(c => ({
    likes: c.actual_likes || 0,
    retweets: c.actual_retweets || 0,
    replies: c.actual_replies || 0,
    bookmarks: 0, // Not always available
    impressions: c.actual_impressions || 0,
    posted_at: new Date(c.posted_at),
  }));

  // 3. Fetch recent failures
  const { data: recentFailures } = await supabase
    .from('system_events')
    .select('event_type, created_at')
    .in('event_type', ['rate_limit_429', 'login_wall_detected', 'posting_error'])
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  const failures: RecentFailure[] = (recentFailures || []).map(f => ({
    error_type: f.event_type === 'rate_limit_429' ? '429' : f.event_type === 'login_wall_detected' ? 'login_wall' : 'posting_error',
    occurred_at: new Date(f.created_at),
  }));

  // 4. Calculate scores
  const yieldScore = calculateYieldScore(outcomes);
  const riskScore = calculateRiskScore(failures);

  // 5. Determine mode
  let mode: ControllerMode = 'WARMUP';
  if (backoffCheck.blocked || riskScore > 0.5) {
    mode = 'COOLDOWN';
  } else if (yieldScore > HIGH_YIELD_THRESHOLD && riskScore < 0.2) {
    mode = 'GROWTH';
  }

  // 🎯 RAMP SCHEDULE: Calculate hours since first execution and stability metrics
  const { data: firstState } = await supabase
    .from('rate_controller_state')
    .select('hour_start')
    .order('hour_start', { ascending: true })
    .limit(1)
    .maybeSingle();
  
  const hoursSinceStart = firstState?.hour_start 
    ? Math.floor((Date.now() - new Date(firstState.hour_start).getTime()) / (1000 * 60 * 60))
    : 0;
  
  // Check 24h stability: no 429s, no auth failures in last 24h
  const ramp24HoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { count: recent429s } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'rate_limit_429')
    .gte('created_at', ramp24HoursAgo.toISOString());
  
  const { count: authFailures } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .in('event_type', ['login_wall_detected', 'auth_freshness_failed'])
    .gte('created_at', ramp24HoursAgo.toISOString());
  
  const has24hStability = (recent429s || 0) === 0 && (authFailures || 0) === 0;
  
  // Calculate success rate (last 6 hours)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const { data: recentExecutions } = await supabase
    .from('rate_controller_state')
    .select('executed_replies, target_replies_this_hour')
    .gte('hour_start', sixHoursAgo.toISOString())
    .order('hour_start', { ascending: false })
    .limit(6);
  
  const totalAttempted = (recentExecutions || []).reduce((sum, r) => sum + (r.target_replies_this_hour || 0), 0);
  const totalExecuted = (recentExecutions || []).reduce((sum, r) => sum + (r.executed_replies || 0), 0);
  const successRate = totalAttempted > 0 ? totalExecuted / totalAttempted : 1.0;
  
  // 6. Calculate targets based on mode and ramp schedule
  let targetReplies = 0;
  let targetPosts = 0;
  let allowSearch = true;
  let rampReason = '';

  if (mode === 'COOLDOWN') {
    // Minimal activity
    targetReplies = 0;
    targetPosts = 0;
    allowSearch = false;
    rampReason = 'cooldown_mode';
  } else if (mode === 'WARMUP') {
    // 🎯 RAMP SCHEDULE: 1→2 replies/hour over first 6 hours if stable
    const baseReplies = 1;
    let rampReplies = baseReplies;
    
    // First 6 hours: allow up to 2 replies/hour if zero 429s and success rate > 50%
    if (hoursSinceStart < 6) {
      const hasZero429s = (recent429s || 0) === 0;
      if (hasZero429s && successRate > 0.5) {
        // Ramp: hour 0-2 = 1, hour 3-5 = 2
        rampReplies = hoursSinceStart >= 3 ? 2 : 1;
        rampReason = `warmup_ramp_hour_${hoursSinceStart}_stable`;
      } else {
        rampReplies = 1;
        rampReason = `warmup_hour_${hoursSinceStart}_conservative`;
      }
    } else {
      rampReplies = 1;
      rampReason = 'warmup_beyond_6h';
    }
    
    targetReplies = isPeak ? rampReplies : Math.floor(rampReplies * OFF_PEAK_REDUCTION);
    targetPosts = 0; // Start with 0, ramp up after warmup period
    allowSearch = budgets.searchRemaining > 0 && !backoffCheck.blocked;
  } else if (mode === 'GROWTH') {
    // 🎯 RAMP SCHEDULE: 1→2→3→4 replies/hour over 24 hours if stable
    let rampReplies = 2; // Default GROWTH target
    
    if (has24hStability) {
      // Full ramp: 1→2→3→4 over 24 hours
      if (hoursSinceStart < 6) {
        rampReplies = hoursSinceStart >= 3 ? 2 : 1;
        rampReason = `growth_ramp_hour_${hoursSinceStart}_early`;
      } else if (hoursSinceStart < 12) {
        rampReplies = 2;
        rampReason = `growth_ramp_hour_${hoursSinceStart}_mid`;
      } else if (hoursSinceStart < 18) {
        rampReplies = 3;
        rampReason = `growth_ramp_hour_${hoursSinceStart}_late`;
      } else {
        rampReplies = 4;
        rampReason = `growth_ramp_hour_${hoursSinceStart}_full`;
      }
    } else {
      // Conservative ramp if not fully stable
      rampReplies = Math.min(2, 1 + Math.floor(hoursSinceStart / 6));
      rampReason = `growth_ramp_hour_${hoursSinceStart}_conservative`;
    }
    
    const peakMultiplier = isPeak ? 1 : OFF_PEAK_REDUCTION;
    targetReplies = Math.min(MAX_REPLIES_PER_HOUR, Math.floor(rampReplies * peakMultiplier));
    targetPosts = isPeak && riskScore < 0.1 ? PEAK_BURST_POSTS_PER_HOUR : MAX_POSTS_PER_HOUR;
    allowSearch = budgets.searchRemaining > 0 && !backoffCheck.blocked;
  }

  // 7. Respect budgets
  if (budgets.navRemaining < targetReplies + targetPosts) {
    const total = targetReplies + targetPosts;
    const ratio = budgets.navRemaining / Math.max(1, total);
    targetReplies = Math.floor(targetReplies * ratio);
    targetPosts = Math.floor(targetPosts * ratio);
  }

  // 9. Store state
  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);

  await supabase
    .from('rate_controller_state')
    .upsert({
      hour_start: hourStart.toISOString(),
      mode,
      target_replies_this_hour: targetReplies,
      target_posts_this_hour: targetPosts,
      allow_search: allowSearch,
      risk_score: riskScore,
      yield_score: yieldScore,
      budgets_remaining: { nav: budgets.navRemaining, search: budgets.searchRemaining },
      blocked_until: backoffCheck.blockedUntil?.toISOString() || null,
      ramp_reason: rampReason,
      hours_since_start: hoursSinceStart,
      has_24h_stability: has24hStability,
      success_rate_6h: successRate,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'hour_start',
    });

  return {
    mode,
    target_replies_this_hour: targetReplies,
    target_posts_this_hour: targetPosts,
    allow_search: allowSearch,
    risk_score: riskScore,
    yield_score: yieldScore,
    budgets_remaining: { nav: budgets.navRemaining, search: budgets.searchRemaining },
    blocked_until: backoffCheck.blockedUntil || null,
  };
}

/**
 * Get current hour's targets (from DB or compute)
 */
export async function getCurrentHourTargets(): Promise<RateControllerOutput> {
  const supabase = getSupabaseClient();
  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);

  const { data } = await supabase
    .from('rate_controller_state')
    .select('*')
    .eq('hour_start', hourStart.toISOString())
    .single();

  if (data) {
    return {
      mode: data.mode as ControllerMode,
      target_replies_this_hour: data.target_replies_this_hour,
      target_posts_this_hour: data.target_posts_this_hour,
      allow_search: data.allow_search,
      risk_score: data.risk_score,
      yield_score: data.yield_score,
      budgets_remaining: data.budgets_remaining as { nav: number; search: number },
      blocked_until: data.blocked_until ? new Date(data.blocked_until) : null,
    };
  }

  // Compute if not found
  return computeRateTargets();
}
