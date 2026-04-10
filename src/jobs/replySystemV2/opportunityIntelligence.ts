/**
 * Opportunity intelligence: composite scoring, minimum threshold gating, and pool diagnostics.
 * Prevents forcing replies when the pool is weak; emits NO_TRADE/POOL_TOO_WEAK with reason codes.
 * Optional: account/source history adjustments from reply_account_performance and reply_source_performance.
 */

const OPP_HISTORY_WEIGHT = 25; // max ±25 points from (account_adj + source_adj) combined
const OPP_HISTORY_CAP = 35;    // cap total history delta at ±35

export const OPP_INTELLIGENCE_MIN_TOP_SCORE =
  typeof process.env.OPP_INTELLIGENCE_MIN_TOP_SCORE !== 'undefined'
    ? parseFloat(process.env.OPP_INTELLIGENCE_MIN_TOP_SCORE)
    : 35; // Lowered from 45→35: keyword-discovered small-account tweets score ~40 on opp intelligence but pass scorer at 55-75. All other safety gates (topic, self-reply, context lock, substance) remain intact.

export const OPP_INTELLIGENCE_MIN_POOL_SIZE_FOR_QUALITY =
  typeof process.env.OPP_INTELLIGENCE_MIN_POOL_SIZE_FOR_QUALITY !== 'undefined'
    ? parseInt(process.env.OPP_INTELLIGENCE_MIN_POOL_SIZE_FOR_QUALITY, 10)
    : 1;

export type OpportunityDecision =
  | 'SELECT'
  | 'NO_TRADE'
  | 'POOL_TOO_WEAK'
  | 'TOP_CANDIDATE_BELOW_THRESHOLD'
  | 'NEED_MORE_DISCOVERY'
  | 'POOL_EMPTY';

export const REASON_CODES = {
  TOO_STALE: 'too_stale',
  LOW_ENGAGEMENT: 'low_engagement',
  SOURCE_QUALITY_WEAK: 'source_quality_weak',
  INSUFFICIENT_FRESHNESS: 'insufficient_freshness',
  EVALUATION_ONLY_FALLBACK: 'evaluation_only_fallback',
  INSUFFICIENT_SCORE_MARGIN: 'insufficient_score_margin',
  TOP_BELOW_THRESHOLD: 'top_below_threshold',
  POOL_EMPTY: 'pool_empty',
  NO_CDP_SOURCES: 'no_cdp_sources',
} as const;

export interface OpportunityOppData {
  target_tweet_id: string;
  target_username?: string | null;
  tweet_posted_at?: string | null;
  created_at?: string;
  discovery_source?: string | null;
  like_count?: number | null;
  reply_count?: number | null;
  retweet_count?: number | null;
  target_followers?: number | null;
  account_size_tier?: string | null;
  is_root_tweet?: boolean | null;
  target_in_reply_to_tweet_id?: string | null;
  features?: Record<string, unknown> | null;
}

function isRootTweet(opp: OpportunityOppData | null | undefined): boolean {
  if (!opp) return true;
  return opp.is_root_tweet === true || (opp.is_root_tweet !== false && opp.target_in_reply_to_tweet_id == null);
}

export interface QueueCandidateWithOpp {
  candidate_tweet_id: string;
  evaluation_id: string;
  predicted_tier: number;
  overall_score: number;
  id?: string;
  stability_score?: number;
  age_minutes?: number | null;
  opp?: OpportunityOppData | null;
  /** From candidate_evaluations when available (Phase 1). */
  opportunity_upside_score?: number | null;
  health_angle_fit_score?: number | null;
}

export interface ScoreBreakdown {
  freshness_score: number;
  source_score: number;
  engagement_score: number;
  root_score: number;
  quality_score: number;
  /** Phase 1: 0-100 opportunity upside from evaluation or computed from opp. */
  opportunity_upside_score?: number;
  account_adj?: number;
  source_adj?: number;
  total: number;
}

export interface ScoredCandidate extends QueueCandidateWithOpp {
  opportunity_score: number;
  breakdown: ScoreBreakdown;
  reason_codes: string[];
}

/**
 * Source quality: CDP live > CDP search > orchestrator > evaluation-only / other.
 */
function sourceScore(discoverySource: string | null | undefined): number {
  if (!discoverySource) return 0.2;
  if (discoverySource.startsWith('cdp_timeline')) return 1.0;
  if (discoverySource.startsWith('cdp_search_')) return 0.9;
  if (discoverySource.startsWith('orchestrator_')) return 0.5;
  if (discoverySource.startsWith('public_search_')) return 0.6;
  if (discoverySource === 'profile' || discoverySource?.includes('profile')) return 0.7;
  if (discoverySource.startsWith('seed_account_')) return 0.4;
  return 0.3;
}

