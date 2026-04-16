/**
 * Brain Query Interface
 *
 * Single entry point for content generation and strategy to ask the brain questions.
 * Returns phase-calibrated answers, not raw data.
 *
 * Usage:
 *   import { brainQuery } from '../brain/brainQuery';
 *   const patterns = await brainQuery.getTopPatternsForOurPhase('reply', 5);
 *   const timing = await brainQuery.getOptimalTimingWindows();
 *   const health = await brainQuery.getStrategyHealth();
 */

import { getSupabaseClient } from '../db';
import { getSelfModel, getBrainStats, getRecentFeedbackEvents, getFailureDiagnosisSummary } from './db';
import { getPhaseAdvice, type PhaseAdvice } from './phaseAdvisor';
import type {
  PhasePattern,
  TimingWindow,
  TrendingTopic,
  ContentGap,
  StrategyHealthSummary,
  SelfModelState,
  GrowthPhase,
} from './types';

const LOG_PREFIX = '[brain/query]';

// =============================================================================
// 1. Top patterns for our phase
// =============================================================================

/**
 * Returns best-performing patterns (hooks, tones, formats, triggers) calibrated
 * to accounts at our growth phase. Only recommends what's proven at our tier.
 */
async function getTopPatternsForOurPhase(
  actionType?: 'reply' | 'single' | 'thread',
  limit: number = 5,
): Promise<PhaseAdvice | null> {
  return getPhaseAdvice();
}

// =============================================================================
// 2. Optimal timing windows
// =============================================================================

/**
 * Returns best posting hours based on brain data, segmented by our tier.
 * Merges external brain data with our own self-model best hours.
 */
async function getOptimalTimingWindows(): Promise<TimingWindow[]> {
  const advice = await getPhaseAdvice();
  if (!advice) return [];

  const selfModel = await getSelfModel();
  if (!selfModel) return advice.recommended_hours;

  // Merge: if self-model has proven best hours, boost those
  const selfHours = (selfModel.best_posting_hours ?? []).map(h => Number(h.name));

  return advice.recommended_hours.map(window => {
    const isSelfProven = selfHours.includes(window.hour_utc);
    if (!isSelfProven) return window;
    // External pattern confirmed by our own posting data — promote one tier
    // and boost effective sample size so it sorts above unconfirmed windows.
    const bumpedConfidence: 'high' | 'medium' | 'low' =
      window.confidence === 'low' ? 'medium' : 'high';
    return {
      ...window,
      sample_size: window.sample_size + 100,
      confidence: bumpedConfidence,
    };
  }).sort((a, b) => b.sample_size - a.sample_size);
}

// =============================================================================
// 3. Trending topics
// =============================================================================

/**
 * Returns what's trending right now across all brain_tweets.
 * Grouped by keyword, sorted by recency and volume.
 */
