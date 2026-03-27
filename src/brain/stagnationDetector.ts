/**
 * Brain: Stagnation Detector & Strategy Pivot Engine
 *
 * Detects when the ENTIRE strategy is failing — not individual posts,
 * but the overall approach. When stagnation is confirmed, generates
 * and executes strategy pivots.
 *
 * This is the "nothing is working, fundamentally change approach" system
 * that the existing optimizer lacks.
 *
 * Stagnation = we've been active but seeing no meaningful results.
 * This is different from "we haven't posted" (inactivity) or
 * "one post failed" (normal variance).
 *
 * Runs every 6 hours (not hourly — strategy pivots should be deliberate).
 */

import { getSupabaseClient } from '../db';
import { getSelfModel } from './db';
import type { GrowthPhase } from './types';

const LOG_PREFIX = '[brain/stagnation]';

// =============================================================================
// Stagnation Thresholds (per growth phase)
// =============================================================================

interface PhaseThresholds {
  min_actions_to_evaluate: number;  // Don't judge until we've done this many actions
  min_days_to_evaluate: number;     // Don't judge until this many days have passed
  min_avg_views: number;            // Below this = stagnating
  min_followers_gained_per_week: number; // Below this = stagnating
  min_engagement_rate: number;      // Below this = stagnating
}

const THRESHOLDS: Record<GrowthPhase, PhaseThresholds> = {
  cold_start: {
    min_actions_to_evaluate: 30,      // Need 30 actions before judging
    min_days_to_evaluate: 7,          // At least a week
    min_avg_views: 20,                // Even 20 views means algo is showing us to SOMEONE
    min_followers_gained_per_week: 1, // At least 1 follower per week
    min_engagement_rate: 0.005,       // 0.5% engagement minimum
  },
  early_traction: {
    min_actions_to_evaluate: 50,
    min_days_to_evaluate: 7,
    min_avg_views: 100,
    min_followers_gained_per_week: 5,
    min_engagement_rate: 0.01,
  },
  growth: {
    min_actions_to_evaluate: 50,
    min_days_to_evaluate: 7,
    min_avg_views: 500,
    min_followers_gained_per_week: 20,
    min_engagement_rate: 0.015,
  },
  authority: {
    min_actions_to_evaluate: 50,
    min_days_to_evaluate: 7,
    min_avg_views: 2000,
    min_followers_gained_per_week: 50,
    min_engagement_rate: 0.02,
  },
  scale: {
    min_actions_to_evaluate: 50,
    min_days_to_evaluate: 7,
    min_avg_views: 5000,
    min_followers_gained_per_week: 100,
    min_engagement_rate: 0.02,
  },
};

// =============================================================================
// Pivot strategies for each phase
// =============================================================================

interface StrategyPivot {
  name: string;
  description: string;
  changes: Record<string, any>;  // Fields to write to strategy_state
  duration_days: number;         // How long to run this pivot before evaluating
}

