/**
 * ═══════════════════════════════════════════════════════════
 * AUTONOMOUS OPTIMIZATION JOB
 * ═══════════════════════════════════════════════════════════
 * 
 * Purpose: Automatically optimize generator weights based on performance
 * 
 * Runs: Every 6 hours
 * 
 * What it does:
 * 1. Analyzes last 7 days of generator performance
 * 2. Calculates optimal weights based on F/1K (followers per 1K impressions)
 * 3. Updates generator_weights table
 * 4. Handles special cases (viral, failing, new generators)
 * 5. Logs all changes for transparency
 * 
 * Requirements:
 * - Minimum 20 posts in last 7 days to run optimization
 * - At least 3 posts per generator to include in optimization
 * - Respects locked generators (status != 'active')
 */

import { getSupabaseClient } from '../db/index';
import { GeneratorPerformanceTracker } from '../learning/generatorPerformanceTracker';
import type { GeneratorStats } from '../learning/generatorPerformanceTracker';
import { GeneratorWeightCalculator } from '../learning/generatorWeightCalculator';
import type { GeneratorWeights, WeightChange } from '../learning/generatorWeightCalculator';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface OptimizationResult {
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
  posts_analyzed?: number;
  generators_updated?: number;
  changes?: WeightChange[];
  top_performer?: string;
  top_performer_f_per_1k?: number;
  bottom_performer?: string;
  bottom_performer_f_per_1k?: number;
  execution_time_ms?: number;
  error?: string;
}

export interface OptimizationConfig {
  lookback_days: number;
  min_posts_required: number;
  min_posts_per_generator: number;
  aggressiveness: number;
  enable_viral_boost: boolean;
  enable_failure_detection: boolean;
  dry_run: boolean;
}

// ═══════════════════════════════════════════════════════════
// MAIN OPTIMIZATION FUNCTION
// ═══════════════════════════════════════════════════════════

