#!/usr/bin/env tsx
/**
 * 🔄 Reply V2 Continuous Ops Loop
 * 
 * Runs forever with:
 * - Harvest cycle every 10 minutes (with timeout handling)
 * - Planner + Scheduler every 10 minutes
 * - Heartbeat every 2 minutes
 * - Aggressive pool fill (fresh_12h >= 80)
 * 
 * Usage:
 *   pnpm tsx scripts/ops/reply-v2-ops-loop.ts
 */

import 'dotenv/config';
import { execSync, spawn } from 'child_process';
import { getSupabaseClient } from '../../src/db/index';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

const HARVEST_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const PLAN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const HARVEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per cycle
const TARGET_FRESH_12H = 80;
const MAX_HARVEST_CYCLES_PER_HOUR = 6;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCommandWithTimeout(
  cmd: string,
  description: string,
  timeoutMs: number
): Promise<{ success: boolean; output: string; timedOut: boolean; durationMs: number }> {
  const startTime = Date.now();
  console.log(`[OPS_LOOP] start ${description}`);
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      env: { ...process.env, HARVESTING_ENABLED: 'true' },
      stdio: 'pipe',
      timeout: timeoutMs
    });
    const durationMs = Date.now() - startTime;
    console.log(`[OPS_LOOP] end ${description} duration_ms=${durationMs}`);
    return { success: true, output, timedOut: false, durationMs };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const timedOut = error.signal === 'SIGTERM' || error.message.includes('timeout');
    if (timedOut) {
      console.log(`[OPS_LOOP] end ${description} duration_ms=${durationMs} timed_out=true (continuing loop)`);
      return { success: false, output: '', timedOut: true, durationMs };
    }
    console.error(`[OPS_LOOP] end ${description} duration_ms=${durationMs} error=${error.message}`);
    return { success: false, output: '', timedOut: false, durationMs };
  }
}

async function checkOpportunities(): Promise<{
  pool_size: number;
  unclaimed: number;
  fresh_12h: number;
  fresh_24h: number;
  newest_unclaimed: string | null;
}> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('reply_opportunities')
    .select('replied_to, tweet_posted_at');
  
  if (error) {
    console.error('Error checking opportunities:', error);
    return { pool_size: 0, unclaimed: 0, fresh_12h: 0, fresh_24h: 0, newest_unclaimed: null };
  }
  
  const poolSize = data?.length || 0;
  const unclaimed = data?.filter(o => !o.replied_to).length || 0;
  const now = Date.now();
  const twelveHoursAgo = now - 12 * 60 * 60 * 1000;
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
  
  const fresh12h = data?.filter(o => 
    !o.replied_to && 
    o.tweet_posted_at && 
    new Date(o.tweet_posted_at).getTime() > twelveHoursAgo
  ).length || 0;
  
  const fresh24h = data?.filter(o => 
    !o.replied_to && 
    o.tweet_posted_at && 
    new Date(o.tweet_posted_at).getTime() > twentyFourHoursAgo
  ).length || 0;
  
  const unclaimedOpps = data?.filter(o => !o.replied_to) || [];
  const newestUnclaimed = unclaimedOpps.length > 0
    ? unclaimedOpps.reduce((newest, o) => {
        if (!o.tweet_posted_at) return newest;
        const oTime = new Date(o.tweet_posted_at).getTime();
        const newestTime = newest ? new Date(newest).getTime() : 0;
        return oTime > newestTime ? o.tweet_posted_at : newest;
      }, null as string | null)
    : null;
  
  return { pool_size: poolSize, unclaimed, fresh_12h: fresh12h, fresh_24h: fresh24h, newest_unclaimed: newestUnclaimed };
}