async function getTrendingTopics(limit: number = 10): Promise<TrendingTopic[]> {
  const supabase = getSupabaseClient();
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(); // Last 6 hours

  // Get recent brain_tweets grouped by discovery_keyword
  const { data: recent } = await supabase
    .from('brain_tweets')
    .select('discovery_keyword, tweet_id, likes, views, created_at')
    .gte('created_at', cutoff)
    .not('discovery_keyword', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (!recent || recent.length === 0) return [];

  // Group by keyword
  const groups: Record<string, {
    count: number;
    totalLikes: number;
    totalViews: number;
    tweetIds: string[];
    firstSeen: string;
  }> = {};

  for (const tweet of recent) {
    const kw = (tweet.discovery_keyword as string).toLowerCase();
    if (!groups[kw]) {
      groups[kw] = { count: 0, totalLikes: 0, totalViews: 0, tweetIds: [], firstSeen: tweet.created_at };
    }
    groups[kw].count++;
    groups[kw].totalLikes += tweet.likes ?? 0;
    groups[kw].totalViews += tweet.views ?? 0;
    if (groups[kw].tweetIds.length < 5) groups[kw].tweetIds.push(tweet.tweet_id);
    if (tweet.created_at < groups[kw].firstSeen) groups[kw].firstSeen = tweet.created_at;
  }

  // Also pull from brain_keywords with recent activity
  const { data: activeKeywords } = await supabase
    .from('brain_keywords')
    .select('keyword, tweets_found_last_run, avg_engagement_found')
    .eq('is_active', true)
    .eq('source', 'trending')
    .gte('last_searched_at', cutoff)
    .order('avg_engagement_found', { ascending: false })
    .limit(20);

  // Merge trending keywords into groups
  if (activeKeywords) {
    for (const kw of activeKeywords) {
      const key = kw.keyword.toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          count: kw.tweets_found_last_run ?? 0,
          totalLikes: (kw.avg_engagement_found ?? 0) * (kw.tweets_found_last_run ?? 1),
          totalViews: 0,
          tweetIds: [],
          firstSeen: new Date().toISOString(),
        };
      }
    }
  }

  const trending: TrendingTopic[] = Object.entries(groups)
    .map(([keyword, g]) => ({
      keyword,
      tweet_count: g.count,
      avg_engagement: g.count > 0 ? g.totalLikes / g.count : 0,
      avg_views: g.count > 0 ? g.totalViews / g.count : 0,
      top_tweet_ids: g.tweetIds,
      first_seen_at: g.firstSeen,
    }))
    .sort((a, b) => b.tweet_count - a.tweet_count)
    .slice(0, limit);

  return trending;
}

// =============================================================================
// 4. Recommended reply targets
// =============================================================================

/**
 * Returns high-engagement accounts from brain_accounts that are good reply targets.
 * Calibrated to our tier — recommends accounts 1-2 tiers above us.
 */
async function getRecommendedTargets(
  actionType: 'reply' | 'single' = 'reply',
  limit: number = 20,
): Promise<{ username: string; followers: number; avg_engagement: number; tier: string }[]> {
  const supabase = getSupabaseClient();
  const selfModel = await getSelfModel();

  // For replies, target accounts 1-2 tiers above us
  // cold_start → target B and A tier accounts (10K-100K followers)
  // early_traction → target A tier (50K-500K)
  // growth → target A and S tier
  const targetTiers = getTargetTiersForReplies(selfModel?.growth_phase ?? 'cold_start');

  const { data: accounts } = await supabase
    .from('brain_accounts')
    .select('username, followers_count, avg_engagement_rate_30d, tier')
    .eq('is_active', true)
    .in('tier', targetTiers)
    .not('avg_engagement_rate_30d', 'is', null)
    .order('avg_engagement_rate_30d', { ascending: false })
    .limit(limit);

  if (!accounts) return [];

  return accounts.map(a => ({
    username: a.username,
    followers: a.followers_count ?? 0,
    avg_engagement: a.avg_engagement_rate_30d ?? 0,
    tier: a.tier,
  }));
}

function getTargetTiersForReplies(phase: GrowthPhase): string[] {
  switch (phase) {
    case 'cold_start': return ['B', 'A'];        // 10K-100K followers
    case 'early_traction': return ['A', 'S'];     // 50K+
    case 'growth': return ['A', 'S'];             // 50K+
    case 'authority': return ['S'];               // 100K+
    case 'scale': return ['S'];                   // 100K+
  }
}

// =============================================================================
// 5. Content gaps
// =============================================================================

/**
 * Topics/formats we haven't tried that brain data suggests would work.
 * Compares what performs well in the brain vs what we've actually posted.
 */