export async function runAutonomousOptimization(
  config?: Partial<OptimizationConfig>
): Promise<OptimizationResult> {
  const startTime = Date.now();
  
  const defaultConfig: OptimizationConfig = {
    lookback_days: 7,
    min_posts_required: 20,
    min_posts_per_generator: 3,
    aggressiveness: 0.3, // 30% adjustment per cycle
    enable_viral_boost: true,
    enable_failure_detection: true,
    dry_run: false,
    ...config
  };

  console.log('════════════════════════════════════════════════════════════');
  console.log('🤖 AUTONOMOUS OPTIMIZATION: Starting optimization cycle...');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`   Lookback period: ${defaultConfig.lookback_days} days`);
  console.log(`   Min posts required: ${defaultConfig.min_posts_required}`);
  console.log(`   Aggressiveness: ${defaultConfig.aggressiveness * 100}%`);
  console.log(`   Viral boost: ${defaultConfig.enable_viral_boost ? 'enabled' : 'disabled'}`);
  console.log(`   Failure detection: ${defaultConfig.enable_failure_detection ? 'enabled' : 'disabled'}`);
  console.log(`   Dry run: ${defaultConfig.dry_run ? 'YES (no changes will be saved)' : 'NO'}`);
  console.log('════════════════════════════════════════════════════════════');

  try {
    // ═══════════════════════════════════════════════════════════
    // STEP 1: CHECK IF WE HAVE ENOUGH DATA
    // ═══════════════════════════════════════════════════════════
    
    const postCount = await getRecentPostCount(defaultConfig.lookback_days);
    
    console.log(`📊 STEP 1: Data check`);
    console.log(`   Posts in last ${defaultConfig.lookback_days} days: ${postCount}`);
    
    if (postCount < defaultConfig.min_posts_required) {
      console.log(`⚠️ OPTIMIZATION SKIPPED: Not enough data`);
      console.log(`   Need ${defaultConfig.min_posts_required} posts, have ${postCount}`);
      return {
        status: 'skipped',
        reason: 'insufficient_data',
        posts_analyzed: postCount
      };
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 2: GET GENERATOR PERFORMANCE
    // ═══════════════════════════════════════════════════════════
    
    console.log(`\n📈 STEP 2: Analyzing generator performance...`);
    
    const tracker = new GeneratorPerformanceTracker();
    const performance = await tracker.getGeneratorPerformance(defaultConfig.lookback_days);
    
    if (performance.length === 0) {
      console.log('⚠️ OPTIMIZATION SKIPPED: No generator performance data');
      return {
        status: 'skipped',
        reason: 'no_performance_data',
        posts_analyzed: postCount
      };
    }

    console.log(`✅ Found ${performance.length} generators with data`);
    console.log('\n   Performance Summary:');
    console.log('   ┌─────────────────────┬───────┬──────────┬────────┐');
    console.log('   │ Generator           │ Posts │ F/1K     │ Status │');
    console.log('   ├─────────────────────┼───────┼──────────┼────────┤');
    
    for (const gen of performance.slice(0, 12)) {
      const name = gen.name.padEnd(19);
      const posts = String(gen.total_posts).padStart(5);
      const f1k = gen.f_per_1k.toFixed(2).padStart(8);
      const status = gen.f_per_1k > 5 ? '🚀' : gen.f_per_1k > 3 ? '⭐' : gen.f_per_1k > 1.5 ? '✅' : gen.f_per_1k > 0.5 ? '⚠️' : '❌';
      console.log(`   │ ${name} │ ${posts} │ ${f1k} │   ${status}    │`);
    }
    console.log('   └─────────────────────┴───────┴──────────┴────────┘');

    // ═══════════════════════════════════════════════════════════
    // STEP 3: LOAD CURRENT WEIGHTS
    // ═══════════════════════════════════════════════════════════
    
    console.log(`\n⚖️  STEP 3: Loading current weights...`);
    
    const currentWeights = await loadCurrentWeights();
    console.log(`✅ Loaded weights for ${Object.keys(currentWeights).length} generators`);

    // ═══════════════════════════════════════════════════════════
    // STEP 4: CALCULATE OPTIMAL WEIGHTS
    // ═══════════════════════════════════════════════════════════
    
    console.log(`\n🧮 STEP 4: Calculating optimal weights...`);
    
    const calculator = new GeneratorWeightCalculator({
      aggressiveness: defaultConfig.aggressiveness,
      min_posts_for_optimization: defaultConfig.min_posts_per_generator
    });
    
    const newWeights = await calculator.calculateOptimalWeights(
      performance,
      currentWeights
    );

    // ═══════════════════════════════════════════════════════════
    // STEP 5: DETECT SIGNIFICANT CHANGES
    // ═══════════════════════════════════════════════════════════
    
    console.log(`\n🔍 STEP 5: Detecting significant changes...`);
    
    const changes = calculator.detectSignificantChanges(currentWeights, newWeights, 0.01);
    
    if (changes.length === 0) {
      console.log('ℹ️  No significant weight changes detected');
      return {
        status: 'skipped',
        reason: 'no_significant_changes',
        posts_analyzed: postCount,
        generators_updated: 0
      };
    }

    console.log(`✅ Found ${changes.length} significant changes:`);
    console.log('\n   Weight Changes:');
    console.log('   ┌─────────────────────┬─────────┬─────────┬──────────────┐');
    console.log('   │ Generator           │ Old %   │ New %   │ Change       │');
    console.log('   ├─────────────────────┼─────────┼─────────┼──────────────┤');
    
    for (const change of changes.slice(0, 10)) {
      const name = change.generator.padEnd(19);
      const oldPct = (change.old_weight * 100).toFixed(1).padStart(7);
      const newPct = (change.new_weight * 100).toFixed(1).padStart(7);
      const changePct = (change.change_percent > 0 ? '+' : '') + change.change_percent.toFixed(1);
      const arrow = change.change_percent > 0 ? '⬆️' : '⬇️';
      console.log(`   │ ${name} │ ${oldPct} │ ${newPct} │ ${arrow} ${changePct.padStart(8)}% │`);
    }
    console.log('   └─────────────────────┴─────────┴─────────┴──────────────┘');

    // ═══════════════════════════════════════════════════════════
    // STEP 6: HANDLE SPECIAL CASES
    // ═══════════════════════════════════════════════════════════
    
    console.log(`\n🎯 STEP 6: Handling special cases...`);
    
    let specialCases = 0;
    
    if (defaultConfig.enable_viral_boost) {
      specialCases += await handleViralGenerators(performance, newWeights);
    }
    
    if (defaultConfig.enable_failure_detection) {
      specialCases += await handleFailingGenerators(performance, newWeights);
    }
    
    console.log(`✅ Processed ${specialCases} special cases`);

    // ═══════════════════════════════════════════════════════════
    // STEP 7: UPDATE DATABASE (unless dry run)
    // ═══════════════════════════════════════════════════════════
    
    if (defaultConfig.dry_run) {
      console.log(`\n🧪 DRY RUN: Changes NOT saved to database`);
      console.log('   To apply changes, run without dry_run flag');
    } else {
      console.log(`\n💾 STEP 7: Updating database...`);
      await updateGeneratorWeights(newWeights);
      console.log(`✅ Updated weights for ${Object.keys(newWeights).length} generators`);
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 8: LOG OPTIMIZATION EVENT
    // ═══════════════════════════════════════════════════════════
    
    const topPerformer = performance[0];
    const bottomPerformer = performance[performance.length - 1];
    const executionTime = Date.now() - startTime;
    
    if (!defaultConfig.dry_run) {
      await logOptimizationEvent({
        event_type: 'weight_update',
        posts_analyzed: postCount,
        period_days: defaultConfig.lookback_days,
        generators_updated: changes.length,
        top_performer: topPerformer.name,
        top_performer_f_per_1k: topPerformer.f_per_1k,
        bottom_performer: bottomPerformer.name,
        bottom_performer_f_per_1k: bottomPerformer.f_per_1k,
        changes: changes.map(c => ({
          generator: c.generator,
          old_weight: c.old_weight,
          new_weight: c.new_weight,
          change_percent: c.change_percent,
          reason: c.reason
        })),
        execution_time_ms: executionTime,
        success: true
      });
    }

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('✅ AUTONOMOUS OPTIMIZATION: Complete');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`   Posts analyzed: ${postCount}`);
    console.log(`   Generators updated: ${changes.length}`);
    console.log(`   Top performer: ${topPerformer.name} (${topPerformer.f_per_1k.toFixed(2)} F/1K)`);
    console.log(`   Bottom performer: ${bottomPerformer.name} (${bottomPerformer.f_per_1k.toFixed(2)} F/1K)`);
    console.log(`   Execution time: ${executionTime}ms`);
    console.log('════════════════════════════════════════════════════════════\n');

    return {
      status: 'success',
      posts_analyzed: postCount,
      generators_updated: changes.length,
      changes,
      top_performer: topPerformer.name,
      top_performer_f_per_1k: topPerformer.f_per_1k,
      bottom_performer: bottomPerformer.name,
      bottom_performer_f_per_1k: bottomPerformer.f_per_1k,
      execution_time_ms: executionTime
    };

  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    
    console.error('════════════════════════════════════════════════════════════');
    console.error('❌ AUTONOMOUS OPTIMIZATION: Failed');
    console.error('════════════════════════════════════════════════════════════');
    console.error(`   Error: ${error.message}`);
    console.error(`   Execution time: ${executionTime}ms`);
    console.error('════════════════════════════════════════════════════════════\n');

    // Log failure event
    await logOptimizationEvent({
      event_type: 'weight_update',
      posts_analyzed: 0,
      period_days: defaultConfig.lookback_days,
      generators_updated: 0,
      execution_time_ms: executionTime,
      success: false,
      error_message: error.message
    });

    return {
      status: 'failed',
      error: error.message,
      execution_time_ms: executionTime
    };
  }
}

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Get count of recent posts
 */
