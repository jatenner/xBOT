/**
 * 🧠 GROWTH INTELLIGENCE ENGINE — Phase 1
 *
 * Aggregates performance data across dimensions and produces signals
 * the central controller can consume to make smarter decisions.
 *
 * Dimensions:
 *   - action_type (reply vs single vs thread)
 *   - reply_archetype (insight_addon, reframe, etc.)
 *   - target_account_tier (mega, large, medium, small, tiny)
 *   - posting_hour (0-23 UTC)
 *
 * Reuses existing tables:
 *   - outcomes (views, likes, engagement_rate)
 *   - content_generation_metadata_comprehensive (decision metadata)
 *   - reply_execution_events (target metadata)
 *   - strategy_rewards (archetype performance storage)
 *
 * Does NOT modify the controller — just produces data the controller can read.
 */

import { getSupabaseClient } from '../db/index';
import { logLearningState } from '../utils/learningStateLogger';

// ─── Types ───

export interface DimensionPerformance {
  dimension: string;
  value: string;
  sample_count: number;
  avg_views: number;
  avg_likes: number;
  avg_engagement_rate: number;
  avg_reward: number; // likes*2 + views*0.01 + er*100
  total_followers_gained: number;
}

export interface GrowthSnapshot {
  computed_at: string;
  by_action_type: DimensionPerformance[];
  by_archetype: DimensionPerformance[];
  by_account_tier: DimensionPerformance[];
  by_hour: DimensionPerformance[];
  best_action_type: string | null;
  best_archetype: string | null;
  best_account_tier: string | null;
  best_hours: number[];
  total_posts: number;
  total_replies: number;
  total_with_outcomes: number;
  data_quality?: {
    total_outcomes_queried: number;
    outcomes_with_views: number;
    outcomes_all_zero: number;
    total_records_joined: number;
  };
}

// ─── Core Aggregation ───

/**
 * Compute performance across all dimensions from the last N days.
 */