async function getContentGaps(limit: number = 10): Promise<ContentGap[]> {
  const supabase = getSupabaseClient();
  const selfModel = await getSelfModel();
  if (!selfModel) return [];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get what we've posted (from growth_ledger)
  const { data: ourPosts } = await supabase
    .from('growth_ledger')
    .select('format_type, hook_type, topic')
    .gte('posted_at', thirtyDaysAgo)
    .limit(500);

  // Count our format/hook usage
  const ourFormats = new Set((ourPosts ?? []).map(p => p.format_type).filter(Boolean));
  const ourHooks = new Set((ourPosts ?? []).map(p => p.hook_type).filter(Boolean));

  // Get top-performing formats and hooks from brain for our tier
  const advice = await getPhaseAdvice();
  if (!advice) return [];

  const gaps: ContentGap[] = [];

  // Check for formats the brain recommends that we haven't tried
  for (const format of advice.recommended_formats) {
    if (!ourFormats.has(format.value) && format.confidence !== 'low') {
      gaps.push({
        dimension: 'format',
        value: format.value,
        external_performance: format.avg_engagement_rate,
        our_attempts: 0,
        potential_lift: format.avg_engagement_rate / (selfModel.avg_engagement_rate_30d ?? 0.01),
        confidence: format.confidence,
      });
    }
  }

  // Check for hooks the brain recommends that we haven't tried
  for (const hook of advice.recommended_hooks) {
    if (!ourHooks.has(hook.value) && hook.confidence !== 'low') {
      gaps.push({
        dimension: 'hook_type',
        value: hook.value,
        external_performance: hook.avg_engagement_rate,
        our_attempts: 0,
        potential_lift: hook.avg_engagement_rate / (selfModel.avg_engagement_rate_30d ?? 0.01),
        confidence: hook.confidence,
      });
    }
  }

  // Check for emotional triggers we haven't explored
  for (const trigger of advice.recommended_triggers) {
    if (trigger.confidence !== 'low') {
      gaps.push({
        dimension: 'emotional_trigger',
        value: trigger.value,
        external_performance: trigger.avg_engagement_rate,
        our_attempts: 0, // We don't track this yet
        potential_lift: trigger.avg_engagement_rate / (selfModel.avg_engagement_rate_30d ?? 0.01),
        confidence: trigger.confidence,
      });
    }
  }

  // Sort by potential lift
  gaps.sort((a, b) => b.potential_lift - a.potential_lift);
  return gaps.slice(0, limit);
}

// =============================================================================
// 6. Self performance summary
// =============================================================================

/**
 * Returns our current account state, expectations, and phase-specific notes.
 */
async function getSelfPerformanceSummary(): Promise<{
  self_model: SelfModelState | null;
  phase_notes: string[];
  failure_summary: { diagnosis: string; count: number; avg_delta: number }[];
  brain_stats: Awaited<ReturnType<typeof getBrainStats>>;
} | null> {
  const selfModel = await getSelfModel();
  if (!selfModel) return null;

  const advice = await getPhaseAdvice();
  const failureSummary = await getFailureDiagnosisSummary(30);
  const brainStats = await getBrainStats();

  return {
    self_model: selfModel,
    phase_notes: advice?.strategy_notes ?? [],
    failure_summary: failureSummary,
    brain_stats: brainStats,
  };
}

// =============================================================================
// 7. Strategy health
// =============================================================================

/**
 * Returns which strategies are working, decaying, or untested.
 */
async function getStrategyHealth(): Promise<StrategyHealthSummary | null> {
  const selfModel = await getSelfModel();
  if (!selfModel) return null;

  const working = selfModel.working_strategies ?? [];
  const decaying = selfModel.decaying_strategies ?? [];
  const untested = (selfModel.untested_strategies ?? []).map((s: any) => s.strategy ?? String(s));

  // Determine overall health
  let overallHealth: 'healthy' | 'stagnating' | 'declining' = 'healthy';

  if (decaying.length > working.length) {
    overallHealth = 'declining';
  } else if (working.length === 0 && decaying.length === 0) {
    overallHealth = 'stagnating';
  } else if (decaying.length > 0 && working.length <= decaying.length) {
    overallHealth = 'stagnating';
  }

  // Factor in recent feedback
  const recentFeedback = await getRecentFeedbackEvents(7);
  if (recentFeedback.length >= 5) {
    const failures = recentFeedback.filter(f => f.outcome_class === 'failure' || f.outcome_class === 'below_expected');
    const failureRate = failures.length / recentFeedback.length;

    if (failureRate > 0.6) overallHealth = 'declining';
    else if (failureRate > 0.4) overallHealth = 'stagnating';
  }

  return {
    working,
    decaying,
    untested,
    overall_health: overallHealth,
  };
}