async function checkDecisions(): Promise<{
  total_last_30m: number;
  total_last_60m: number;
  total_last_60m_metadata: number; // Also check content_metadata table
  queued: number;
  runtime_ok: number;
  runtime_inaccessible: number;
  runtime_deleted: number;
  runtime_timeout: number;
  posted: number;
  by_pipeline_source: Record<string, number>;
}> {
  const supabase = getSupabaseClient();
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: data30m } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, features, posted_tweet_id, pipeline_source, created_at')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', thirtyMinutesAgo)
    .order('created_at', { ascending: false });
  
  const { data: data60m } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, features, posted_tweet_id, pipeline_source, created_at')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });
  
  // Also check content_metadata table
  const { data: data60mMetadata } = await supabase
    .from('content_metadata')
    .select('decision_id, status, features, posted_tweet_id, pipeline_source, created_at')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });
  
  const replyV2_30m = data30m || [];
  const replyV2_60m = data60m || [];
  
  const queued = replyV2_60m.filter((d: any) => d.status === 'queued').length;
  const posted = replyV2_60m.filter((d: any) => d.posted_tweet_id).length;
  
  const runtimeOk = replyV2_60m.filter((d: any) => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'ok';
  }).length;
  
  const runtimeInaccessible = replyV2_60m.filter((d: any) => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'inaccessible';
  }).length;
  
  const runtimeDeleted = replyV2_60m.filter((d: any) => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'deleted';
  }).length;
  
  const runtimeTimeout = replyV2_60m.filter((d: any) => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'timeout';
  }).length;
  
  const byPipelineSource: Record<string, number> = {};
  replyV2_30m.forEach((d: any) => {
    const source = d.pipeline_source || 'unknown';
    byPipelineSource[source] = (byPipelineSource[source] || 0) + 1;
  });
  
  return {
    total_last_30m: replyV2_30m.length,
    total_last_60m: replyV2_60m.length,
    total_last_60m_metadata: (data60mMetadata || []).length,
    queued,
    runtime_ok: runtimeOk,
    runtime_inaccessible: runtimeInaccessible,
    runtime_deleted: runtimeDeleted,
    runtime_timeout: runtimeTimeout,
    posted,
    by_pipeline_source: byPipelineSource
  };
}

function getExecutorInfo(): { pid: number | null; logTimestamp: string | null } {
  try {
    const pidOutput = execSync('ps aux | grep "executor.*daemon" | grep -v grep | head -1', { encoding: 'utf-8' });
    const pidMatch = pidOutput.match(/\s+(\d+)\s+/);
    const pid = pidMatch ? parseInt(pidMatch[1], 10) : null;
    
    const logPath = join(process.cwd(), '.runner-profile', 'executor.log');
    let logTimestamp: string | null = null;
    if (existsSync(logPath)) {
      const stats = statSync(logPath);
      logTimestamp = new Date(stats.mtime).toISOString();
    }
    
    return { pid, logTimestamp };
  } catch {
    return { pid: null, logTimestamp: null };
  }
}

async function printHeartbeat() {
  const opps = await checkOpportunities();
  const decisions = await checkDecisions();
  const executor = getExecutorInfo();
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`💓 HEARTBEAT - ${new Date().toISOString()}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Opportunities:`);
  console.log(`  fresh_12h: ${opps.fresh_12h} (target: ${TARGET_FRESH_12H})`);
  console.log(`  fresh_24h: ${opps.fresh_24h}`);
  console.log(`  pool_size: ${opps.pool_size}`);
  console.log(`  unclaimed: ${opps.unclaimed}`);
  console.log(`  newest_unclaimed: ${opps.newest_unclaimed || 'N/A'}`);
  console.log(`\nDecisions (last 30m):`);
  console.log(`  total: ${decisions.total_last_30m}`);
  console.log(`  by pipeline_source:`, decisions.by_pipeline_source);
  console.log(`\nDecisions (last 60m):`);
  console.log(`  total (comprehensive): ${decisions.total_last_60m}`);
  console.log(`  total (metadata): ${decisions.total_last_60m_metadata}`);
  console.log(`  queued: ${decisions.queued}`);
  console.log(`  runtime_ok: ${decisions.runtime_ok}`);
  console.log(`  runtime_inaccessible: ${decisions.runtime_inaccessible}`);
  console.log(`  runtime_deleted: ${decisions.runtime_deleted}`);
  console.log(`  runtime_timeout: ${decisions.runtime_timeout}`);
  console.log(`  posted: ${decisions.posted}`);
  console.log(`\nExecutor:`);
  console.log(`  PID: ${executor.pid || 'not found'}`);
  console.log(`  last log update: ${executor.logTimestamp || 'N/A'}`);
  console.log(`${'='.repeat(70)}\n`);
}

async function aggressivePoolFill(): Promise<number> {
  let cyclesRun = 0;
  let lastFresh12h = 0;
  
  while (cyclesRun < MAX_HARVEST_CYCLES_PER_HOUR) {
    const beforeOpps = await checkOpportunities();
    lastFresh12h = beforeOpps.fresh_12h;
    
    if (beforeOpps.fresh_12h >= TARGET_FRESH_12H) {
      console.log(`✅ Pool fill target reached: fresh_12h=${beforeOpps.fresh_12h} >= ${TARGET_FRESH_12H}`);
      break;
    }
    
    cyclesRun++;
    console.log(`\n🌾 Aggressive pool fill cycle ${cyclesRun}/${MAX_HARVEST_CYCLES_PER_HOUR}...`);
    
    const result = await runCommandWithTimeout(
      'pnpm tsx scripts/ops/run-harvester-single-cycle.ts',
      `Harvest cycle ${cyclesRun}`,
      HARVEST_TIMEOUT_MS
    );
    
    if (result.timedOut) {
      console.log(`⚠️  Harvest cycle ${cyclesRun} timed out (continuing)`);
    }
    
    const afterOpps = await checkOpportunities();
    const delta = afterOpps.fresh_12h - beforeOpps.fresh_12h;
    console.log(`  fresh_12h: ${beforeOpps.fresh_12h} → ${afterOpps.fresh_12h} (delta: +${delta})`);
    
    if (cyclesRun < MAX_HARVEST_CYCLES_PER_HOUR && afterOpps.fresh_12h < TARGET_FRESH_12H) {
      await sleep(2 * 60 * 1000); // 2 minutes between cycles
    }
  }
  
  return lastFresh12h;
}

