/**
 * 🤖 AUTONOMOUS HEALTH MONITOR
 * Self-diagnosing and self-healing system that detects and fixes issues automatically
 */

import { getSupabaseClient } from '../db/index';
import { getConfig, getModeFlags } from '../config/config';
import { isLLMAllowed } from '../config/envFlags';
import { checkBudgetAllowed } from '../budget/hardGuard';
import { getCircuitBreakerStatus, resetCircuitBreaker } from './postingQueue';
import { planContent } from './planJob';
import { log } from '../lib/logger';

interface HealthCheckResult {
  healthy: boolean;
  issues: string[];
  actions: string[];
  metrics: {
    queuedContent: number;
    queuedReplies: number;
    recentPosts: number;
    contentGenerated24h: number;
    stuckPosts: number;
    nullTweetIds: number;
  };
}

export class AutonomousHealthMonitor {
  private static instance: AutonomousHealthMonitor;
  private lastCheck: Date | null = null;
  private consecutiveFailures = 0;
  private lastPlanRun: Date | null = null;

  static getInstance(): AutonomousHealthMonitor {
    if (!AutonomousHealthMonitor.instance) {
      AutonomousHealthMonitor.instance = new AutonomousHealthMonitor();
    }
    return AutonomousHealthMonitor.instance;
  }

