/**
 * STRATEGY LEARNER
 *
 * The brain that closes the learning loop.
 *
 * Called every hour by learnJob. Consumes outputs from existing learning systems
 * (Growth Intelligence, Archetype Learning, Pattern Discovery, Ceiling Awareness,
 * Growth Analytics, Breakout Detector). Updates strategy_state.
 *
 * Design principles:
 * 1. Don't reinvent — consume what's already computed
 * 2. Breakouts > averages — learn from outlier successes
 * 3. Fast negative, slow positive — react to problems in minutes, confirm success over days
 * 4. Safety ceiling, learned strategy — only safety constraints are fixed
 * 5. Exploration minimum — always try new things (30%+)
 */

import { getSupabaseClient } from '../db';
import { findBreakouts, type BreakoutPattern } from './breakoutDetector';
import { logLearningState } from '../utils/learningStateLogger';
import type { GrowthSnapshot } from '../intelligence/growthIntelligence';

// ─── Config ───

const RAMP_STEP = 2;               // Volume change per learning cycle
const MIN_PACING_MINUTES = 10;     // Never faster than 1 action per 10 min
const MIN_DAILY_TARGET = 1;        // Always do at least 1 of each (except threads can be 0)
const MIN_WEIGHT = 0.2;            // Minimum weight for any action type (exploration floor)
const BREAKOUT_MIN_SAMPLES = 2;    // Need at least 2 breakouts to extract pattern
const VOLUME_RAMP_REWARD_THRESHOLD = 0.5; // Min avg reward to ramp up

interface LearnerInput {
  growthSnapshot?: GrowthSnapshot | null;
  recentSafetyEvents?: number;     // 429s, consent walls in last 24h
}

interface StrategyUpdate {
  generation: number;
  changes: string[];
  breakout_count: number;
}

/**
 * Main learning cycle. Called by learnJob after existing learning steps.
 * Reads all signals, detects breakouts, updates strategy_state.
 */
