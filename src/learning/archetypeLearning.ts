/**
 * 🎯 ARCHETYPE LEARNING
 *
 * Aggregates reply performance by archetype and provides epsilon-greedy selection.
 * Reuses strategy_rewards table for storage.
 *
 * Data flow:
 *   content_generation_metadata_comprehensive.features->>'reply_archetype'
 *   JOIN outcomes ON decision_id
 *   → aggregate per archetype → strategy_rewards (strategy_id = 'archetype_<name>')
 *   → epsilon-greedy selection in replyGeneratorAdapter
 */

import { getSupabaseClient } from '../db/index';
import { logLearningState } from '../utils/learningStateLogger';

const ARCHETYPE_PREFIX = 'archetype_';
const MIN_SAMPLES_FOR_EXPLOIT = 5; // Need at least 5 samples per archetype before exploiting
const EPSILON = 0.20; // 20% exploration rate
const ALL_ARCHETYPES = ['insight_addon', 'reframe', 'practical_implication', 'sharp_one_liner', 'mini_framework'] as const;
export type ReplyArchetype = typeof ALL_ARCHETYPES[number];

export interface ArchetypeStats {
  archetype: ReplyArchetype;
  sample_count: number;
  total_reward: number;
  mean_reward: number;
  avg_views: number;
  avg_engagement_rate: number;
  successes: number; // engagement_rate > 0.02
}

/**
 * Aggregate archetype performance from posted replies + outcomes.
 * Writes results to strategy_rewards table with 'archetype_' prefix.
 */
export async function aggregateArchetypePerformance(): Promise<ArchetypeStats[]> {
  const supabase = getSupabaseClient();
  const stats: ArchetypeStats[] = [];

  // Query: join comprehensive table (has features.reply_archetype) with outcomes
  for (const archetype of ALL_ARCHETYPES) {
    try {
      // Get all posted replies with this archetype that have outcomes
      const { data: replies } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('decision_id, features')
        .eq('decision_type', 'reply')
        .eq('status', 'posted')
        .not('tweet_id', 'is', null);

      // Filter by archetype in features (Supabase JSONB filter)
      const archetypeReplies = (replies || []).filter((r: any) => {
        const f = r.features as any;
        return f?.reply_archetype === archetype;
      });

      if (archetypeReplies.length === 0) {
        stats.push({
          archetype,
          sample_count: 0,
          total_reward: 0,
          mean_reward: 0,
          avg_views: 0,
          avg_engagement_rate: 0,
          successes: 0,
        });
        continue;
      }

      // Get outcomes for these decision_ids
      const decisionIds = archetypeReplies.map((r: any) => r.decision_id);
      const { data: outcomes } = await supabase
        .from('outcomes')
        .select('decision_id, views, likes, engagement_rate')
        .in('decision_id', decisionIds)
        .not('views', 'is', null);

      const validOutcomes = (outcomes || []).filter((o: any) => o.views != null && o.views > 0);

      const sampleCount = validOutcomes.length;
      const totalViews = validOutcomes.reduce((s: number, o: any) => s + (Number(o.views) || 0), 0);
      const totalER = validOutcomes.reduce((s: number, o: any) => s + (Number(o.engagement_rate) || 0), 0);
      const totalReward = validOutcomes.reduce((s: number, o: any) => {
        const likes = Number(o.likes) || 0;
        const views = Number(o.views) || 0;
        const er = Number(o.engagement_rate) || 0;
        return s + (likes * 2 + views * 0.01 + er * 100);
      }, 0);
      const successes = validOutcomes.filter((o: any) => (Number(o.engagement_rate) || 0) > 0.02).length;

      const stat: ArchetypeStats = {
        archetype,
        sample_count: sampleCount,
        total_reward: totalReward,
        mean_reward: sampleCount > 0 ? totalReward / sampleCount : 0,
        avg_views: sampleCount > 0 ? totalViews / sampleCount : 0,
        avg_engagement_rate: sampleCount > 0 ? totalER / sampleCount : 0,
        successes,
      };
      stats.push(stat);

      // Upsert into strategy_rewards for persistence
      await supabase.from('strategy_rewards').upsert({
        strategy_id: ARCHETYPE_PREFIX + archetype,
        strategy_version: '1',
        sample_count: sampleCount,
        total_reward: totalReward,
        mean_reward: stat.mean_reward,
        last_updated_at: new Date().toISOString(),
      }, { onConflict: 'strategy_id,strategy_version' });

    } catch (err: any) {
      console.warn(`[ARCHETYPE_LEARNING] Error aggregating ${archetype}: ${err.message}`);
      stats.push({
        archetype,
        sample_count: 0,
        total_reward: 0,
        mean_reward: 0,
        avg_views: 0,
        avg_engagement_rate: 0,
        successes: 0,
      });
    }
  }

  const totalSamples = stats.reduce((s, st) => s + st.sample_count, 0);
  const anyHasSufficientData = stats.some(s => s.sample_count >= MIN_SAMPLES_FOR_EXPLOIT);
  const sampleCounts: Record<string, number> = {};
  for (const s of stats) sampleCounts[s.archetype] = s.sample_count;

  const archetypeMode = anyHasSufficientData ? 'real_data' as const : 'insufficient_data' as const;
  console.log(`[LEARNING_STATE] system=archetype_learning mode=${archetypeMode} total_samples=${totalSamples} per_archetype=${JSON.stringify(sampleCounts)}`);
  logLearningState('archetype_learning', archetypeMode, totalSamples, MIN_SAMPLES_FOR_EXPLOIT, sampleCounts);

  console.log(`[ARCHETYPE_LEARNING] Aggregated: ${totalSamples} samples across ${stats.filter(s => s.sample_count > 0).length} archetypes`);
  for (const s of stats) {
    if (s.sample_count > 0) {
      console.log(`[ARCHETYPE_LEARNING]   ${s.archetype}: n=${s.sample_count} mean_reward=${s.mean_reward.toFixed(2)} avg_views=${s.avg_views.toFixed(0)} avg_er=${(s.avg_engagement_rate * 100).toFixed(2)}% successes=${s.successes}`);
    }
  }

  return stats;
}

