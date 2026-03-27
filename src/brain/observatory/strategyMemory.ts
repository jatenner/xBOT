/**
 * Strategy Memory
 *
 * Tracks what WE tried, what worked, what failed, and when to try again.
 *
 * This is the test-learn-iterate loop with LONG memory:
 * - We try a strategy for 7 days
 * - Compare our results against the strategy library benchmark
 * - If it worked: keep doing it
 * - If it failed: diagnose WHY, shelve it with a revisit date
 * - When the revisit date arrives: try again with adjustments
 *
 * Strategies can fail because:
 * - Wrong timing (we're too small for this strategy)
 * - Wrong execution (right strategy, poor content quality)
 * - Wrong target (replying to wrong account sizes)
 * - Market changed (what worked last month doesn't work now)
 *
 * A shelved strategy gets revisited when:
 * - We reach a new growth phase
 * - Enough time has passed (default 30 days)
 * - External evidence changes (strategy library updates)
 */

import { getSupabaseClient } from '../../db';
import { getSelfModel } from '../db';
import type { StrategyVerdict, ShelfStatus, GrowthPhase } from '../types';

const LOG_PREFIX = '[observatory/strategy-memory]';

const DEFAULT_TEST_DAYS = 7;
const DEFAULT_REVISIT_DAYS = 30;

// =============================================================================
// Start a new strategy test
// =============================================================================

