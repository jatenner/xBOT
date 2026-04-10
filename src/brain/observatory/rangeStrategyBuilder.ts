/**
 * Range Strategy Builder
 *
 * Like strategyLibraryBuilder.ts but iterates over FollowerRange values
 * instead of growth phases. Answers: "What do accounts at 10K followers
 * do differently than accounts at 100 followers?"
 *
 * Writes to brain_range_strategies (keyed by follower_range, not stage).
 * The existing brain_strategy_library stays untouched.
 *
 * Runs every 6 hours.
 */

import { getSupabaseClient } from '../../db';
import { FOLLOWER_RANGE_ORDER, type FollowerRange } from '../types';

const LOG_PREFIX = '[observatory/range-strategy]';
const MIN_SAMPLE_SIZE = 3;

export async function runRangeStrategyBuilder(): Promise<{
  strategies_updated: number;
  ranges_with_data: number;
}> {
  const supabase = getSupabaseClient();
  let strategiesUpdated = 0;
  let rangesWithData = 0;

  for (const range of FOLLOWER_RANGE_ORDER) {
    try {
      // Get retrospective analyses for accounts in this follower range
      const { data: retros } = await supabase
        .from('brain_retrospective_analyses')
        .select('username, before_stats, during_stats, key_changes, analysis_summary, follower_range_at_growth')
        .eq('follower_range_at_growth', range)
        .not('during_stats', 'is', null)
        .limit(100);

      if (!retros || retros.length < MIN_SAMPLE_SIZE) continue;
      rangesWithData++;

      // Get stagnant accounts in this range for comparison
      const stagnantStats = await getStagnantStatsForRange(supabase, range);

      // Extract winning patterns (from during-growth period)
      const winningPatterns = extractPatterns(retros, 'during');
      const preGrowthPatterns = extractPatterns(retros, 'before');
      const losingPatterns = stagnantStats.length > 0
        ? aggregateStats(stagnantStats)
        : preGrowthPatterns;

      // Compute differentiators
      const differentiators = computeDifferentiators(winningPatterns, losingPatterns);

      // Generate strategies for this range
      const strategies = generateRangeStrategies(range, winningPatterns, losingPatterns, differentiators, retros.length);

      for (const strategy of strategies) {
        // Use raw SQL upsert since the unique constraint uses COALESCE
        const { error } = await supabase.from('brain_range_strategies').upsert(strategy, {
          onConflict: 'follower_range,COALESCE(niche, \'__cross_niche__\'),strategy_name',
          ignoreDuplicates: false,
        });

        // If upsert with COALESCE fails, try manual check + insert/update
        if (error) {
          const { data: existing } = await supabase
            .from('brain_range_strategies')
            .select('id')
            .eq('follower_range', strategy.follower_range)
            .is('niche', null)
            .eq('strategy_name', strategy.strategy_name)
            .single();

          if (existing) {
            await supabase
              .from('brain_range_strategies')
              .update(strategy)
              .eq('id', existing.id);
          } else {
            await supabase.from('brain_range_strategies').insert(strategy);
          }
        }

        strategiesUpdated++;
      }

      console.log(
        `${LOG_PREFIX} ${range}: ${retros.length} retrospectives → ${strategies.length} strategies`
      );
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error building ${range} playbook: ${err.message}`);
    }
  }

  // ==========================================================================
  // Second pass: niche-specific strategies for (range, niche) pairs
  // ==========================================================================
  const { data: nichesWithData } = await supabase
    .from('brain_accounts')
    .select('niche_cached')
    .eq('is_active', true)
    .not('niche_cached', 'is', null);

  const uniqueNiches = [...new Set((nichesWithData ?? []).map((a: any) => a.niche_cached).filter(Boolean))];

  for (const niche of uniqueNiches) {
    for (const range of FOLLOWER_RANGE_ORDER) {
      try {
        // Get retrospectives for this (range, niche) pair
        // Join through growth events → accounts to get niche
        const { data: nicheRetros } = await supabase
          .from('brain_retrospective_analyses')
          .select(`
            username, before_stats, during_stats, key_changes, analysis_summary,
            follower_range_at_growth
          `)
          .eq('follower_range_at_growth', range)
          .not('during_stats', 'is', null)
          .limit(100);

        if (!nicheRetros || nicheRetros.length === 0) continue;

        // Filter to accounts in this niche
        const nicheUsernames = new Set<string>();
        const { data: nicheAccounts } = await supabase
          .from('brain_accounts')
          .select('username')
          .eq('niche_cached', niche)
          .eq('is_active', true);

        for (const a of (nicheAccounts ?? [])) nicheUsernames.add(a.username);

        const filteredRetros = nicheRetros.filter((r: any) => nicheUsernames.has(r.username));
        if (filteredRetros.length < MIN_SAMPLE_SIZE) continue;

        const winningPatterns = extractPatterns(filteredRetros, 'during');
        const preGrowthPatterns = extractPatterns(filteredRetros, 'before');
        const differentiators = computeDifferentiators(winningPatterns, preGrowthPatterns);

        const strategies = generateRangeStrategies(range, winningPatterns, preGrowthPatterns, differentiators, filteredRetros.length, niche);

        for (const strategy of strategies) {
          const { data: existing } = await supabase
            .from('brain_range_strategies')
            .select('id')
            .eq('follower_range', strategy.follower_range)
            .eq('niche', niche)
            .eq('strategy_name', strategy.strategy_name)
            .single();

          if (existing) {
            await supabase.from('brain_range_strategies').update(strategy).eq('id', existing.id);
          } else {
            await supabase.from('brain_range_strategies').insert(strategy);
          }
          strategiesUpdated++;
        }
      } catch {
        // Non-fatal per niche/range pair
      }
    }
  }

  if (strategiesUpdated > 0) {
    console.log(`${LOG_PREFIX} Updated ${strategiesUpdated} strategies across ${rangesWithData} ranges (+ ${uniqueNiches.length} niches)`);
  }

  return { strategies_updated: strategiesUpdated, ranges_with_data: rangesWithData };
}

// =============================================================================
// Pattern extraction (reuses same logic as strategyLibraryBuilder)
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
  if (stats.length === 0) return emptyPattern();
  return aggregateStats(stats);
}

function aggregateStats(stats: any[]): AggregatedPattern {
  if (stats.length === 0) return emptyPattern();

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

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

  const allHooks: Record<string, number> = {};
  for (const s of stats) {
    for (const [hook, count] of Object.entries(s.hook_distribution ?? {})) {
      allHooks[hook] = (allHooks[hook] ?? 0) + (count as number);
    }
  }

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
    avg_reply_ratio: Math.round(avg(stats.map((s: any) => s.reply_ratio ?? 0)) * 100) / 100,
    avg_tweets_per_day: Math.round(avg(stats.map((s: any) => s.tweets_per_day ?? 0)) * 10) / 10,
    avg_likes: Math.round(avg(stats.map((s: any) => s.avg_likes ?? 0))),
    avg_word_count: Math.round(avg(stats.map((s: any) => s.avg_word_count ?? 0))),
    avg_original_ratio: Math.round(avg(stats.map((s: any) => s.original_ratio ?? 0)) * 100) / 100,
    avg_thread_ratio: Math.round(avg(stats.map((s: any) => s.thread_ratio ?? 0)) * 100) / 100,
    common_reply_targets: commonTargets,
    common_hooks: allHooks,
    common_active_hours: topHours,
    sample_size: stats.length,
  };
}

function emptyPattern(): AggregatedPattern {
  return {
    avg_reply_ratio: 0, avg_tweets_per_day: 0, avg_likes: 0, avg_word_count: 0,
    avg_original_ratio: 0, avg_thread_ratio: 0, common_reply_targets: [],
    common_hooks: {}, common_active_hours: [], sample_size: 0,
  };
}

async function getStagnantStatsForRange(supabase: any, range: FollowerRange): Promise<any[]> {
  const { data: stagnant } = await supabase
    .from('brain_accounts')
    .select('username')
    .eq('follower_range', range)
    .eq('growth_status', 'boring')
    .gte('snapshot_count', 3)
    .limit(20);

  if (!stagnant || stagnant.length === 0) return [];

  const stats: any[] = [];
  for (const acct of stagnant) {
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
      tweets_per_day: 1,
      avg_likes: avgLikes,
      avg_word_count: avgWords,
    });
  }

  return stats;
}

function computeDifferentiators(winning: AggregatedPattern, losing: AggregatedPattern): Record<string, string> {
  const diffs: Record<string, string> = {};

  if (winning.avg_reply_ratio > losing.avg_reply_ratio + 0.15) {
    diffs.reply_strategy = `Winners reply ${(winning.avg_reply_ratio * 100).toFixed(0)}% vs losers at ${(losing.avg_reply_ratio * 100).toFixed(0)}%`;
  }
  if (winning.avg_tweets_per_day > losing.avg_tweets_per_day * 1.5) {
    diffs.posting_volume = `Winners post ${winning.avg_tweets_per_day}/day vs losers at ${losing.avg_tweets_per_day}/day`;
  }
  if (winning.avg_word_count < losing.avg_word_count * 0.8) {
    diffs.content_length = `Winners use shorter content (${winning.avg_word_count} words) vs losers (${losing.avg_word_count} words)`;
  } else if (winning.avg_word_count > losing.avg_word_count * 1.3) {
    diffs.content_length = `Winners use longer content (${winning.avg_word_count} words) vs losers (${losing.avg_word_count} words)`;
  }
  if (winning.avg_likes > losing.avg_likes * 3) {
    diffs.engagement_quality = `Winners avg ${winning.avg_likes} likes vs losers at ${losing.avg_likes}`;
  }

  return diffs;
}

function generateRangeStrategies(
  range: FollowerRange,
  winning: AggregatedPattern,
  losing: AggregatedPattern,
  differentiators: Record<string, string>,
  sampleSize: number,
  niche: string | null = null,
): any[] {
  const strategies: any[] = [];
  const confidence = sampleSize >= 10 ? 'high' : sampleSize >= 5 ? 'medium' : 'low';
  const now = new Date().toISOString();

  // Reply strategy
  if (winning.avg_reply_ratio > 0.3) {
    strategies.push({
      follower_range: range,
      niche,
      strategy_name: 'reply_heavy',
      strategy_category: 'reply_targeting',
      sample_size: sampleSize,
      winning_patterns: { reply_ratio: winning.avg_reply_ratio, common_targets: winning.common_reply_targets.slice(0, 5) },
      losing_patterns: { reply_ratio: losing.avg_reply_ratio },
      key_differentiators: differentiators,
      confidence,
      updated_at: now,
    });
  }

  // Content style
  strategies.push({
    follower_range: range,
    niche,
    strategy_name: 'content_style',
    strategy_category: 'content_style',
    sample_size: sampleSize,
    winning_patterns: { avg_word_count: winning.avg_word_count, common_hooks: winning.common_hooks, tweets_per_day: winning.avg_tweets_per_day },
    losing_patterns: { avg_word_count: losing.avg_word_count, tweets_per_day: losing.avg_tweets_per_day },
    key_differentiators: differentiators,
    confidence,
    updated_at: now,
  });

  // Timing
  if (winning.common_active_hours.length > 0) {
    strategies.push({
      follower_range: range,
      niche,
      strategy_name: 'timing_pattern',
      strategy_category: 'timing',
      sample_size: sampleSize,
      winning_patterns: { active_hours_utc: winning.common_active_hours },
      losing_patterns: { active_hours_utc: losing.common_active_hours },
      key_differentiators: {},
      confidence,
      updated_at: now,
    });
  }

  // Volume
  strategies.push({
    follower_range: range,
    niche,
    strategy_name: 'posting_volume',
    strategy_category: 'posting_frequency',
    sample_size: sampleSize,
    winning_patterns: { tweets_per_day: winning.avg_tweets_per_day, reply_ratio: winning.avg_reply_ratio },
    losing_patterns: { tweets_per_day: losing.avg_tweets_per_day, reply_ratio: losing.avg_reply_ratio },
    key_differentiators: differentiators,
    confidence,
    updated_at: now,
  });

  return strategies;
}
