/**
 * 🎯 PLAN_ONLY CONTENT GENERATOR
 * 
 * Generates reply content for PLAN_ONLY decisions on Mac Runner.
 * This bridges the gap between Railway planning and Mac Runner execution.
 */

import { getSupabaseClient } from '../../db/index';

/**
 * Clamp reply length while preserving required grounding phrases
 * Ensures reply never exceeds maxLen and always includes required phrases
 */
export function clampReplyLengthPreserveGrounding(
  content: string,
  maxLen: number,
  requiredPhrases: string[]
): string {
  if (content.length <= maxLen) {
    return content;
  }
  
  // If content is too long, try to truncate at word boundary while preserving phrases
  const contentLower = content.toLowerCase();
  const phrasePositions: Array<{ phrase: string; start: number; end: number }> = [];
  
  // Find positions of required phrases
  for (const phrase of requiredPhrases) {
    if (phrase.length < 3) continue; // Skip very short phrases
    const phraseLower = phrase.toLowerCase();
    const index = contentLower.indexOf(phraseLower);
    if (index >= 0) {
      phrasePositions.push({
        phrase,
        start: index,
        end: index + phrase.length
      });
    }
  }
  
  // Sort by position
  phrasePositions.sort((a, b) => a.start - b.start);
  
  // If we have phrases, try to keep them
  if (phrasePositions.length > 0) {
    const lastPhraseEnd = phrasePositions[phrasePositions.length - 1].end;
    
    // If last phrase is within maxLen, truncate after it
    if (lastPhraseEnd <= maxLen - 10) { // Leave room for ellipsis
      const truncated = content.substring(0, maxLen - 3);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > lastPhraseEnd) {
        return truncated.substring(0, lastSpace).trim() + '...';
      }
      return truncated.trim() + '...';
    }
    
    // If last phrase is beyond maxLen, try to include at least first phrase
    const firstPhraseEnd = phrasePositions[0].end;
    if (firstPhraseEnd <= maxLen - 10) {
      const truncated = content.substring(0, maxLen - 3);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > firstPhraseEnd) {
        return truncated.substring(0, lastSpace).trim() + '...';
      }
      return truncated.trim() + '...';
    }
  }
  
  // Fallback: truncate at word boundary
  const truncated = content.substring(0, maxLen - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.7) { // Only use word boundary if it's not too early
    return truncated.substring(0, lastSpace).trim() + '...';
  }
  
  // Last resort: hard truncate
  return truncated.trim() + '...';
}

export interface PlanOnlyGenerationResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Ensure reply content is generated for a PLAN_ONLY decision
 * Only runs on Mac Runner (RUNNER_MODE=true)
 * Idempotent: if content already generated, returns existing content
 */
