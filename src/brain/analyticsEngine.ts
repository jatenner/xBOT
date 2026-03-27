/**
 * Brain Analytics Engine
 *
 * Turns raw brain_tweets + brain_classifications data into actionable intelligence.
 * This is the analytical layer that answers: "What combinations ACTUALLY drive engagement?"
 *
 * Key KPIs:
 * 1. Outperformance Ratio — how a tweet performed relative to what's normal for that account size
 * 2. Pattern Effectiveness Score — which dimension combos consistently outperform
 * 3. Confidence Level — how much data backs each recommendation
 * 4. Trend Direction — is this pattern getting better or worse over time
 * 5. Diminishing Returns Detection — is the audience getting tired of a pattern
 *
 * Runs every 2 hours. Results cached in brain_pattern_scores table.
 */

import { getSupabaseClient } from '../db';

const LOG_PREFIX = '[brain/analytics]';

// =============================================================================
// Types
// =============================================================================

export interface PatternScore {
  dimension: string;          // e.g. "hook_type", "tone", "format", "hook+tone"
  value: string;              // e.g. "curiosity_gap", "casual", "curiosity_gap+casual"
  sample_count: number;
  median_outperformance: number;  // 1.0 = average, 2.0 = 2x better than expected
  p25_outperformance: number;     // 25th percentile (floor)
  p75_outperformance: number;     // 75th percentile (ceiling)
  avg_likes: number;
  avg_bookmarks: number;
  bookmark_to_like_ratio: number; // High = save-worthy content
  reply_to_like_ratio: number;    // High = conversation-starting
  confidence: 'high' | 'medium' | 'low';
  trend: 'rising' | 'stable' | 'declining';
  trend_delta: number;            // % change recent vs older
  account_tier: string;           // Which tier this applies to
}

export interface AnalyticsReport {
  computed_at: string;
  total_tweets_analyzed: number;
  total_classified: number;
  top_patterns: PatternScore[];     // Best performing combinations
  worst_patterns: PatternScore[];   // Worst performing (avoid these)
  declining_patterns: PatternScore[]; // Used to work, now declining
  rising_patterns: PatternScore[];   // Getting better over time
  content_gaps: { dimension: string; value: string; external_score: number; our_attempts: number }[];
  kpi_summary: {
    avg_outperformance: number;
    pct_above_average: number;      // % of tweets that outperformed their account's average
    top_hook: string;
    top_tone: string;
    top_format: string;
    top_combo: string;
  };
}

// =============================================================================
// KPI 1: Compute Outperformance Ratio for every tweet
// =============================================================================

async function computeOutperformanceRatios(): Promise<number> {
  const supabase = getSupabaseClient();

  // Get all brain_tweets with their author's average engagement
  // Step 1: Compute per-author average likes
  const { data: authorStats } = await supabase
    .from('brain_tweets')
    .select('author_username, likes')
    .gt('likes', 0)
    .limit(10000);

  if (!authorStats || authorStats.length === 0) return 0;

  const authorAvg: Record<string, { total: number; count: number }> = {};
  for (const t of authorStats) {
    const a = t.author_username;
    if (!authorAvg[a]) authorAvg[a] = { total: 0, count: 0 };
    authorAvg[a].total += t.likes ?? 0;
    authorAvg[a].count++;
  }

  // Step 2: Compute outperformance for each tweet and update
  let updated = 0;
  const batchSize = 100;

  // Get tweets without outperformance ratio
  const { data: unscored } = await supabase
    .from('brain_tweets')
    .select('tweet_id, author_username, likes')
    .is('viral_multiplier', null)
    .limit(500);

  if (!unscored || unscored.length === 0) return 0;

  for (let i = 0; i < unscored.length; i += batchSize) {
    const batch = unscored.slice(i, i + batchSize);
    for (const tweet of batch) {
      const avg = authorAvg[tweet.author_username];
      if (!avg || avg.count < 2) continue;

      const authorMean = avg.total / avg.count;
      if (authorMean <= 0) continue;

      const outperformance = (tweet.likes ?? 0) / authorMean;

      await supabase
        .from('brain_tweets')
        .update({ viral_multiplier: Math.round(outperformance * 100) / 100 })
        .eq('tweet_id', tweet.tweet_id);

      updated++;
    }
  }

  return updated;
}

// =============================================================================
// KPI 2: Pattern Effectiveness Scoring
// =============================================================================

