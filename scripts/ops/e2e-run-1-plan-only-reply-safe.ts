#!/usr/bin/env tsx
/**
 * 🔍 E2E RUN: Safe Single PLAN_ONLY Reply Attempt
 * 
 * Runs one complete E2E cycle safely:
 * 1. Runs harvester once
 * 2. Triggers planner once
 * 3. Runs Mac Runner with MAX_E2E_REPLIES=1
 * 4. Prints SQL evidence of status transitions + stale_reason distribution
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local first (same as daemon)
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

import { getSupabaseClient } from '../../src/db/index';
import { replyOpportunityHarvester } from '../../src/jobs/replyOpportunityHarvester';
import { attemptScheduledReply } from '../../src/jobs/replySystemV2/tieredScheduler';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     🔍 E2E RUN: Safe Single PLAN_ONLY Reply Attempt');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();

  // Step 1: Run harvester once
  console.log('[E2E] 🌾 Step 1: Running harvester...\n');
  try {
    await replyOpportunityHarvester();
    console.log('[E2E] ✅ Harvester completed\n');
  } catch (error: any) {
    console.error(`[E2E] ❌ Harvester failed: ${error.message}`);
    process.exit(1);
  }

  // Step 2: Check fresh opportunities
  const { count: freshCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  
  console.log(`[E2E] 📊 Fresh opportunities (<60min): ${freshCount || 0}\n`);

  // Step 3: Trigger planner once
  console.log('[E2E] 📋 Step 2: Triggering planner...\n');
  try {
    process.env.REPLY_V2_PLAN_ONLY = 'true';
    process.env.REPLY_SYSTEM_VERSION = 'v2';
    const schedulerResult = await attemptScheduledReply();
    console.log(`[E2E] ✅ Planner completed: ${JSON.stringify(schedulerResult, null, 2)}\n`);
  } catch (error: any) {
    console.error(`[E2E] ❌ Planner failed: ${error.message}`);
    // Continue anyway - may have created decisions
  }

  // Step 4: Check queued decisions
  const { data: queuedDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, created_at, status, features')
    .eq('pipeline_source', 'reply_v2_planner')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(`[E2E] 📊 Queued planner decisions: ${queuedDecisions?.length || 0}\n`);

  // Step 5: Run Mac Runner with MAX_E2E_REPLIES=1 (background, limited time)
  console.log('[E2E] 🚀 Step 3: Starting Mac Runner daemon (MAX_E2E_REPLIES=1)...\n');
  console.log('[E2E] ⏰ Will run for 5 minutes, then check results\n');
  
  const daemonProcess = exec(
    'MAX_E2E_REPLIES=1 RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile EXECUTION_MODE=executor HEADLESS=true pnpm run executor:daemon',
    { cwd: process.cwd() }
  );
  
  // Wait 5 minutes
  await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
  
  // Kill daemon
  daemonProcess.kill();
  console.log('[E2E] ⏹️  Daemon stopped\n');

  // Step 6: Query status transitions
  console.log('[E2E] 📊 Step 4: Querying status transitions...\n');
  
  const { data: statusTransitions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, updated_at, features, error_message')
    .eq('pipeline_source', 'reply_v2_planner')
    .gte('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .order('updated_at', { ascending: false })
    .limit(20);
  
  console.log(`[E2E] 📊 Decisions updated in last 10 minutes: ${statusTransitions?.length || 0}\n`);
  
  // Group by status
  const statusGroups: Record<string, number> = {};
  const staleReasons: Record<string, number> = {};
  
  statusTransitions?.forEach(d => {
    statusGroups[d.status] = (statusGroups[d.status] || 0) + 1;
    
    if (d.error_message) {
      try {
        const errorData = JSON.parse(d.error_message);
        const reason = errorData.stale_reason || 'unknown';
        staleReasons[reason] = (staleReasons[reason] || 0) + 1;
      } catch (e) {
        // Ignore parse errors
      }
    }
  });
  
  console.log('[E2E] 📊 Status Distribution:');
  Object.entries(statusGroups).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  console.log('\n[E2E] 📊 Stale Reason Distribution:');
  Object.entries(staleReasons).forEach(([reason, count]) => {
    console.log(`  ${reason}: ${count}`);
  });
  
  if (Object.keys(staleReasons).length === 0) {
    console.log('  (none)');
  }

  // Step 7: Check for successful posts
  const { data: postedDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, updated_at, features->>tweet_id as tweet_id')
    .eq('pipeline_source', 'reply_v2_planner')
    .eq('status', 'posted')
    .gte('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .order('updated_at', { ascending: false })
    .limit(5);
  
  console.log(`\n[E2E] ✅ Posted decisions: ${postedDecisions?.length || 0}`);
  if (postedDecisions && postedDecisions.length > 0) {
    postedDecisions.forEach(d => {
      console.log(`  - ${d.decision_id}: tweet_id=${d.tweet_id || 'pending'}`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ E2E run complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(error => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
