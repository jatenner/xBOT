/**
 * ═══════════════════════════════════════════════════════════
 * GENERATOR MONITORING UTILITIES
 * ═══════════════════════════════════════════════════════════
 * 
 * Purpose: Monitor and validate the autonomous learning system
 * 
 * Features:
 * - System health checks
 * - Performance dashboards
 * - Validation queries
 * - Alerting for issues
 * 
 * Usage:
 *   const monitor = new GeneratorMonitor();
 *   const health = await monitor.getSystemHealth();
 */

import { getSupabaseClient } from '../db/index';
import { getGeneratorPerformanceTracker } from './generatorPerformanceTracker';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  issues: string[];
  warnings: string[];
  metrics: {
    total_posts: number;
    posts_with_generator: number;
    generator_coverage: number;
    active_generators: number;
    optimization_runs: number;
    last_optimization: string | null;
    weights_sum: number;
    data_freshness_hours: number;
  };
}

export interface GeneratorAlert {
  severity: 'info' | 'warning' | 'critical';
  generator: string;
  issue: string;
  recommendation: string;
  metric?: number;
}

// ═══════════════════════════════════════════════════════════
// GENERATOR MONITOR
// ═══════════════════════════════════════════════════════════

export class GeneratorMonitor {
  private supabase;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get overall system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    console.log('🏥 MONITOR: Checking system health...');
    