/**
 * Freshness: reward <10m, <30m, <60m, <3h; penalize >3h, >6h.
 */
function freshnessScore(ageMinutes: number | null): number {
  if (ageMinutes == null) return 0.3;
  if (ageMinutes <= 10) return 1.0;
  if (ageMinutes <= 30) return 0.9;
  if (ageMinutes <= 60) return 0.75;
  if (ageMinutes <= 180) return 0.5;
  if (ageMinutes <= 360) return 0.25;
  return 0.1;
}

/**
 * Engagement: normalize likes + replies into 0..1 (log scale).
 */
function engagementScore(likeCount: number | null | undefined, replyCount: number | null | undefined): number {
  const likes = Math.max(0, likeCount ?? 0);
  const replies = Math.max(0, replyCount ?? 0);
  const combined = likes + replies * 2;
  if (combined <= 0) return 0.2;
  if (combined <= 5) return 0.4;
  if (combined <= 50) return 0.6;
  if (combined <= 500) return 0.8;
  if (combined <= 5000) return 1.0;
  return 0.95;
}

/**
 * Quality from evaluation: tier 1 best, tier 4 worst; overall_score 0-100.
 */
function qualityScore(predictedTier: number, overallScore: number): number {
  const tierScore = predictedTier <= 1 ? 1.0 : predictedTier === 2 ? 0.8 : predictedTier === 3 ? 0.6 : 0.3;
  const normScore = Math.min(100, Math.max(0, overallScore ?? 0)) / 100;
  return (tierScore * 0.6 + normScore * 0.4);
}

/**
 * Opportunity upside component: use evaluation score when available, else derive from opp (Phase 1).
 */
function opportunityUpsideComponent(c: QueueCandidateWithOpp, ageMinutes: number | null): number {
  if (c.opportunity_upside_score != null && c.opportunity_upside_score >= 0) {
    return Math.min(1, c.opportunity_upside_score / 100);
  }
  const opp = c.opp;
  const likeCount = opp?.like_count ?? 0;
  const replyCount = opp?.reply_count ?? 0;
  const engagement = engagementScore(likeCount, replyCount);
  const freshness = freshnessScore(ageMinutes);
  const tier = opp?.account_size_tier ?? null;
  const followers = opp?.target_followers ?? 0;
  const tierScore =
    tier === 'mega' ? 1.0 : tier === 'large' ? 0.85 : tier === 'medium' ? 0.65 : followers >= 100e3 ? 0.85 : followers >= 10e3 ? 0.65 : 0.4;
  return (engagement * 0.5 + freshness * 0.3 + tierScore * 0.2);
}

/**
 * Score a single candidate with optional opportunity data (Phase 1: include opportunity_upside).
 */
export function scoreOpportunity(c: QueueCandidateWithOpp): ScoredCandidate {
  const opp = c.opp;
  const ageMinutes = c.age_minutes ?? (opp?.tweet_posted_at || opp?.created_at
    ? (Date.now() - new Date(opp.tweet_posted_at || opp!.created_at!).getTime()) / (60 * 1000)
    : null);
  const discoverySource = opp?.discovery_source ?? null;
  const likeCount = opp?.like_count ?? null;
  const replyCount = opp?.reply_count ?? null;
  const isRoot = isRootTweet(opp);

  const freshness = freshnessScore(ageMinutes);
  const source = sourceScore(discoverySource);
  const engagement = engagementScore(likeCount, replyCount);
  const root = isRoot ? 1.0 : 0.5;
  const quality = qualityScore(c.predicted_tier, c.overall_score ?? 0);
  const opportunityUpside = opportunityUpsideComponent(c, ageMinutes);

  const weights = { freshness: 0.22, source: 0.22, engagement: 0.18, root: 0.08, quality: 0.18, opportunity_upside: 0.12 };
  const total =
    freshness * weights.freshness +
    source * weights.source +
    engagement * weights.engagement +
    root * weights.root +
    quality * weights.quality +
    opportunityUpside * weights.opportunity_upside;
  const totalNorm = Math.round(total * 100);

  const reasonCodes: string[] = [];
  if (ageMinutes != null && ageMinutes > 180) reasonCodes.push(REASON_CODES.TOO_STALE);
  if ((likeCount ?? 0) + (replyCount ?? 0) < 3) reasonCodes.push(REASON_CODES.LOW_ENGAGEMENT);
  if (!discoverySource || source < 0.4) reasonCodes.push(REASON_CODES.SOURCE_QUALITY_WEAK);
  if (ageMinutes == null || ageMinutes > 360) reasonCodes.push(REASON_CODES.INSUFFICIENT_FRESHNESS);
  if (!opp?.discovery_source && discoverySource !== 'profile') reasonCodes.push(REASON_CODES.EVALUATION_ONLY_FALLBACK);

  return {
    ...c,
    opportunity_score: totalNorm,
    breakdown: {
      freshness_score: Math.round(freshness * 100),
      source_score: Math.round(source * 100),
      engagement_score: Math.round(engagement * 100),
      root_score: Math.round(root * 100),
      quality_score: Math.round(quality * 100),
      opportunity_upside_score: Math.round(opportunityUpside * 100),
      total: totalNorm,
    },
    reason_codes: reasonCodes,
  };
}