/**
 * Load archetype stats from strategy_rewards (fast, no aggregation).
 */
export async function loadArchetypeStats(): Promise<Map<ReplyArchetype, ArchetypeStats>> {
  const supabase = getSupabaseClient();
  const map = new Map<ReplyArchetype, ArchetypeStats>();

  const { data } = await supabase
    .from('strategy_rewards')
    .select('strategy_id, sample_count, total_reward, mean_reward')
    .like('strategy_id', ARCHETYPE_PREFIX + '%');

  for (const row of (data || [])) {
    const archetype = row.strategy_id.replace(ARCHETYPE_PREFIX, '') as ReplyArchetype;
    if (ALL_ARCHETYPES.includes(archetype as any)) {
      map.set(archetype, {
        archetype,
        sample_count: row.sample_count || 0,
        total_reward: row.total_reward || 0,
        mean_reward: row.mean_reward || 0,
        avg_views: 0, // Not stored in strategy_rewards (computed on demand)
        avg_engagement_rate: 0,
        successes: 0,
      });
    }
  }

  return map;
}

/**
 * Epsilon-greedy archetype selection.
 *
 * - If insufficient data (< MIN_SAMPLES per archetype): random exploration
 * - If enough data: exploit best archetype (1 - epsilon) or explore (epsilon)
 *
 * Returns chosen archetype + reasoning.
 */
export async function selectArchetypeAdaptive(tweetLength: number, intent: string): Promise<{
  archetype: ReplyArchetype;
  reason: string;
  mode: 'explore_insufficient_data' | 'explore_random' | 'exploit';
  stats_snapshot: Record<string, { n: number; reward: number }>;
}> {
  const stats = await loadArchetypeStats();

  // Build snapshot for logging
  const snapshot: Record<string, { n: number; reward: number }> = {};
  for (const a of ALL_ARCHETYPES) {
    const s = stats.get(a);
    snapshot[a] = { n: s?.sample_count || 0, reward: Number((s?.mean_reward || 0).toFixed(2)) };
  }

  // Check if we have enough data for any archetype
  const archetypesWithData = ALL_ARCHETYPES.filter(a => (stats.get(a)?.sample_count || 0) >= MIN_SAMPLES_FOR_EXPLOIT);

  if (archetypesWithData.length < 2) {
    // Not enough data — pure exploration (random, influenced by tweet length)
    const archetype = randomArchetypeByContext(tweetLength, intent);
    return {
      archetype,
      reason: `explore: insufficient data (${archetypesWithData.length} archetypes have ${MIN_SAMPLES_FOR_EXPLOIT}+ samples)`,
      mode: 'explore_insufficient_data',
      stats_snapshot: snapshot,
    };
  }

  // Epsilon-greedy
  if (Math.random() < EPSILON) {
    // Explore: random
    const archetype = randomArchetypeByContext(tweetLength, intent);
    return {
      archetype,
      reason: `explore: epsilon=${EPSILON} random selection`,
      mode: 'explore_random',
      stats_snapshot: snapshot,
    };
  }

  // Exploit: pick archetype with highest mean_reward
  let bestArchetype: ReplyArchetype = 'insight_addon';
  let bestReward = -1;
  for (const a of archetypesWithData) {
    const reward = stats.get(a)?.mean_reward || 0;
    if (reward > bestReward) {
      bestReward = reward;
      bestArchetype = a;
    }
  }

  return {
    archetype: bestArchetype,
    reason: `exploit: ${bestArchetype} has highest mean_reward=${bestReward.toFixed(2)} (n=${stats.get(bestArchetype)?.sample_count})`,
    mode: 'exploit',
    stats_snapshot: snapshot,
  };
}

/**
 * Context-aware random archetype selection (used during exploration).
 */
function randomArchetypeByContext(tweetLength: number, intent: string): ReplyArchetype {
  if (intent === 'disagree') return 'reframe';
  if (intent === 'question') return Math.random() < 0.5 ? 'sharp_one_liner' : 'insight_addon';

  if (tweetLength > 200) {
    return Math.random() < 0.4 ? 'mini_framework' : 'insight_addon';
  }
  if (tweetLength < 80) {
    return Math.random() < 0.5 ? 'sharp_one_liner' : 'insight_addon';
  }

  const r = Math.random();
  if (r < 0.30) return 'insight_addon';
  if (r < 0.50) return 'reframe';
  if (r < 0.65) return 'practical_implication';
  if (r < 0.80) return 'sharp_one_liner';
  return 'mini_framework';
}