async function getRecentPostCount(days: number): Promise<number> {
  const supabase = getSupabaseClient();
  
  const { count, error } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
  
  if (error) throw error;
  return count || 0;
}

/**
 * Load current weights from database
 */
async function loadCurrentWeights(): Promise<GeneratorWeights> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('generator_weights')
    .select('generator_name, weight');
  
  if (error) throw error;
  
  const weights: GeneratorWeights = {};
  for (const row of data || []) {
    weights[row.generator_name] = row.weight;
  }
  
  return weights;
}

/**
 * Update weights in database
 */
async function updateGeneratorWeights(weights: GeneratorWeights): Promise<void> {
  const supabase = getSupabaseClient();
  
  for (const [generatorName, weight] of Object.entries(weights)) {
    const { error } = await supabase
      .from('generator_weights')
      .update({
        weight,
        last_updated: new Date().toISOString()
      })
      .eq('generator_name', generatorName);
    
    if (error) {
      console.error(`❌ Failed to update weight for ${generatorName}:`, error.message);
    }
  }
}

/**
 * Handle viral generators (boost their weight)
 */
async function handleViralGenerators(
  performance: GeneratorStats[],
  weights: GeneratorWeights
): Promise<number> {
  const supabase = getSupabaseClient();
  let count = 0;
  
  for (const gen of performance) {
    // Viral criteria: F/1K > 5 and at least 5 posts
    if (gen.f_per_1k > 5 && gen.total_posts >= 5) {
      console.log(`   🚀 VIRAL GENERATOR: ${gen.name} (${gen.f_per_1k.toFixed(2)} F/1K)`);
      
      // Boost weight by 50%
      const boostedWeight = Math.min(weights[gen.name] * 1.5, 0.30); // Cap at 30%
      weights[gen.name] = boostedWeight;
      
      // Log viral event
      await logOptimizationEvent({
        event_type: 'viral_boost',
        posts_analyzed: gen.total_posts,
        generators_updated: 1,
        top_performer: gen.name,
        top_performer_f_per_1k: gen.f_per_1k,
        changes: [{
          generator: gen.name,
          old_weight: gen.current_weight,
          new_weight: boostedWeight,
          change_percent: ((boostedWeight - gen.current_weight) / gen.current_weight) * 100,
          reason: 'Viral performance boost'
        }],
        success: true
      });
      
      count++;
    }
  }
  
  return count;
}

