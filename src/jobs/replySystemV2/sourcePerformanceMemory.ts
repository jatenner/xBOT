/**
 * Source performance memory: historical reply performance by discovery source.
 * Used for opportunity score adjustment (boost/penalize by source history).
 */

import { getSupabaseClient } from '../../db';

export interface SourcePerformanceRow {
  discovery_source: string;
  replies_attempted: number;
  replies_posted: number;
  total_reward_24h: number;
  avg_reward_24h: number | null;
  last_interaction_at: string | null;
  updated_at: string;
}

function normalizeSource(source: string | null | undefined): string {
  if (!source || typeof source !== 'string') return 'unknown';
  const s = source.trim();
  return s || 'unknown';
}

/**
 * Get source performance row.
 */
export async function getSourcePerformance(
  discoverySource: string
): Promise<SourcePerformanceRow | null> {
  const key = normalizeSource(discoverySource);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('reply_source_performance')
    .select('*')
    .eq('discovery_source', key)
    .maybeSingle();
  if (error) {
    console.warn(`[SOURCE_PERF] getSourcePerformance error: ${error.message}`);
    return null;
  }
  return data as SourcePerformanceRow | null;
}

/**
 * Compute score adjustment from source history (-1..1).
 * Same mapping as account: avg_reward_24h -> adjustment.
 */
export function sourcePerformanceToAdjustment(row: SourcePerformanceRow | null): number {
  if (!row || row.replies_posted < 1) return 0;
  const avg = row.avg_reward_24h;
  if (avg == null) return 0;
  if (avg <= 5) return -0.3;
  if (avg <= 20) return -0.1 + (avg - 5) * 0.0067;
  if (avg <= 80) return Math.min(0.2, (avg - 20) * 0.00333);
  return Math.min(0.35, 0.2 + (avg - 80) * 0.0005);
}

/**
 * Get source adjustment for opportunity intelligence.
 */
export async function getSourceAdjustmentScore(
  discoverySource: string
): Promise<{ adjustment: number; norm100: number; reason: string }> {
  const row = await getSourcePerformance(discoverySource);
  const adjustment = sourcePerformanceToAdjustment(row);
  const norm100 = Math.round(adjustment * 100);
  const reason = !row
    ? 'no_history'
    : row.replies_posted < 1
    ? 'no_posted_yet'
    : `n=${row.replies_posted} avg_reward=${row.avg_reward_24h?.toFixed(1) ?? 'null'}`;
  return { adjustment, norm100, reason };
}

/**
 * Upsert source performance.
 */
export async function upsertSourcePerformance(
  discoverySource: string,
  opts: {
    attempted?: boolean;
    posted?: boolean;
    reward_24h?: number | null;
    interaction_at?: string;
  }
): Promise<void> {
  const key = normalizeSource(discoverySource);
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const interactionAt = opts.interaction_at || now;

  const { data: existing } = await supabase
    .from('reply_source_performance')
    .select('replies_attempted, replies_posted, total_reward_24h')
    .eq('discovery_source', key)
    .maybeSingle();

  const prev = (existing as { replies_attempted: number; replies_posted: number; total_reward_24h: number } | null) || {
    replies_attempted: 0,
    replies_posted: 0,
    total_reward_24h: 0,
  };

  let replies_attempted = prev.replies_attempted;
  let replies_posted = prev.replies_posted;
  let total_reward_24h = Number(prev.total_reward_24h) || 0;

  if (opts.attempted) replies_attempted += 1;
  if (opts.posted) {
    replies_posted += 1;
    if (opts.reward_24h != null && !Number.isNaN(opts.reward_24h)) {
      total_reward_24h += opts.reward_24h;
    }
  }

  const avg_reward_24h = replies_posted > 0 ? total_reward_24h / replies_posted : null;

  const { error } = await supabase.from('reply_source_performance').upsert(
    {
      discovery_source: key,
      replies_attempted,
      replies_posted,
      total_reward_24h,
      avg_reward_24h,
      last_interaction_at: interactionAt,
      updated_at: now,
    },
    { onConflict: 'discovery_source' }
  );

  if (error) {
    console.warn(`[SOURCE_PERF] upsertSourcePerformance error: ${error.message}`);
  }
}
