/**
 * 📊 GENERATOR PERFORMANCE FETCHER
 * 
 * Read-only helper to fetch generator performance summaries from vw_learning.
 * Used by generator policy to blend base weights with learning metrics.
 */

import { getSupabaseClient } from '../db';
import type { GeneratorPerformanceSummary } from './generatorPolicy';

/**
 * Fetch generator performance summary from vw_learning
 * 
 * Aggregates performance metrics per generator:
 * - avg(primary_objective_score)
 * - avg(followers_gained_weighted)
 * - count(*) as total_posts
 * 
 * @returns Array of generator performance summaries, or empty array on error
 */
export async function fetchGeneratorPerformanceSummary(): Promise<GeneratorPerformanceSummary[]> {
  try {
    const supabase = getSupabaseClient();
    
    // Query vw_learning and aggregate in memory (Supabase client doesn't support GROUP BY easily)
    // We fetch recent rows (last 30 days) to keep query size reasonable
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: allRows, error: queryError } = await supabase
      .from('vw_learning')
      .select('generator_name, primary_objective_score, followers_gained_weighted')
      .not('generator_name', 'is', null)
      .neq('generator_name', '')
      .not('posted_at', 'is', null)
      .gte('posted_at', thirtyDaysAgo.toISOString())
      .limit(10000); // Reasonable limit
    
    if (queryError) {
      console.error(`[GEN_PERF_FETCHER] ❌ Query failed: ${queryError.message}`);
      return [];
    }

    if (!allRows || allRows.length === 0) {
      console.log('[GEN_PERF_FETCHER] ⚠️ No data found in vw_learning');
      return [];
    }

    // Aggregate in memory
    const performanceMap = new Map<string, {
      scores: number[];
      followers: number[];
      count: number;
    }>();

    for (const row of allRows) {
      const genName = row.generator_name;
      if (!genName || typeof genName !== 'string') continue;

      if (!performanceMap.has(genName)) {
        performanceMap.set(genName, { scores: [], followers: [], count: 0 });
      }

      const perf = performanceMap.get(genName)!;
      perf.count++;

      if (row.primary_objective_score !== null && typeof row.primary_objective_score === 'number') {
        perf.scores.push(row.primary_objective_score);
      }

      if (row.followers_gained_weighted !== null && typeof row.followers_gained_weighted === 'number') {
        perf.followers.push(row.followers_gained_weighted);
      }
    }

    // Convert to GeneratorPerformanceSummary[]
    const summaries: GeneratorPerformanceSummary[] = [];
    for (const [generatorName, perf] of performanceMap.entries()) {
      const avgScore = perf.scores.length > 0
        ? perf.scores.reduce((sum, s) => sum + s, 0) / perf.scores.length
        : null;
      
      const avgFollowers = perf.followers.length > 0
        ? perf.followers.reduce((sum, f) => sum + f, 0) / perf.followers.length
        : null;

      summaries.push({
        generator_name: generatorName as any, // Type assertion needed
        avg_primary_objective_score: avgScore,
        avg_followers_gained_weighted: avgFollowers,
        total_posts: perf.count
      });
    }

    // Sort by total_posts descending
    summaries.sort((a, b) => b.total_posts - a.total_posts);

    console.log(`[GEN_PERF_FETCHER] ✅ Fetched ${summaries.length} generator summaries (${allRows.length} rows aggregated)`);
    return summaries;

  } catch (error: any) {
    console.error(`[GEN_PERF_FETCHER] ❌ Error fetching generator performance: ${error.message}`);
    return [];
  }
}