function getPivotStrategies(phase: GrowthPhase, diagnosis: StagnationDiagnosis): StrategyPivot[] {
  const pivots: StrategyPivot[] = [];

  if (phase === 'cold_start' || phase === 'early_traction') {
    // At cold start, the #1 issue is usually: nobody sees our original posts.
    // The fix is almost always: more replies to bigger accounts.

    if (diagnosis.reply_ratio < 0.7) {
      pivots.push({
        name: 'heavy_reply_pivot',
        description: 'Shift to 90% replies, 10% originals. Original posts get no reach at this size. Replies to bigger accounts are the only way to get eyeballs.',
        changes: {
          target_replies_per_day: 8,
          target_singles_per_day: 1,
          target_threads_per_day: 0,
          reply_weight: 5.0,
          single_weight: 0.5,
          thread_weight: 0.0,
          reply_pacing_minutes: 15,
        },
        duration_days: 7,
      });
    }

    if (diagnosis.avg_target_followers < 10000) {
      pivots.push({
        name: 'bigger_targets_pivot',
        description: 'Reply to BIGGER accounts (50K-500K followers). Small accounts have small audiences — our replies there get seen by nobody.',
        changes: {
          preferred_tiers: ['large', 'mega'],
        },
        duration_days: 7,
      });
    }

    if (diagnosis.avg_engagement_rate < 0.01) {
      pivots.push({
        name: 'content_quality_pivot',
        description: 'Content quality issue. Switch to data-driven, specific replies instead of generic comments. Every reply should add a specific stat, mechanism, or insight.',
        changes: {
          preferred_archetypes: ['insight_addon', 'practical_implication'],
          preferred_hooks: ['surprising_stat', 'data_driven', 'curiosity_gap'],
        },
        duration_days: 7,
      });
    }

    if (diagnosis.posting_hour_spread < 4) {
      pivots.push({
        name: 'timing_diversity_pivot',
        description: 'All posts concentrated in same time window. Spread across day to find when OUR audience is active.',
        changes: {
          active_hours: { start: 6, end: 23 },
          peak_hours: [8, 12, 17, 20], // Test multiple windows
        },
        duration_days: 7,
      });
    }
  }

  if (phase === 'growth' || phase === 'authority') {
    if (diagnosis.content_diversity < 3) {
      pivots.push({
        name: 'format_diversity_pivot',
        description: 'Stuck on one content format. Experiment with threads, lists, hot takes, data posts.',
        changes: {
          preferred_formats: ['thread', 'list', 'hot_take', 'data_driven'],
          exploration_rate: 0.4, // 40% exploration
        },
        duration_days: 10,
      });
    }
  }

  // Universal pivot: if nothing else, try the opposite of what we're doing
  if (pivots.length === 0) {
    pivots.push({
      name: 'invert_strategy_pivot',
      description: 'Nothing specific to fix. Try the OPPOSITE approach: if we do mostly replies, try originals. If we post in mornings, try evenings. If we use educational tone, try provocative.',
      changes: {
        // Invert reply/post ratio
        reply_weight: diagnosis.reply_ratio > 0.5 ? 0.5 : 5.0,
        single_weight: diagnosis.reply_ratio > 0.5 ? 5.0 : 0.5,
        // Force high exploration
        exploration_rate: 0.5,
      },
      duration_days: 7,
    });
  }

  return pivots;
}

// =============================================================================
// Stagnation diagnosis
// =============================================================================

interface StagnationDiagnosis {
  is_stagnating: boolean;
  confidence: number;
  reasons: string[];
  reply_ratio: number;            // Replies / total actions
  avg_target_followers: number;   // Average followers of accounts we reply to
  avg_engagement_rate: number;
  avg_views: number;
  posting_hour_spread: number;    // How many different hours we post in
  content_diversity: number;      // How many different formats/hooks we use
  days_since_last_follower: number;
  total_actions: number;
  total_days_active: number;
}