// =============================================================================
// 8. Quick recommendation (the "what should I do right now?" query)
// =============================================================================

interface QuickRecommendation {
  action: 'reply' | 'single' | 'thread' | 'wait';
  reason: string;
  suggested_format: string | null;
  suggested_hook: string | null;
  suggested_tone: string | null;
  target_account: string | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * "It's 7pm, what should I tweet?"
 * Returns a single concrete recommendation based on all brain data.
 */
async function getQuickRecommendation(): Promise<QuickRecommendation> {
  const selfModel = await getSelfModel();
  const advice = await getPhaseAdvice();

  // Default: reply (safest for small accounts)
  const fallback: QuickRecommendation = {
    action: 'reply',
    reason: 'Insufficient brain data — default to replies which are safest for growth.',
    suggested_format: null,
    suggested_hook: null,
    suggested_tone: null,
    target_account: null,
    confidence: 'low',
  };

  if (!selfModel || !advice) return fallback;

  // Phase-based action selection
  let action: 'reply' | 'single' | 'thread' = 'reply';
  let reason = '';

  if (selfModel.growth_phase === 'cold_start') {
    action = 'reply';
    reason = 'Cold start phase — replies to bigger accounts are the primary growth lever.';
  } else if (selfModel.growth_phase === 'early_traction') {
    // Check if we've posted too many replies today
    const replyRatio = selfModel.total_replies_7d > 0 && selfModel.total_posts_7d > 0
      ? selfModel.total_replies_7d / (selfModel.total_replies_7d + selfModel.total_posts_7d)
      : 1;

    if (replyRatio > 0.7) {
      action = 'single';
      reason = 'Reply ratio too high (>70%) — mix in an original post to build your voice.';
    } else {
      action = 'reply';
      reason = 'Early traction — replies still primary but mixing in originals.';
    }
  } else {
    // growth/authority/scale — check what's working
    const bestAction = selfModel.best_formats?.[0]?.name;
    if (bestAction === 'thread') {
      action = 'thread';
      reason = `Threads are your best format (avg ${Math.round(selfModel.best_formats[0].avg_views)} views).`;
    } else {
      action = 'single';
      reason = `Growth phase — original posts get enough reach to justify.`;
    }
  }

  // Pick best format/hook/tone from phase advice
  const suggestedFormat = advice.recommended_formats[0]?.value ?? null;
  const suggestedHook = advice.recommended_hooks[0]?.value ?? null;
  const suggestedTone = advice.recommended_tones[0]?.value ?? null;

  // Get a target account for replies
  let targetAccount: string | null = null;
  if (action === 'reply') {
    const targets = await getRecommendedTargets('reply', 3);
    if (targets.length > 0) {
      targetAccount = targets[0].username;
    }
  }

  return {
    action,
    reason,
    suggested_format: suggestedFormat,
    suggested_hook: suggestedHook,
    suggested_tone: suggestedTone,
    target_account: targetAccount,
    confidence: advice.recommended_hooks.length >= 3 ? 'medium' : 'low',
  };
}

// =============================================================================
// 9. Analytics report — pattern effectiveness KPIs
// =============================================================================

/**
 * Returns the latest analytics report with pattern scores, KPIs, and trends.
 * This is the most rigorous analysis the brain provides — based on outperformance
 * ratios, not raw likes.
 */
async function getAnalyticsReport(): Promise<{
  top_patterns: import('./analyticsEngine').PatternScore[];
  worst_patterns: import('./analyticsEngine').PatternScore[];
  declining_patterns: import('./analyticsEngine').PatternScore[];
  rising_patterns: import('./analyticsEngine').PatternScore[];
  kpi_summary: any;
} | null> {
  try {
    const { runBrainAnalytics } = await import('./analyticsEngine');
    const report = await runBrainAnalytics();
    return {
      top_patterns: report.top_patterns,
      worst_patterns: report.worst_patterns,
      declining_patterns: report.declining_patterns,
      rising_patterns: report.rising_patterns,
      kpi_summary: report.kpi_summary,
    };
  } catch {
    return null;
  }
}

// =============================================================================
// 10. Growth Observatory: Playbooks + Growing Accounts
// =============================================================================

/**
 * Returns the strategy playbook for a given growth phase.
 * This is the observatory's main product — "here's what accounts at your
 * stage did to grow, based on real observed growth journeys."
 */
async function getGrowthPlaybook(phase?: string): Promise<any[]> {
  const supabase = getSupabaseClient();
  const selfModel = await getSelfModel();
  const targetPhase = phase || selfModel?.growth_phase || 'cold_start';

  const { data } = await supabase
    .from('brain_strategy_library')
    .select('*')
    .eq('stage', targetPhase)
    .order('win_rate', { ascending: false, nullsFirst: false });

  if (!data || data.length === 0) return [];

  // Sort: high confidence first, then medium, then low — within each band
  // preserve the win_rate order we got from the DB. Consumers that want
  // experimental / low-confidence recommendations can still see them, just
  // after the high-confidence ones.
  const rank = (c: string | null | undefined): number =>
    c === 'high' ? 0 : c === 'medium' ? 1 : 2;
  return [...data].sort((a, b) => rank(a.confidence) - rank(b.confidence));
}

/**
 * Returns the fastest-growing accounts at a given stage.
 * "Who is growing right now that we can learn from?"
 */
async function getGrowthLeaderboard(phase?: string, limit: number = 10): Promise<any[]> {
  const supabase = getSupabaseClient();
  const selfModel = await getSelfModel();

  // Map phase to follower ranges
  const ranges: Record<string, [number, number]> = {
    cold_start: [0, 500],
    early_traction: [500, 2000],
    growth: [2000, 10000],
    authority: [10000, 50000],
    scale: [50000, 10000000],
  };

  const targetPhase = phase || selfModel?.growth_phase || 'cold_start';
  const range = ranges[targetPhase] ?? [0, 10000000];

  const { data } = await supabase
    .from('brain_accounts')
    .select('username, followers_count, growth_rate_7d, growth_status, niche_cached, account_type_cached')
    .in('growth_status', ['interesting', 'hot', 'explosive'])
    .gte('followers_count', range[0])
    .lt('followers_count', range[1])
    .order('growth_rate_7d', { ascending: false, nullsFirst: false })
    .limit(limit);

  return data ?? [];
}

/**
 * Returns retrospective insights — what growing accounts did differently.
 */
async function getRetrospectiveInsights(phase?: string, limit: number = 5): Promise<any[]> {
  const supabase = getSupabaseClient();
  const selfModel = await getSelfModel();
  const targetPhase = phase || selfModel?.growth_phase || 'cold_start';

  const { data } = await supabase
    .from('brain_retrospective_analyses')
    .select(`
      username, key_changes, analysis_summary, analyzed_at,
      brain_growth_events!inner(growth_phase_at_detection, growth_rate_after, followers_at_detection)
    `)
    .eq('brain_growth_events.growth_phase_at_detection', targetPhase)
    .order('analyzed_at', { ascending: false })
    .limit(limit);

  return data ?? [];
}

/**
 * Returns our active experiments and shelved strategies.
 */
async function getOurExperiments(): Promise<{ active: any[]; shelved: any[]; history: any[] }> {
  try {
    const { getActiveExperiments, getShelvedStrategies } = await import('./observatory/strategyMemory');
    const active = await getActiveExperiments();
    const shelved = await getShelvedStrategies();
    return { active, shelved, history: [] };
  } catch {
    return { active: [], shelved: [], history: [] };
  }
}

// =============================================================================
// 11. Evidence Packages — Rich JSONL data for LLM context
// =============================================================================

/**
 * Loads relevant evidence packages and formats them for LLM prompt injection.
 * Purpose: 'strategy' (growth journeys + failed strategies),
 *          'content' (content patterns + top examples),
 *          'reply' (content patterns for reply style),
 *          'analysis' (everything)
 */
async function getEvidenceForPrompt(
  purpose: 'strategy' | 'content' | 'reply' | 'analysis',
  limit: number = 5,
): Promise<string> {
  try {
    const { getEvidenceForPrompt: loadEvidence } = await import('./observatory/evidenceLoader');
    return loadEvidence(purpose, limit);
  } catch {
    return ''; // Evidence not available yet
  }
}

// =============================================================================
// 16. Follower Range Distribution
// =============================================================================

/**
 * Returns the count of tracked accounts in each follower range bucket.
 */
async function getRangeDistribution(): Promise<Record<string, number>> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('brain_accounts')
      .select('follower_range')
      .eq('is_active', true)
      .not('follower_range', 'is', null);