export async function ensureReplyContentGeneratedForPlanOnlyDecision(
  decision: any
): Promise<PlanOnlyGenerationResult> {
  const decisionId = decision.id || decision.decision_id || 'unknown';
  const decisionFeatures = (decision.features || {}) as Record<string, any>;
  
  // Check if this is a PLAN_ONLY decision
  const isPlanOnly = 
    decision.pipeline_source === 'reply_v2_planner' ||
    decisionFeatures.plan_mode === 'railway';
  
  if (!isPlanOnly) {
    // Not a plan-only decision, no generation needed
    return { success: true };
  }
  
  // Check if RUNNER_MODE is enabled (required for generation)
  const runnerMode = process.env.RUNNER_MODE === 'true';
  if (!runnerMode) {
    const errorMsg = 'RUNNER_MODE not enabled - cannot generate content for PLAN_ONLY decision';
    console.error(`[PLAN_ONLY_GENERATOR] ❌ ${errorMsg} decision_id=${decisionId}`);
    
    // Log to system_events
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_plan_only_generation_failed',
        severity: 'error',
        message: errorMsg,
        event_data: {
          decision_id: decisionId,
          reason: 'RUNNER_MODE_NOT_ENABLED',
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError: any) {
      console.warn(`[PLAN_ONLY_GENERATOR] ⚠️ Failed to log error: ${logError.message}`);
    }
    
    return { success: false, error: errorMsg };
  }
  
  // 🔒 FAIL-FAST: Check for OpenAI API key before attempting generation
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey || !openaiApiKey.startsWith('sk-')) {
    const errorMsg = 'OPENAI_API_KEY missing or invalid - cannot generate content for PLAN_ONLY decision';
    console.error(`[PLAN_ONLY_GENERATOR] ❌ ${errorMsg} decision_id=${decisionId}`);
    
    // Log to system_events with specific event type
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'mac_runner_missing_openai_key',
        severity: 'error',
        message: errorMsg,
        event_data: {
          decision_id: decisionId,
          reason: 'OPENAI_API_KEY_MISSING_OR_INVALID',
          key_present: !!openaiApiKey,
          key_prefix: openaiApiKey ? openaiApiKey.slice(0, 3) : 'none',
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError: any) {
      console.warn(`[PLAN_ONLY_GENERATOR] ⚠️ Failed to log error: ${logError.message}`);
    }
    
    return { success: false, error: errorMsg };
  }
  
  // Check if content is already generated (idempotent check)
  const currentContent = decision.content || '';
  const isPlaceholder = 
    !currentContent ||
    currentContent.trim() === '' ||
    currentContent.includes('[PLAN_ONLY') ||
    currentContent.includes('Pending Mac Runner execution');
  
  if (!isPlaceholder) {
    // Content already generated, return success
    console.log(`[PLAN_ONLY_GENERATOR] ✅ Content already generated for decision_id=${decisionId} (${currentContent.length} chars)`);
    return { success: true, content: currentContent };
  }
  
  // Generate content
  console.log(`[PLAN_ONLY_GENERATOR] 🔄 Generating content for PLAN_ONLY decision_id=${decisionId}`);
  
  try {
    const supabase = getSupabaseClient();
    
    // Extract required fields from decision/features
    const targetTweetContent = 
      decision.target_tweet_content_snapshot ||
      decisionFeatures.target_tweet_content_snapshot ||
      '';
    
    const targetUsername = 
      decision.target_username ||
      decisionFeatures.target_username ||
      '';
    
    const strategyId = 
      decisionFeatures.strategy_id ||
      'insight_punch';
    
    const strategyVersion = 
      String(decisionFeatures.strategy_version || '1');
    
    if (!targetTweetContent || targetTweetContent.length < 20) {
      throw new Error(`Missing or invalid target_tweet_content_snapshot (length: ${targetTweetContent.length})`);
    }
    
    // Import generation dependencies
    const { generateReplyContent } = await import('../../ai/replyGeneratorAdapter');
    const { formatStrategyPrompt } = await import('../../growth/replyStrategies');
    const { getStrategyById } = await import('../../growth/replyStrategies');
    
    // Get strategy details
    const strategy = getStrategyById(strategyId);
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }
    
    // Build strategy prompt
    const strategyPrompt = formatStrategyPrompt(strategy, '');
    
    // Extract keywords from target content (matches tieredScheduler logic)
    const { extractKeywords } = await import('../../gates/ReplyQualityGate');
    const keywords = extractKeywords(targetTweetContent);
    
    // 🔒 GROUNDING ENFORCEMENT: Extract anchor tokens (clean, human-readable words)
    const { extractAnchorTokens, verifyAnchorTokens, extractGroundingPhrases, verifyGroundingPhrases } = await import('./groundingPhraseExtractor');
    const anchorTokens = extractAnchorTokens(targetTweetContent);
    const requiredPhrases = extractGroundingPhrases(targetTweetContent); // Keep for backward compatibility
    
    console.log(`[PLAN_ONLY_GENERATOR] 📝 Generating reply using strategy=${strategyId} version=${strategyVersion}`);
    console.log(`[PLAN_ONLY_GENERATOR] 🔒 Anchor tokens (${anchorTokens.length}): ${anchorTokens.join(', ')}`);
    console.log(`[PLAN_ONLY_GENERATOR] 🔒 Required grounding phrases (${requiredPhrases.length}): ${requiredPhrases.join(', ')}`);
    
    // Generate reply content with retry logic for grounding enforcement
    let generatedContent: string | null = null;
    let generationAttempt = 0;
    const maxAttempts = 2; // Initial attempt + 1 retry
    let repairApplied = false; // Track if repair was used
    let firstAttemptOutput: string | null = null;
    let retryOutput: string | null = null;
    
    while (generationAttempt < maxAttempts && !generatedContent) {
      generationAttempt++;
      const generationStartTime = Date.now();
      
      // 🔒 HARD-ENFORCEMENT: Always include explicit anchor token requirements from the start
      let enhancedPrompt = strategyPrompt;
      if (anchorTokens.length >= 2) {
        // Use anchor tokens for explicit requirement
        const anchorList = anchorTokens.slice(0, 2).map(a => `"${a}"`).join(' and ');
        enhancedPrompt = `${strategyPrompt}\n\n**CRITICAL ANCHOR REQUIREMENT**: Your reply MUST include these exact anchor words from the target tweet verbatim: ${anchorList}. These words MUST appear naturally in your reply - failure to include both anchor words makes the reply invalid.`;
      } else if (requiredPhrases.length > 0) {
        // Fallback to phrases if anchors not available
        const phraseList = requiredPhrases.map(p => `"${p}"`).join(' and ');
        enhancedPrompt = `${strategyPrompt}\n\n**CRITICAL REQUIREMENT**: Your reply MUST include at least ${requiredPhrases.length === 1 ? '1' : '2'} of these exact phrases from the target tweet verbatim: ${phraseList}. Include them naturally in context - failure to include required phrases makes the reply invalid.`;
      }
      
      // 🔒 PLAN_ONLY GROUNDING FIX: Ensure template_id is passed so adapter can detect PLAN_ONLY mode
      const replyResult = await Promise.race([
        generateReplyContent({
          target_username: targetUsername,
          target_tweet_content: targetTweetContent,
          topic: keywords.join(', ') || 'health',
          angle: 'reply_context',
          tone: 'helpful',
          model: 'gpt-4o-mini',
          template_id: strategyId, // Pass strategy_id so adapter can detect PLAN_ONLY and apply stricter grounding
          prompt_version: strategyVersion,
          custom_prompt: enhancedPrompt,
          reply_context: {
            target_text: targetTweetContent,
            root_text: targetTweetContent, // For PLAN_ONLY, assume root = target
            root_tweet_id: decision.target_tweet_id || decisionFeatures.root_tweet_id || '',
          },
        }),
        new Promise<any>((_, reject) => {
          setTimeout(() => reject(new Error('GENERATION_TIMEOUT')), 25000); // 25s timeout
        }),
      ]) as any;
      
      const generationElapsed = Date.now() - generationStartTime;
      let candidateContent = replyResult.content;
      
      // Store output for debug bundle
      if (generationAttempt === 1) {
        firstAttemptOutput = candidateContent;
      } else {
        retryOutput = candidateContent;
      }
      
      if (!candidateContent || candidateContent.trim().length === 0) {
        if (generationAttempt < maxAttempts) {
          console.log(`[PLAN_ONLY_GENERATOR] ⚠️ Attempt ${generationAttempt}: Generated content is empty, retrying...`);
          continue;
        }
        throw new Error('Generated content is empty');
      }
      
      // Verify grounding (prefer anchor tokens if available, fallback to phrases)
      let contentToCheck = candidateContent;
      let groundingCheck: { passed: boolean; matchedPhrases?: string[]; missingPhrases?: string[]; matchedAnchors?: string[]; missingAnchors?: string[]; tokenOverlaps?: string[]; tokenOverlapCount?: number };
      
      if (anchorTokens.length >= 2) {
        // Use anchor token verification (stricter)
        const anchorCheck = verifyAnchorTokens(contentToCheck, anchorTokens);
        groundingCheck = {
          passed: anchorCheck.passed,
          matchedAnchors: anchorCheck.matchedAnchors,
          missingAnchors: anchorCheck.missingAnchors,
          tokenOverlaps: anchorCheck.tokenOverlaps,
          tokenOverlapCount: anchorCheck.tokenOverlapCount,
        };
      } else {
        // Fallback to phrase verification
        const phraseCheck = verifyGroundingPhrases(contentToCheck, requiredPhrases);
        groundingCheck = {
          passed: phraseCheck.passed,
          matchedPhrases: phraseCheck.matchedPhrases,
          missingPhrases: phraseCheck.missingPhrases,
        };
      }
        
        if (!groundingCheck.passed) {
          // 🔒 REPAIR STEP: Try to append missing anchor/phrase
          let repairSucceeded = false;
          if (anchorTokens.length >= 2 && groundingCheck.missingAnchors && groundingCheck.missingAnchors.length > 0) {
            // Try to append missing anchor
            const missingAnchor = groundingCheck.missingAnchors[0];
            if (contentToCheck.length < 180) {
              const repairTail = ` (${missingAnchor})`;
              const repairedContent = contentToCheck.trim() + repairTail;
              
              // Re-verify repaired content
              const repairCheck = verifyAnchorTokens(repairedContent, anchorTokens);
              if (repairCheck.passed) {
                console.log(`[PLAN_ONLY_GENERATOR] ✅ Repair successful: Appended missing anchor "${missingAnchor}", grounding now verified`);
                contentToCheck = repairedContent;
                repairApplied = true;
                repairSucceeded = true;
              }
            }
          } else if (groundingCheck.missingPhrases && groundingCheck.missingPhrases.length > 0) {
            // Fallback: try to append missing phrase
            const missingPhrase = groundingCheck.missingPhrases[0];
            if (contentToCheck.length < 180) {
              const repairTail = ` (Re: "${missingPhrase}")`;
              const repairedContent = contentToCheck.trim() + repairTail;
              
              // Re-verify repaired content
              const repairCheck = verifyGroundingPhrases(repairedContent, requiredPhrases);
              if (repairCheck.passed) {
                console.log(`[PLAN_ONLY_GENERATOR] ✅ Repair successful: Appended missing phrase "${missingPhrase}", grounding now verified`);
                contentToCheck = repairedContent;
                repairApplied = true;
                repairSucceeded = true;
              }
            }
          }
          
          if (!repairSucceeded) {
            // Repair didn't help or cannot repair - need to retry generation or fail
            const matchedInfo = anchorTokens.length >= 2 
              ? `Matched anchors: ${groundingCheck.matchedAnchors?.join(', ') || 'none'}, Missing: ${groundingCheck.missingAnchors?.join(', ') || 'none'}, Token overlaps: ${groundingCheck.tokenOverlapCount || 0}`
              : `Matched phrases: ${groundingCheck.matchedPhrases?.join(', ') || 'none'}, Missing: ${groundingCheck.missingPhrases?.join(', ') || 'none'}`;
            
            if (generationAttempt < maxAttempts) {
              console.log(`[PLAN_ONLY_GENERATOR] ⚠️ Attempt ${generationAttempt}: Missing grounding. ${matchedInfo}, retrying generation...`);
              continue;
            } else {
              // Final attempt - log debug bundle and throw
              await logGroundingDebugBundle(
                decisionId,
                decision.target_tweet_id || '',
                targetTweetContent,
                anchorTokens.length >= 2 ? anchorTokens : requiredPhrases,
                firstAttemptOutput || '',
                retryOutput || '',
                groundingCheck,
                supabase
              );
              
              const errorMsg = anchorTokens.length >= 2
                ? `UNGROUNDED_AFTER_RETRY: Reply does not contain required anchor tokens. Required: ${anchorTokens.join(', ')}, ${matchedInfo}`
                : `UNGROUNDED_AFTER_RETRY: Reply does not contain required grounding phrases. Required: ${requiredPhrases.join(', ')}, ${matchedInfo}`;
              
              // Log to system_events
              try {
                await supabase.from('system_events').insert({
                  event_type: 'reply_v2_ungrounded_after_retry',
                  severity: 'error',
                  message: errorMsg,
                  event_data: {
                    decision_id: decisionId,
                    anchor_tokens: anchorTokens,
                    required_phrases: requiredPhrases,
                    matched_anchors: groundingCheck.matchedAnchors,
                    missing_anchors: groundingCheck.missingAnchors,
                    matched_phrases: groundingCheck.matchedPhrases,
                    missing_phrases: groundingCheck.missingPhrases,
                    token_overlap_count: groundingCheck.tokenOverlapCount,
                    attempt_count: generationAttempt,
                    repair_attempted: true,
                    repair_failed: !repairSucceeded,
                  },
                  created_at: new Date().toISOString(),
                });
              } catch (logError: any) {
                console.warn(`[PLAN_ONLY_GENERATOR] ⚠️ Failed to log error: ${logError.message}`);
              }
              
              throw new Error(errorMsg);
            }
          }
        } else {
          const matchedInfo = anchorTokens.length >= 2
            ? `Matched ${groundingCheck.matchedAnchors?.length || 0} anchors: ${groundingCheck.matchedAnchors?.join(', ') || 'none'}`
            : `Matched ${groundingCheck.matchedPhrases?.length || 0} phrases: ${groundingCheck.matchedPhrases?.join(', ') || 'none'}`;
          console.log(`[PLAN_ONLY_GENERATOR] ✅ Grounding verified: ${matchedInfo}`);
        }
        
        candidateContent = contentToCheck; // Use repaired content if repair was applied
      }
      
      generatedContent = candidateContent;
      console.log(`[PLAN_ONLY_GENERATOR] ✅ Generated content (attempt ${generationAttempt}): ${generatedContent.length} chars in ${generationElapsed}ms`);
    }
    
    if (!generatedContent) {
      throw new Error('Failed to generate content after retries');
    }
    
    // 🔒 HARD LENGTH CLAMP: Enforce MAX_REPLY_LENGTH with grounding preservation
    const MAX_REPLY_LENGTH = parseInt(process.env.MAX_REPLY_LENGTH || '200', 10); // Default 200 for safety
    
    const originalLength = generatedContent.length;
    if (generatedContent.length > MAX_REPLY_LENGTH) {
      // Clamp while preserving required grounding phrases
      generatedContent = clampReplyLengthPreserveGrounding(
        generatedContent,
        MAX_REPLY_LENGTH,
        requiredPhrases
      );
      
      console.log(`[PLAN_ONLY_GENERATOR] ⚠️ Clamped content from ${originalLength} to ${generatedContent.length} chars (preserved ${requiredPhrases.length} grounding phrases)`);
      
      // Re-verify grounding after clamp (phrases might have been cut off)
      if (requiredPhrases.length > 0) {
        const postClampCheck = verifyGroundingPhrases(generatedContent, requiredPhrases);
        if (!postClampCheck.passed) {
          console.warn(`[PLAN_ONLY_GENERATOR] ⚠️ Warning: Clamp may have removed required phrases. Matched: ${postClampCheck.matchedPhrases.join(', ') || 'none'}`);
          // Don't fail here - clamp is best-effort preservation
        }
      }
    }
    
    // Persist generated content to base table
    const generatedAt = new Date().toISOString();
    // Final grounding check (use anchor tokens if available)
    let finalGroundingCheck: any;
    if (anchorTokens.length >= 2) {
      finalGroundingCheck = verifyAnchorTokens(generatedContent, anchorTokens);
    } else {
      finalGroundingCheck = verifyGroundingPhrases(generatedContent, requiredPhrases);
    }
    
    const updatedFeatures = {
      ...decisionFeatures,
      generated_by: 'mac_runner',
      generated_at: generatedAt,
      anchor_tokens: anchorTokens, // Store anchor tokens
      required_grounding_phrases: requiredPhrases, // Store for proof reporting
      grounding_phrases: requiredPhrases, // Legacy field
      grounding_phrases_matched: finalGroundingCheck.matchedPhrases || finalGroundingCheck.matchedAnchors || [],
      grounding_extractor_version: '3.0', // Version with anchor tokens + improved extractor
      grounding_repair_applied: repairApplied, // Track if repair was used
    };
    
    const { error: updateError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .update({
        content: generatedContent,
        features: updatedFeatures,
        // Keep status as 'queued' - don't change it here
      })
      .eq('decision_id', decisionId);
    
    if (updateError) {
      throw new Error(`Failed to persist generated content: ${updateError.message}`);
    }
    
    console.log(`[PLAN_ONLY_GENERATOR] ✅ Content persisted to database for decision_id=${decisionId}`);
    
    // Update decision object in-place so subsequent checks use the new content
    decision.content = generatedContent;
    
    return { success: true, content: generatedContent };
    
  } catch (error: any) {
    const errorMsg = `Generation failed: ${error.message}`;
    console.error(`[PLAN_ONLY_GENERATOR] ❌ ${errorMsg} decision_id=${decisionId}`);
    
    // Log to system_events
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_plan_only_generation_failed',
        severity: 'error',
        message: errorMsg,
        event_data: {
          decision_id: decisionId,
          error: error.message,
          stack: error.stack?.substring(0, 500),
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError: any) {
      console.warn(`[PLAN_ONLY_GENERATOR] ⚠️ Failed to log error: ${logError.message}`);
    }
    
    return { success: false, error: errorMsg };
  }
}

