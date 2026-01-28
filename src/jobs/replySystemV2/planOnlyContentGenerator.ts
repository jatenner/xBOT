/**
 * 🎯 PLAN_ONLY CONTENT GENERATOR
 * 
 * Generates reply content for PLAN_ONLY decisions on Mac Runner.
 * This bridges the gap between Railway planning and Mac Runner execution.
 */

import { getSupabaseClient } from '../../db/index';

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
    
    // Generate reply content
    console.log(`[PLAN_ONLY_GENERATOR] 📝 Generating reply using strategy=${strategyId} version=${strategyVersion}`);
    const generationStartTime = Date.now();
    
    const replyResult = await Promise.race([
      generateReplyContent({
        target_username: targetUsername,
        target_tweet_content: targetTweetContent,
        topic: keywords.join(', ') || 'health',
        angle: 'reply_context',
        tone: 'helpful',
        model: 'gpt-4o-mini',
        template_id: strategyId,
        prompt_version: strategyVersion,
        custom_prompt: strategyPrompt,
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
    const generatedContent = replyResult.content;
    
    if (!generatedContent || generatedContent.trim().length === 0) {
      throw new Error('Generated content is empty');
    }
    
    console.log(`[PLAN_ONLY_GENERATOR] ✅ Generated content: ${generatedContent.length} chars in ${generationElapsed}ms`);
    
    // Persist generated content to base table
    const generatedAt = new Date().toISOString();
    const updatedFeatures = {
      ...decisionFeatures,
      generated_by: 'mac_runner',
      generated_at: generatedAt,
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