    if (!data) return {};

    const dist: Record<string, number> = {};
    for (const row of data) {
      const range = row.follower_range || 'unknown';
      dist[range] = (dist[range] || 0) + 1;
    }
    return dist;
  } catch (err: any) {
    console.error(`${LOG_PREFIX} getRangeDistribution error: ${err.message}`);
    return {};
  }
}

// =============================================================================
// 17. Growth Playbook by Follower Range
// =============================================================================

/**
 * Returns strategies from brain_range_strategies for a specific follower range.
 * Falls back to cross-niche if no niche-specific strategies exist.
 */
async function getGrowthPlaybookByRange(
  followerRange: string,
  niche?: string,
  limit: number = 10,
): Promise<any[]> {
  try {
    const supabase = getSupabaseClient();

    // Try niche-specific first
    if (niche) {
      const { data: nicheStrategies } = await supabase
        .from('brain_range_strategies')
        .select('*')
        .eq('follower_range', followerRange)
        .eq('niche', niche)
        .order('sample_size', { ascending: false })
        .limit(limit);

      if (nicheStrategies && nicheStrategies.length >= 3) {
        return nicheStrategies;
      }
    }

    // Fall back to cross-niche
    const { data: strategies } = await supabase
      .from('brain_range_strategies')
      .select('*')
      .eq('follower_range', followerRange)
      .is('niche', null)
      .order('sample_size', { ascending: false })
      .limit(limit);

    return strategies ?? [];
  } catch (err: any) {
    console.error(`${LOG_PREFIX} getGrowthPlaybookByRange error: ${err.message}`);
    return [];
  }
}

