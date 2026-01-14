#!/usr/bin/env tsx
/**
 * Post One Golden Reply - Deterministic flow to find valid target and post
 * Usage: railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts [--maxCandidates=25]
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { resolveTweetAncestry } from '../src/jobs/replySystemV2/replyDecisionRecorder';
import { computeSemanticSimilarity } from '../src/gates/semanticGate';
import { normalizeTweetText } from '../src/gates/contextLockVerifier';
import { createHash } from 'crypto';
import { processPostingQueue } from '../src/jobs/postingQueue';

interface PreflightReport {
  target_exists: boolean;
  is_root: boolean;
  semantic_similarity: number;
  missing_fields: string[];
  will_pass_gates: boolean;
  failure_reason?: string;
}

async function main() {
  const maxCandidates = parseInt(
    process.argv.find(arg => arg.startsWith('--maxCandidates='))?.split('=')[1] || '25',
    10
  );
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('           🎯 POST ONE GOLDEN REPLY\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Max candidates to check: ${maxCandidates}\n`);
  
  const supabase = getSupabaseClient();
  
  // Step 1: Get candidate tweet IDs from production tables
  console.log('Step 1: Fetching candidate tweet IDs...');
  
  // Get recent candidates from candidate_evaluations (most reliable source)
  const { data: candidates, error: candidatesError } = await supabase
    .from('candidate_evaluations')
    .select('candidate_tweet_id, created_at')
    .eq('is_root_tweet', true)
    .eq('passed_hard_filters', true)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(maxCandidates);
  
  if (candidatesError || !candidates || candidates.length === 0) {
    console.error(`❌ No candidates found: ${candidatesError?.message || 'empty result'}`);
    process.exit(1);
  }
  
  console.log(`✅ Found ${candidates.length} candidate tweets\n`);
  
  // Step 2: Filter out recently used tweet IDs
  console.log('Step 2: Filtering out recently used tweets...');
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentDecisions } = await supabase
    .from('reply_decisions')
    .select('target_tweet_id')
    .gte('created_at', oneDayAgo);
  
  const usedTweetIds = new Set((recentDecisions || []).map(d => d.target_tweet_id));
  const availableCandidates = candidates.filter(c => !usedTweetIds.has(c.candidate_tweet_id));
  
  console.log(`✅ Filtered: ${candidates.length} → ${availableCandidates.length} available (removed ${candidates.length - availableCandidates.length} recently used)\n`);
  
  if (availableCandidates.length === 0) {
    console.error('❌ No available candidates after filtering');
    process.exit(1);
  }
  
  // Step 3: Validate each candidate until we find one that generates successfully
  console.log('Step 3: Validating candidates and generating replies...\n');
  
  let chosenTweetId: string | null = null;
  let ancestry: any = null;
  let targetTweetContent: string = '';
  let targetUsername: string = '';
  let replyContent: string = '';
  let semanticSimilarity: number = 0;
  let templateSelection: any = null;
  
  candidateLoop: for (let i = 0; i < availableCandidates.length; i++) {
    const candidate = availableCandidates[i];
    const tweetId = candidate.candidate_tweet_id;
    
    console.log(`[${i + 1}/${availableCandidates.length}] Validating ${tweetId}...`);
    
    try {
      // First try to get tweet content from candidate_evaluations (no browser needed)
      const { data: candidateData } = await supabase
        .from('candidate_evaluations')
        .select('candidate_content, candidate_author_username, is_root_tweet')
        .eq('candidate_tweet_id', tweetId)
        .eq('is_root_tweet', true)
        .single();
      
      if (candidateData && candidateData.is_root_tweet && candidateData.candidate_content) {
        // Use cached data - tweet is already validated as root
        ancestry = {
          targetTweetId: tweetId,
          targetTweetContent: candidateData.candidate_content,
          targetUsername: candidateData.candidate_author_username || 'unknown',
          rootTweetId: tweetId,
          isRoot: true,
          status: 'OK',
          confidence: 'HIGH',
          method: 'cached_candidate_data',
        };
        
        targetTweetContent = candidateData.candidate_content;
        targetUsername = candidateData.candidate_author_username || 'unknown';
        
        console.log(`   ✅ Valid (cached): exists=true, is_root=true, author=@${targetUsername}`);
        console.log(`   Content: ${targetTweetContent.substring(0, 80)}...\n`);
        
        chosenTweetId = tweetId;
      } else {
        // Skip if no cached data (don't use browser-dependent resolver)
        console.log(`   ⚠️  No cached candidate data available - Skipping (requires browser)\n`);
        continue candidateLoop;
      }
      
      // Step 4: Select template
      console.log(`   Selecting template...`);
      const { selectReplyTemplate } = await import('../src/jobs/replySystemV2/replyTemplateSelector');
      
      templateSelection = await selectReplyTemplate({
        topic_relevance_score: 0.8,
        candidate_score: 85,
        topic: 'general',
        content_preview: targetTweetContent.substring(0, 100),
      });
      
      if (!templateSelection || !templateSelection.template_id) {
        console.log(`   ❌ Template selection failed - Skipping\n`);
        continue candidateLoop;
      }
      
      console.log(`   ✅ Template: ${templateSelection.template_id} (${templateSelection.prompt_version})`);
      
      // Step 5: Generate reply content (with retry if similarity low)
      console.log(`   Generating reply...`);
      let attempt = 0;
      const maxAttempts = 2;
      let generationSuccess = false;
      
      while (attempt < maxAttempts && !generationSuccess) {
        attempt++;
        
        try {
          const { generateReplyContent } = await import('../src/ai/replyGeneratorAdapter');
          const normalizedTarget = normalizeTweetText(targetTweetContent);
          
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
              root_tweet_id: ancestry.rootTweetId || chosenTweetId,
            },
          });
          
          if (!replyResult || !replyResult.content) {
            throw new Error('Generation returned empty content');
          }
          
          replyContent = replyResult.content;
          
          // Compute semantic similarity
          const normalizedReply = normalizeTweetText(replyContent);
          semanticSimilarity = computeSemanticSimilarity(normalizedTarget, normalizedReply);
          
          console.log(`   ✅ Generated (${replyContent.length} chars, similarity: ${semanticSimilarity.toFixed(3)})`);
          
          if (semanticSimilarity >= 0.25) {
            generationSuccess = true;
            break;
          }
          
          if (attempt < maxAttempts) {
            console.log(`   ⚠️  Similarity too low (${semanticSimilarity.toFixed(3)} < 0.25), retrying...`);
          }
        } catch (error: any) {
          // Handle UNGROUNDED_GENERATION_SKIP - try fallback
          if (error.message?.includes('UNGROUNDED_GENERATION_SKIP') && attempt < maxAttempts) {
            console.log(`   ⚠️  Ungrounded skip, trying fallback...`);
            try {
              const { generateGroundedFallbackReply } = await import('../src/ai/replyGeneratorAdapter');
              const normalizedTarget = normalizeTweetText(targetTweetContent);
              const fallbackResult = await generateGroundedFallbackReply({
                target_username: targetUsername,
                target_tweet_content: normalizedTarget,
                topic: 'health',
                angle: 'reply_context',
                tone: 'helpful',
                model: 'gpt-4o-mini',
                template_id: templateSelection.template_id,
                prompt_version: templateSelection.prompt_version,
                reply_context: {
                  target_text: normalizedTarget,
                  root_text: normalizedTarget,
                  root_tweet_id: ancestry.rootTweetId || chosenTweetId,
                },
              });
              
              if (fallbackResult && fallbackResult.content) {
                replyContent = fallbackResult.content;
                const normalizedReply = normalizeTweetText(replyContent);
                semanticSimilarity = computeSemanticSimilarity(normalizedTarget, normalizedReply);
                console.log(`   ✅ Fallback generated (${replyContent.length} chars, similarity: ${semanticSimilarity.toFixed(3)})`);
                if (semanticSimilarity >= 0.25) {
                  generationSuccess = true;
                  break;
                }
              }
            } catch (fallbackError: any) {
              console.log(`   ❌ Fallback failed: ${fallbackError.message}`);
            }
          } else {
            console.log(`   ❌ Generation failed: ${error.message}`);
          }
        }
      }
      
      if (generationSuccess && semanticSimilarity >= 0.25) {
        console.log(`   ✅ Successfully generated reply\n`);
        break candidateLoop; // Found valid candidate with successful generation
      } else {
        console.log(`   ❌ Generation failed or similarity too low - Trying next candidate...\n`);
        chosenTweetId = null;
        ancestry = null;
        continue candidateLoop;
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message} - Skipping\n`);
      continue candidateLoop;
    }
  }
  
  if (!chosenTweetId || !ancestry || !replyContent || semanticSimilarity < 0.25) {
    console.error('❌ No valid candidate found with successful generation');
    process.exit(1);
  }
  
  console.log(`✅ Chosen target tweet: ${chosenTweetId}\n`);
  
  console.log(`✅ Final reply: "${replyContent}"\n`);
  
  // Step 6: Preflight gate report
  console.log('Step 6: Preflight gate checks...\n');
  
  const normalizedTarget = normalizeTweetText(targetTweetContent);
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
    process.exit(1);
  }
  
  // Step 7: Create decision record
  console.log('Step 7: Creating decision record...');
  const decisionId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const { recordReplyDecision } = await import('../src/jobs/replySystemV2/replyDecisionRecorder');
  await recordReplyDecision({
    decision_id: decisionId,
    target_tweet_id: chosenTweetId,
    target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId || null,
    root_tweet_id: ancestry.rootTweetId || chosenTweetId,
    ancestry_depth: ancestry.ancestryDepth ?? 0,
    is_root: ancestry.isRoot,
    decision: 'ALLOW',
    reason: 'post_one_golden_reply_script',
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
  
  // Step 8: Create content_metadata
  console.log('Step 8: Creating content_metadata entry...');
  
  const scheduledAt = new Date().toISOString();
  
  await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'reply',
      content: replyContent,
      status: 'queued',
      target_tweet_id: chosenTweetId,
      target_tweet_content_hash: targetTweetContentHash,
      semantic_similarity: semanticSimilarity,
      scheduled_at: scheduledAt,
      target_tweet_content_snapshot: normalizedTarget,
      target_username: targetUsername,
      root_tweet_id: ancestry.rootTweetId || chosenTweetId,
      created_at: now,
      updated_at: now,
    });
  
  console.log(`✅ Content metadata created (status: queued)\n`);
  
  // Step 9: Update reply_decisions with posting_started_at
  await supabase
    .from('reply_decisions')
    .update({
      posting_started_at: now,
    })
    .eq('decision_id', decisionId);
  
  // Step 10: Run posting queue once
  console.log('Step 10: Running posting queue...\n');
  
  try {
    const { processPostingQueue } = await import('../src/jobs/postingQueue');
    await processPostingQueue({ maxItems: 1 });
    console.log('✅ Posting queue completed\n');
  } catch (error: any) {
    console.error(`❌ Posting queue error: ${error.message}`);
    // Continue to check result
  }
  
  // Step 11: Check result
  console.log('Step 11: Checking result...\n');
  
  // Wait a moment for DB updates
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const { data: decisionRow } = await supabase
    .from('reply_decisions')
    .select('posted_reply_tweet_id, posting_completed_at, pipeline_error_reason')
    .eq('decision_id', decisionId)
    .single();
  
  const { data: eventRow } = await supabase
    .from('system_events')
    .select('event_type, created_at, event_data')
    .eq('event_type', 'POST_SUCCESS')
    .eq('event_data->>decision_id', decisionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  // Print final result
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 FINAL RESULT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`chosen target_tweet_id: ${chosenTweetId}`);
  console.log(`decision_id: ${decisionId}`);
  console.log(`preflight gates: ✅ PASSED`);
  console.log(`  - target_exists: ✅`);
  console.log(`  - is_root: ✅`);
  console.log(`  - semantic_similarity: ${semanticSimilarity.toFixed(3)} ✅`);
  console.log(`  - missing_fields: None ✅`);
  
  if (decisionRow?.posted_reply_tweet_id) {
    const tweetId = decisionRow.posted_reply_tweet_id;
    console.log(`\n✅ POST_SUCCESS`);
    console.log(`posted_reply_tweet_id: ${tweetId}`);
    console.log(`posting_completed_at: ${decisionRow.posting_completed_at || 'N/A'}`);
    console.log(`\n🎯 TWEET URL: https://x.com/i/status/${tweetId}`);
    console.log(`\n📋 Verify on timeline:`);
    console.log(`   1. Open: https://x.com/i/status/${tweetId}`);
    console.log(`   2. Check @SignalAndSynapse replies tab`);
    console.log(`   3. Verify reply appears correctly threaded\n`);
  } else if (decisionRow?.pipeline_error_reason) {
    console.log(`\n❌ POST_FAILED`);
    console.log(`pipeline_error_reason: ${decisionRow.pipeline_error_reason}`);
    console.log(`posting_completed_at: ${decisionRow.posting_completed_at || 'N/A'}\n`);
  } else {
    console.log(`\n⏳ Status: Still processing (check again in a moment)\n`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