export async function startStrategyTest(
  strategyName: string,
  benchmark?: Record<string, any>,
): Promise<string | null> {
  const supabase = getSupabaseClient();

  // Check if already testing this strategy
  const { data: existing } = await supabase
    .from('brain_strategy_memory')
    .select('id, verdict')
    .eq('strategy_name', strategyName)
    .eq('verdict', 'in_progress')
    .limit(1)
    .single();

  if (existing) {
    console.log(`${LOG_PREFIX} Already testing "${strategyName}"`);
    return existing.id;
  }

  // Get next test number
  const { data: prev } = await supabase
    .from('brain_strategy_memory')
    .select('test_number')
    .eq('strategy_name', strategyName)
    .order('test_number', { ascending: false })
    .limit(1)
    .single();

  const testNumber = (prev?.test_number ?? 0) + 1;

  const { data, error } = await supabase
    .from('brain_strategy_memory')
    .insert({
      strategy_name: strategyName,
      test_number: testNumber,
      test_period_start: new Date().toISOString(),
      test_period_end: new Date(Date.now() + DEFAULT_TEST_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      benchmark: benchmark ?? null,
      verdict: 'in_progress',
      shelf_status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    console.error(`${LOG_PREFIX} Error starting test: ${error.message}`);
    return null;
  }

  console.log(`${LOG_PREFIX} Started test #${testNumber} for "${strategyName}" (${DEFAULT_TEST_DAYS} days)`);
  return data?.id ?? null;
}

// =============================================================================
// Update test results (called by feedback loop)
// =============================================================================

export async function updateStrategyResults(
  strategyName: string,
  results: Record<string, any>,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: active } = await supabase
    .from('brain_strategy_memory')
    .select('id, our_results')
    .eq('strategy_name', strategyName)
    .eq('verdict', 'in_progress')
    .limit(1)
    .single();

  if (!active) return;

  // Merge results (accumulate over the test period)
  const merged = { ...(active.our_results ?? {}), ...results };

  await supabase
    .from('brain_strategy_memory')
    .update({
      our_results: merged,
      updated_at: new Date().toISOString(),
    })
    .eq('id', active.id);
}

// =============================================================================
// Evaluate completed tests
// =============================================================================

export async function evaluateCompletedTests(): Promise<{
  evaluated: number;
  working: number;
  failed: number;
}> {
  const supabase = getSupabaseClient();
  let evaluated = 0;
  let working = 0;
  let failed = 0;

  // Find tests whose period has ended
  const { data: completed } = await supabase
    .from('brain_strategy_memory')
    .select('*')
    .eq('verdict', 'in_progress')
    .lte('test_period_end', new Date().toISOString());

  if (!completed || completed.length === 0) {
    return { evaluated: 0, working: 0, failed: 0 };
  }

  const selfModel = await getSelfModel();

  for (const test of completed) {
    try {
      const verdict = evaluateTest(test, selfModel);
      evaluated++;

      const updateData: Record<string, any> = {
        verdict: verdict.verdict,
        diagnosis: verdict.diagnosis,
        next_action: verdict.next_action,
        updated_at: new Date().toISOString(),
      };

      if (verdict.verdict === 'failed') {
        failed++;
        updateData.shelf_status = 'shelved';
        updateData.shelved_reason = verdict.diagnosis;
        updateData.revisit_at = new Date(Date.now() + DEFAULT_REVISIT_DAYS * 24 * 60 * 60 * 1000).toISOString();

        console.log(
          `${LOG_PREFIX} ❌ "${test.strategy_name}" test #${test.test_number} FAILED: ${verdict.diagnosis}. ` +
          `Revisit in ${DEFAULT_REVISIT_DAYS} days.`
        );
      } else if (verdict.verdict === 'working') {
        working++;
        updateData.shelf_status = 'active';

        console.log(
          `${LOG_PREFIX} ✅ "${test.strategy_name}" test #${test.test_number} WORKING: ${verdict.diagnosis}`
        );
      } else {
        updateData.shelf_status = 'active';
        updateData.next_action = 'Extend test period for more data';

        // Extend test by another 7 days
        updateData.test_period_end = new Date(Date.now() + DEFAULT_TEST_DAYS * 24 * 60 * 60 * 1000).toISOString();
        updateData.verdict = 'in_progress'; // Keep testing

        console.log(`${LOG_PREFIX} 🔄 "${test.strategy_name}" test #${test.test_number} INCONCLUSIVE: extending`);
      }

      await supabase
        .from('brain_strategy_memory')
        .update(updateData)
        .eq('id', test.id);
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error evaluating "${test.strategy_name}": ${err.message}`);
    }
  }

  return { evaluated, working, failed };
}

function evaluateTest(
  test: any,
  selfModel: any,
): { verdict: StrategyVerdict; diagnosis: string; next_action: string } {
  const results = test.our_results ?? {};
  const benchmark = test.benchmark ?? {};

  // No results at all? Inconclusive
  if (Object.keys(results).length === 0) {
    return {
      verdict: 'inconclusive',
      diagnosis: 'No outcome data collected during test period',
      next_action: 'Verify posting system is active and collecting outcomes',
    };
  }

  const ourViews = results.avg_views ?? 0;
  const ourFollowers = results.followers_gained ?? 0;
  const ourEngagement = results.avg_engagement_rate ?? 0;

  const benchViews = benchmark.avg_views ?? ourViews * 2; // Default: expect 2x if no benchmark
  const benchFollowers = benchmark.followers_per_week ?? 5; // Default: at least 5/week
  const benchEngagement = benchmark.avg_engagement_rate ?? 0.02;

  // Scoring: compare against benchmarks
  const viewsRatio = benchViews > 0 ? ourViews / benchViews : 0;
  const followerRatio = benchFollowers > 0 ? ourFollowers / benchFollowers : 0;
  const engRatio = benchEngagement > 0 ? ourEngagement / benchEngagement : 0;

  // Working: at least 60% of benchmark on 2+ metrics
  const passCount = [viewsRatio >= 0.6, followerRatio >= 0.6, engRatio >= 0.6].filter(Boolean).length;

  if (passCount >= 2) {
    return {
      verdict: 'working',
      diagnosis: `Meeting benchmarks: views ${(viewsRatio * 100).toFixed(0)}%, followers ${(followerRatio * 100).toFixed(0)}%, engagement ${(engRatio * 100).toFixed(0)}% of target`,
      next_action: 'Continue this strategy. Consider increasing volume.',
    };
  }

  // Failed: below 30% on 2+ metrics
  const failCount = [viewsRatio < 0.3, followerRatio < 0.3, engRatio < 0.3].filter(Boolean).length;

  if (failCount >= 2) {
    // Diagnose WHY
    let diagnosis = 'Significantly below benchmarks. ';
    if (viewsRatio < 0.3) diagnosis += 'Views very low — algorithm may not be distributing. ';
    if (followerRatio < 0.3) diagnosis += 'No follower growth — content not converting. ';
    if (engRatio < 0.3) diagnosis += 'Low engagement — content not resonating. ';

    // Phase-specific diagnosis
    const phase = selfModel?.growth_phase ?? 'cold_start';
    if (phase === 'cold_start' && (results.reply_ratio ?? 0) < 0.5) {
      diagnosis += 'At cold_start, try heavier reply strategy (>70% replies). ';
    }

    return {
      verdict: 'failed',
      diagnosis: diagnosis.trim(),
      next_action: `Shelved. Revisit in ${DEFAULT_REVISIT_DAYS} days or at next growth phase.`,
    };
  }

  // In between: inconclusive
  return {
    verdict: 'inconclusive',
    diagnosis: `Mixed results: views ${(viewsRatio * 100).toFixed(0)}%, followers ${(followerRatio * 100).toFixed(0)}%, engagement ${(engRatio * 100).toFixed(0)}% of target`,
    next_action: 'Extend test period. Adjust execution if possible.',
  };
}

// =============================================================================
// Resurface shelved strategies
// =============================================================================

export async function resurfaceShelvedStrategies(): Promise<{ resurfaced: number }> {
  const supabase = getSupabaseClient();
  const selfModel = await getSelfModel();
  const currentPhase = selfModel?.growth_phase ?? 'cold_start';

  // Find shelved strategies whose revisit_at has passed
  const { data: shelved } = await supabase
    .from('brain_strategy_memory')
    .select('id, strategy_name, test_number, shelved_reason')
    .eq('shelf_status', 'shelved')
    .lte('revisit_at', new Date().toISOString());

  if (!shelved || shelved.length === 0) {
    return { resurfaced: 0 };
  }

  let resurfaced = 0;

  for (const entry of shelved) {
    // Mark as revisiting
    await supabase
      .from('brain_strategy_memory')
      .update({
        shelf_status: 'revisiting',
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.id);

    // Start a new test
    const testId = await startStrategyTest(entry.strategy_name);
    if (testId) {
      resurfaced++;
      console.log(
        `${LOG_PREFIX} 🔄 Resurfaced "${entry.strategy_name}" for re-testing ` +
        `(previously: ${entry.shelved_reason})`
      );
    }
  }

  return { resurfaced };
}

// =============================================================================
// Query helpers
// =============================================================================

export async function getActiveExperiments(): Promise<any[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('brain_strategy_memory')
    .select('*')
    .eq('verdict', 'in_progress')
    .order('created_at', { ascending: false });

  return data ?? [];
}

export async function getShelvedStrategies(): Promise<any[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('brain_strategy_memory')
    .select('*')
    .eq('shelf_status', 'shelved')
    .order('revisit_at', { ascending: true });

  return data ?? [];
}

export async function getStrategyHistory(strategyName: string): Promise<any[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('brain_strategy_memory')
    .select('*')
    .eq('strategy_name', strategyName)
    .order('test_number', { ascending: true });

  return data ?? [];
}