// =============================================================================
// 18. Growth Examples by Range
// =============================================================================

/**
 * Returns retrospective analyses filtered by follower range at time of growth.
 */
async function getGrowthExamplesByRange(
  followerRange: string,
  limit: number = 5,
): Promise<any[]> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('brain_retrospective_analyses')
      .select('*')
      .eq('follower_range_at_growth', followerRange)
      .not('analysis_summary', 'is', null)
      .order('analyzed_at', { ascending: false })
      .limit(limit);

    return data ?? [];
  } catch (err: any) {
    console.error(`${LOG_PREFIX} getGrowthExamplesByRange error: ${err.message}`);
    return [];
  }
}

// =============================================================================
// 19. Growth Attribution (range transition analysis)
// =============================================================================

/**
 * Returns what accounts did to cross from one follower range to another.
 * e.g. getGrowthAttribution('nano', 'small') → strategies for 0-500 → 2K-10K
 */
async function getGrowthAttribution(
  fromRange: string,
  toRange: string,
  niche?: string,
): Promise<any | null> {
  try {
    const supabase = getSupabaseClient();

    // Try niche-specific first
    if (niche) {
      const { data: nicheTransition } = await supabase
        .from('brain_range_transitions')
        .select('*')
        .eq('from_range', fromRange)
        .eq('to_range', toRange)
        .eq('niche', niche)
        .single();

      if (nicheTransition && nicheTransition.sample_size >= 3) {
        return nicheTransition;
      }
    }

    // Fall back to cross-niche
    const { data: transition } = await supabase
      .from('brain_range_transitions')
      .select('*')
      .eq('from_range', fromRange)
      .eq('to_range', toRange)
      .is('niche', null)
      .single();

    return transition ?? null;
  } catch (err: any) {
    console.error(`${LOG_PREFIX} getGrowthAttribution error: ${err.message}`);
    return null;
  }
}