async function diagnoseStagnation(): Promise<StagnationDiagnosis> {
  const supabase = getSupabaseClient();
  const selfModel = await getSelfModel();

  const phase = selfModel?.growth_phase ?? 'cold_start';
  const thresholds = THRESHOLDS[phase];

  const diagnosis: StagnationDiagnosis = {
    is_stagnating: false,
    confidence: 0,
    reasons: [],
    reply_ratio: 0,
    avg_target_followers: 0,
    avg_engagement_rate: 0,
    avg_views: 0,
    posting_hour_spread: 0,
    content_diversity: 0,
    days_since_last_follower: 999,
    total_actions: 0,
    total_days_active: 0,
  };

  // Count total actions in evaluation window
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: ledger } = await supabase
    .from('growth_ledger')
    .select('action_type, reward, views, likes, engagement_rate, posted_at, posted_hour_utc, format_type, hook_type, target_followers')
    .gte('posted_at', since)
    .not('reward', 'is', null);

  if (!ledger || ledger.length === 0) {
    diagnosis.reasons.push('No actions recorded yet');
    return diagnosis;
  }

  diagnosis.total_actions = ledger.length;

  // Calculate days active
  const uniqueDays = new Set(ledger.map(e => e.posted_at?.substring(0, 10)).filter(Boolean));
  diagnosis.total_days_active = uniqueDays.size;

  // Not enough data to judge?
  if (diagnosis.total_actions < thresholds.min_actions_to_evaluate) {
    diagnosis.reasons.push(`Only ${diagnosis.total_actions} actions (need ${thresholds.min_actions_to_evaluate})`);
    return diagnosis;
  }
  if (diagnosis.total_days_active < thresholds.min_days_to_evaluate) {
    diagnosis.reasons.push(`Only ${diagnosis.total_days_active} days active (need ${thresholds.min_days_to_evaluate})`);
    return diagnosis;
  }

  // Reply ratio
  const replies = ledger.filter(e => e.action_type === 'reply').length;
  diagnosis.reply_ratio = replies / ledger.length;

  // Average target followers (for replies)
  const replyEntries = ledger.filter(e => e.action_type === 'reply' && e.target_followers);
  diagnosis.avg_target_followers = replyEntries.length > 0
    ? replyEntries.reduce((s, e) => s + (e.target_followers ?? 0), 0) / replyEntries.length
    : 0;

  // Average engagement
  diagnosis.avg_engagement_rate = ledger.reduce((s, e) => s + (e.engagement_rate ?? 0), 0) / ledger.length;
  diagnosis.avg_views = ledger.reduce((s, e) => s + (e.views ?? 0), 0) / ledger.length;

  // Posting hour spread
  const uniqueHours = new Set(ledger.map(e => e.posted_hour_utc).filter(h => h != null));
  diagnosis.posting_hour_spread = uniqueHours.size;

  // Content diversity (unique formats + hooks used)
  const uniqueFormats = new Set(ledger.map(e => e.format_type).filter(Boolean));
  const uniqueHooks = new Set(ledger.map(e => e.hook_type).filter(Boolean));
  diagnosis.content_diversity = uniqueFormats.size + uniqueHooks.size;

  // Days since last follower gain
  if (selfModel) {
    const lastGain = selfModel.followers_gained_7d ?? 0;
    diagnosis.days_since_last_follower = lastGain > 0 ? 0 : 7; // Simplified
  }

  // === STAGNATION CHECKS ===
  let stagnationScore = 0;

  if (diagnosis.avg_views < thresholds.min_avg_views) {
    stagnationScore += 0.3;
    diagnosis.reasons.push(`Avg views (${Math.round(diagnosis.avg_views)}) below threshold (${thresholds.min_avg_views})`);
  }

  if (diagnosis.avg_engagement_rate < thresholds.min_engagement_rate) {
    stagnationScore += 0.2;
    diagnosis.reasons.push(`Avg engagement (${(diagnosis.avg_engagement_rate * 100).toFixed(2)}%) below threshold (${(thresholds.min_engagement_rate * 100).toFixed(1)}%)`);
  }

  const weeklyFollowers = selfModel?.followers_gained_7d ?? 0;
  if (weeklyFollowers < thresholds.min_followers_gained_per_week) {
    stagnationScore += 0.3;
    diagnosis.reasons.push(`Followers gained (${weeklyFollowers}/week) below threshold (${thresholds.min_followers_gained_per_week}/week)`);
  }

  // Check if all recent rewards are near zero
  const recentRewards = ledger.slice(-20).map(e => Number(e.reward) || 0);
  const avgRecentReward = recentRewards.reduce((s, r) => s + r, 0) / recentRewards.length;
  if (avgRecentReward < 0.5) {
    stagnationScore += 0.2;
    diagnosis.reasons.push(`Recent reward avg (${avgRecentReward.toFixed(2)}) near zero — nothing is hitting`);
  }

  diagnosis.confidence = Math.min(stagnationScore, 1.0);
  diagnosis.is_stagnating = stagnationScore >= 0.5; // Need multiple signals to confirm

  return diagnosis;
}

