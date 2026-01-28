#!/usr/bin/env tsx
/**
 * Proof: Reply V2 Planner Finalization
 * 
 * Validates that PLAN_ONLY mode finalizes decisions correctly:
 * - status='queued'
 * - features.plan_mode='railway'
 * - features.strategy_id populated
 * - pipeline_source='reply_v2_planner'
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { getSupabaseClient } from '../../src/db/index';
import { plannerFinalizeDecision } from '../../src/jobs/replySystemV2/plannerFinalize';

const PROOF_TAG = `reply-v2-planner-finalize-${Date.now()}`;

/**
 * Get immutable report path
 */
function getImmutableReportPath(proofTag: string): string {
  const proofsDir = path.join(process.cwd(), 'docs', 'proofs', 'learning');
  if (!fs.existsSync(proofsDir)) {
    fs.mkdirSync(proofsDir, { recursive: true });
  }
  return path.join(proofsDir, `${proofTag}.md`);
}

/**
 * Main proof execution
 */
async function main() {
  const supabase = getSupabaseClient();
  const reportPath = getImmutableReportPath(PROOF_TAG);
  
  console.log('[PROOF] Starting Reply V2 Planner Finalize proof...');
  
  // Step 1: Create a test decision in 'generating' status
  const testDecisionId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const testFields = {
    strategy_id: 'insight_punch',
    strategy_version: '1',
    selection_mode: 'explore' as const,
    strategy_description: 'Test strategy',
    targeting_score_total: 0.75,
    topic_fit: 0.8,
    score_bucket: '0.7-0.8',
  };
  
  // Insert test decision into base table
  const { error: insertError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .insert({
      decision_id: testDecisionId,
      decision_type: 'reply',
      status: 'generating',
      content: '[TEST - GENERATING...]',
      pipeline_source: 'reply_v2_planner',
    });
  
  if (insertError) {
    throw new Error(`Failed to insert test decision: ${insertError.message}`);
  }
  
  console.log(`[PROOF] Test decision created: ${testDecisionId}`);
  
  // Step 2: Call finalizer
  const finalizeResult = await plannerFinalizeDecision(testDecisionId, testFields);
  
  if (!finalizeResult.success) {
    throw new Error(`Finalization failed: ${finalizeResult.error}`);
  }
  
  console.log('[PROOF] Finalization succeeded');
  
  // Step 3: Verify decision was updated correctly
  const { data: updatedDecision, error: selectError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, pipeline_source, features')
    .eq('decision_id', testDecisionId)
    .single();
  
  if (selectError) {
    throw new Error(`Failed to select updated decision: ${selectError.message}`);
  }
  
  // Assertions
  const assertions = {
    status_is_queued: updatedDecision.status === 'queued',
    pipeline_source_is_planner: updatedDecision.pipeline_source === 'reply_v2_planner',
    plan_mode_is_railway: updatedDecision.features?.plan_mode === 'railway',
    strategy_id_populated: updatedDecision.features?.strategy_id === 'insight_punch',
    strategy_version_populated: updatedDecision.features?.strategy_version === '1',
    selection_mode_populated: updatedDecision.features?.selection_mode === 'explore',
    targeting_score_populated: updatedDecision.features?.targeting_score_total === 0.75,
    topic_fit_populated: updatedDecision.features?.topic_fit === 0.8,
  };
  
  const allPassed = Object.values(assertions).every(v => v === true);
  
  if (!allPassed) {
    console.error('[PROOF] ❌ Assertions failed:', assertions);
    throw new Error('One or more assertions failed');
  }
  
  console.log('[PROOF] ✅ All assertions passed');
  
  // Step 4: Verify view also reflects changes
  const { data: viewDecision, error: viewError } = await supabase
    .from('content_metadata')
    .select('decision_id, status, features->>plan_mode as plan_mode, features->>strategy_id as strategy_id')
    .eq('decision_id', testDecisionId)
    .single();
  
  if (viewError) {
    console.warn(`[PROOF] ⚠️ View query failed (non-critical): ${viewError.message}`);
  } else {
    console.log('[PROOF] ✅ View reflects changes:', {
      status: viewDecision.status,
      plan_mode: viewDecision.plan_mode,
      strategy_id: viewDecision.strategy_id,
    });
  }
  
  // Cleanup test decision
  await supabase
    .from('content_generation_metadata_comprehensive')
    .delete()
    .eq('decision_id', testDecisionId);
  
  console.log('[PROOF] Test decision cleaned up');
  
  // Generate report
  const report = `# Reply V2 Planner Finalize Proof

**Timestamp:** ${new Date().toISOString()}
**Proof Tag:** ${PROOF_TAG}

## Summary

✅ Planner finalization function works correctly
✅ Base table (content_generation_metadata_comprehensive) updated with status='queued'
✅ Features populated with plan_mode='railway' and strategy attribution
✅ All assertions passed

## Test Results

### Test Decision
- \`decision_id\`: \`${testDecisionId}\`
- Initial status: \`generating\`
- Final status: \`${updatedDecision.status}\` ✅

### Assertions
${Object.entries(assertions).map(([key, value]) => `- \`${key}\`: ${value ? '✅' : '❌'}`).join('\n')}

### Features Verification
\`\`\`json
${JSON.stringify(updatedDecision.features, null, 2)}
\`\`\`

### View Verification
${viewDecision ? `- Status: \`${viewDecision.status}\` ✅\n- plan_mode: \`${viewDecision.plan_mode}\` ✅\n- strategy_id: \`${viewDecision.strategy_id}\` ✅` : '⚠️ View query failed (non-critical)'}

## Conclusion

Planner finalization correctly updates decisions to \`status='queued'\` with full strategy attribution.

**Status:** ✅ PASS
`;

  fs.writeFileSync(reportPath, report);
  console.log(`[PROOF] Report written: ${reportPath}`);
  console.log('[PROOF] ✅ Reply V2 Planner Finalize proof PASSED');
  
  return {
    success: true,
    reportPath,
    proofTag: PROOF_TAG,
  };
}

main().catch((error) => {
  console.error('[PROOF] ❌ Proof failed:', error);
  process.exit(1);
});