    const issues: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Check 1: Posts with generator_name
      const { count: totalPosts } = await this.supabase
        .from('content_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'posted')
        .gte('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      const { count: postsWithGenerator } = await this.supabase
        .from('content_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'posted')
        .not('generator_name', 'is', null)
        .gte('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      const coverage = totalPosts ? (postsWithGenerator / totalPosts) * 100 : 0;
      
      if (coverage < 50) {
        issues.push(`Low generator coverage: ${coverage.toFixed(1)}% of posts have generator_name`);
      } else if (coverage < 80) {
        warnings.push(`Moderate generator coverage: ${coverage.toFixed(1)}%`);
      }
      
      // Check 2: Active generators
      const { data: activeGenerators } = await this.supabase
        .from('generator_weights')
        .select('generator_name, weight, last_used')
        .eq('status', 'active');
      
      if (!activeGenerators || activeGenerators.length < 10) {
        warnings.push(`Only ${activeGenerators?.length || 0} active generators (expected 12)`);
      }
      
      // Check 3: Weight sum (should be ~1.0)
      const weightsSum = activeGenerators?.reduce((sum, g) => sum + Number(g.weight), 0) || 0;
      if (Math.abs(weightsSum - 1.0) > 0.05) {
        issues.push(`Weights don't sum to 1.0 (sum: ${weightsSum.toFixed(4)})`);
      }
      
      // Check 4: Optimization runs
      const { data: lastOptimization } = await this.supabase
        .from('optimization_events')
        .select('created_at')
        .eq('event_type', 'weight_update')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      const { count: optimizationRuns } = await this.supabase
        .from('optimization_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'weight_update');
      
      const hoursSinceOptimization = lastOptimization
        ? (Date.now() - new Date(lastOptimization.created_at).getTime()) / (1000 * 60 * 60)
        : Infinity;
      
      if (hoursSinceOptimization > 12) {
        warnings.push(`No optimization run in last ${Math.round(hoursSinceOptimization)} hours`);
      }
      
      // Check 5: Stale generators (not used in 7+ days)
      const staleGenerators = activeGenerators?.filter(g => {
        if (!g.last_used) return true;
        const daysSinceUse = (Date.now() - new Date(g.last_used).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceUse > 7;
      }) || [];
      
      if (staleGenerators.length > 0) {
        warnings.push(`${staleGenerators.length} generators not used in 7+ days: ${staleGenerators.map(g => g.generator_name).join(', ')}`);
      }
      
      // Determine overall status
      let status: SystemHealth['status'] = 'healthy';
      if (issues.length > 0) status = 'critical';
      else if (warnings.length > 0) status = 'degraded';
      
      const health: SystemHealth = {
        status,
        issues,
        warnings,
        metrics: {
          total_posts: totalPosts || 0,
          posts_with_generator: postsWithGenerator || 0,
          generator_coverage: coverage,
          active_generators: activeGenerators?.length || 0,
          optimization_runs: optimizationRuns || 0,
          last_optimization: lastOptimization?.created_at || null,
          weights_sum: weightsSum,
          data_freshness_hours: hoursSinceOptimization
        }
      };
      
      console.log(`✅ MONITOR: System health: ${status.toUpperCase()}`);
      if (issues.length > 0) {
        console.log(`   Issues: ${issues.length}`);
        issues.forEach(i => console.log(`   ❌ ${i}`));
      }
      if (warnings.length > 0) {
        console.log(`   Warnings: ${warnings.length}`);
        warnings.forEach(w => console.log(`   ⚠️ ${w}`));
      }
      
      return health;
      
    } catch (error: any) {
      console.error('❌ MONITOR: Health check failed:', error.message);
      return {
        status: 'critical',
        issues: [`Health check failed: ${error.message}`],
        warnings: [],
        metrics: {
          total_posts: 0,
          posts_with_generator: 0,
          generator_coverage: 0,
          active_generators: 0,
          optimization_runs: 0,
          last_optimization: null,
          weights_sum: 0,
          data_freshness_hours: 0
        }
      };
    }
  }

  /**
   * Get alerts for generators needing attention
   */
  async getGeneratorAlerts(): Promise<GeneratorAlert[]> {
    const alerts: GeneratorAlert[] = [];
    
    try {
      const tracker = getGeneratorPerformanceTracker();
      const needsAttention = await tracker.getGeneratorsNeedingAttention();
      
      // Viral generators
      for (const generator of needsAttention.viral) {
        alerts.push({
          severity: 'info',
          generator,
          issue: 'Viral performance detected',
          recommendation: 'Consider boosting weight by 50%',
          metric: 5
        });
      }
      
      // Failing generators
      for (const generator of needsAttention.failing) {
        alerts.push({
          severity: 'critical',
          generator,
          issue: 'Consistently getting 0 followers',
          recommendation: 'Reduce to minimum weight or disable',
          metric: 0
        });
      }
      
      // Underused generators
      for (const generator of needsAttention.underused) {
        alerts.push({
          severity: 'warning',
          generator,
          issue: 'Being selected less than expected',
          recommendation: 'Check if weight is too low or investigate quality issues'
        });
      }
      
      // Overused generators
      for (const generator of needsAttention.overused) {
        alerts.push({
          severity: 'warning',
          generator,
          issue: 'Being overused despite poor performance',
          recommendation: 'Reduce weight to allow other generators to perform'
        });
      }
      
      return alerts;
      
    } catch (error: any) {
      console.error('❌ MONITOR: Failed to get alerts:', error.message);
      return [];
    }
  }

  /**
   * Generate performance dashboard
   */
  async generateDashboard(): Promise<string> {
    const tracker = getGeneratorPerformanceTracker();
    const performance = await tracker.getGeneratorPerformance(7);
    const comparison = await tracker.compareGenerators();
    const health = await this.getSystemHealth();
    const alerts = await this.getGeneratorAlerts();
    
    let dashboard = '\n';
    dashboard += '═══════════════════════════════════════════════════════════\n';
    dashboard += '🤖 AUTONOMOUS LEARNING SYSTEM DASHBOARD\n';
    dashboard += '═══════════════════════════════════════════════════════════\n\n';
    
    // System Health
    dashboard += `📊 SYSTEM HEALTH: ${health.status.toUpperCase()}\n`;
    dashboard += `   Posts (7d): ${health.metrics.total_posts}\n`;
    dashboard += `   Generator coverage: ${health.metrics.generator_coverage.toFixed(1)}%\n`;
    dashboard += `   Active generators: ${health.metrics.active_generators}\n`;
    dashboard += `   Last optimization: ${health.metrics.last_optimization ? new Date(health.metrics.last_optimization).toLocaleString() : 'Never'}\n`;
    dashboard += `   Weights sum: ${health.metrics.weights_sum.toFixed(4)}\n\n`;
    
    if (health.issues.length > 0) {
      dashboard += '❌ ISSUES:\n';
      health.issues.forEach(i => dashboard += `   ${i}\n`);
      dashboard += '\n';
    }
    
    if (health.warnings.length > 0) {
      dashboard += '⚠️ WARNINGS:\n';
      health.warnings.forEach(w => dashboard += `   ${w}\n`);
      dashboard += '\n';
    }
    
    // Generator Performance
    dashboard += '📈 GENERATOR PERFORMANCE (Last 7 days)\n';
    dashboard += '┌─────────────────────┬───────┬──────────┬─────────┬────────┐\n';
    dashboard += '│ Generator           │ Posts │ F/1K     │ Weight  │ Status │\n';
    dashboard += '├─────────────────────┼───────┼──────────┼─────────┼────────┤\n';
    
    for (const gen of performance.slice(0, 12)) {
      const name = gen.name.padEnd(19);
      const posts = String(gen.total_posts).padStart(5);
      const f1k = gen.f_per_1k.toFixed(2).padStart(8);
      const weight = (gen.current_weight * 100).toFixed(1).padStart(7) + '%';
      const status = gen.f_per_1k > 5 ? '🚀' : gen.f_per_1k > 3 ? '⭐' : gen.f_per_1k > 1.5 ? '✅' : gen.f_per_1k > 0.5 ? '⚠️' : '❌';
      dashboard += `│ ${name} │ ${posts} │ ${f1k} │ ${weight} │   ${status}    │\n`;
    }
    dashboard += '└─────────────────────┴───────┴──────────┴─────────┴────────┘\n\n';
    
    // Recommendations
    dashboard += '💡 RECOMMENDATIONS\n';
    for (const comp of comparison.slice(0, 12)) {
      dashboard += `   ${comp.performance_tier === 'viral' ? '🚀' : comp.performance_tier === 'excellent' ? '⭐' : comp.performance_tier === 'good' ? '✅' : comp.performance_tier === 'average' ? '⚠️' : '❌'} ${comp.generator_name}: ${comp.recommendation}\n`;
    }
    dashboard += '\n';
    
    // Alerts
    if (alerts.length > 0) {
      dashboard += '🚨 ALERTS\n';
      for (const alert of alerts) {
        const icon = alert.severity === 'critical' ? '❌' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
        dashboard += `   ${icon} ${alert.generator}: ${alert.issue}\n`;
        dashboard += `      → ${alert.recommendation}\n`;
      }
      dashboard += '\n';
    }
    
    dashboard += '═══════════════════════════════════════════════════════════\n';
    
    return dashboard;
  }

  /**
   * Validate system is working correctly
   */
  async validateSystem(): Promise<{
    valid: boolean;
    checks: Array<{ name: string; passed: boolean; message: string }>;
  }> {
    const checks: Array<{ name: string; passed: boolean; message: string }> = [];
    
    try {
      // Check 1: generator_weights table exists and has data
      const { data: weights, error: weightsError } = await this.supabase
        .from('generator_weights')
        .select('*')
        .limit(1);
      
      checks.push({
        name: 'generator_weights table',
        passed: !weightsError && weights && weights.length > 0,
        message: weightsError ? weightsError.message : '✅ Table exists with data'
      });
      
      // Check 2: content_metadata has generator_name column
      const { data: metadata, error: metadataError } = await this.supabase
        .from('content_metadata')
        .select('generator_name')
        .limit(1);
      
      checks.push({
        name: 'generator_name column',
        passed: !metadataError,
        message: metadataError ? metadataError.message : '✅ Column exists'
      });
      
      // Check 3: Recent posts have generator_name
      const { data: recentPosts } = await this.supabase
        .from('content_metadata')
        .select('generator_name')
        .eq('status', 'posted')
        .not('generator_name', 'is', null)
        .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);
      
      checks.push({
        name: 'Recent posts with generator',
        passed: recentPosts && recentPosts.length > 0,
        message: recentPosts && recentPosts.length > 0 ? '✅ Recent posts tracking generator' : '⚠️ No recent posts with generator_name'
      });
      
      // Check 4: Weights sum to 1.0
      const { data: allWeights } = await this.supabase
        .from('generator_weights')
        .select('weight')
        .eq('status', 'active');
      
      const sum = allWeights?.reduce((s, w) => s + Number(w.weight), 0) || 0;
      const sumValid = Math.abs(sum - 1.0) < 0.05;
      
      checks.push({
        name: 'Weights normalization',
        passed: sumValid,
        message: sumValid ? `✅ Weights sum to ${sum.toFixed(4)}` : `❌ Weights sum to ${sum.toFixed(4)} (should be ~1.0)`
      });
      
      // Check 5: Optimization events logged
      const { count: eventCount } = await this.supabase
        .from('optimization_events')
        .select('*', { count: 'exact', head: true });
      
      checks.push({
        name: 'Optimization logging',
        passed: (eventCount || 0) > 0,
        message: eventCount ? `✅ ${eventCount} optimization events logged` : '⚠️ No optimization events yet'
      });
      
      // Check 6: Generator performance tracking works
      const tracker = getGeneratorPerformanceTracker();
      const performance = await tracker.getGeneratorPerformance(7);
      
      checks.push({
        name: 'Performance tracking',
        passed: performance.length > 0,
        message: performance.length > 0 ? `✅ Tracking ${performance.length} generators` : '⚠️ No performance data'
      });
      
      const allPassed = checks.every(c => c.passed);
      
      return { valid: allPassed, checks };
      
    } catch (error: any) {
      checks.push({
        name: 'System validation',
        passed: false,
        message: `❌ Validation failed: ${error.message}`
      });
      
      return { valid: false, checks };
    }
  }

  /**
   * Get optimization history
   */
  async getOptimizationHistory(limit: number = 10): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('optimization_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('❌ MONITOR: Failed to get optimization history:', error.message);
      return [];
    }
    
    return data || [];
  }
}

// ═══════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Quick health check
 */
export async function checkSystemHealth(): Promise<SystemHealth> {
  const monitor = new GeneratorMonitor();
  return monitor.getSystemHealth();
}

/**
 * Print dashboard to console
 */
export async function printDashboard(): Promise<void> {
  const monitor = new GeneratorMonitor();
  const dashboard = await monitor.generateDashboard();
  console.log(dashboard);
}

/**
 * Validate system setup
 */
export async function validateSystemSetup(): Promise<boolean> {
  const monitor = new GeneratorMonitor();
  const result = await monitor.validateSystem();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔍 SYSTEM VALIDATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  for (const check of result.checks) {
    console.log(`${check.passed ? '✅' : '❌'} ${check.name}: ${check.message}`);
  }
  
  console.log(`\n${result.valid ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}\n`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  return result.valid;
}