// =============================================================================
// Main: Detect stagnation and execute pivot if needed
// =============================================================================

export async function runStagnationDetector(): Promise<{
  stagnating: boolean;
  pivot_executed: string | null;
  diagnosis: StagnationDiagnosis;
}> {
  const supabase = getSupabaseClient();
  const selfModel = await getSelfModel();
  const phase = selfModel?.growth_phase ?? 'cold_start';

  console.log(`${LOG_PREFIX} Running stagnation check (phase: ${phase})...`);

  const diagnosis = await diagnoseStagnation();

  if (!diagnosis.is_stagnating) {
    if (diagnosis.reasons.length > 0) {
      console.log(`${LOG_PREFIX} Not stagnating (${diagnosis.reasons[0]})`);
    } else {
      console.log(`${LOG_PREFIX} Not stagnating — metrics above thresholds`);
    }
    return { stagnating: false, pivot_executed: null, diagnosis };
  }

  // Check if we already have an active pivot
  try {
    const { data: activePivot } = await supabase
      .from('system_events')
      .select('event_data')
      .eq('event_type', 'strategy_pivot_executed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (activePivot?.event_data) {
      const pivotData = activePivot.event_data as any;
      const pivotEnd = new Date(pivotData.expires_at);
      if (pivotEnd > new Date()) {
        console.log(`${LOG_PREFIX} Stagnation detected but active pivot in progress (expires ${pivotEnd.toISOString()}). Waiting.`);
        return { stagnating: true, pivot_executed: null, diagnosis };
      }
    }
  } catch { /* no previous pivot */ }

  // Generate and execute pivot
  console.log(`${LOG_PREFIX} ⚠️ STAGNATION DETECTED (confidence: ${(diagnosis.confidence * 100).toFixed(0)}%)`);
  for (const reason of diagnosis.reasons) {
    console.log(`${LOG_PREFIX}   - ${reason}`);
  }

  const pivots = getPivotStrategies(phase, diagnosis);
  if (pivots.length === 0) {
    console.log(`${LOG_PREFIX} No pivot strategies available`);
    return { stagnating: true, pivot_executed: null, diagnosis };
  }

  // Execute the first (highest priority) pivot
  const pivot = pivots[0];
  console.log(`${LOG_PREFIX} 🔄 EXECUTING PIVOT: "${pivot.name}" — ${pivot.description}`);

  try {
    // Write pivot changes to strategy_state
    await supabase
      .from('strategy_state')
      .update({
        ...pivot.changes,
        update_summary: `PIVOT: ${pivot.name} — ${pivot.description}`,
        last_updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    // Record the pivot event
    await supabase.from('system_events').insert({
      event_type: 'strategy_pivot_executed',
      severity: 'warning',
      message: `Stagnation pivot: ${pivot.name}`,
      event_data: {
        pivot_name: pivot.name,
        pivot_description: pivot.description,
        changes: pivot.changes,
        diagnosis: {
          confidence: diagnosis.confidence,
          reasons: diagnosis.reasons,
          reply_ratio: diagnosis.reply_ratio,
          avg_views: diagnosis.avg_views,
          avg_engagement_rate: diagnosis.avg_engagement_rate,
          total_actions: diagnosis.total_actions,
        },
        executed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + pivot.duration_days * 24 * 60 * 60 * 1000).toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    console.log(`${LOG_PREFIX} ✅ Pivot executed. Will evaluate in ${pivot.duration_days} days.`);
    return { stagnating: true, pivot_executed: pivot.name, diagnosis };
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Pivot execution failed: ${err.message}`);
    return { stagnating: true, pivot_executed: null, diagnosis };
  }
}
