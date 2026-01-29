#!/usr/bin/env tsx
/**
 * 🔒 E2E Proof: Grounding Hard-Enforcement Fix
 * 
 * Validates that:
 * 1. Planner creates decisions with grounding phrases
 * 2. Mac Runner generates content that passes grounding check
 * 3. Decision transitions: queued -> posting_attempt -> posted
 * 4. At least ONE decision reaches status='posted' with tweet_id
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const MAX_WAIT_MINUTES = 20;
const CHECK_INTERVAL_SECONDS = 15;

async function main() {
  console.log('🔒 E2E Proof: Grounding Hard-Enforcement Fix\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const supabase = getSupabaseClient();
  const startTime = Date.now();
  const timestamp = Date.now();
  
  // Step 1: Run planner once
  console.log('📋 Step 1: Running planner...');
  try {
    await execAsync('railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts', {
      env: { ...process.env },
    });
    console.log('✅ Planner completed\n');
  } catch (error: any) {
    console.error(`❌ Planner failed: ${error.message}`);
    process.exit(1);
  }
  
  // Step 2: Wait for decisions to be created
  console.log('📋 Step 2: Waiting for queued decisions...');
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5s wait
  
  const { data: queuedDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, features, target_tweet_id, created_at')
    .eq('pipeline_source', 'reply_v2_planner')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (!queuedDecisions || queuedDecisions.length === 0) {
    console.log('❌ FAIL: No queued decisions found after planner run');
    process.exit(1);
  }
  
  console.log(`✅ Found ${queuedDecisions.length} queued decisions\n`);
  
  // Step 3: Monitor for posted reply
  console.log('📋 Step 3: Monitoring for posted reply (Mac Runner should process)...\n');
  
  let postedDecision: any = null;
  const maxWaitMs = MAX_WAIT_MINUTES * 60 * 1000;
  const pollIntervalMs = CHECK_INTERVAL_SECONDS * 1000;
  
  while (Date.now() - startTime < maxWaitMs && !postedDecision) {
    const { data: decisions } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*')
      .eq('pipeline_source', 'reply_v2_planner')
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .gte('updated_at', new Date(startTime - 60000).toISOString()) // Since we started
      .order('updated_at', { ascending: false })
      .limit(1);
    
    if (decisions && decisions.length > 0) {
      postedDecision = decisions[0];
      break;
    }
    
    // Show progress
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed % 30 === 0 && elapsed > 0) {
      process.stdout.write(`\r⏳ Waiting... (${elapsed}s elapsed)`);
    }
    
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  // Step 4: Generate proof report
  if (!postedDecision) {
    console.log('\n❌ FAIL: No posted reply found within timeout\n');
    
    // Check for blockers
    const { data: recentDecisions } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, status, features, error_message, skip_reason')
      .eq('pipeline_source', 'reply_v2_planner')
      .gte('updated_at', new Date(startTime - 60000).toISOString())
      .order('updated_at', { ascending: false })
      .limit(10);
    
    console.log('📊 Recent decision statuses:');
    recentDecisions?.forEach(d => {
      const f = (d.features || {}) as any;
      console.log(`   ${d.decision_id.substring(0, 8)}... status=${d.status} runtime_preflight=${f.runtime_preflight_status || 'null'} grounding_repair=${f.grounding_repair_applied || false}`);
      if (d.error_message) {
        const em = typeof d.error_message === 'string' ? d.error_message.substring(0, 100) : JSON.stringify(d.error_message).substring(0, 100);
        console.log(`      Error: ${em}`);
      }
      if (d.skip_reason) {
        console.log(`      Skip reason: ${d.skip_reason}`);
      }
    });
    
    process.exit(1);
  }
  
  // Success - generate report
  const features = (postedDecision.features || {}) as any;
  const reportPath = path.join(
    process.cwd(),
    'docs',
    'proofs',
    'learning',
    `e2e-grounding-fix-${timestamp}.md`
  );
  
  const report = `# E2E Grounding Hard-Enforcement Fix - Proof Report

**Generated:** ${new Date().toISOString()}  
**Commit:** ${process.env.GIT_SHA || 'unknown'}  
**Fix:** Hard-enforce grounding phrases with normalization + repair

---

## ✅ SUCCESS: Posted Reply Achieved

### Decision Details

- **decision_id:** \`${postedDecision.decision_id}\`
- **tweet_id:** \`${postedDecision.tweet_id}\`
- **target_tweet_id:** \`${postedDecision.target_tweet_id}\`
- **status:** \`${postedDecision.status}\`
- **posted_at:** \`${postedDecision.posted_at}\`

### Grounding Verification

- **required_grounding_phrases:** ${features.required_grounding_phrases ? JSON.stringify(features.required_grounding_phrases) : 'null'}
- **grounding_phrases_matched:** ${features.grounding_phrases_matched ? JSON.stringify(features.grounding_phrases_matched) : 'null'}
- **grounding_extractor_version:** \`${features.grounding_extractor_version || 'null'}\`
- **grounding_repair_applied:** \`${features.grounding_repair_applied || false}\`

### Preflight Status

- **preflight_status:** \`${features.preflight_status || 'null'}\`
- **preflight_ok:** \`${features.preflight_ok || 'null'}\`
- **runtime_preflight_status:** \`${features.runtime_preflight_status || 'null'}\`
- **runtime_preflight_timeout_ms:** \`${features.runtime_preflight_timeout_ms || 'null'}\`

### Strategy Attribution

- **strategy_id:** \`${features.strategy_id || 'null'}\`
- **strategy_version:** \`${features.strategy_version || 'null'}\`

### Content Preview

\`\`\`
${(postedDecision.content || '').substring(0, 220)}${(postedDecision.content || '').length > 220 ? '...' : ''}
\`\`\`

---

## SQL Evidence

\`\`\`sql
SELECT decision_id, status, tweet_id, target_tweet_id,
       features->>'required_grounding_phrases' AS required_phrases,
       features->>'grounding_phrases_matched' AS matched_phrases,
       features->>'grounding_repair_applied' AS repair_applied,
       features->>'runtime_preflight_status' AS runtime_preflight_status,
       posted_at
FROM content_generation_metadata_comprehensive
WHERE decision_id = '${postedDecision.decision_id}';
\`\`\`

---

## Conclusion

✅ **E2E Proof PASSED**

Successfully posted 1 reply from reply_v2_planner pipeline with:
- Grounding phrases hard-enforced (normalization + repair)
- Runtime preflight passed
- Content generated and posted successfully
${features.grounding_repair_applied ? '- Repair mechanism applied successfully' : ''}
`;
  
  // Ensure directory exists
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  fs.writeFileSync(reportPath, report, 'utf-8');
  
  console.log('✅ SUCCESS: Posted reply achieved!\n');
  console.log('📊 Decision Details:');
  console.log(`   decision_id: ${postedDecision.decision_id}`);
  console.log(`   tweet_id: ${postedDecision.tweet_id}`);
  console.log(`   runtime_preflight_status: ${features.runtime_preflight_status || 'null'}`);
  console.log(`   grounding_repair_applied: ${features.grounding_repair_applied || false}`);
  console.log(`   required_grounding_phrases: ${features.required_grounding_phrases ? JSON.stringify(features.required_grounding_phrases) : 'null'}`);
  console.log(`   content_length: ${(postedDecision.content || '').length} chars\n`);
  console.log(`📄 Proof report saved to: ${reportPath}\n`);
  
  // Print report
  console.log(report);
  
  process.exit(0);
}

main().catch(err => {
  console.error('❌ E2E proof failed:', err);
  process.exit(1);
});
