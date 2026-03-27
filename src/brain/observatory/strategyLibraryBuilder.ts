/**
 * Strategy Library Builder
 *
 * Aggregates all retrospective analyses into stage-specific playbooks.
 * This is the PRODUCT of the entire observatory — the actionable output
 * that tells our content system exactly what to do at each growth stage.
 *
 * Example output:
 *   STAGE: cold_start
 *   STRATEGY: "heavy_reply_to_mega_accounts"
 *   WIN_RATE: 73% (11/15 accounts that did this grew past cold_start)
 *   WINNING_PATTERNS: { reply_ratio: 0.8+, target_size: 50K-500K, tweets_per_day: 5-8 }
 *   LOSING_PATTERNS: { reply_ratio: < 0.3, target_size: < 10K, tweets_per_day: < 2 }
 *   KEY_DIFFERENTIATORS: "Winners replied to accounts 10-100x their size. Losers replied to peers."
 *
 * Runs every 6 hours. Needs at least 5 retrospective analyses per stage
 * to generate confident recommendations.
 */

import { getSupabaseClient } from '../../db';

const LOG_PREFIX = '[observatory/strategy-library]';
const MIN_SAMPLE_SIZE = 3; // Minimum retrospectives per stage to generate a playbook

const STAGES = ['cold_start', 'early_traction', 'growth', 'authority', 'scale'];