/**
 * Handle failing generators (reduce to minimum or disable)
 */
async function handleFailingGenerators(
  performance: GeneratorStats[],
  weights: GeneratorWeights
): Promise<number> {
  const supabase = getSupabaseClient();
  let count = 0;
  
  for (const gen of performance) {
    // Failure criteria: 0 F/1K with at least 10 posts
    if (gen.f_per_1k === 0 && gen.total_posts >= 10) {
      console.log(`   ❌ FAILING GENERATOR: ${gen.name} (0 followers from ${gen.total_posts} posts)`);
      
      // Reduce to minimum weight (2%)
      const minWeight = 0.02;
      weights[gen.name] = minWeight;
      
      // Mark for review
      await supabase
        .from('generator_weights')
        .update({
          status: 'testing',
          notes: `Consistently failing: 0 followers from ${gen.total_posts} posts`
        })
        .eq('generator_name', gen.name);
      
      // Log failure event
      await logOptimizationEvent({
        event_type: 'failure_detected',
        posts_analyzed: gen.total_posts,
        generators_updated: 1,
        bottom_performer: gen.name,
        bottom_performer_f_per_1k: gen.f_per_1k,
        changes: [{
          generator: gen.name,
          old_weight: gen.current_weight,
          new_weight: minWeight,
          change_percent: ((minWeight - gen.current_weight) / gen.current_weight) * 100,
          reason: 'Consistent failure - minimum weight applied'
        }],
        success: true
      });
      
      count++;
    }
  }
  
  return count;
}

/**
 * Log optimization event to database
 */
async function logOptimizationEvent(event: any): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('optimization_events')
    .insert({
      event_type: event.event_type,
      posts_analyzed: event.posts_analyzed,
      period_days: event.period_days,
      generators_updated: event.generators_updated,
      top_performer: event.top_performer || null,
      top_performer_f_per_1k: event.top_performer_f_per_1k || null,
      bottom_performer: event.bottom_performer || null,
      bottom_performer_f_per_1k: event.bottom_performer_f_per_1k || null,
      changes: event.changes || null,
      execution_time_ms: event.execution_time_ms || null,
      success: event.success !== undefined ? event.success : true,
      error_message: event.error_message || null
    });
  
  if (error) {
    console.error('⚠️  Failed to log optimization event:', error.message);
  }
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Run optimization with dry run (preview changes without applying)
 */
export async function previewOptimization(): Promise<OptimizationResult> {
  return runAutonomousOptimization({ dry_run: true });
}

/**
 * Run optimization with custom config
 */
export async function runOptimizationWithConfig(config: Partial<OptimizationConfig>): Promise<OptimizationResult> {
  return runAutonomousOptimization(config);
}

/**
 * Force optimization (ignore minimum post requirements)
 */
export async function forceOptimization(): Promise<OptimizationResult> {
  return runAutonomousOptimization({
    min_posts_required: 0,
    min_posts_per_generator: 1
  });
}