/**
 * Batch-fetch account and source adjustment scores for candidates (for history-adjusted scoring).
 */
async function getBatchHistoryAdjustments(
  candidates: QueueCandidateWithOpp[]
): Promise<Map<string, { accountAdj: number; sourceAdj: number; accountReason: string; sourceReason: string }>> {
  const map = new Map<string, { accountAdj: number; sourceAdj: number; accountReason: string; sourceReason: string }>();
  const accounts = new Set<string>();
  const sources = new Set<string>();
  const keyByCandidate = new Map<string, { account: string; source: string }>();
  for (const c of candidates) {
    const account = (c.opp?.target_username ?? '').trim().toLowerCase().replace(/^@/, '') || null;
    const source = (c.opp?.discovery_source ?? '').trim() || 'unknown';
    keyByCandidate.set(c.candidate_tweet_id, { account: account ?? '', source });
    if (account) accounts.add(account);
    sources.add(source);
  }
  const { getAccountAdjustmentScore } = await import('./accountPerformanceMemory');
  const { getSourceAdjustmentScore } = await import('./sourcePerformanceMemory');
  const accountResults = new Map<string, { adjustment: number; reason: string }>();
  const sourceResults = new Map<string, { adjustment: number; reason: string }>();
  for (const a of accounts) {
    const res = await getAccountAdjustmentScore(a);
    accountResults.set(a, { adjustment: res.adjustment, reason: res.reason });
  }
  for (const s of sources) {
    const res = await getSourceAdjustmentScore(s);
    sourceResults.set(s, { adjustment: res.adjustment, reason: res.reason });
  }
  for (const c of candidates) {
    const { account, source } = keyByCandidate.get(c.candidate_tweet_id) ?? { account: '', source: 'unknown' };
    const acc = accountResults.get(account) ?? { adjustment: 0, reason: 'no_history' };
    const src = sourceResults.get(source) ?? { adjustment: 0, reason: 'no_history' };
    map.set(c.candidate_tweet_id, {
      accountAdj: acc.adjustment,
      sourceAdj: src.adjustment,
      accountReason: acc.reason,
      sourceReason: src.reason,
    });
  }
  return map;
}

/**
 * Apply history adjustments to pre-scored candidates; re-compute total and sort order.
 */
function applyHistoryAdjustments(
  scored: ScoredCandidate[],
  adjustments: Map<string, { accountAdj: number; sourceAdj: number; accountReason: string; sourceReason: string }>
): ScoredCandidate[] {
  const out: ScoredCandidate[] = [];
  for (const s of scored) {
    const adj = adjustments.get(s.candidate_tweet_id) ?? { accountAdj: 0, sourceAdj: 0, accountReason: '', sourceReason: '' };
    const rawTotal = s.breakdown.total;
    const historyDelta = (adj.accountAdj + adj.sourceAdj) * OPP_HISTORY_WEIGHT;
    const cappedDelta = Math.max(-OPP_HISTORY_CAP, Math.min(OPP_HISTORY_CAP, historyDelta));
    const accountAdj100 = Math.round(adj.accountAdj * 100);
    const sourceAdj100 = Math.round(adj.sourceAdj * 100);
    const total = Math.round(rawTotal + cappedDelta);
    out.push({
      ...s,
      opportunity_score: Math.max(0, total),
      breakdown: {
        ...s.breakdown,
        account_adj: accountAdj100,
        source_adj: sourceAdj100,
        total: Math.max(0, total),
      },
    });
  }
  out.sort((a, b) => b.opportunity_score - a.opportunity_score);
  return out;
}