/**
 * Log grounding debug bundle for UNGROUNDED_AFTER_RETRY failures
 */
async function logGroundingDebugBundle(
  decisionId: string,
  targetTweetId: string,
  tweetText: string,
  extractedTerms: string[],
  firstAttempt: string,
  retryAttempt: string,
  matcherResult: any,
  supabase: any
): Promise<void> {
  const debugBundle = {
    decision_id: decisionId,
    target_tweet_id: targetTweetId,
    tweet_text_used_for_generation: tweetText.substring(0, 300),
    extracted_grounding_terms: extractedTerms,
    model_output_first_attempt: firstAttempt.substring(0, 240),
    model_output_retry: retryAttempt.substring(0, 240),
    matcher_result: {
      passed: matcherResult.passed,
      exact_matches_count: matcherResult.matchedAnchors?.length || matcherResult.matchedPhrases?.length || 0,
      token_overlap_count: matcherResult.tokenOverlapCount || 0,
      matched_tokens: matcherResult.matchedAnchors || matcherResult.matchedPhrases || [],
      missing_tokens: matcherResult.missingAnchors || matcherResult.missingPhrases || [],
      token_overlaps: matcherResult.tokenOverlaps || [],
    },
    timestamp: new Date().toISOString(),
  };
  
  // Log to executor.log (single-line JSON)
  console.log(`[GROUNDING_DEBUG_BUNDLE] ${JSON.stringify(debugBundle)}`);
  
  // Save full bundle to file
  try {
    const { mkdirSync, writeFileSync } = await import('fs');
    const { join } = await import('path');
    const debugDir = join(process.cwd(), '.runner-profile', 'debug', 'grounding');
    mkdirSync(debugDir, { recursive: true });
    const debugFile = join(debugDir, `${decisionId}.json`);
    writeFileSync(debugFile, JSON.stringify(debugBundle, null, 2));
    console.log(`[GROUNDING_DEBUG_BUNDLE] 💾 Saved debug bundle to ${debugFile}`);
  } catch (fileError: any) {
    console.warn(`[GROUNDING_DEBUG_BUNDLE] ⚠️ Failed to save debug bundle: ${fileError.message}`);
  }
}

/**
 * Simple keyword extraction (matches tieredScheduler logic)
 */
function extractKeywords(content: string): string[] {
  const healthKeywords = [
    'health', 'fitness', 'nutrition', 'diet', 'exercise', 'workout',
    'wellness', 'sleep', 'recovery', 'muscle', 'strength', 'cardio',
    'protein', 'carbs', 'fat', 'calories', 'metabolism', 'weight',
    'body', 'mind', 'mental', 'stress', 'energy', 'performance',
  ];
  
  const lowerContent = content.toLowerCase();
  const found = healthKeywords.filter(kw => lowerContent.includes(kw));
  
  // Always include 'health' as default
  return found.length > 0 ? found : ['health'];
}
