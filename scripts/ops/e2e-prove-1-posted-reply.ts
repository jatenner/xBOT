#!/usr/bin/env tsx
/**
 * 🎯 E2E Proof: Get 1 Posted Reply
 * 
 * Orchestrates a controlled E2E attempt:
 * 1. Triggers planner once (Railway)
 * 2. Prints DB snapshot
 * 3. Instructs operator to run Mac Runner daemon
 * 4. Polls DB for posted reply
 * 5. Generates proof report
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🎯 E2E Proof: Get 1 Posted Reply');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const supabase = getSupabaseClient();
  const timestamp = Date.now();
  const proofReportPath = path.join(
    __dirname,
    '../../docs/proofs/learning',
    `e2e-reply-v2-1-posted-${timestamp}.md`
  );
  
  // Step 1: Trigger planner
  console.log('📋 Step 1: Triggering planner...');
  try {
    const plannerOutput = execSync(
      'railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts',
      { encoding: 'utf-8', timeout: 60000 }
    );
    console.log('   ✅ Planner triggered');
    console.log('   Output:', plannerOutput.split('\n').slice(-5).join('\n'));
  } catch (error: any) {
    console.log('   ⚠️  Planner command failed (may need manual run):', error.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Step 2: DB snapshot
  console.log('\n📋 Step 2: DB Snapshot...');
  
  // Queued decisions by preflight_status
  const { data: queuedDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, created_at, features')
    .eq('decision_type', 'reply')
    .eq('pipeline_source', 'reply_v2_planner')
    .eq('status', 'queued')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  
  const preflightStatusCounts: Record<string, number> = {};
  if (queuedDecisions) {
    for (const d of queuedDecisions) {
      const features = (d.features || {}) as any;
      const status = features.preflight_status || 'null';
      preflightStatusCounts[status] = (preflightStatusCounts[status] || 0) + 1;
    }
  }
  
  console.log('   Queued decisions (last 60m) by preflight_status:');
  Object.entries(preflightStatusCounts).forEach(([status, count]) => {
    console.log(`     ${status}: ${count}`);
  });
  
  // Opportunities by tier
  const { data: opportunities } = await supabase
    .from('reply_opportunities')
    .select('tier')
    .eq('replied_to', false)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  
  const tierCounts: Record<string, number> = {};
  if (opportunities) {
    for (const opp of opportunities) {
      const tier = opp.tier || 'unknown';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    }
  }
  
  console.log('   Opportunities (last 60m) by tier:');
  Object.entries(tierCounts).forEach(([tier, count]) => {
    console.log(`     ${tier}: ${count}`);
  });
  
  // Step 3: Instructions
  console.log('\n📋 Step 3: Start Mac Runner Daemon');
  console.log('   Run in a separate terminal:');
  console.log('   RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile EXECUTION_MODE=executor HEADLESS=true MAX_E2E_REPLIES=1 pnpm run executor:daemon');
  console.log('\n   Monitoring DB for posted reply...\n');
  
  // Step 4: Poll for posted reply
  console.log('📋 Step 4: Monitoring for posted reply...');
  const startTime = Date.now();
  const maxWaitMs = 10 * 60 * 1000; // 10 minutes
  const pollIntervalMs = 15 * 1000; // 15 seconds
  
  let postedDecision: any = null;
  
  while (Date.now() - startTime < maxWaitMs) {
    const { data: postedDecisions } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, status, updated_at, features, content')
      .eq('decision_type', 'reply')
      .eq('pipeline_source', 'reply_v2_planner')
      .in('status', ['posting_attempt', 'posted'])
      .gte('updated_at', new Date(startTime - 60000).toISOString()) // Decisions updated since we started
      .order('updated_at', { ascending: false })
      .limit(10);
    
    if (postedDecisions && postedDecisions.length > 0) {
      const posted = postedDecisions.find(d => d.status === 'posted');
      if (posted) {
        postedDecision = posted;
        break;
      }
      
      // Log posting_attempt
      const attempting = postedDecisions.find(d => d.status === 'posting_attempt');
      if (attempting) {
        console.log(`   ⏳ Found posting_attempt: ${attempting.decision_id.substring(0, 8)}...`);
      }
    }
    
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    console.log(`   ⏳ Waiting... (${elapsedSeconds}s elapsed)`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  // Step 5: Generate proof report
  console.log('\n📋 Step 5: Generating proof report...');
  
  let reportContent = `# E2E Proof: 1 Posted Reply V2 PLAN_ONLY

**Date:** ${new Date().toISOString()}
**SHA:** ${process.env.GIT_SHA || 'unknown'}
**Goal:** Get 1 reply_v2_planner decision to POST successfully

## Summary

${postedDecision ? '✅ SUCCESS: Posted reply found' : '❌ FAILURE: No posted reply found within timeout'}

## DB Snapshot

### Queued Decisions (last 60m) by preflight_status
${Object.entries(preflightStatusCounts).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

### Opportunities (last 60m) by tier
${Object.entries(tierCounts).map(([tier, count]) => `- ${tier}: ${count}`).join('\n')}

## Posted Reply Evidence

`;
  
  if (postedDecision) {
    const features = (postedDecision.features || {}) as any;
    reportContent += `### Decision Details
- **Decision ID:** ${postedDecision.decision_id}
- **Status:** ${postedDecision.status}
- **Updated At:** ${postedDecision.updated_at}
- **Tweet ID:** ${features.tweet_id || 'pending'}
- **Runtime Preflight Status:** ${features.runtime_preflight_status || 'not_set'}
- **Preflight Status:** ${features.preflight_status || 'not_set'}
- **Strategy ID:** ${features.strategy_id || 'unknown'}
- **Content Preview:** ${(postedDecision.content || '').substring(0, 100)}...

### Reward Evidence
`;
    
    // Check for reward
    const { data: rewardDecision } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('features')
      .eq('decision_id', postedDecision.decision_id)
      .single();
    
    if (rewardDecision) {
      const rewardFeatures = (rewardDecision.features || {}) as any;
      if (rewardFeatures.reward !== undefined) {
        reportContent += `- **Reward:** ${rewardFeatures.reward}
- **Reward Components:** ${JSON.stringify(rewardFeatures.reward_components || {})}
`;
      } else {
        reportContent += `- **Reward:** Not yet computed (scraper may need to run)
`;
      }
    }
    
    // Check strategy_rewards
    const { data: strategyRewards } = await supabase
      .from('strategy_rewards')
      .select('*')
      .order('last_updated_at', { ascending: false })
      .limit(10);
    
    if (strategyRewards && strategyRewards.length > 0) {
      reportContent += `\n### Strategy Rewards
${strategyRewards.map(sr => `- ${sr.strategy_id}/${sr.strategy_version}: sample_count=${sr.sample_count}, mean_reward=${sr.mean_reward}`).join('\n')}
`;
    } else {
      reportContent += `\n### Strategy Rewards
- Not yet updated (scraper may need to run)
`;
    }
  } else {
    reportContent += `No posted reply found within ${Math.round(maxWaitMs / 1000 / 60)} minutes.

Check Mac Runner logs for errors.
`;
  }
  
  reportContent += `\n## SQL Queries Used

\`\`\`sql
-- Posted reply
SELECT decision_id, status, updated_at, features->>'runtime_preflight_status' AS runtime_preflight, features->>'tweet_id' AS tweet_id
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner' AND status='posted'
ORDER BY updated_at DESC LIMIT 5;

-- Reward
SELECT decision_id, features->>'reward' AS reward, features->>'strategy_id' AS strategy_id
FROM content_generation_metadata_comprehensive
WHERE pipeline_source='reply_v2_planner' AND status='posted' AND features ? 'reward'
ORDER BY updated_at DESC LIMIT 5;

-- Strategy rewards
SELECT strategy_id, strategy_version, sample_count, mean_reward, last_updated_at
FROM strategy_rewards
ORDER BY last_updated_at DESC LIMIT 10;
\`\`\`
`;
  
  // Ensure directory exists
  const reportDir = path.dirname(proofReportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  fs.writeFileSync(proofReportPath, reportContent);
  console.log(`   ✅ Proof report written: ${proofReportPath}`);
  
  if (postedDecision) {
    console.log('\n✅ E2E PROOF COMPLETE');
    console.log(`   Posted Decision ID: ${postedDecision.decision_id}`);
    const features = (postedDecision.features || {}) as any;
    console.log(`   Tweet ID: ${features.tweet_id || 'pending'}`);
    process.exit(0);
  } else {
    console.log('\n❌ E2E PROOF FAILED: No posted reply found');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ E2E script failed:', err);
  process.exit(1);
});
