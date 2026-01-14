#!/usr/bin/env tsx
/**
 * Force a "golden path" post - guaranteed to succeed with preflight checks
 * Usage: pnpm exec tsx scripts/force-golden-post.ts <target_tweet_id>
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { computeSemanticSimilarity } from '../src/gates/semanticGate';
import { normalizeTweetText } from '../src/gates/contextLockVerifier';
import { createHash } from 'crypto';

interface PreflightReport {
  target_exists: boolean;
  is_root: boolean;
  semantic_similarity: number;
  missing_fields: string[];
  will_pass_gates: boolean;
  failure_reason?: string;
}

async function main() {
  const targetTweetId = process.argv[2];
  
  if (!targetTweetId) {
    console.error('Usage: pnpm exec tsx scripts/force-golden-post.ts <target_tweet_id>');
    process.exit(1);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('           🎯 FORCE GOLDEN POST\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Target Tweet ID: ${targetTweetId}\n`);
  
  const supabase = getSupabaseClient();
  
  // Step 1: Verify tweet exists + is root
  console.log('Step 1: Verifying tweet exists and is root...');
  let ancestry: any;
  let targetTweetContent: string;
  let targetUsername: string;
  
  try {
    const { resolveTweetAncestry } = await import('../src/jobs/replySystemV2/replyDecisionRecorder');
    ancestry = await resolveTweetAncestry(targetTweetId);
    
    if (!ancestry || ancestry.status !== 'OK') {
      console.error(`❌ Failed to resolve tweet: ${ancestry?.status || 'UNKNOWN'}`);
      console.error(`   Reason: ${ancestry?.error || 'No error message'}`);
      process.exit(1);
    }
    
    if (!ancestry.isRoot) {
      console.error(`❌ Tweet is not a root tweet (in_reply_to: ${ancestry.targetInReplyToTweetId})`);
      process.exit(1);
    }
    
    targetTweetContent = ancestry.targetTweetContent || '';
    targetUsername = ancestry.targetUsername || 'unknown';
    
    console.log(`✅ Tweet verified:`);
    console.log(`   Exists: ✅`);
    console.log(`   Is Root: ✅`);
    console.log(`   Author: @${targetUsername}`);
    console.log(`   Content: ${targetTweetContent.substring(0, 100)}...\n`);
  } catch (error: any) {
    console.error(`❌ Ancestry resolution failed: ${error.message}`);
    process.exit(1);
  }
  
  // Step 2: Select safest template
  console.log('Step 2: Selecting safest template...');
  const { selectReplyTemplate } = await import('../src/jobs/replySystemV2/replyTemplateSelector');
  
  const templateSelection = await selectReplyTemplate({
    topic_relevance_score: 0.8, // High relevance for golden path
    candidate_score: 85, // High score
    topic: 'general',
    content_preview: targetTweetContent.substring(0, 100),
  });
  
  if (!templateSelection || !templateSelection.template_id) {
    console.error('❌ Template selection failed');
    process.exit(1);
  }
  
  console.log(`✅ Template selected: ${templateSelection.template_id}`);
  console.log(`   Prompt version: ${templateSelection.prompt_version}\n`);
  
  // Step 3: Generate reply content
  console.log('Step 3: Generating reply content...');
  let replyContent: string;
  let semanticSimilarity: number;
  let attempt = 0;
  const maxAttempts = 2;
  
  while (attempt < maxAttempts) {
    attempt++;
    console.log(`   Attempt ${attempt}/${maxAttempts}...`);
    
    try {
      const { generateReplyContent } = await import('../src/ai/replyGeneratorAdapter');
      const normalizedTarget = normalizeTweetText(targetTweetContent);
      
      // On second attempt, use stronger "quote + respond" style
      const topic = attempt === 2 
        ? 'health (quote and respond style - directly reference the target tweet)'
        : 'health';
      
      const replyResult = await generateReplyContent({
        target_username: targetUsername,
        target_tweet_content: normalizedTarget,
        topic: topic,
        angle: 'reply_context',
        tone: 'helpful',
        model: 'gpt-4o-mini',
        template_id: templateSelection.template_id,
        prompt_version: templateSelection.prompt_version,
        reply_context: {
          target_text: normalizedTarget,
          root_text: normalizedTarget,
          root_tweet_id: ancestry.rootTweetId || targetTweetId,
        },
      });
      
      if (!replyResult || !replyResult.content) {
        throw new Error('Generation returned empty content');
      }
      
      replyContent = replyResult.content;
      
      // Compute semantic similarity
      const normalizedReply = normalizeTweetText(replyContent);
      semanticSimilarity = await computeSemanticSimilarity(normalizedTarget, normalizedReply);
      
      console.log(`   ✅ Generated reply (${replyContent.length} chars)`);
      console.log(`   ✅ Semantic similarity: ${semanticSimilarity.toFixed(3)}`);
      
      // If similarity is acceptable, break
      if (semanticSimilarity >= 0.25) {
        break;
      }
      
      if (attempt < maxAttempts) {
        console.log(`   ⚠️  Similarity too low (${semanticSimilarity.toFixed(3)} < 0.25), regenerating with stronger style...\n`);
      }
    } catch (error: any) {
      console.error(`   ❌ Generation failed: ${error.message}`);
      if (attempt >= maxAttempts) {
        throw error;
      }
    }
  }
  
  if (semanticSimilarity < 0.25) {
    console.error(`❌ Semantic similarity still too low after ${maxAttempts} attempts: ${semanticSimilarity.toFixed(3)}`);
    process.exit(1);
  }
  
  console.log(`✅ Final reply content:\n   "${replyContent}"\n`);
  
  // Step 4: Preflight gate report
  console.log('Step 4: Preflight gate checks...\n');
  
  const normalizedTarget = normalizeTweetText(targetTweetContent);
  const normalizedReply = normalizeTweetText(replyContent);
  const targetTweetContentHash = createHash('sha256')
    .update(normalizedTarget)
    .digest('hex');
  
  const missingFields: string[] = [];
  if (!targetTweetContentHash) missingFields.push('target_tweet_content_hash');
  if (semanticSimilarity === undefined) missingFields.push('semantic_similarity');
  if (!ancestry.rootTweetId) missingFields.push('root_tweet_id');
  
  const preflightReport: PreflightReport = {
    target_exists: true,
    is_root: ancestry.isRoot,
    semantic_similarity: semanticSimilarity,
    missing_fields: missingFields,
    will_pass_gates: false,
  };
  
  // Check if it will pass gates
  if (!preflightReport.is_root) {
    preflightReport.failure_reason = 'target_not_root';
  } else if (preflightReport.semantic_similarity < 0.25) {
    preflightReport.failure_reason = 'low_semantic_similarity';
  } else if (missingFields.length > 0) {
    preflightReport.failure_reason = `missing_fields: ${missingFields.join(', ')}`;
  } else {
    preflightReport.will_pass_gates = true;
  }
  
  // Print preflight report
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📋 PREFLIGHT GATE REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`target_exists: ${preflightReport.target_exists ? '✅' : '❌'}`);
  console.log(`is_root: ${preflightReport.is_root ? '✅' : '❌'}`);
  console.log(`semantic_similarity: ${preflightReport.semantic_similarity.toFixed(3)} ${preflightReport.semantic_similarity >= 0.25 ? '✅' : '❌'} (threshold: 0.25)`);
  console.log(`missing_fields: ${preflightReport.missing_fields.length > 0 ? '❌ ' + preflightReport.missing_fields.join(', ') : '✅ None'}`);
  console.log(`will_pass_gates: ${preflightReport.will_pass_gates ? '✅ YES' : '❌ NO'}`);
  if (preflightReport.failure_reason) {
    console.log(`failure_reason: ${preflightReport.failure_reason}`);
  }
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (!preflightReport.will_pass_gates) {
    console.error(`❌ Preflight check failed: ${preflightReport.failure_reason}`);
    console.error('   Aborting before enqueue to prevent failure.');
    process.exit(1);
  }
  
  // Step 5: Create decision record
  console.log('Step 5: Creating decision record...');
  const decisionId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const { recordReplyDecision } = await import('../src/jobs/replySystemV2/replyDecisionRecorder');
  await recordReplyDecision({
    decision_id: decisionId,
    target_tweet_id: targetTweetId,
    target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId || null,
    root_tweet_id: ancestry.rootTweetId || targetTweetId,
    ancestry_depth: ancestry.ancestryDepth ?? 0,
    is_root: ancestry.isRoot,
    decision: 'ALLOW',
    reason: 'force_golden_post',
    status: 'OK',
    confidence: 'HIGH',
    method: 'force_script',
    template_id: templateSelection.template_id,
    prompt_version: templateSelection.prompt_version,
    template_status: 'SET',
    template_selected_at: now,
    generation_started_at: now,
    generation_completed_at: now,
    scored_at: now,
  });
  
  console.log(`✅ Decision created: ${decisionId}\n`);
  
  // Step 6: Create/update content_metadata
  console.log('Step 6: Creating content_metadata entry...');
  
  const scheduledAt = new Date().toISOString();
  
  // Check if content_metadata already exists
  const { data: existingMetadata } = await supabase
    .from('content_metadata')
    .select('id')
    .eq('decision_id', decisionId)
    .maybeSingle();
  
  if (existingMetadata) {
    // Update existing
    await supabase
      .from('content_metadata')
      .update({
        content: replyContent,
        status: 'queued',
        target_tweet_content_hash: targetTweetContentHash,
        semantic_similarity: semanticSimilarity,
        scheduled_at: scheduledAt,
        target_tweet_content_snapshot: normalizedTarget,
        target_username: targetUsername,
        root_tweet_id: ancestry.rootTweetId || targetTweetId,
        error_message: null,
        skip_reason: null,
        updated_at: now,
      })
      .eq('decision_id', decisionId);
  } else {
    // Create new
    await supabase
      .from('content_metadata')
      .insert({
        decision_id: decisionId,
        decision_type: 'reply',
        content: replyContent,
        status: 'queued',
        target_tweet_id: targetTweetId,
        target_tweet_content_hash: targetTweetContentHash,
        semantic_similarity: semanticSimilarity,
        scheduled_at: scheduledAt,
        target_tweet_content_snapshot: normalizedTarget,
        target_username: targetUsername,
        root_tweet_id: ancestry.rootTweetId || targetTweetId,
        created_at: now,
        updated_at: now,
      });
  }
  
  console.log(`✅ Content metadata created/updated`);
  console.log(`   Status: queued`);
  console.log(`   Scheduled at: ${scheduledAt}\n`);
  
  // Step 7: Update reply_decisions with posting_started_at
  await supabase
    .from('reply_decisions')
    .update({
      posting_started_at: now,
    })
    .eq('decision_id', decisionId);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('           ✅ GOLDEN POST QUEUED\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Decision ID: ${decisionId}`);
  console.log(`Target Tweet: https://x.com/i/status/${targetTweetId}`);
  console.log(`Status: queued (ready for posting queue)\n`);
  console.log('Next steps:');
  console.log('1. Wait for posting queue to process (or run: railway run -s xBOT -- pnpm exec tsx scripts/run-posting-once.ts)');
  console.log('2. Check for POST_SUCCESS event: railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts');
  console.log('3. Verify tweet on timeline: https://x.com/i/status/<posted_reply_tweet_id>\n');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
