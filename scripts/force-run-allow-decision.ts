#!/usr/bin/env tsx
/**
 * Force generation + posting for an existing ALLOW decision
 * Usage: pnpm exec tsx scripts/force-run-allow-decision.ts <decision_id_or_id>
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { computeSemanticSimilarity } from '../src/gates/semanticGate';
import { normalizeTweetText } from '../src/gates/contextLockVerifier';

async function main() {
  const decisionIdOrId = process.argv[2];
  
  if (!decisionIdOrId) {
    console.error('Usage: pnpm exec tsx scripts/force-run-allow-decision.ts <decision_id_or_id>');
    process.exit(1);
  }
  
  const supabase = getSupabaseClient();
  
  // Load decision row
  const { data: decision, error: decisionError } = await supabase
    .from('reply_decisions')
    .select('id, decision_id, target_tweet_id, template_id, prompt_version, template_status, candidate_features, candidate_score, root_tweet_id')
    .or(`decision_id.eq.${decisionIdOrId},id.eq.${decisionIdOrId}`)
    .eq('decision', 'ALLOW')
    .eq('template_status', 'SET')
    .single();
  
  if (decisionError || !decision) {
    console.error(`❌ Decision not found: ${decisionError?.message || 'not found'}`);
    process.exit(1);
  }
  
  const canonicalId = decision.decision_id || decision.id;
  console.log(`✅ Found decision: id=${decision.id}, decision_id=${canonicalId}, target_tweet_id=${decision.target_tweet_id}`);
  
  // Get candidate data from content_metadata
  const { data: metadata, error: metadataError } = await supabase
    .from('content_metadata')
    .select('target_tweet_content_snapshot, target_username, target_tweet_id, root_tweet_id')
    .eq('decision_id', canonicalId)
    .single();
  
  if (metadataError || !metadata) {
    console.error(`❌ Metadata not found: ${metadataError?.message || 'not found'}`);
    process.exit(1);
  }
  
  const targetTweetContent = metadata.target_tweet_content_snapshot || '';
  const targetUsername = metadata.target_username || 'unknown';
  const rootTweetId = metadata.root_tweet_id || decision.root_tweet_id || decision.target_tweet_id;
  
  if (!targetTweetContent || targetTweetContent.length < 20) {
    console.error(`❌ Target tweet content too short: ${targetTweetContent.length} chars`);
    process.exit(1);
  }
  
  console.log(`✅ Loaded metadata: username=${targetUsername}, content_length=${targetTweetContent.length}`);
  
  // Normalize content
  const normalizedSnapshot = normalizeTweetText(targetTweetContent);
  
  // Extract candidate features for topic/keywords
  const candidateFeatures = (decision.candidate_features as any) || {};
  const topicRelevance = candidateFeatures.topic_relevance || 70;
  const topic = candidateFeatures.topic || candidateFeatures.keywords || 'health';
  
  // Mark generation started
  const generationStartedAt = new Date().toISOString();
  await supabase
    .from('reply_decisions')
    .update({ generation_started_at: generationStartedAt })
    .eq('id', decision.id);
  
  console.log(`[PIPELINE] decision_id=${canonicalId} stage=generate ok=start detail=generation_started`);
  
  // Generate reply content
  let replyContent: string;
  let generationError: Error | null = null;
  let isFallback = false;
  
  try {
    console.log(`[PIPELINE] decision_id=${canonicalId} stage=generate ok=start detail=generating_reply`);
    const { generateReplyContent } = await import('../src/ai/replyGeneratorAdapter');
    
    const replyResult = await generateReplyContent({
      target_username: targetUsername,
      target_tweet_content: normalizedSnapshot,
      topic: topic,
      angle: 'reply_context',
      tone: 'helpful',
      model: 'gpt-4o-mini',
      template_id: decision.template_id || 'explanation',
      prompt_version: decision.prompt_version || 'v1',
      reply_context: {
        target_text: normalizedSnapshot,
        root_text: normalizedSnapshot,
        root_tweet_id: decision.target_tweet_id,
      },
    });
    
    replyContent = replyResult.content;
    console.log(`[PIPELINE] decision_id=${canonicalId} stage=generate ok=true detail=reply_generated length=${replyContent.length}`);
  } catch (genError: any) {
    generationError = genError;
    
    // Try fallback
    try {
      console.log(`[PIPELINE] decision_id=${canonicalId} stage=generate ok=fallback detail=attempting_fallback`);
      const { generateGroundedFallbackReply } = await import('../src/ai/replyGeneratorAdapter');
      const fallbackResult = await generateGroundedFallbackReply({
        target_username: targetUsername,
        target_tweet_content: normalizedSnapshot,
        topic: 'health',
        angle: 'reply_context',
        tone: 'helpful',
        model: 'gpt-4o-mini',
        template_id: decision.template_id || 'explanation',
        prompt_version: decision.prompt_version || 'v1',
        reply_context: {
          target_text: normalizedSnapshot,
          root_text: normalizedSnapshot,
          root_tweet_id: decision.target_tweet_id,
        },
      });
      
      replyContent = fallbackResult.content;
      isFallback = true;
      console.log(`[PIPELINE] decision_id=${canonicalId} stage=generate ok=true detail=fallback_reply_generated length=${replyContent.length}`);
    } catch (fallbackError: any) {
      const errorReason = `GENERATION_FAILED_${genError.message.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50)}_FALLBACK_${fallbackError.message.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50)}`;
      const generationCompletedAt = new Date().toISOString();
      
      await supabase
        .from('reply_decisions')
        .update({
          generation_completed_at: generationCompletedAt,
          pipeline_error_reason: errorReason,
        })
        .eq('id', decision.id);
      
      console.error(`[PIPELINE] decision_id=${canonicalId} stage=generate ok=false detail=${errorReason}`);
      throw new Error(`Generation failed: ${genError.message}; Fallback failed: ${fallbackError.message}`);
    }
  }
  
  // Compute semantic similarity
  const semanticSimilarity = computeSemanticSimilarity(normalizedSnapshot, replyContent);
  console.log(`[PIPELINE] decision_id=${canonicalId} stage=generate ok=true detail=semantic_similarity=${semanticSimilarity.toFixed(3)}`);
  
  // Mark generation completed
  const generationCompletedAt = new Date().toISOString();
  
  // Get existing features
  const { data: existingMetadata } = await supabase
    .from('content_metadata')
    .select('features')
    .eq('decision_id', canonicalId)
    .single();
  
  const existingFeatures = (existingMetadata?.features as any) || {};
  const updatedFeatures = {
    ...existingFeatures,
    is_fallback: isFallback,
    semantic_similarity: semanticSimilarity,
    reason_codes: isFallback 
      ? [...new Set([...(existingFeatures.reason_codes || []), 'fallback_used'])]
      : (existingFeatures.reason_codes || []),
  };
  
  // Update content_metadata and content_generation_metadata_comprehensive to 'queued'
  await supabase
    .from('content_metadata')
    .update({
      status: 'queued',
      content: replyContent,
      features: updatedFeatures,
    })
    .eq('decision_id', canonicalId);
  
  await supabase
    .from('content_generation_metadata_comprehensive')
    .update({
      status: 'queued',
      content: replyContent,
      semantic_similarity: semanticSimilarity,
    })
    .eq('decision_id', canonicalId);
  
  // Update reply_decisions
  await supabase
    .from('reply_decisions')
    .update({
      generation_completed_at: generationCompletedAt,
      pipeline_error_reason: null,
    })
    .eq('id', decision.id);
  
  console.log(`[PIPELINE] decision_id=${canonicalId} stage=generate ok=true detail=generation_completed queued_for_posting`);
  console.log(`✅ Decision queued for posting. Posting queue will process it automatically.`);
  
  // Print final DB row snapshot
  const { data: finalDecision } = await supabase
    .from('reply_decisions')
    .select('id, decision_id, target_tweet_id, template_status, scored_at, template_selected_at, generation_started_at, generation_completed_at, posting_started_at, posting_completed_at, posted_reply_tweet_id, pipeline_error_reason')
    .eq('id', decision.id)
    .single();
  
  console.log('\n📊 Final Decision Row:');
  console.log(JSON.stringify(finalDecision, null, 2));
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
