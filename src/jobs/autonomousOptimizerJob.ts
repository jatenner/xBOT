/**
 * 🤖 AUTONOMOUS OPTIMIZER JOB
 * Self-optimizing system that adjusts strategies based on performance
 * Runs every 4 hours to optimize content generation, timing, and engagement
 */

import { getSupabaseClient } from '../db/index';
import { learningSystem } from '../learning/learningSystem';
import { trackError } from '../utils/errorTracker';

export interface OptimizationResult {
  timestamp: string;
  optimizations: Array<{
    type: string;
    description: string;
    expectedImpact: number;
    implemented: boolean;
  }>;
  performanceChanges: Record<string, number>;
}

export async function runAutonomousOptimization(): Promise<OptimizationResult> {
  console.log('[AUTONOMOUS_OPTIMIZER] 🤖 Starting autonomous optimization...');
  
  try {
    const supabase = getSupabaseClient();
    const optimizations: OptimizationResult['optimizations'] = [];
    
    // 1. Analyze content performance (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentPosts } = await supabase
      .from('content_metadata')
      .select('decision_type, generator_name, topic_cluster, hook_type, quality_score, predicted_er')
      .eq('status', 'posted')
      .gte('posted_at', sevenDaysAgo);
    
    const { data: outcomes } = await supabase
      .from('outcomes')
      .select('decision_id, likes, retweets, replies, views, followers_gained')
      .gte('collected_at', sevenDaysAgo);
    
    // 2. Calculate performance by generator
    const generatorPerformance = new Map<string, { total: number; count: number; avgEngagement: number }>();
    
    (recentPosts || []).forEach((post: any) => {
      const outcome = outcomes?.find((o: any) => o.decision_id === post.decision_id);
      if (!outcome) return;
      
      const engagement = (outcome.likes || 0) + (outcome.retweets || 0) * 2 + (outcome.replies || 0) * 3;
      const generator = post.generator_name || 'unknown';
      
      const current = generatorPerformance.get(generator) || { total: 0, count: 0, avgEngagement: 0 };
      generatorPerformance.set(generator, {
        total: current.total + engagement,
        count: current.count + 1,
        avgEngagement: 0
      });
    });
    
    // Calculate averages
    generatorPerformance.forEach((stats, generator) => {
      stats.avgEngagement = stats.count > 0 ? stats.total / stats.count : 0;
    });
    
    // 3. Identify top and bottom performers
    const sortedGenerators = Array.from(generatorPerformance.entries())
      .sort((a, b) => b[1].avgEngagement - a[1].avgEngagement);
    
    if (sortedGenerators.length > 0) {
      const topGenerator = sortedGenerators[0];
      const bottomGenerator = sortedGenerators[sortedGenerators.length - 1];
      
      console.log(`[AUTONOMOUS_OPTIMIZER] 📊 Generator Performance:`);
      console.log(`  Top: ${topGenerator[0]} (${topGenerator[1].avgEngagement.toFixed(1)} avg engagement)`);
      console.log(`  Bottom: ${bottomGenerator[0]} (${bottomGenerator[1].avgEngagement.toFixed(1)} avg engagement)`);
      
      // Optimization: Increase weight of top performers
      if (topGenerator[1].avgEngagement > bottomGenerator[1].avgEngagement * 1.5) {
        optimizations.push({
          type: 'generator_weight_adjustment',
          description: `Increase weight of ${topGenerator[0]} generator (performing ${((topGenerator[1].avgEngagement / bottomGenerator[1].avgEngagement) * 100).toFixed(0)}% better)`,
          expectedImpact: 15,
          implemented: false // Would need generator weight system to implement
        });
      }
    }
    
    // 4. Analyze format performance (single vs thread)
    const formatPerformance = {
      single: { total: 0, count: 0, avgEngagement: 0 },
      thread: { total: 0, count: 0, avgEngagement: 0 }
    };
    
    (recentPosts || []).forEach((post: any) => {
      const outcome = outcomes?.find((o: any) => o.decision_id === post.decision_id);
      if (!outcome) return;
      
      const engagement = (outcome.likes || 0) + (outcome.retweets || 0) * 2 + (outcome.replies || 0) * 3;
      const format = post.decision_type === 'thread' ? 'thread' : 'single';
      
      formatPerformance[format].total += engagement;
      formatPerformance[format].count += 1;
    });
    
    formatPerformance.single.avgEngagement = formatPerformance.single.count > 0 
      ? formatPerformance.single.total / formatPerformance.single.count 
      : 0;
    formatPerformance.thread.avgEngagement = formatPerformance.thread.count > 0 
      ? formatPerformance.thread.total / formatPerformance.thread.count 
      : 0;
    
    if (formatPerformance.single.count > 0 && formatPerformance.thread.count > 0) {
      const betterFormat = formatPerformance.single.avgEngagement > formatPerformance.thread.avgEngagement 
        ? 'single' 
        : 'thread';
      const improvement = Math.abs(formatPerformance.single.avgEngagement - formatPerformance.thread.avgEngagement);
      
      if (improvement > 5) {
        optimizations.push({
          type: 'format_selection',
          description: `Prefer ${betterFormat} format (${improvement.toFixed(1)} engagement difference)`,
          expectedImpact: 10,
          implemented: false // Would need format selection system to implement
        });
      }
    }
    
    // 5. Analyze timing performance
    const { data: timingData } = await supabase
      .from('content_metadata')
      .select('posted_at, decision_id')
      .eq('status', 'posted')
      .gte('posted_at', sevenDaysAgo);
    
    const hourPerformance = new Map<number, { total: number; count: number }>();
    
    (timingData || []).forEach((post: any) => {
      const outcome = outcomes?.find((o: any) => o.decision_id === post.decision_id);
      if (!outcome) return;
      
      const engagement = (outcome.likes || 0) + (outcome.retweets || 0) * 2 + (outcome.replies || 0) * 3;
      const hour = new Date(post.posted_at).getHours();
      
      const current = hourPerformance.get(hour) || { total: 0, count: 0 };
      hourPerformance.set(hour, {
        total: current.total + engagement,
        count: current.count + 1
      });
    });
    
    // Find best posting hours
    const sortedHours = Array.from(hourPerformance.entries())
      .map(([hour, stats]) => ({
        hour,
        avgEngagement: stats.count > 0 ? stats.total / stats.count : 0,
        count: stats.count
      }))
      .filter(h => h.count >= 2) // Need at least 2 posts for statistical significance
      .sort((a, b) => b.avgEngagement - a.avgEngagement);
    
    if (sortedHours.length > 0) {
      const bestHour = sortedHours[0];
      optimizations.push({
        type: 'timing_optimization',
        description: `Prioritize posting at hour ${bestHour.hour} (${bestHour.avgEngagement.toFixed(1)} avg engagement)`,
        expectedImpact: 8,
        implemented: false // Would need timing system to implement
      });
    }
    
    // 6. Store optimizations
    const result: OptimizationResult = {
      timestamp: new Date().toISOString(),
      optimizations,
      performanceChanges: {}
    };
    
    await supabase.from('system_events').insert({
      event_type: 'autonomous_optimization',
      severity: 'info',
      event_data: result,
      created_at: new Date().toISOString()
    });
    
    console.log(`[AUTONOMOUS_OPTIMIZER] ✅ Found ${optimizations.length} optimization opportunities`);
    optimizations.forEach((opt, index) => {
      console.log(`  ${index + 1}. ${opt.type}: ${opt.description} (expected impact: ${opt.expectedImpact}%)`);
    });
    
    console.log('[AUTONOMOUS_OPTIMIZER] ✅ Optimization complete');
    
    return result;
    
  } catch (error: any) {
    console.error('[AUTONOMOUS_OPTIMIZER] ❌ Optimization failed:', error.message);
    
    await trackError(
      'autonomous_optimizer',
      'optimization_failed',
      error.message,
      'error',
      { error_stack: error.stack?.substring(0, 300) }
    );
    
    return {
      timestamp: new Date().toISOString(),
      optimizations: [],
      performanceChanges: {}
    };
  }
}