export async function computeGrowthSnapshot(daysBack: number = 14): Promise<GrowthSnapshot> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  // Fetch outcomes with real views data, then match to decisions
  // CRITICAL: Filter simulated=false to exclude shadow/test data from aggregations
  const { data: outcomesRaw } = await supabase
    .from('outcomes')
    .select('decision_id, tweet_id, views, likes, engagement_rate, followers_gained, simulated')
    .not('views', 'is', null)
    .not('decision_id', 'is', null)
    .eq('simulated', false)
    .limit(500); // Cap for performance

  console.log(`[GROWTH_INTEL] outcomes_found=${(outcomesRaw || []).length} simulated_filtered=true`);

  // Fetch decisions in batches to avoid Supabase .in() limit
  const outcomeDecisionIds = (outcomesRaw || []).map(o => o.decision_id).filter(Boolean);
  const BATCH_SIZE = 50;
  const allDecisions: any[] = [];
  for (let i = 0; i < outcomeDecisionIds.length; i += BATCH_SIZE) {
    const batch = outcomeDecisionIds.slice(i, i + BATCH_SIZE);
    const { data: batchDecisions } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, decision_type, features, posted_at, target_tweet_id')
      .eq('status', 'posted')
      .in('decision_id', batch);
    if (batchDecisions) allDecisions.push(...batchDecisions);
  }
  const decisions = allDecisions;

  const outcomeMap = new Map((outcomesRaw || []).map(o => [o.decision_id, o]));

  // Fetch reply execution events for account tier data
  const { data: execEvents } = await supabase
    .from('reply_execution_events')
    .select('target_tweet_id, account_size_tier, target_followers')
    .in('target_tweet_id', (decisions || []).filter(d => d.target_tweet_id).map(d => d.target_tweet_id!));
  const tierMap = new Map((execEvents || []).map(e => [e.target_tweet_id, e.account_size_tier || tierFromFollowers(e.target_followers)]));

  // Build enriched records
  const records: Array<{
    decision_type: string;
    archetype: string;
    account_tier: string;
    hour: number;
    views: number;
    likes: number;
    er: number;
    reward: number;
    followers_gained: number;
  }> = [];

  for (const d of (decisions || [])) {
    const o = outcomeMap.get(d.decision_id);
    if (!o) continue;

    const f = d.features as any;
    const views = Number(o.views) || 0;
    const likes = Number(o.likes) || 0;
    const er = Number(o.engagement_rate) || 0;
    const reward = likes * 2 + views * 0.01 + er * 100;
    const fg = Number(o.followers_gained) || 0;
    const hour = d.posted_at ? new Date(d.posted_at).getUTCHours() : -1;
    const archetype = f?.reply_archetype || 'none';
    const tier = d.target_tweet_id ? (tierMap.get(d.target_tweet_id) || 'unknown') : 'n/a';

    records.push({
      decision_type: d.decision_type,
      archetype,
      account_tier: tier,
      hour,
      views, likes, er, reward, followers_gained: fg,
    });
  }

  // Data quality assessment
  const dataQuality = {
    total_outcomes_queried: (outcomesRaw || []).length,
    outcomes_with_views: records.filter(r => r.views > 0).length,
    outcomes_all_zero: records.filter(r => r.views === 0 && r.likes === 0).length,
    total_records_joined: records.length,
  };
  const giMode = dataQuality.total_records_joined >= 3 ? 'real_data' as const : 'insufficient_data' as const;
  console.log(`[LEARNING_STATE] system=growth_intelligence mode=${giMode} samples=${dataQuality.total_records_joined} quality=${JSON.stringify(dataQuality)}`);
  logLearningState('growth_intelligence', giMode, dataQuality.total_records_joined, 3, dataQuality);

  // Aggregate by dimension
  const byActionType = aggregateBy(records, 'decision_type');
  const byArchetype = aggregateBy(records.filter(r => r.decision_type === 'reply'), 'archetype');
  const byAccountTier = aggregateBy(records.filter(r => r.decision_type === 'reply'), 'account_tier');
  const byHour = aggregateBy(records.filter(r => r.hour >= 0), 'hour');

  // Find bests
  const bestActionType = findBest(byActionType);
  const bestArchetype = findBest(byArchetype);
  const bestAccountTier = findBest(byAccountTier);
  const bestHours = byHour
    .filter(h => h.sample_count >= 2)
    .sort((a, b) => b.avg_reward - a.avg_reward)
    .slice(0, 3)
    .map(h => parseInt(h.value));

  const snapshot: GrowthSnapshot = {
    computed_at: new Date().toISOString(),
    by_action_type: byActionType,
    by_archetype: byArchetype,
    by_account_tier: byAccountTier,
    by_hour: byHour,
    best_action_type: bestActionType,
    best_archetype: bestArchetype,
    best_account_tier: bestAccountTier,
    best_hours: bestHours,
    total_posts: (decisions || []).length,
    total_replies: (decisions || []).filter(d => d.decision_type === 'reply').length,
    total_with_outcomes: records.length,
    data_quality: dataQuality,
  };

  return snapshot;
}

// ─── Helpers ───