export async function updateStrategy(input: LearnerInput = {}): Promise<StrategyUpdate> {
  const supabase = getSupabaseClient();
  const changes: string[] = [];

  // 1. Read current strategy
  const { data: current } = await supabase
    .from('strategy_state')
    .select('*')
    .eq('id', 1)
    .single();

  if (!current) {
    console.warn('[STRATEGY_LEARNER] No strategy_state found, skipping update');
    return { generation: 0, changes: ['no_strategy_state'], breakout_count: 0 };
  }

  const gen = (current.generation || 0) + 1;

  // 2. Detect breakouts from growth_ledger
  const { breakouts, pattern, medianReward } = await findBreakouts(7);

  console.log(`[STRATEGY_LEARNER] gen=${gen} breakouts=${breakouts.length} median_reward=${medianReward.toFixed(3)} ledger_entries=${pattern.total_ledger_entries}`);

  // 3. Check safety signals
  let safetyEvents = input.recentSafetyEvents ?? 0;
  if (safetyEvents === 0) {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('system_events')
        .select('*', { count: 'exact', head: true })
        .in('event_type', ['rate_limit_429', 'consent_wall_detected'])
        .gte('created_at', oneDayAgo);
      safetyEvents = count || 0;
    } catch { /* non-fatal */ }
  }

  // 4. VOLUME ADJUSTMENT
  const gi = input.growthSnapshot;
  const avgReward = medianReward; // Use median as the central tendency

  if (safetyEvents > 0) {
    // Safety events detected — pull back
    const newReplies = Math.max(MIN_DAILY_TARGET, current.target_replies_per_day - RAMP_STEP);
    const newPacing = Math.min(60, current.reply_pacing_minutes + 5);
    if (newReplies !== current.target_replies_per_day) {
      changes.push(`replies: ${current.target_replies_per_day}→${newReplies} (safety: ${safetyEvents} events)`);
    }
    current.target_replies_per_day = newReplies;
    current.reply_pacing_minutes = newPacing;
  } else if (avgReward >= VOLUME_RAMP_REWARD_THRESHOLD && pattern.total_ledger_entries >= 3) {
    // Positive outcomes + no safety issues → ramp up
    const newReplies = current.target_replies_per_day + RAMP_STEP;
    const newPacing = Math.max(MIN_PACING_MINUTES, current.reply_pacing_minutes - 2);
    changes.push(`replies: ${current.target_replies_per_day}→${newReplies} (reward=${avgReward.toFixed(2)}, safe)`);
    current.target_replies_per_day = newReplies;
    current.reply_pacing_minutes = newPacing;
  }

  // Singles/threads volume based on action type performance
  if (gi && gi.by_action_type.length > 0) {
    const singlePerf = gi.by_action_type.find(d => d.value === 'single');
    const threadPerf = gi.by_action_type.find(d => d.value === 'thread');

    // If threads consistently get 0 reward, drop to 0
    if (threadPerf && threadPerf.sample_count >= 2 && threadPerf.avg_reward < 0.1) {
      if (current.target_threads_per_day > 0) {
        changes.push(`threads: ${current.target_threads_per_day}→0 (avg_reward=${threadPerf.avg_reward.toFixed(2)})`);
        current.target_threads_per_day = 0;
      }
    }

    // Singles: maintain minimum for profile content (visitors need to see originals)
    if (singlePerf && singlePerf.sample_count >= 2 && singlePerf.avg_reward < 0.1) {
      if (current.target_singles_per_day > 2) {
        changes.push(`singles: ${current.target_singles_per_day}→2 (low reward, kept for profile)`);
        current.target_singles_per_day = 2;
      }
    }
  }

  // 5. MIX WEIGHTS — from GI action type rewards
  if (gi && gi.by_action_type.length > 0) {
    for (const d of gi.by_action_type) {
      if (d.sample_count < 2) continue;
      const weight = Math.max(MIN_WEIGHT, d.avg_reward);
      if (d.value === 'reply' && Math.abs(weight - Number(current.reply_weight)) > 0.3) {
        changes.push(`reply_weight: ${current.reply_weight}→${weight.toFixed(1)}`);
        current.reply_weight = weight;
      }
      if (d.value === 'single' && Math.abs(weight - Number(current.single_weight)) > 0.3) {
        changes.push(`single_weight: ${current.single_weight}→${weight.toFixed(1)}`);
        current.single_weight = weight;
      }
      if (d.value === 'thread' && Math.abs(weight - Number(current.thread_weight)) > 0.3) {
        changes.push(`thread_weight: ${current.thread_weight}→${weight.toFixed(1)}`);
        current.thread_weight = weight;
      }
    }
  }

  // 6. CONTENT PREFERENCES — from breakout patterns
  if (breakouts.length >= BREAKOUT_MIN_SAMPLES) {
    if (pattern.dominant_topics.length > 0) {
      changes.push(`preferred_topics: ${JSON.stringify(pattern.dominant_topics)}`);
      current.preferred_topics = pattern.dominant_topics;
    }
    if (pattern.dominant_formats.length > 0) {
      changes.push(`preferred_formats: ${JSON.stringify(pattern.dominant_formats)}`);
      current.preferred_formats = pattern.dominant_formats;
    }
    if (pattern.dominant_hooks.length > 0) {
      changes.push(`preferred_hooks: ${JSON.stringify(pattern.dominant_hooks)}`);
      current.preferred_hooks = pattern.dominant_hooks;
    }
    if (pattern.dominant_archetypes.length > 0) {
      changes.push(`preferred_archetypes: ${JSON.stringify(pattern.dominant_archetypes)}`);
      current.preferred_archetypes = pattern.dominant_archetypes;
    }
  }

  // 7. TIMING — from breakout hours + GI
  if (breakouts.length >= BREAKOUT_MIN_SAMPLES && pattern.dominant_hours.length > 0) {
    changes.push(`peak_hours: ${JSON.stringify(pattern.dominant_hours)}`);
    current.peak_hours = pattern.dominant_hours;
  } else if (gi && gi.best_hours.length > 0) {
    // Fall back to GI best hours
    if (JSON.stringify(current.peak_hours) !== JSON.stringify(gi.best_hours)) {
      changes.push(`peak_hours (GI): ${JSON.stringify(gi.best_hours)}`);
      current.peak_hours = gi.best_hours;
    }
  }

  // 8. DISCOVERY — from breakout analysis
  if (breakouts.length >= BREAKOUT_MIN_SAMPLES) {
    if (pattern.dominant_tiers.length > 0) {
      changes.push(`preferred_tiers: ${JSON.stringify(pattern.dominant_tiers)}`);
      current.preferred_tiers = pattern.dominant_tiers;
    }
    if (pattern.dominant_sources.length > 0) {
      // Convert to weight map
      const sourceWeights: Record<string, number> = {};
      const total = pattern.dominant_sources.length;
      pattern.dominant_sources.forEach((s, i) => {
        sourceWeights[s] = Number(((total - i) / total).toFixed(2));
      });
      changes.push(`preferred_sources: ${JSON.stringify(sourceWeights)}`);
      current.preferred_sources = sourceWeights;
    }
    if (pattern.dominant_keywords.length > 0) {
      // Store keyword rankings
      const kwPerf: Record<string, number> = {};
      pattern.dominant_keywords.forEach((k, i) => {
        kwPerf[k] = pattern.dominant_keywords.length - i; // higher = better
      });
      changes.push(`keyword_performance: top=${pattern.dominant_keywords[0]}`);
      current.keyword_performance = kwPerf;
    }
  }

  // 9. AVOIDED TOPICS — topics with 5+ attempts, 0 breakouts, below-median reward
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: topicStats } = await supabase
      .from('growth_ledger')
      .select('topic, reward')
      .not('topic', 'is', null)
      .not('reward', 'is', null)
      .gte('posted_at', since);

    if (topicStats && topicStats.length > 0) {
      const topicAgg = new Map<string, { count: number; totalReward: number }>();
      for (const row of topicStats) {
        if (!row.topic) continue;
        const agg = topicAgg.get(row.topic) || { count: 0, totalReward: 0 };
        agg.count++;
        agg.totalReward += Number(row.reward) || 0;
        topicAgg.set(row.topic, agg);
      }

      const breakoutTopics = new Set(pattern.dominant_topics);
      const avoided: string[] = [];
      for (const [topic, agg] of Array.from(topicAgg.entries())) {
        if (agg.count >= 3 && !breakoutTopics.has(topic) && (agg.totalReward / agg.count) < medianReward) {
          avoided.push(topic);
        }
      }
      if (avoided.length > 0 && JSON.stringify(avoided.sort()) !== JSON.stringify((current.avoided_topics || []).sort())) {
        changes.push(`avoided_topics: ${JSON.stringify(avoided)}`);
        current.avoided_topics = avoided;
      }
    }
  } catch { /* non-fatal */ }

  // 10. BRAIN v2: Self-model + strategy health integration
  // The brain's self-model tracks what's working/decaying for OUR account specifically.
  // This supplements breakout detection with continuous performance monitoring.
  try {
    const { getSelfModel } = await import('../brain/db');
    const selfModel = await getSelfModel();

    if (selfModel) {
      // Update strategy_state with brain's growth phase
      current.growth_phase = selfModel.growth_phase;

      // Merge brain's best patterns with breakout patterns (brain is continuous, breakouts are event-driven)
      const brainBestFormats = (selfModel.best_formats ?? []).slice(0, 3).map((f: any) => f.name).filter(Boolean);
      const brainBestHooks = (selfModel.best_hooks ?? []).slice(0, 3).map((h: any) => h.name).filter(Boolean);

      if (brainBestFormats.length > 0 && !current.preferred_formats?.length) {
        current.preferred_formats = brainBestFormats;
        changes.push(`preferred_formats (brain): ${JSON.stringify(brainBestFormats)}`);
      }
      if (brainBestHooks.length > 0 && !current.preferred_hooks?.length) {
        current.preferred_hooks = brainBestHooks;
        changes.push(`preferred_hooks (brain): ${JSON.stringify(brainBestHooks)}`);
      }

      // Flag decaying strategies — these should be moved to exploration
      const decaying = selfModel.decaying_strategies ?? [];
      if (decaying.length > 0) {
        const decayNames = decaying.map((d: any) => d.strategy).filter(Boolean);
        current.decay_detected_strategies = decayNames;
        changes.push(`decay_detected: ${decayNames.join(', ')}`);

        // If a preferred format is decaying, remove it from preferred list
        if (current.preferred_formats && Array.isArray(current.preferred_formats)) {
          const decaySet = new Set(decayNames);
          const filtered = (current.preferred_formats as string[]).filter(f => !decaySet.has(f));
          if (filtered.length < (current.preferred_formats as string[]).length) {
            current.preferred_formats = filtered;
            changes.push(`removed_decaying_formats: ${decayNames.filter((d: string) => !filtered.includes(d)).join(', ')}`);
          }
        }
      }

      console.log(`[STRATEGY_LEARNER] Brain self-model: phase=${selfModel.growth_phase} working=${(selfModel.working_strategies??[]).length} decaying=${decaying.length}`);
    }
  } catch (e: any) {
    // Brain integration is non-fatal
    console.warn(`[STRATEGY_LEARNER] Brain self-model integration skipped: ${e.message}`);
  }

  // 11. Write updated strategy
  if (changes.length === 0) {
    console.log(`[STRATEGY_LEARNER] gen=${gen} No changes (insufficient data or stable)`);
    logLearningState('strategy_learner', pattern.total_ledger_entries >= 3 ? 'real_data' : 'insufficient_data', pattern.total_ledger_entries, 3);
    return { generation: gen, changes: ['no_changes'], breakout_count: breakouts.length };
  }

  const updateSummary = changes.join(' | ');
  console.log(`[STRATEGY_LEARNER] gen=${gen} UPDATING: ${updateSummary}`);

  try {
    await supabase
      .from('strategy_state')
      .update({
        target_replies_per_day: current.target_replies_per_day,
        target_singles_per_day: current.target_singles_per_day,
        target_threads_per_day: current.target_threads_per_day,
        reply_pacing_minutes: current.reply_pacing_minutes,
        post_pacing_minutes: current.post_pacing_minutes,
        active_hours: current.active_hours,
        peak_hours: current.peak_hours,
        peak_volume_multiplier: current.peak_volume_multiplier,
        reply_weight: current.reply_weight,
        single_weight: current.single_weight,
        thread_weight: current.thread_weight,
        preferred_topics: current.preferred_topics,
        preferred_formats: current.preferred_formats,
        preferred_hooks: current.preferred_hooks,
        preferred_archetypes: current.preferred_archetypes,
        avoided_topics: current.avoided_topics,
        preferred_tiers: current.preferred_tiers,
        preferred_sources: current.preferred_sources,
        keyword_performance: current.keyword_performance,
        ...(current.growth_phase ? { growth_phase: current.growth_phase } : {}),
        ...(current.decay_detected_strategies ? { decay_detected_strategies: current.decay_detected_strategies } : {}),
        generation: gen,
        total_outcomes: pattern.total_ledger_entries,
        last_updated_at: new Date().toISOString(),
        update_summary: updateSummary,
      })
      .eq('id', 1);

    logLearningState('strategy_learner', 'real_data', pattern.total_ledger_entries, 5, {
      breakouts: breakouts.length,
      changes: changes.length,
      median_reward: medianReward,
    }, updateSummary);

  } catch (err: any) {
    console.error(`[STRATEGY_LEARNER] Failed to write strategy_state: ${err.message}`);
  }

  return { generation: gen, changes, breakout_count: breakouts.length };
}
