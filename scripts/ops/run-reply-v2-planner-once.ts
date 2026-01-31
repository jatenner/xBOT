#!/usr/bin/env tsx
/**
 * 🎯 Reply V2 Planner One-Off Runner
 * 
 * Runs the Reply V2 planner exactly once to create decisions.
 * Designed for Railway execution (PLAN_ONLY mode).
 * 
 * Usage:
 *   railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
 */

import 'dotenv/config';
import { attemptScheduledReply } from '../../src/jobs/replySystemV2/tieredScheduler';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  console.log('🎯 Reply V2 Planner One-Off Runner');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Ensure PLAN_ONLY mode (Railway should not execute)
  const originalPlanOnly = process.env.REPLY_V2_PLAN_ONLY;
  process.env.REPLY_V2_PLAN_ONLY = 'true';
  process.env.RUNNER_MODE = 'false'; // Ensure Railway mode
  
  try {
    console.log('[PLANNER] 🚀 Starting planner cycle...\n');
    
    const beforeCount = await getSupabaseClient()
      .from('content_generation_metadata_comprehensive')
      .select('decision_id', { count: 'exact', head: true })
      .eq('pipeline_source', 'reply_v2_planner')
      .eq('status', 'queued')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour
    
    const beforeTotal = beforeCount.count || 0;
    console.log(`[PLANNER] 📊 Queued decisions before: ${beforeTotal}`);
    
    // 🔧 FIX: Refresh queue BEFORE scheduler to ensure ROOT_EVAL bridge runs
    console.log(`[PLANNER] 🔄 Refreshing candidate queue (triggers ROOT_EVAL bridge)...`);
    const { refreshCandidateQueue } = await import('../../src/jobs/replySystemV2/queueManager');
    const queueResult = await refreshCandidateQueue();
    console.log(`[PLANNER] Queue refresh: evaluated=${queueResult.evaluated} queued=${queueResult.queued} expired=${queueResult.expired}`);
    
    const result = await attemptScheduledReply();
    
    console.log(`\n[PLANNER] 📊 Result:`);
    console.log(`   Posted: ${result.posted}`);
    console.log(`   Reason: ${result.reason}`);
    if (result.candidate_tweet_id) {
      console.log(`   Candidate: ${result.candidate_tweet_id}`);
    }
    
    // Wait a moment for DB writes to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const afterCount = await getSupabaseClient()
      .from('content_generation_metadata_comprehensive')
      .select('decision_id', { count: 'exact', head: true })
      .eq('pipeline_source', 'reply_v2_planner')
      .eq('status', 'queued')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    const afterTotal = afterCount.count || 0;
    const added = afterTotal - beforeTotal;
    
    console.log(`\n[PLANNER] 📊 Queued decisions after: ${afterTotal}`);
    console.log(`[PLANNER] ✅ Added: ${added} decisions`);
    
    // Show decisions with preflight proof
    const { data: decisions } = await getSupabaseClient()
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, created_at, status, features')
      .eq('pipeline_source', 'reply_v2_planner')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (decisions && decisions.length > 0) {
      console.log(`\n[PLANNER] 📋 Recent decisions:`);
      for (const decision of decisions) {
        const features = (decision.features || {}) as any;
        const preflightOk = features.preflight_ok === true ? '✅' : '❌';
        console.log(`   ${decision.decision_id.substring(0, 8)}... ${decision.status} ${preflightOk} preflight_ok=${features.preflight_ok || 'null'} strategy=${features.strategy_id || 'null'}`);
      }
    }
    
    if (afterTotal >= 5) {
      console.log(`\n✅ SUCCESS: Target met (${afterTotal} >= 5 queued decisions)`);
      process.exit(0);
    } else {
      console.log(`\n⚠️  WARNING: Target not met (${afterTotal} < 5 queued decisions)`);
      console.log(`   Reason: ${result.reason}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`\n❌ Planner failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    
    // Log to system_events
    try {
      await getSupabaseClient().from('system_events').insert({
        event_type: 'reply_v2_planner_one_off_failed',
        severity: 'error',
        message: `Planner one-off run failed: ${error.message}`,
        event_data: {
          error: error.message,
          stack: error.stack,
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError: any) {
      console.warn(`Failed to log error: ${logError.message}`);
    }
    
    process.exit(1);
  } finally {
    // Restore original value
    if (originalPlanOnly !== undefined) {
      process.env.REPLY_V2_PLAN_ONLY = originalPlanOnly;
    }
  }
}

main().catch(console.error);