async function computePatternScores(accountTier?: string): Promise<PatternScore[]> {
  const supabase = getSupabaseClient();

  // Join brain_tweets + brain_classifications
  const query = supabase
    .from('brain_classifications')
    .select(`
      tweet_id, domain, hook_type, tone, format, emotional_trigger,
      specificity, actionability, identity_signal,
      brain_tweets!inner(
        likes, retweets, replies, bookmarks,
        viral_multiplier, author_tier, engagement_rate,
        bookmark_to_like_ratio, reply_to_like_ratio,
        posted_at
      )
    `)
    .not('hook_type', 'is', null)
    .limit(5000);

  if (accountTier) {
    query.eq('brain_tweets.author_tier', accountTier);
  }

  const { data: rows, error } = await query;
  if (error || !rows || rows.length === 0) return [];

  // Flatten
  const tweets = rows.map((r: any) => ({
    hook_type: r.hook_type,
    tone: r.tone,
    format: r.format,
    emotional_trigger: r.emotional_trigger,
    specificity: r.specificity,
    identity_signal: r.identity_signal,
    outperformance: r.brain_tweets?.viral_multiplier ?? 1,
    likes: r.brain_tweets?.likes ?? 0,
    bookmarks: r.brain_tweets?.bookmarks ?? 0,
    replies: r.brain_tweets?.replies ?? 0,
    bookmark_to_like: r.brain_tweets?.bookmark_to_like_ratio ?? 0,
    reply_to_like: r.brain_tweets?.reply_to_like_ratio ?? 0,
    author_tier: r.brain_tweets?.author_tier ?? 'C',
    posted_at: r.brain_tweets?.posted_at,
  }));

  const scores: PatternScore[] = [];

  // Score single dimensions
  const singleDimensions = ['hook_type', 'tone', 'format', 'emotional_trigger', 'specificity', 'identity_signal'];
  for (const dim of singleDimensions) {
    const groups = groupBy(tweets, dim);
    for (const [value, group] of Object.entries(groups)) {
      if (group.length < 3) continue; // Minimum sample size
      const score = computeGroupScore(dim, value, group, accountTier ?? 'all');
      scores.push(score);
    }
  }

  // Score two-dimension combos (hook + tone, hook + format, tone + format)
  const comboPairs: [string, string][] = [
    ['hook_type', 'tone'],
    ['hook_type', 'format'],
    ['tone', 'format'],
    ['hook_type', 'emotional_trigger'],
  ];

  for (const [dimA, dimB] of comboPairs) {
    const comboGroups: Record<string, any[]> = {};
    for (const t of tweets) {
      const key = `${t[dimA as keyof typeof t]}+${t[dimB as keyof typeof t]}`;
      if (key.includes('null') || key.includes('undefined') || key.includes('other+other')) continue;
      if (!comboGroups[key]) comboGroups[key] = [];
      comboGroups[key].push(t);
    }

    for (const [value, group] of Object.entries(comboGroups)) {
      if (group.length < 5) continue; // Higher minimum for combos
      const score = computeGroupScore(`${dimA}+${dimB}`, value, group, accountTier ?? 'all');
      scores.push(score);
    }
  }

  return scores.sort((a, b) => b.median_outperformance - a.median_outperformance);
}

function groupBy(items: any[], key: string): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  for (const item of items) {
    const val = item[key];
    if (!val || val === 'other' || val === 'none') continue;
    if (!groups[val]) groups[val] = [];
    groups[val].push(item);
  }
  return groups;
}

function computeGroupScore(dimension: string, value: string, group: any[], tier: string): PatternScore {
  const outperformances = group.map(t => t.outperformance).filter(o => o > 0).sort((a, b) => a - b);
  const n = outperformances.length;

  const median = n > 0 ? outperformances[Math.floor(n / 2)] : 1;
  const p25 = n >= 4 ? outperformances[Math.floor(n * 0.25)] : median;
  const p75 = n >= 4 ? outperformances[Math.floor(n * 0.75)] : median;

  const avgLikes = group.reduce((s, t) => s + (t.likes ?? 0), 0) / group.length;
  const avgBookmarks = group.reduce((s, t) => s + (t.bookmarks ?? 0), 0) / group.length;
  const avgBTL = group.reduce((s, t) => s + (t.bookmark_to_like ?? 0), 0) / group.length;
  const avgRTL = group.reduce((s, t) => s + (t.reply_to_like ?? 0), 0) / group.length;

  // Confidence based on sample size
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (n >= 30) confidence = 'high';
  else if (n >= 10) confidence = 'medium';

  // Trend: compare first half vs second half by posted_at
  const sorted = group.filter(t => t.posted_at).sort((a, b) =>
    new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime()
  );
  let trend: 'rising' | 'stable' | 'declining' = 'stable';
  let trendDelta = 0;

  if (sorted.length >= 6) {
    const half = Math.floor(sorted.length / 2);
    const olderAvg = sorted.slice(0, half).reduce((s, t) => s + t.outperformance, 0) / half;
    const newerAvg = sorted.slice(half).reduce((s, t) => s + t.outperformance, 0) / (sorted.length - half);

    if (olderAvg > 0) {
      trendDelta = (newerAvg - olderAvg) / olderAvg;
      if (trendDelta > 0.2) trend = 'rising';
      else if (trendDelta < -0.2) trend = 'declining';
    }
  }

  return {
    dimension,
    value,
    sample_count: n,
    median_outperformance: Math.round(median * 100) / 100,
    p25_outperformance: Math.round(p25 * 100) / 100,
    p75_outperformance: Math.round(p75 * 100) / 100,
    avg_likes: Math.round(avgLikes),
    avg_bookmarks: Math.round(avgBookmarks),
    bookmark_to_like_ratio: Math.round(avgBTL * 1000) / 1000,
    reply_to_like_ratio: Math.round(avgRTL * 1000) / 1000,
    confidence,
    trend,
    trend_delta: Math.round(trendDelta * 100) / 100,
    account_tier: tier,
  };
}

