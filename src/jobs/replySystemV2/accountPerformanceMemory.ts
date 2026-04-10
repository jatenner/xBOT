/**
 * Account performance memory: historical reply performance by target account.
 * Used for opportunity score adjustment (boost/penalize by account history).
 */

import { getSupabaseClient } from '../../db';

export interface AccountPerformanceRow {
  target_username: string;
  replies_attempted: number;
  replies_posted: number;
  total_reward_24h: number;
  avg_reward_24h: number | null;
  last_interaction_at: string | null;
  updated_at: string;
}

function normalizeUsername(username: string | null | undefined): string {
  if (!username || typeof username !== 'string') return '';
  return username.trim().toLowerCase().replace(/^@/, '');
}

/**
 * Get account performance row by target username.
 */
export async function getAccountPerformance(
  targetUsername: string
): Promise<AccountPerformanceRow | null> {
  const key = normalizeUsername(targetUsername);
  if (!key) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('reply_account_performance')
    .select('*')
    .eq('target_username', key)
    .maybeSingle();
  if (error) {
    console.warn(`[ACCOUNT_PERF] getAccountPerformance error: ${error.message}`);
    return null;
  }
  return data as AccountPerformanceRow | null;
}

/**
 * Compute a score adjustment from account history (-1..1 scale).
 * Positive = historically good outcomes → boost; negative = weak outcomes → penalize.
 * Returns 0 when insufficient history.
 */
export function accountPerformanceToAdjustment(row: AccountPerformanceRow | null): number {
  if (!row || row.replies_posted < 1) return 0;
  const avg = row.avg_reward_24h;
  if (avg == null) return 0;
  // Normalize: assume typical "good" reply reward ~20–100, weak ~0–5
  // Map avg_reward_24h to adjustment: <5 -> -0.3, 5–20 -> -0.1..0, 20–80 -> 0..0.2, >80 -> 0.2..0.3
  if (avg <= 5) return -0.3;
  if (avg <= 20) return -0.1 + (avg - 5) * 0.0067; // -0.1 to 0
  if (avg <= 80) return Math.min(0.2, (avg - 20) * 0.00333); // 0 to 0.2
  return Math.min(0.35, 0.2 + (avg - 80) * 0.0005); // cap at 0.35
}

/**
 * Get account adjustment score for opportunity intelligence (0–100 scale for logging).
 */
export async function getAccountAdjustmentScore(
  targetUsername: string
): Promise<{ adjustment: number; norm100: number; reason: string }> {
  const row = await getAccountPerformance(targetUsername);
  const adjustment = accountPerformanceToAdjustment(row);
  const norm100 = Math.round(adjustment * 100);
  const reason = !row
    ? 'no_history'
    : row.replies_posted < 1
    ? 'no_posted_yet'
    : `n=${row.replies_posted} avg_reward=${row.avg_reward_24h?.toFixed(1) ?? 'null'}`;
  return { adjustment, norm100, reason };
}

/**
 * Upsert account performance (increment attempted/posted, update reward aggregates).
 * Call from outcome aggregation when we have a new outcome for this account.
 */
export async function upsertAccountPerformance(
  targetUsername: string,
  opts: {
    attempted?: boolean;
    posted?: boolean;
    reward_24h?: number | null;
    interaction_at?: string;
  }
): Promise<void> {
  const key = normalizeUsername(targetUsername);
  if (!key) return;
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const interactionAt = opts.interaction_at || now;

  const { data: existing } = await supabase
    .from('reply_account_performance')
    .select('replies_attempted, replies_posted, total_reward_24h')
    .eq('target_username', key)
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

  const { error } = await supabase.from('reply_account_performance').upsert(
    {
      target_username: key,
      replies_attempted,
      replies_posted,
      total_reward_24h,
      avg_reward_24h,
      last_interaction_at: interactionAt,
      updated_at: now,
    },
    { onConflict: 'target_username' }
  );

  if (error) {
    console.warn(`[ACCOUNT_PERF] upsertAccountPerformance error: ${error.message}`);
  }
}