  /**
   * 🔍 COMPREHENSIVE HEALTH CHECK
   * Diagnoses all system components and identifies issues
   */
  async checkSystemHealth(): Promise<HealthCheckResult> {
    const issues: string[] = [];
    const actions: string[] = [];
    const supabase = getSupabaseClient();
    const config = getConfig();
    const flags = getModeFlags(config);

    console.log('\n🤖 AUTONOMOUS_HEALTH_MONITOR: Starting comprehensive health check...');
    console.log('='.repeat(70));

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // ============================================================
    // 1. CHECK CONFIGURATION
    // ============================================================
    console.log('\n1️⃣ Configuration Check:');
    if (flags.postingDisabled) {
      issues.push('🚨 POSTING_DISABLED=true or MODE=shadow');
      console.log('   ❌ Posting disabled');
    } else {
      console.log('   ✅ Posting enabled');
    }

    // ============================================================
    // 2. CHECK LLM ACCESS
    // ============================================================
    console.log('\n2️⃣ LLM Access Check:');
    const llmCheck = isLLMAllowed();
    if (!llmCheck.allowed) {
      issues.push(`🚨 LLM blocked: ${llmCheck.reason}`);
      console.log(`   ❌ LLM blocked: ${llmCheck.reason}`);
    } else {
      console.log('   ✅ LLM access OK');
    }

    // Check budget
    try {
      const budgetCheck = await checkBudgetAllowed();
      if (!budgetCheck.allowed) {
        issues.push(`🚨 Budget limit: ${budgetCheck.reason}`);
        console.log(`   ❌ Budget limit: ${budgetCheck.reason}`);
      } else {
        console.log('   ✅ Budget OK');
      }
    } catch (error: any) {
      console.log(`   ⚠️ Budget check failed: ${error.message}`);
    }

    // ============================================================
    // 3. CHECK CIRCUIT BREAKER
    // ============================================================
    console.log('\n3️⃣ Circuit Breaker Check:');
    try {
      const cbStatus = getCircuitBreakerStatus();
      if (cbStatus.state === 'open') {
        issues.push(`🚨 Circuit breaker OPEN (${cbStatus.failures} failures)`);
        console.log(`   ❌ Circuit breaker OPEN (${cbStatus.failures}/${cbStatus.threshold} failures)`);
        if (cbStatus.timeUntilReset && cbStatus.timeUntilReset < 1000) {
          actions.push('🔄 Resetting circuit breaker');
          resetCircuitBreaker();
          console.log('   ✅ Circuit breaker reset');
        }
      } else {
        console.log(`   ✅ Circuit breaker ${cbStatus.state} (${cbStatus.failures} failures)`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ Circuit breaker check failed: ${error.message}`);
    }

    // ============================================================
    // 4. CHECK DATABASE STATE
    // ============================================================
    console.log('\n4️⃣ Database State Check:');
    
    // Queued content
    const { count: queuedContent } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread']);

    // Queued replies
    const { count: queuedReplies } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .eq('decision_type', 'reply');

    // Recent posts
    const { count: recentPosts } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .gte('posted_at', oneDayAgo)
      .in('decision_type', ['single', 'thread', 'reply'])
      .eq('status', 'posted');

    // Content generated (24h)
    const { count: contentGenerated24h } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo)
      .in('decision_type', ['single', 'thread']);

    // Stuck posts
    const { count: stuckPosts } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posting')
      .lt('created_at', fifteenMinAgo);

    // NULL tweet IDs
    const { count: nullTweetIds } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', oneDayAgo);

    const metrics = {
      queuedContent: queuedContent || 0,
      queuedReplies: queuedReplies || 0,
      recentPosts: recentPosts || 0,
      contentGenerated24h: contentGenerated24h || 0,
      stuckPosts: stuckPosts || 0,
      nullTweetIds: nullTweetIds || 0
    };

    console.log(`   📊 Queued content: ${metrics.queuedContent}`);
    console.log(`   📊 Queued replies: ${metrics.queuedReplies}`);
    console.log(`   📊 Recent posts (24h): ${metrics.recentPosts}`);
    console.log(`   📊 Content generated (24h): ${metrics.contentGenerated24h}`);
    console.log(`   📊 Stuck posts: ${metrics.stuckPosts}`);
    console.log(`   📊 NULL tweet IDs: ${metrics.nullTweetIds}`);

    // ============================================================
    // 5. DIAGNOSE ISSUES
    // ============================================================
    console.log('\n5️⃣ Issue Diagnosis:');

    // No content generated
    if (metrics.contentGenerated24h === 0) {
      issues.push('🚨 No content generated in last 24 hours');
      console.log('   🚨 No content generated in last 24 hours');
      
      // Check if plan job should have run
      const planInterval = config.JOBS_PLAN_INTERVAL_MIN || 120;
      const maxHoursSincePlan = (planInterval / 60) * 2; // 2x interval
      
      if (this.lastPlanRun) {
        const hoursSincePlan = (Date.now() - this.lastPlanRun.getTime()) / (1000 * 60 * 60);
        if (hoursSincePlan > maxHoursSincePlan) {
          issues.push(`🚨 Plan job hasn't run in ${hoursSincePlan.toFixed(1)} hours`);
          actions.push('🔄 Triggering emergency plan job');
          console.log(`   🚨 Plan job hasn't run in ${hoursSincePlan.toFixed(1)} hours`);
        }
      } else {
        issues.push('🚨 Plan job never recorded a run');
        actions.push('🔄 Triggering emergency plan job');
        console.log('   🚨 Plan job never recorded a run');
      }
    }

    // No queued content
    if (metrics.queuedContent === 0 && metrics.queuedReplies === 0) {
      issues.push('🚨 No content in queue');
      console.log('   🚨 No content in queue');
      
      if (metrics.contentGenerated24h === 0) {
        actions.push('🔄 Triggering emergency plan job');
      }
    }

    // Stuck posts
    if (metrics.stuckPosts > 0) {
      issues.push(`⚠️ ${metrics.stuckPosts} stuck posts`);
      actions.push('🔄 Recovering stuck posts');
      console.log(`   ⚠️ ${metrics.stuckPosts} stuck posts need recovery`);
    }

    // NULL tweet IDs
    if (metrics.nullTweetIds > 0) {
      issues.push(`⚠️ ${metrics.nullTweetIds} posts missing tweet IDs`);
      console.log(`   ⚠️ ${metrics.nullTweetIds} posts missing tweet IDs`);
    }

    // ============================================================
    // 6. EXECUTE SELF-HEALING ACTIONS
    // ============================================================
    console.log('\n6️⃣ Self-Healing Actions:');
    
    if (actions.length > 0) {
      for (const action of actions) {
        console.log(`   ${action}`);
        
        if (action.includes('emergency plan job')) {
          try {
            console.log('   🚀 Running emergency plan job...');
            await planContent();
            this.lastPlanRun = new Date();
            console.log('   ✅ Emergency plan job completed');
            log({ op: 'autonomous_health', action: 'emergency_plan_job', outcome: 'success' });
          } catch (error: any) {
            console.error(`   ❌ Emergency plan job failed: ${error.message}`);
            this.consecutiveFailures++;
            log({ op: 'autonomous_health', action: 'emergency_plan_job', outcome: 'error', error: error.message });
          }
        }
        
        if (action.includes('Recovering stuck posts')) {
          try {
            const { data: stuck } = await supabase
              .from('content_metadata')
              .select('decision_id')
              .eq('status', 'posting')
              .lt('created_at', fifteenMinAgo);
            
            if (stuck && stuck.length > 0) {
              await supabase
                .from('content_metadata')
                .update({ status: 'queued' })
                .in('decision_id', stuck.map(s => s.decision_id));
              console.log(`   ✅ Recovered ${stuck.length} stuck posts`);
              log({ op: 'autonomous_health', action: 'recover_stuck_posts', count: stuck.length });
            }
          } catch (error: any) {
            console.error(`   ❌ Failed to recover stuck posts: ${error.message}`);
          }
        }
      }
    } else {
      console.log('   ✅ No actions needed');
    }

    // ============================================================
    // 7. SUMMARY
    // ============================================================
    const healthy = issues.filter(i => i.startsWith('🚨')).length === 0;
    
    console.log('\n' + '='.repeat(70));
    console.log(`📊 HEALTH STATUS: ${healthy ? '✅ HEALTHY' : '🚨 ISSUES DETECTED'}`);
    console.log('='.repeat(70));
    console.log(`   Issues: ${issues.length}`);
    console.log(`   Actions taken: ${actions.length}`);
    console.log(`   Consecutive failures: ${this.consecutiveFailures}`);
    
    if (issues.length > 0) {
      console.log('\n   Issues:');
      issues.forEach(issue => console.log(`      ${issue}`));
    }
    
    this.lastCheck = new Date();
    
    if (healthy) {
      this.consecutiveFailures = 0;
    }

    return {
      healthy,
      issues,
      actions,
      metrics
    };
  }

  /**
   * Get last plan job run time
   */
  getLastPlanRun(): Date | null {
    return this.lastPlanRun;
  }

  /**
   * Record plan job run
   */
  recordPlanRun(): void {
    this.lastPlanRun = new Date();
    this.consecutiveFailures = 0;
  }
}

export async function runAutonomousHealthCheck(): Promise<void> {
  const monitor = AutonomousHealthMonitor.getInstance();
  await monitor.checkSystemHealth();
}


