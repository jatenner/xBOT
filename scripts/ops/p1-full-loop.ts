#!/usr/bin/env tsx
/**
 * P1 Full Loop: Harvest → Plan → Execute → Monitor
 * 
 * Runs unattended loop for up to 60 minutes or until 1 reply posts.
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import { getSupabaseClient } from '../../src/db/index';

const MAX_DURATION_MS = 60 * 60 * 1000; // 60 minutes
const TARGET_FRESH_12H = 50;
const MAX_HARVEST_CYCLES = 10;
const HARVEST_SLEEP_MS = 2 * 60 * 1000; // 2 minutes
const MONITOR_INTERVAL_MS = 30 * 1000; // 30 seconds

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCommand(cmd: string, description: string): Promise<string> {
  console.log(`\n🔄 ${description}...`);
  try {
    const output = execSync(cmd, { 
      encoding: 'utf-8',
      env: { ...process.env, HARVESTING_ENABLED: 'true' },
      stdio: 'pipe'
    });
    return output;
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    return '';
  }
}

async function checkOpportunities(): Promise<{
  fresh_12h: number;
  fresh_24h: number;
  pool_size: number;
  newest_unclaimed: string | null;
}> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('reply_opportunities')
    .select('replied_to, tweet_posted_at');
  
  if (error) {
    return { fresh_12h: 0, fresh_24h: 0, pool_size: 0, newest_unclaimed: null };
  }
  
  const poolSize = data?.length || 0;
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
  
  return { fresh_12h: fresh12h, fresh_24h: fresh24h, pool_size: poolSize, newest_unclaimed: newestUnclaimed };
}

async function checkDecisions(): Promise<{
  total: number;
  queued: number;
  runtime_ok: number;
  runtime_timeout: number;
  runtime_deleted: number;
  posted: number;
  failureReasons: Record<string, number>;
}> {
  const supabase = getSupabaseClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, features, posted_tweet_id')
    .eq('decision_type', 'reply')
    .gte('created_at', oneHourAgo);
  
  if (error) {
    return { total: 0, queued: 0, runtime_ok: 0, runtime_timeout: 0, runtime_deleted: 0, posted: 0, failureReasons: {} };
  }
  
  const replyV2Decisions = (data || []).filter((d: any) => {
    const features = d.features || {};
    const source = features.pipeline_source || d.pipeline_source;
    return source === 'reply_v2_planner' || source === 'reply_v2_scheduler';
  });
  
  const queued = replyV2Decisions.filter((d: any) => d.status === 'queued').length;
  const posted = replyV2Decisions.filter((d: any) => d.posted_tweet_id).length;
  
  const runtimeOk = replyV2Decisions.filter((d: any) => {
    const features = d.features || {};
    return features.runtime_preflight_status === 'ok';
  }).length;
  
  const runtimeTimeout = replyV2Decisions.filter((d: any) => {
    const features = d.features || {};
    return features.runtime_preflight_status === 'timeout';
  }).length;
  
  const runtimeDeleted = replyV2Decisions.filter((d: any) => {
    const features = d.features || {};
    return features.runtime_preflight_status === 'deleted';
  }).length;
  
  const failureReasons: Record<string, number> = {};
  replyV2Decisions.forEach((d: any) => {
    const features = d.features || {};
    const reason = features.runtime_preflight_status || features.runtime_preflight_reason || 'null';
    if (reason !== 'ok' && reason !== null) {
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    }
  });
  
  return {
    total: replyV2Decisions.length,
    queued,
    posted,
    runtime_ok: runtimeOk,
    runtime_timeout: runtimeTimeout,
    runtime_deleted: runtimeDeleted,
    failureReasons
  };
}

async function checkPostedReplies(): Promise<string[]> {
  const supabase = getSupabaseClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, posted_tweet_id, features, created_at')
    .eq('decision_type', 'reply')
    .not('posted_tweet_id', 'is', null)
    .gte('created_at', oneHourAgo);
  
  if (error || !data) {
    return [];
  }
  
  const replyV2Posts = data.filter((d: any) => {
    const features = d.features || {};
    const source = features.pipeline_source || d.pipeline_source;
    return (source === 'reply_v2_planner' || source === 'reply_v2_scheduler') && d.posted_tweet_id;
  });
  
  return replyV2Posts.map((d: any) => {
    const tweetId = d.posted_tweet_id;
    return `https://x.com/i/web/status/${tweetId}`;
  });
}

async function main() {
  console.log('🌾 P1 Full Loop: Harvest → Plan → Execute → Monitor');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Max duration: ${MAX_DURATION_MS / 1000 / 60} minutes`);
  console.log(`Target fresh_12h: ${TARGET_FRESH_12H}`);
  console.log(`Monitor interval: ${MONITOR_INTERVAL_MS / 1000}s\n`);
  
  const startTime = Date.now();
  let harvestCyclesRun = 0;
  let postedUrls: string[] = [];
  
  // Step 1: Harvest until fresh_12h >= 50
  console.log('📊 Step 1: Harvesting until fresh_12h >= 50...\n');
  let opps = await checkOpportunities();
  console.log(`Initial: fresh_12h=${opps.fresh_12h}, pool_size=${opps.pool_size}`);
  
  while (harvestCyclesRun < MAX_HARVEST_CYCLES && opps.fresh_12h < TARGET_FRESH_12H) {
    harvestCyclesRun++;
    console.log(`\n🌾 Harvest cycle ${harvestCyclesRun}/${MAX_HARVEST_CYCLES}...`);
    await runCommand(
      'pnpm tsx scripts/ops/run-harvester-single-cycle.ts',
      'Harvest'
    );
    
    opps = await checkOpportunities();
    console.log(`After cycle ${harvestCyclesRun}: fresh_12h=${opps.fresh_12h} (target: ${TARGET_FRESH_12H})`);
    
    if (opps.fresh_12h < TARGET_FRESH_12H && harvestCyclesRun < MAX_HARVEST_CYCLES) {
      console.log(`⏳ Sleeping ${HARVEST_SLEEP_MS / 1000}s before next harvest...`);
      await sleep(HARVEST_SLEEP_MS);
    }
  }
  
  console.log(`\n✅ Harvest complete: fresh_12h=${opps.fresh_12h}, cycles=${harvestCyclesRun}\n`);
  
  // Step 2: Trigger planner and scheduler
  console.log('🎯 Step 2: Triggering planner and scheduler...\n');
  await runCommand(
    'REPLY_V2_PLAN_ONLY=true RUNNER_MODE=false pnpm tsx scripts/ops/run-reply-v2-planner-once.ts',
    'Planner'
  );
  
  await sleep(5000); // Brief pause
  
  await runCommand(
    'REPLY_V2_PLAN_ONLY=true RUNNER_MODE=false pnpm tsx scripts/ops/run-reply-v2-planner-once.ts',
    'Scheduler (via planner)'
  );
  
  // Step 3: Confirm queued decisions
  let decisions = await checkDecisions();
  console.log(`\n📊 Decisions after planning:`);
  console.log(`  total: ${decisions.total}`);
  console.log(`  queued: ${decisions.queued}`);
  console.log(`  runtime_ok: ${decisions.runtime_ok}\n`);
  
  if (decisions.queued < 5) {
    console.log(`⚠️  Warning: Only ${decisions.queued} queued decisions (target: >=5)`);
  }
  
  // Step 4: Monitor executor and wait for post
  console.log('⏳ Step 3: Monitoring executor for up to 60 minutes...\n');
  const monitorStartTime = Date.now();
  let lastPostedCount = 0;
  
  while (Date.now() - startTime < MAX_DURATION_MS) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000 / 60);
    const remaining = Math.floor((MAX_DURATION_MS - (Date.now() - startTime)) / 1000 / 60);
    
    decisions = await checkDecisions();
    postedUrls = await checkPostedReplies();
    
    if (postedUrls.length > lastPostedCount) {
      console.log(`\n✅ NEW POST DETECTED!`);
      postedUrls.slice(lastPostedCount).forEach(url => {
        console.log(`  ${url}`);
      });
      lastPostedCount = postedUrls.length;
      
      if (postedUrls.length >= 1) {
        console.log(`\n🎉 P1 MILESTONE ACHIEVED: ${postedUrls.length} reply(ies) posted!`);
        break;
      }
    }
    
    console.log(`[${elapsed}m/${MAX_DURATION_MS / 1000 / 60}m] queued=${decisions.queued} runtime_ok=${decisions.runtime_ok} posted=${postedUrls.length} (${remaining}m remaining)`);
    
    await sleep(MONITOR_INTERVAL_MS);
  }
  
  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 FINAL STATE');
  console.log(`${'='.repeat(60)}\n`);
  
  opps = await checkOpportunities();
  decisions = await checkDecisions();
  postedUrls = await checkPostedReplies();
  
  console.log('Opportunities:');
  console.log(`  fresh_12h: ${opps.fresh_12h}`);
  console.log(`  fresh_24h: ${opps.fresh_24h}`);
  console.log(`  pool_size: ${opps.pool_size}\n`);
  
  console.log('Decisions (last hour):');
  console.log(`  total: ${decisions.total}`);
  console.log(`  queued: ${decisions.queued}`);
  console.log(`  runtime_ok: ${decisions.runtime_ok}`);
  console.log(`  runtime_timeout: ${decisions.runtime_timeout}`);
  console.log(`  runtime_deleted: ${decisions.runtime_deleted}`);
  console.log(`  posted: ${decisions.posted}\n`);
  
  if (Object.keys(decisions.failureReasons).length > 0) {
    console.log('Top 3 failure reasons:');
    const sorted = Object.entries(decisions.failureReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    sorted.forEach(([reason, count], idx) => {
      console.log(`  ${idx + 1}. ${reason}: ${count}`);
    });
    console.log('');
  }
  
  if (postedUrls.length > 0) {
    console.log('✅ Posted Reply URLs:');
    postedUrls.forEach(url => console.log(`  ${url}`));
  } else {
    console.log('❌ No posted replies found');
    if (decisions.runtime_timeout > 0) {
      console.log('\n💡 Primary fix: Address timeout failures (likely stale targets or slow network)');
    } else if (decisions.runtime_deleted > 0) {
      console.log('\n💡 Primary fix: Address deleted target tweets (harvester may be surfacing unstable tweets)');
    } else if (decisions.queued === 0) {
      console.log('\n💡 Primary fix: Ensure planner creates more decisions from fresh opportunities');
    }
  }
  
  console.log(`\n🔄 Harvest cycles run: ${harvestCyclesRun}`);
  console.log(`⏱️  Total duration: ${Math.floor((Date.now() - startTime) / 1000 / 60)} minutes`);
}

main().catch(console.error);