// =============================================================================
// Pattern Engine + Growth Stories
// =============================================================================

async function getPlaybookForTransition(fromRange: string, toRange: string, niche?: string): Promise<any> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('brain_growth_playbooks')
    .select('*')
    .eq('from_range', fromRange)
    .eq('to_range', toRange);

  if (niche) {
    query = query.eq('niche', niche);
  } else {
    query = query.is('niche', null);
  }

  const { data } = await query.single();
  return data;
}

async function getRecentGrowthStories(limit: number = 10): Promise<any[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('brain_growth_stories')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

// =============================================================================
// Export as singleton object
// =============================================================================

// =============================================================================
// Cohort Matching (NEW)
// =============================================================================

async function findSimilarAccounts(username: string, limit: number = 10): Promise<any[]> {
  const supabase = getSupabaseClient();
  const { data: account } = await supabase
    .from('brain_accounts')
    .select('follower_range, niche_cached, growth_rate_7d, avg_engagement_rate_30d, tweet_frequency_daily')
    .eq('username', username)
    .single();

  if (!account) return [];

  const { getSimilarAccounts } = await import('./cohortMatcher');
  return getSimilarAccounts({
    follower_range: account.follower_range,
    niche: account.niche_cached,
    growth_rate_7d: account.growth_rate_7d,
    avg_engagement_rate_30d: account.avg_engagement_rate_30d,
    tweet_frequency_daily: account.tweet_frequency_daily,
  }, limit);
}

// =============================================================================
// Stage-Based Growth Playbooks (NEW)
// =============================================================================

/**
 * Get the playbook for a specific stage transition (e.g. "500" → "1000").
 * Returns what successful accounts did vs what stalled accounts did.
 */
async function getStagePlaybook(fromStage: string, toStage: string): Promise<any | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('brain_stage_playbooks')
    .select('*')
    .eq('from_stage', fromStage)
    .eq('to_stage', toStage)
    .single();

  return data ?? null;
}

/**
 * Get all detected stage transitions for a specific account.
 */
async function getStageTransitions(username: string): Promise<any[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('brain_stage_transitions')
    .select('*')
    .eq('username', username)
    .order('from_stage', { ascending: true });

  return data ?? [];
}

export const brainQuery = {
  // Original brain v2
  getTopPatternsForOurPhase,
  getOptimalTimingWindows,
  getTrendingTopics,
  getRecommendedTargets,
  getContentGaps,
  getSelfPerformanceSummary,
  getStrategyHealth,
  getQuickRecommendation,
  getAnalyticsReport,

  // Growth Observatory
  getGrowthPlaybook,
  getGrowthLeaderboard,
  getRetrospectiveInsights,
  getOurExperiments,

  // Evidence Packages
  getEvidenceForPrompt,

  // Follower Range Intelligence
  getRangeDistribution,
  getGrowthPlaybookByRange,
  getGrowthExamplesByRange,
  getGrowthAttribution,

  // Pattern Engine + Growth Stories
  getPlaybookForTransition,
  getRecentGrowthStories,

  // Cohort Matching
  findSimilarAccounts,

  // Stage-Based Growth Playbooks (NEW)
  getStagePlaybook,
  getStageTransitions,
};
