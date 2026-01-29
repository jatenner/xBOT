#!/usr/bin/env tsx
/**
 * P1 Harvest + Plan Loop
 * 
 * Runs harvest → plan cycles until fresh_12h >= 50 or max cycles reached.
 * Monitors for queued decisions, runtime_preflight_status='ok', and posted replies.
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import { getSupabaseClient } from '../../src/db/index';

const MAX_CYCLES = 10;
const TARGET_FRESH_12H = 50;
const SLEEP_SECONDS = 120; // 2 minutes

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
  total: number;
  queued: number;
  posted: number;
  runtime_ok: number;
  runtime_timeout: number;
  runtime_deleted: number;
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
    console.error('Error checking decisions:', error);
    return { total: 0, queued: 0, posted: 0, runtime_ok: 0, runtime_timeout: 0, runtime_deleted: 0, failureReasons: {} };
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
  
  // Count failure reasons
  const failureReasons: Record<string, number> = {};
  replyV2Decisions.forEach((d: any) => {
    const features = d.features || {};
    const reason = features.runtime_preflight_status || features.runtime_preflight_reason || 'unknown';
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
  console.log('🌾 P1 Harvest + Plan Loop');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Target: fresh_12h >= ${TARGET_FRESH_12H}`);
  console.log(`Max cycles: ${MAX_CYCLES}`);
  console.log(`Sleep between cycles: ${SLEEP_SECONDS}s\n`);
  
  let cyclesRun = 0;
  let postedUrls: string[] = [];
  
  // Initial check
  let opps = await checkOpportunities();
  console.log('📊 Initial state:');
  console.log(`  fresh_12h: ${opps.fresh_12h}`);
  console.log(`  pool_size: ${opps.pool_size}`);
  console.log(`  unclaimed: ${opps.unclaimed}\n`);
  
  while (cyclesRun < MAX_CYCLES && opps.fresh_12h < TARGET_FRESH_12H) {
    cyclesRun++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 CYCLE ${cyclesRun}/${MAX_CYCLES}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Harvest
    console.log('🌾 Step 1: Harvesting...');
    await runCommand(
      'pnpm tsx scripts/ops/run-harvester-single-cycle.ts',
      'Harvest cycle'
    );
    
    // Check opportunities after harvest
    opps = await checkOpportunities();
    console.log(`\n📊 After harvest:`);
    console.log(`  fresh_12h: ${opps.fresh_12h} (target: ${TARGET_FRESH_12H})`);
    console.log(`  pool_size: ${opps.pool_size}`);
    console.log(`  newest_unclaimed: ${opps.newest_unclaimed || 'N/A'}`);
    
    // Plan
    console.log('\n🎯 Step 2: Planning...');
    await runCommand(
      'REPLY_V2_PLAN_ONLY=true RUNNER_MODE=false pnpm tsx scripts/ops/run-reply-v2-planner-once.ts',
      'Planner run'
    );
    
    // Check decisions
    const decisions = await checkDecisions();
    console.log(`\n📊 Decisions (last hour):`);
    console.log(`  total: ${decisions.total}`);
    console.log(`  queued: ${decisions.queued}`);
    console.log(`  runtime_ok: ${decisions.runtime_ok}`);
    console.log(`  posted: ${decisions.posted}`);
    
    // Check for posted replies
    postedUrls = await checkPostedReplies();
    if (postedUrls.length > 0) {
      console.log(`\n✅ POSTED REPLIES FOUND:`);
      postedUrls.forEach(url => console.log(`  ${url}`));
    }
    
    // Check if target reached
    if (opps.fresh_12h >= TARGET_FRESH_12H) {
      console.log(`\n✅ Target reached: fresh_12h=${opps.fresh_12h} >= ${TARGET_FRESH_12H}`);
      break;
    }
    
    // Sleep before next cycle
    if (cyclesRun < MAX_CYCLES) {
      console.log(`\n⏳ Sleeping ${SLEEP_SECONDS}s before next cycle...`);
      await sleep(SLEEP_SECONDS * 1000);
    }
  }
  
  // Final check
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 FINAL STATE');
  console.log(`${'='.repeat(60)}\n`);
  
  opps = await checkOpportunities();
  const decisions = await checkDecisions();
  postedUrls = await checkPostedReplies();
  
  console.log('Opportunities:');
  console.log(`  fresh_12h: ${opps.fresh_12h}`);
  console.log(`  fresh_24h: ${opps.fresh_24h}`);
  console.log(`  pool_size: ${opps.pool_size}`);
  console.log(`  unclaimed: ${opps.unclaimed}`);
  console.log(`  newest_unclaimed: ${opps.newest_unclaimed || 'N/A'}\n`);
  
  console.log('Decisions (last hour):');
  console.log(`  total: ${decisions.total}`);
  console.log(`  queued: ${decisions.queued}`);
  console.log(`  runtime_ok: ${decisions.runtime_ok}`);
  console.log(`  runtime_timeout: ${decisions.runtime_timeout}`);
  console.log(`  runtime_deleted: ${decisions.runtime_deleted}`);
  console.log(`  posted: ${decisions.posted}\n`);
  
  if (Object.keys(decisions.failureReasons).length > 0) {
    console.log('Runtime preflight failure reasons:');
    const sorted = Object.entries(decisions.failureReasons)
      .sort((a, b) => b[1] - a[1]);
    sorted.forEach(([reason, count]) => {
      console.log(`  ${reason}: ${count}`);
    });
    console.log('');
  }
  
  if (postedUrls.length > 0) {
    console.log('✅ Posted Reply URLs:');
    postedUrls.forEach(url => console.log(`  ${url}`));
  } else {
    console.log('❌ No posted replies found');
  }
  
  console.log(`\n🔄 Cycles run: ${cyclesRun}`);
}

main().catch(console.error);