export async function runStrategyLibraryBuilder(): Promise<{
  strategies_updated: number;
  stages_with_data: number;
}> {
  const supabase = getSupabaseClient();
  let strategiesUpdated = 0;
  let stagesWithData = 0;

  for (const stage of STAGES) {
    try {
      // Get all retrospective analyses for this stage
      const { data: retros } = await supabase
        .from('brain_retrospective_analyses')
        .select(`
          username, before_stats, during_stats, key_changes, analysis_summary,
          brain_growth_events!inner(growth_phase_at_detection, growth_rate_after, followers_at_detection)
        `)
        .eq('brain_growth_events.growth_phase_at_detection', stage)
        .limit(100);

      if (!retros || retros.length < MIN_SAMPLE_SIZE) {
        continue;
      }

      stagesWithData++;

      // Also get accounts at this stage that did NOT grow (for comparison)
      const { data: stagnantAccounts } = await supabase
        .from('brain_accounts')
        .select('username, growth_status, growth_rate_7d, followers_count')
        .eq('growth_status', 'boring')
        .gte('snapshot_count', 3) // Has been checked multiple times
        .limit(50);

      // Get their tweet data for comparison
      const stagnantStats = await getStagnantAccountStats(supabase, stagnantAccounts ?? [], stage);

      // Extract patterns from growing accounts (winners)
      const winningPatterns = extractPatterns(retros, 'during');
      const preGrowthPatterns = extractPatterns(retros, 'before');

      // Extract patterns from stagnant accounts (losers)
      const losingPatterns = stagnantStats.length > 0
        ? extractPatternsFromStats(stagnantStats)
        : preGrowthPatterns; // Use pre-growth as proxy for losing if no stagnant data

      // Identify key differentiators
      const differentiators = computeDifferentiators(winningPatterns, losingPatterns);

      // Compute growth metrics
      const growthRates = retros.map((r: any) => r.brain_growth_events?.growth_rate_after ?? 0).filter((r: number) => r > 0);
      const avgGrowthRate = growthRates.length > 0
        ? growthRates.reduce((s: number, r: number) => s + r, 0) / growthRates.length : 0;

      // Generate strategy entries by category
      const strategies = generateStrategies(stage, winningPatterns, losingPatterns, differentiators, retros.length, avgGrowthRate);

      // Upsert into strategy library
      for (const strategy of strategies) {
        const { error } = await supabase
          .from('brain_strategy_library')
          .upsert(strategy, { onConflict: 'stage,strategy_name' });

        if (!error) strategiesUpdated++;
      }

      console.log(
        `${LOG_PREFIX} ${stage}: ${retros.length} retrospectives → ${strategies.length} strategies ` +
        `(avg growth: ${avgGrowthRate.toFixed(1)}%/week)`
      );
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error building ${stage} playbook: ${err.message}`);
    }
  }

  if (strategiesUpdated > 0) {
    console.log(`${LOG_PREFIX} Updated ${strategiesUpdated} strategies across ${stagesWithData} stages`);
  }

  return { strategies_updated: strategiesUpdated, stages_with_data: stagesWithData };
}

// =============================================================================
// Pattern extraction
// =============================================================================

interface AggregatedPattern {
  avg_reply_ratio: number;
  avg_tweets_per_day: number;
  avg_likes: number;
  avg_word_count: number;
  avg_original_ratio: number;
  avg_thread_ratio: number;
  common_reply_targets: string[];
  common_hooks: Record<string, number>;
  common_active_hours: number[];
  sample_size: number;
}

function extractPatterns(retros: any[], period: 'before' | 'during'): AggregatedPattern {
  const statsKey = period === 'before' ? 'before_stats' : 'during_stats';
  const stats = retros.map(r => r[statsKey]).filter(Boolean);

  if (stats.length === 0) {
    return emptyPattern();
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  // Aggregate reply targets across all accounts
  const allTargets: Record<string, number> = {};
  for (const s of stats) {
    for (const target of (s.top_reply_targets ?? [])) {
      allTargets[target] = (allTargets[target] ?? 0) + 1;
    }
  }
  const commonTargets = Object.entries(allTargets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);

  // Aggregate hooks
  const allHooks: Record<string, number> = {};
  for (const s of stats) {
    for (const [hook, count] of Object.entries(s.hook_distribution ?? {})) {
      allHooks[hook] = (allHooks[hook] ?? 0) + (count as number);
    }
  }

  // Aggregate active hours
  const hourCounts: Record<number, number> = {};
  for (const s of stats) {
    for (const [hour, count] of Object.entries(s.active_hours ?? {})) {
      hourCounts[Number(hour)] = (hourCounts[Number(hour)] ?? 0) + (count as number);
    }
  }
  const topHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([h]) => Number(h));

  return {
    avg_reply_ratio: Math.round(avg(stats.map(s => s.reply_ratio ?? 0)) * 100) / 100,
    avg_tweets_per_day: Math.round(avg(stats.map(s => s.tweets_per_day ?? 0)) * 10) / 10,
    avg_likes: Math.round(avg(stats.map(s => s.avg_likes ?? 0))),
    avg_word_count: Math.round(avg(stats.map(s => s.avg_word_count ?? 0))),
    avg_original_ratio: Math.round(avg(stats.map(s => s.original_ratio ?? 0)) * 100) / 100,
    avg_thread_ratio: Math.round(avg(stats.map(s => s.thread_ratio ?? 0)) * 100) / 100,
    common_reply_targets: commonTargets,
    common_hooks: allHooks,
    common_active_hours: topHours,
    sample_size: stats.length,
  };
}

function extractPatternsFromStats(stats: any[]): AggregatedPattern {
  if (stats.length === 0) return emptyPattern();

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  return {
    avg_reply_ratio: Math.round(avg(stats.map(s => s.reply_ratio ?? 0)) * 100) / 100,
    avg_tweets_per_day: Math.round(avg(stats.map(s => s.tweets_per_day ?? 0)) * 10) / 10,
    avg_likes: Math.round(avg(stats.map(s => s.avg_likes ?? 0))),
    avg_word_count: Math.round(avg(stats.map(s => s.avg_word_count ?? 0))),
    avg_original_ratio: Math.round(avg(stats.map(s => 1 - (s.reply_ratio ?? 0))) * 100) / 100,
    avg_thread_ratio: 0,
    common_reply_targets: [],
    common_hooks: {},
    common_active_hours: [],
    sample_size: stats.length,
  };
}

async function getStagnantAccountStats(supabase: any, accounts: any[], stage: string): Promise<any[]> {
  // Filter to accounts at the right stage based on follower count
  const stageRanges: Record<string, [number, number]> = {
    cold_start: [0, 500],
    early_traction: [500, 2000],
    growth: [2000, 10000],
    authority: [10000, 50000],
    scale: [50000, Infinity],
  };

  const range = stageRanges[stage] ?? [0, Infinity];
  const relevant = accounts.filter(a =>
    (a.followers_count ?? 0) >= range[0] && (a.followers_count ?? 0) < range[1]
  );

  if (relevant.length === 0) return [];

  // Get tweet stats for stagnant accounts
  const stats: any[] = [];
  for (const acct of relevant.slice(0, 20)) {
    const { data: tweets } = await supabase
      .from('brain_tweets')
      .select('tweet_type, likes, content')
      .eq('author_username', acct.username)
      .limit(30);

    if (!tweets || tweets.length < 3) continue;

    const total = tweets.length;
    const replies = tweets.filter((t: any) => t.tweet_type === 'reply').length;
    const avgLikes = tweets.reduce((s: number, t: any) => s + (t.likes ?? 0), 0) / total;
    const avgWords = tweets.reduce((s: number, t: any) => s + ((t.content ?? '').split(/\s+/).length), 0) / total;

    stats.push({
      reply_ratio: replies / total,
      tweets_per_day: 1, // Approximate
      avg_likes: avgLikes,
      avg_word_count: avgWords,
    });
  }

  return stats;
}

function emptyPattern(): AggregatedPattern {
  return {
    avg_reply_ratio: 0, avg_tweets_per_day: 0, avg_likes: 0, avg_word_count: 0,
    avg_original_ratio: 0, avg_thread_ratio: 0, common_reply_targets: [],
    common_hooks: {}, common_active_hours: [], sample_size: 0,
  };
}

// =============================================================================
// Differentiator computation
// =============================================================================

function computeDifferentiators(winning: AggregatedPattern, losing: AggregatedPattern): Record<string, string> {
  const diffs: Record<string, string> = {};

  if (winning.avg_reply_ratio > losing.avg_reply_ratio + 0.15) {
    diffs.reply_strategy = `Winners reply ${(winning.avg_reply_ratio * 100).toFixed(0)}% of the time vs losers at ${(losing.avg_reply_ratio * 100).toFixed(0)}%. Replying more is a strong growth signal.`;
  }

  if (winning.avg_tweets_per_day > losing.avg_tweets_per_day * 1.5) {
    diffs.posting_volume = `Winners post ${winning.avg_tweets_per_day}/day vs losers at ${losing.avg_tweets_per_day}/day. Higher volume correlates with growth.`;
  }

  if (winning.avg_word_count < losing.avg_word_count * 0.8) {
    diffs.content_length = `Winners use shorter content (${winning.avg_word_count} words) vs losers (${losing.avg_word_count} words). Brevity wins.`;
  } else if (winning.avg_word_count > losing.avg_word_count * 1.3) {
    diffs.content_length = `Winners use longer content (${winning.avg_word_count} words) vs losers (${losing.avg_word_count} words). Depth wins at this stage.`;
  }

  if (winning.avg_likes > losing.avg_likes * 3) {
    diffs.engagement_quality = `Winners avg ${winning.avg_likes} likes vs losers at ${losing.avg_likes}. The content quality gap is significant.`;
  }

  if (winning.common_reply_targets.length > 0 && losing.common_reply_targets.length === 0) {
    diffs.targeting = `Winners have clear reply targets (${winning.common_reply_targets.slice(0, 3).map(t => '@' + t).join(', ')}). Losers don't target consistently.`;
  }

  return diffs;
}

// =============================================================================
// Strategy generation
// =============================================================================

function generateStrategies(
  stage: string,
  winning: AggregatedPattern,
  losing: AggregatedPattern,
  differentiators: Record<string, string>,
  sampleSize: number,
  avgGrowthRate: number,
): any[] {
  const strategies: any[] = [];
  const confidence = sampleSize >= 10 ? 'high' : sampleSize >= 5 ? 'medium' : 'low';
  const now = new Date().toISOString();

  // Reply strategy
  if (winning.avg_reply_ratio > 0.3) {
    strategies.push({
      stage,
      strategy_name: 'reply_heavy',
      strategy_category: 'reply_targeting',
      win_rate: Math.min(winning.sample_size / (winning.sample_size + (losing.sample_size || 1)), 0.95),
      sample_size: sampleSize,
      winning_patterns: {
        reply_ratio: winning.avg_reply_ratio,
        common_targets: winning.common_reply_targets.slice(0, 5),
        avg_likes_per_reply: winning.avg_likes,
      },
      losing_patterns: {
        reply_ratio: losing.avg_reply_ratio,
        avg_likes: losing.avg_likes,
      },
      key_differentiators: differentiators,
      avg_growth_rate: avgGrowthRate,
      confidence,
      updated_at: now,
    });
  }

  // Content style strategy
  strategies.push({
    stage,
    strategy_name: 'content_style',
    strategy_category: 'content_style',
    win_rate: null,
    sample_size: sampleSize,
    winning_patterns: {
      avg_word_count: winning.avg_word_count,
      common_hooks: winning.common_hooks,
      tweets_per_day: winning.avg_tweets_per_day,
      thread_ratio: winning.avg_thread_ratio,
    },
    losing_patterns: {
      avg_word_count: losing.avg_word_count,
      tweets_per_day: losing.avg_tweets_per_day,
    },
    key_differentiators: differentiators,
    avg_growth_rate: avgGrowthRate,
    confidence,
    updated_at: now,
  });

  // Timing strategy
  if (winning.common_active_hours.length > 0) {
    strategies.push({
      stage,
      strategy_name: 'timing_pattern',
      strategy_category: 'timing',
      win_rate: null,
      sample_size: sampleSize,
      winning_patterns: {
        active_hours_utc: winning.common_active_hours,
      },
      losing_patterns: {
        active_hours_utc: losing.common_active_hours,
      },
      key_differentiators: {},
      avg_growth_rate: avgGrowthRate,
      confidence,
      updated_at: now,
    });
  }

  // Volume strategy
  strategies.push({
    stage,
    strategy_name: 'posting_volume',
    strategy_category: 'posting_frequency',
    win_rate: null,
    sample_size: sampleSize,
    winning_patterns: {
      tweets_per_day: winning.avg_tweets_per_day,
      reply_ratio: winning.avg_reply_ratio,
      original_ratio: winning.avg_original_ratio,
    },
    losing_patterns: {
      tweets_per_day: losing.avg_tweets_per_day,
      reply_ratio: losing.avg_reply_ratio,
    },
    key_differentiators: differentiators,
    avg_growth_rate: avgGrowthRate,
    confidence,
    updated_at: now,
  });

  return strategies;
}
