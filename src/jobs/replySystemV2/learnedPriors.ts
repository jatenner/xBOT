/**
 * Learned priors for reply growth engine (Phase 4).
 * Simple aggregates from reply_execution_events + reply_performance_snapshots / reply_account_performance.
 * Bounded, minimum-sample, inspectable. Used to bias selection toward what works.
 */

import { getSupabaseClient } from '../../db';

const MIN_SAMPLE_SIZE = 5; // Require at least 5 replies before using a prior
const EXPLORE_RATE = typeof process.env.REPLY_EXPLORE_RATE !== 'undefined'
  ? parseFloat(process.env.REPLY_EXPLORE_RATE)
  : 0.25; // 20-30% explore
const EXPLOIT_RATE = 1 - EXPLORE_RATE;

export const LEARNED_PRIORS_MIN_SAMPLE = MIN_SAMPLE_SIZE;
export const LEARNED_PRIORS_EXPLORE_RATE = EXPLORE_RATE;
export const LEARNED_PRIORS_EXPLOIT_RATE = EXPLOIT_RATE;

export interface PriorRow {
  dimension_value: string;
  sample_size: number;
  avg_impressions_24h: number | null;
  avg_engagements_24h: number | null;
  avg_engagement_rate_24h: number | null;
}

/**
 * Get performance by account_size_tier. Aggregates reply_performance_aggregates_24h by account_size_tier (view may also group by discovery_bucket, age, hour).
 */
export async function getAccountSizeTierPriors(): Promise<PriorRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('reply_performance_aggregates_24h')
    .select('account_size_tier, sample_size, avg_impressions_24h, avg_engagements_24h, avg_engagement_rate_24h');
  if (error) {
    console.warn(`[LEARNED_PRIORS] account_size_tier query failed: ${error.message}`);
    return [];
  }
  const rows = (data || []) as { account_size_tier: string; sample_size: number; avg_impressions_24h?: number; avg_engagements_24h?: number; avg_engagement_rate_24h?: number }[];
  const byTier = new Map<string, { n: number; sumImp: number; sumEng: number; sumRate: number; countImp: number; countRate: number }>();
  for (const r of rows) {
    const t = r.account_size_tier ?? 'unknown';
    const n = Number(r.sample_size ?? 0);
    if (n <= 0) continue;
    const cur = byTier.get(t) ?? { n: 0, sumImp: 0, sumEng: 0, sumRate: 0, countImp: 0, countRate: 0 };
    cur.n += n;
    if (r.avg_impressions_24h != null) {
      cur.sumImp += r.avg_impressions_24h * n;
      cur.countImp += n;
    }
    if (r.avg_engagements_24h != null) cur.sumEng += r.avg_engagements_24h * n;
    if (r.avg_engagement_rate_24h != null) {
      cur.sumRate += r.avg_engagement_rate_24h * n;
      cur.countRate += n;
    }
    byTier.set(t, cur);
  }
  const out: PriorRow[] = [];
  for (const [tier, cur] of byTier) {
    if (cur.n < MIN_SAMPLE_SIZE) continue;
    out.push({
      dimension_value: tier,
      sample_size: cur.n,
      avg_impressions_24h: cur.countImp > 0 ? cur.sumImp / cur.countImp : null,
      avg_engagements_24h: cur.n > 0 ? cur.sumEng / cur.n : null,
      avg_engagement_rate_24h: cur.countRate > 0 ? cur.sumRate / cur.countRate : null,
    });
  }
  return out;
}

/**
 * Get performance by discovery_bucket. Aggregates reply_performance_aggregates_24h by discovery_bucket (view may have discovery_bucket column).
 */
export async function getDiscoveryBucketPriors(): Promise<PriorRow[]> {
  const supabase = getSupabaseClient();
  const view = 'reply_performance_aggregates_24h';
  const { data, error } = await supabase
    .from(view)
    .select('discovery_bucket, sample_size, avg_impressions_24h, avg_engagements_24h, avg_engagement_rate_24h');
  if (error) {
    if (error.message?.includes('discovery_bucket')) return [];
    console.warn(`[LEARNED_PRIORS] discovery_bucket query failed: ${error.message}`);
    return [];
  }
  const rows = (data || []) as { discovery_bucket: string; sample_size: number; avg_impressions_24h?: number; avg_engagements_24h?: number; avg_engagement_rate_24h?: number }[];
  const byBucket = new Map<string, { n: number; sumImp: number; sumEng: number; sumRate: number; countImp: number; countRate: number }>();
  for (const r of rows) {
    const b = r.discovery_bucket ?? 'unknown';
    const n = Number(r.sample_size ?? 0);
    if (n <= 0) continue;
    const cur = byBucket.get(b) ?? { n: 0, sumImp: 0, sumEng: 0, sumRate: 0, countImp: 0, countRate: 0 };
    cur.n += n;
    if (r.avg_impressions_24h != null) {
      cur.sumImp += r.avg_impressions_24h * n;
      cur.countImp += n;
    }
    if (r.avg_engagements_24h != null) cur.sumEng += r.avg_engagements_24h * n;
    if (r.avg_engagement_rate_24h != null) {
      cur.sumRate += r.avg_engagement_rate_24h * n;
      cur.countRate += n;
    }
    byBucket.set(b, cur);
  }
  const out: PriorRow[] = [];
  for (const [bucket, cur] of byBucket) {
    if (cur.n < MIN_SAMPLE_SIZE) continue;
    out.push({
      dimension_value: bucket,
      sample_size: cur.n,
      avg_impressions_24h: cur.countImp > 0 ? cur.sumImp / cur.countImp : null,
      avg_engagements_24h: cur.n > 0 ? cur.sumEng / cur.n : null,
      avg_engagement_rate_24h: cur.countRate > 0 ? cur.sumRate / cur.countRate : null,
    });
  }
  return out;
}

/**
 * Get account-level performance (reply_account_performance).
 */
export async function getAccountPriors(username: string): Promise<{ avg_reward_24h: number | null; sample_size: number }> {
  const supabase = getSupabaseClient();
  const key = username.trim().toLowerCase().replace(/^@/, '');
  if (!key) return { avg_reward_24h: null, sample_size: 0 };
  const { data } = await supabase
    .from('reply_account_performance')
    .select('avg_reward_24h, replies_posted')
    .eq('target_username', key)
    .maybeSingle();
  if (!data || (data.replies_posted ?? 0) < MIN_SAMPLE_SIZE)
    return { avg_reward_24h: null, sample_size: data?.replies_posted ?? 0 };
  return {
    avg_reward_24h: data.avg_reward_24h != null ? Number(data.avg_reward_24h) : null,
    sample_size: Number(data.replies_posted ?? 0),
  };
}

/**
 * Should we explore this tick? (Phase 5) Returns true with probability EXPLORE_RATE.
 * Logged; disable with REPLY_EXPLORE_RATE=0 or REPLY_CONTROLLED_LIVE=true.
 */
export function shouldExploreThisTick(): boolean {
  if (process.env.REPLY_CONTROLLED_LIVE === 'true') return false;
  if (EXPLORE_RATE <= 0) return false;
  const r = Math.random();
  const explore = r < EXPLORE_RATE;
  console.log(`[LEARNED_PRIORS] exploit_explore explore=${explore} roll=${r.toFixed(3)} explore_rate=${EXPLORE_RATE}`);
  return explore;
}