async function main() {
  console.log('🔄 Reply V2 Continuous Ops Loop');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Harvest interval: ${HARVEST_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`Plan interval: ${PLAN_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`Heartbeat interval: ${HEARTBEAT_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`Target fresh_12h: ${TARGET_FRESH_12H}`);
  console.log(`Max harvest cycles/hour: ${MAX_HARVEST_CYCLES_PER_HOUR}`);
  console.log(`Harvest timeout: ${HARVEST_TIMEOUT_MS / 1000}s per cycle\n`);
  
  let lastHarvestTime = 0;
  let lastPlanTime = 0;
  let lastHeartbeatTime = 0;
  let maxFresh12h = 0;
  let harvestCyclesThisHour = 0;
  let hourStartTime = Date.now();
  
  // Initial heartbeat
  await printHeartbeat();
  
  console.log('🚀 Starting continuous loop...\n');
  
  while (true) {
    const now = Date.now();
    
    // Reset harvest cycle counter every hour
    if (now - hourStartTime > 60 * 60 * 1000) {
      harvestCyclesThisHour = 0;
      hourStartTime = now;
    }
    
    // Harvest every 10 minutes (if under hourly limit)
    if (now - lastHarvestTime >= HARVEST_INTERVAL_MS && harvestCyclesThisHour < MAX_HARVEST_CYCLES_PER_HOUR) {
      lastHarvestTime = now;
      harvestCyclesThisHour++;
      
      console.log(`\n🌾 HARVEST CYCLE (${harvestCyclesThisHour}/${MAX_HARVEST_CYCLES_PER_HOUR} this hour)`);
      const beforeOpps = await checkOpportunities();
      const result = await runCommandWithTimeout(
        'pnpm tsx scripts/ops/run-harvester-single-cycle.ts',
        'harvest_cycle',
        HARVEST_TIMEOUT_MS
      );
      
      const afterOpps = await checkOpportunities();
      const newOpportunities = afterOpps.fresh_12h - beforeOpps.fresh_12h;
      console.log(`[OPS_LOOP] harvest_cycle new_opportunities=${newOpportunities} fresh_12h=${beforeOpps.fresh_12h}->${afterOpps.fresh_12h}`);
      
      if (result.timedOut) {
        console.log('⚠️  Harvest cycle timed out (logged, continuing loop)');
      }
      
      if (afterOpps.fresh_12h > maxFresh12h) {
        maxFresh12h = afterOpps.fresh_12h;
      }
      
      // Aggressive pool fill if below target
      if (opps.fresh_12h < TARGET_FRESH_12H && harvestCyclesThisHour < MAX_HARVEST_CYCLES_PER_HOUR) {
        const peakFresh = await aggressivePoolFill();
        if (peakFresh > maxFresh12h) {
          maxFresh12h = peakFresh;
        }
        harvestCyclesThisHour = MAX_HARVEST_CYCLES_PER_HOUR; // Reset counter after aggressive fill
      }
    }
    
    // Plan + Schedule every 10 minutes
    if (now - lastPlanTime >= PLAN_INTERVAL_MS) {
      lastPlanTime = now;
      
      console.log(`\n🎯 PLAN + SCHEDULE CYCLE`);
      
      // Check eligibility snapshot BEFORE planner runs
      const supabase = getSupabaseClient();
      const oppsSnapshot = await checkOpportunities();
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Check reply_opportunities eligibility
      const { data: allOpps } = await supabase
        .from('reply_opportunities')
        .select('replied_to, tweet_posted_at, target_tweet_id');
      
      const fresh12hCount = (allOpps || []).filter(o => 
        !o.replied_to && 
        o.tweet_posted_at && 
        new Date(o.tweet_posted_at).getTime() > new Date(twelveHoursAgo).getTime()
      ).length;
      
      const unclaimedCount = (allOpps || []).filter(o => !o.replied_to).length;
      
      // Check for inaccessible/protected filter exclusions
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentPreflights } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('features->>runtime_preflight_status, features->>target_tweet_id')
        .eq('decision_type', 'reply')
        .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
        .gte('created_at', oneHourAgo);
      
      const inaccessibleCount = (recentPreflights || []).filter((d: any) => {
        const f = d.features || {};
        return f.runtime_preflight_status === 'inaccessible' || f.runtime_preflight_status === 'protected';
      }).length;
      
      // Check candidate_evaluations eligibility
      const { data: evaluations } = await supabase
        .from('candidate_evaluations')
        .select('passed_hard_filters, predicted_tier, status, created_at')
        .gte('created_at', twentyFourHoursAgo);
      
      const passedHardFilters = (evaluations || []).filter(e => e.passed_hard_filters === true).length;
      const tier1to3 = (evaluations || []).filter(e => e.passed_hard_filters === true && e.predicted_tier <= 3).length;
      const evaluatedStatus = (evaluations || []).filter(e => e.status === 'evaluated' && e.passed_hard_filters === true && e.predicted_tier <= 3).length;
      
      // Check candidate queue eligibility
      const { data: queueCandidates } = await supabase
        .from('reply_candidate_queue')
        .select('status, expires_at')
        .eq('status', 'queued')
        .gt('expires_at', new Date().toISOString());
      
      const eligibleQueueCount = queueCandidates?.length || 0;
      
      console.log(`[OPS_LOOP] eligibility_snapshot:`);
      console.log(`  reply_opportunities:`);
      console.log(`    fresh_12h: ${fresh12hCount}`);
      console.log(`    unclaimed: ${unclaimedCount}`);
      console.log(`    not_replied_to: ${unclaimedCount}`);
      console.log(`  candidate_evaluations (last 24h):`);
      console.log(`    passed_hard_filters: ${passedHardFilters}`);
      console.log(`    tier_1_to_3: ${tier1to3}`);
      console.log(`    status=evaluated: ${evaluatedStatus}`);
      console.log(`  filters:`);
      console.log(`    excluded_by_inaccessible_filter: ${inaccessibleCount} (last hour)`);
      console.log(`  candidate_queue:`);
      console.log(`    eligible_queue_count: ${eligibleQueueCount}`);
      console.log(`  final_eligible_count: ${eligibleQueueCount} (from queue)`);
      
      // Run planner
      const plannerStart = Date.now();
      const plannerResult = await runCommandWithTimeout(
        'REPLY_V2_PLAN_ONLY=true RUNNER_MODE=false pnpm tsx scripts/ops/run-reply-v2-planner-once.ts',
        'planner',
        2 * 60 * 1000 // 2 minute timeout
      );
      
      // Check decisions created in last 15 minutes (both tables)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      
      const { data: recentDecisionsComprehensive } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('decision_id, pipeline_source, status, created_at')
        .eq('decision_type', 'reply')
        .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
        .gte('created_at', fifteenMinutesAgo);
      
      const { data: recentDecisionsMetadata } = await supabase
        .from('content_metadata')
        .select('decision_id, pipeline_source, status, created_at')
        .eq('decision_type', 'reply')
        .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
        .gte('created_at', fifteenMinutesAgo);
      
      const decisionsCountComprehensive = recentDecisionsComprehensive?.length || 0;
      const decisionsCountMetadata = recentDecisionsMetadata?.length || 0;
      const queuedCount = (recentDecisionsComprehensive || []).filter((d: any) => d.status === 'queued').length;
      
      console.log(`[OPS_LOOP] planner decisions_created_comprehensive=${decisionsCountComprehensive} decisions_created_metadata=${decisionsCountMetadata} queued=${queuedCount}`);
      
      if (decisionsCountComprehensive === 0 && decisionsCountMetadata === 0) {
        console.log(`[OPS_LOOP] ⚠️  No decisions created - eligible_queue_count=${eligibleQueueCount} fresh_12h=${oppsSnapshot.fresh_12h}`);
        if (eligibleQueueCount === 0) {
          console.log(`[OPS_LOOP] ⚠️  Top blocker: No eligible candidates in queue (need refreshCandidateQueue or scoring)`);
          if (evaluatedStatus === 0) {
            console.log(`[OPS_LOOP] ⚠️  Root cause: No evaluated candidates (need orchestrator/scorer to run)`);
          } else if (tier1to3 === 0) {
            console.log(`[OPS_LOOP] ⚠️  Root cause: All candidates are tier 4 (too low quality)`);
          }
        } else if (oppsSnapshot.fresh_12h < 10) {
          console.log(`[OPS_LOOP] ⚠️  Top blocker: Low fresh_12h (${oppsSnapshot.fresh_12h} < 10)`);
        }
      }
    }
    
    // Heartbeat every 2 minutes
    if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
      lastHeartbeatTime = now;
      await printHeartbeat();
    }
    
    // Sleep 30 seconds before next iteration
    await sleep(30 * 1000);
  }
}

main().catch(console.error);