// =============================================================================
// Full Analytics Report
// =============================================================================

export async function runBrainAnalytics(): Promise<AnalyticsReport> {
  const supabase = getSupabaseClient();

  console.log(`${LOG_PREFIX} Starting analytics run...`);

  // Step 1: Compute outperformance ratios for unscored tweets
  const ratiosUpdated = await computeOutperformanceRatios();
  console.log(`${LOG_PREFIX} Updated ${ratiosUpdated} outperformance ratios`);

  // Step 2: Compute pattern scores
  const allScores = await computePatternScores();
  console.log(`${LOG_PREFIX} Computed ${allScores.length} pattern scores`);

  // Step 3: Separate into categories
  const topPatterns = allScores
    .filter(s => s.median_outperformance >= 1.5 && s.confidence !== 'low')
    .slice(0, 20);

  const worstPatterns = allScores
    .filter(s => s.median_outperformance < 0.7 && s.sample_count >= 5)
    .sort((a, b) => a.median_outperformance - b.median_outperformance)
    .slice(0, 10);

  const decliningPatterns = allScores
    .filter(s => s.trend === 'declining' && s.sample_count >= 10)
    .sort((a, b) => a.trend_delta - b.trend_delta)
    .slice(0, 10);

  const risingPatterns = allScores
    .filter(s => s.trend === 'rising' && s.sample_count >= 10)
    .sort((a, b) => b.trend_delta - a.trend_delta)
    .slice(0, 10);

  // Step 4: KPI summary
  const allOutperformances = allScores.filter(s => s.dimension.split('+').length === 1);
  const avgOutperformance = allOutperformances.length > 0
    ? allOutperformances.reduce((s, p) => s + p.median_outperformance, 0) / allOutperformances.length
    : 1;
  const aboveAvg = allOutperformances.filter(p => p.median_outperformance > 1).length;
  const pctAbove = allOutperformances.length > 0 ? aboveAvg / allOutperformances.length : 0;

  const topHook = allScores.find(s => s.dimension === 'hook_type' && s.confidence !== 'low');
  const topTone = allScores.find(s => s.dimension === 'tone' && s.confidence !== 'low');
  const topFormat = allScores.find(s => s.dimension === 'format' && s.confidence !== 'low');
  const topCombo = allScores.find(s => s.dimension.includes('+') && s.confidence !== 'low');

  // Step 5: Store scores for brain query access
  try {
    await supabase.from('system_events').insert({
      event_type: 'brain_analytics_report',
      severity: 'info',
      message: `Brain analytics: ${allScores.length} patterns, ${topPatterns.length} top, ${decliningPatterns.length} declining`,
      event_data: {
        total_scores: allScores.length,
        top_count: topPatterns.length,
        declining_count: decliningPatterns.length,
        rising_count: risingPatterns.length,
        avg_outperformance: avgOutperformance,
        top_hook: topHook?.value,
        top_tone: topTone?.value,
        top_format: topFormat?.value,
        top_combo: topCombo?.value,
      },
      created_at: new Date().toISOString(),
    });
  } catch { /* non-fatal */ }

  const report: AnalyticsReport = {
    computed_at: new Date().toISOString(),
    total_tweets_analyzed: 0, // filled from DB
    total_classified: allScores.length > 0 ? allScores[0].sample_count : 0,
    top_patterns: topPatterns,
    worst_patterns: worstPatterns,
    declining_patterns: decliningPatterns,
    rising_patterns: risingPatterns,
    content_gaps: [],
    kpi_summary: {
      avg_outperformance: Math.round(avgOutperformance * 100) / 100,
      pct_above_average: Math.round(pctAbove * 100),
      top_hook: topHook?.value ?? 'insufficient_data',
      top_tone: topTone?.value ?? 'insufficient_data',
      top_format: topFormat?.value ?? 'insufficient_data',
      top_combo: topCombo?.value ?? 'insufficient_data',
    },
  };

  console.log(`${LOG_PREFIX} Analytics complete: top_hook=${report.kpi_summary.top_hook} top_tone=${report.kpi_summary.top_tone} top_combo=${report.kpi_summary.top_combo}`);

  return report;
}