export interface PoolEvaluationResult {
  decision: OpportunityDecision;
  topCandidate: ScoredCandidate | null;
  /** Top N candidates (for exploit/explore; Phase 5). */
  topCandidates: ScoredCandidate[];
  topScore: number;
  poolSize: number;
  reasonCodes: string[];
  poolStats: { maxScore: number; minScore: number; avgScore: number; cdpCount: number };
}

/**
 * Evaluate pool: score all, optionally apply account/source history, sort, apply minimum threshold.
 */
export async function evaluatePool(candidates: QueueCandidateWithOpp[]): Promise<PoolEvaluationResult> {
  if (!candidates.length) {
    return {
      decision: 'POOL_EMPTY',
      topCandidate: null,
      topCandidates: [],
      topScore: 0,
      poolSize: 0,
      reasonCodes: [REASON_CODES.POOL_EMPTY],
      poolStats: { maxScore: 0, minScore: 0, avgScore: 0, cdpCount: 0 },
    };
  }

  let scored = candidates.map(scoreOpportunity);
  const historyEnabled = process.env.OPP_HISTORY_ENABLED !== 'false';
  if (historyEnabled) {
    try {
      const adjustments = await getBatchHistoryAdjustments(candidates);
      scored = applyHistoryAdjustments(scored, adjustments);
    } catch (e: any) {
      console.warn(`[OPP_INTELLIGENCE] History adjustment failed (using base scores): ${e.message}`);
    }
  } else {
    scored.sort((a, b) => b.opportunity_score - a.opportunity_score);
  }

  const top = scored[0];
  const scores = scored.map(s => s.opportunity_score);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const cdpCount = scored.filter(s => (s.opp?.discovery_source ?? '').startsWith('cdp_')).length;

  const reasonCodes: string[] = [];
  if (top.opportunity_score < OPP_INTELLIGENCE_MIN_TOP_SCORE) {
    reasonCodes.push(REASON_CODES.TOP_BELOW_THRESHOLD);
    if (top.reason_codes.length) reasonCodes.push(...top.reason_codes);
  }
  if (cdpCount === 0 && scored.length > 0) reasonCodes.push(REASON_CODES.NO_CDP_SOURCES);

  let decision: OpportunityDecision = 'SELECT';
  if (top.opportunity_score < OPP_INTELLIGENCE_MIN_TOP_SCORE) {
    decision = scored.length >= OPP_INTELLIGENCE_MIN_POOL_SIZE_FOR_QUALITY ? 'TOP_CANDIDATE_BELOW_THRESHOLD' : 'POOL_TOO_WEAK';
  }
  if (reasonCodes.includes(REASON_CODES.POOL_EMPTY)) decision = 'POOL_EMPTY';
  if (decision !== 'SELECT' && cdpCount === 0 && scored.length > 0) {
    decision = 'NEED_MORE_DISCOVERY';
  }

  const topCandidates = scored.slice(0, 10);
  return {
    decision,
    topCandidate: top,
    topCandidates,
    topScore: top.opportunity_score,
    poolSize: scored.length,
    reasonCodes: [...new Set(reasonCodes)],
    poolStats: { maxScore, minScore, avgScore, cdpCount },
  };
}

/**
 * Log pool evaluation for diagnostics (including history breakdown when present).
 */
export function logPoolEvaluation(result: PoolEvaluationResult): void {
  const { decision, topScore, poolSize, reasonCodes, poolStats } = result;
  console.log(
    `[OPP_INTELLIGENCE] decision=${decision} top_score=${topScore} pool_size=${poolSize} ` +
    `reasons=[${reasonCodes.join(', ')}] max=${poolStats.maxScore} min=${poolStats.minScore} avg=${Math.round(poolStats.avgScore)} cdp_sources=${poolStats.cdpCount}`
  );
  if (result.topCandidate) {
    const b = result.topCandidate.breakdown;
    const historyPart =
      b.account_adj !== undefined || b.source_adj !== undefined
        ? ` account_adj=${b.account_adj ?? 0} source_adj=${b.source_adj ?? 0}`
        : '';
    const upsidePart = b.opportunity_upside_score !== undefined ? ` opportunity_upside=${b.opportunity_upside_score}` : '';
    console.log(
      `[OPP_INTELLIGENCE] top_candidate=${result.topCandidate.candidate_tweet_id} breakdown: ` +
      `freshness=${b.freshness_score} source=${b.source_score} engagement=${b.engagement_score} root=${b.root_score} quality=${b.quality_score}${upsidePart}${historyPart} total=${b.total}`
    );
  }
}