function aggregateBy(records: any[], field: string): DimensionPerformance[] {
  const groups = new Map<string, any[]>();
  for (const r of records) {
    const key = String(r[field]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const result: DimensionPerformance[] = [];
  for (const [value, items] of groups) {
    const n = items.length;
    result.push({
      dimension: field,
      value,
      sample_count: n,
      avg_views: avg(items, 'views'),
      avg_likes: avg(items, 'likes'),
      avg_engagement_rate: avg(items, 'er'),
      avg_reward: avg(items, 'reward'),
      total_followers_gained: items.reduce((s: number, i: any) => s + (i.followers_gained || 0), 0),
    });
  }

  return result.sort((a, b) => b.avg_reward - a.avg_reward);
}

function avg(items: any[], field: string): number {
  if (items.length === 0) return 0;
  return items.reduce((s: number, i: any) => s + (Number(i[field]) || 0), 0) / items.length;
}

function findBest(items: DimensionPerformance[]): string | null {
  const qualified = items.filter(i => i.sample_count >= 3);
  if (qualified.length === 0) return null;
  return qualified.sort((a, b) => b.avg_reward - a.avg_reward)[0].value;
}

function tierFromFollowers(followers: number | null): string {
  if (!followers) return 'unknown';
  if (followers >= 1_000_000) return 'mega';
  if (followers >= 100_000) return 'large';
  if (followers >= 10_000) return 'medium';
  if (followers >= 1_000) return 'small';
  return 'tiny';
}

// ─── Persistence + Logging ───

/**
 * Run the growth intelligence aggregation and persist results.
 * Called from learnJob or on-demand.
 */
export async function runGrowthIntelligence(): Promise<GrowthSnapshot> {
  const snapshot = await computeGrowthSnapshot(14);

  console.log(`[GROWTH_INTEL] ─── Growth Intelligence Snapshot ───`);
  console.log(`[GROWTH_INTEL] Posts: ${snapshot.total_posts} | With outcomes: ${snapshot.total_with_outcomes} | Replies: ${snapshot.total_replies}`);

  if (snapshot.by_action_type.length > 0) {
    console.log(`[GROWTH_INTEL] BY ACTION TYPE:`);
    for (const d of snapshot.by_action_type) {
      console.log(`[GROWTH_INTEL]   ${d.value}: n=${d.sample_count} views=${d.avg_views.toFixed(0)} likes=${d.avg_likes.toFixed(1)} er=${(d.avg_engagement_rate * 100).toFixed(1)}% reward=${d.avg_reward.toFixed(1)} followers=${d.total_followers_gained}`);
    }
  }

  if (snapshot.by_archetype.length > 0) {
    console.log(`[GROWTH_INTEL] BY ARCHETYPE:`);
    for (const d of snapshot.by_archetype) {
      console.log(`[GROWTH_INTEL]   ${d.value}: n=${d.sample_count} views=${d.avg_views.toFixed(0)} reward=${d.avg_reward.toFixed(1)}`);
    }
  }

  if (snapshot.by_account_tier.length > 0) {
    console.log(`[GROWTH_INTEL] BY TARGET TIER:`);
    for (const d of snapshot.by_account_tier) {
      console.log(`[GROWTH_INTEL]   ${d.value}: n=${d.sample_count} views=${d.avg_views.toFixed(0)} reward=${d.avg_reward.toFixed(1)}`);
    }
  }

  if (snapshot.best_hours.length > 0) {
    console.log(`[GROWTH_INTEL] BEST HOURS (UTC): ${snapshot.best_hours.join(', ')}`);
  }

  console.log(`[GROWTH_INTEL] BEST: action=${snapshot.best_action_type || 'n/a'} archetype=${snapshot.best_archetype || 'n/a'} tier=${snapshot.best_account_tier || 'n/a'}`);

  // Persist snapshot to system_events
  try {
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'GROWTH_INTELLIGENCE_SNAPSHOT',
      severity: 'info',
      message: `Growth snapshot: ${snapshot.total_with_outcomes} samples, best_action=${snapshot.best_action_type}, best_archetype=${snapshot.best_archetype}`,
      event_data: {
        ...snapshot,
        // Flatten for easy querying
        summary: {
          best_action_type: snapshot.best_action_type,
          best_archetype: snapshot.best_archetype,
          best_account_tier: snapshot.best_account_tier,
          best_hours: snapshot.best_hours,
          total_with_outcomes: snapshot.total_with_outcomes,
        },
      },
      created_at: snapshot.computed_at,
    });
  } catch { /* non-blocking */ }

  return snapshot;
}

/**
 * Get the latest growth snapshot for controller use (fast read from system_events).
 */
export async function getLatestGrowthSnapshot(): Promise<GrowthSnapshot | null> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('system_events')
      .select('event_data')
      .eq('event_type', 'GROWTH_INTELLIGENCE_SNAPSHOT')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.event_data as GrowthSnapshot || null;
  } catch {
    return null;
  }
}
