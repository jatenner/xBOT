/**
 * Phase 4 Core Content Orchestrator
 * 
 * Part 1: Wrapper around existing generation system
 * - Wraps UnifiedContentEngine + GeneratorMatcher flow
 * - Uses GPT-4o-mini (via existing generators)
 * - No behavioral changes - just routing layer
 */

import type { DecisionType, ContentSlotType } from '../config/aiRoutingConfig';

export interface CoreContentRequest {
  decision_type: DecisionType;
  content_slot: ContentSlotType;
  model?: 'gpt-4o-mini' | 'gpt-4o'; // Explicit model selection (Part 3)
  topic?: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  generator_name?: string; // Pre-matched generator (for Part 1 compatibility)
  target_username?: string; // For replies
  target_tweet_content?: string; // For replies
  // Context from existing system
  dynamicTopic?: any;
  growthIntelligence?: any;
  viInsights?: any;
  angle_type?: string;
  tone_is_singular?: boolean;
  tone_cluster?: string;
  structural_type?: string;
}

export interface CoreContentResponse {
  text: string;
  format: 'single' | 'thread';
  topic: string;
  angle: string;
  tone: string;
  visual_format: string;
  generator_used: string;
  // Pass through meta-awareness attributes
  angle_type?: string;
  tone_is_singular?: boolean;
  tone_cluster?: string;
  structural_type?: string;
}

/**
 * Core Content Orchestrator
 * 
 * Part 1: Wraps existing generateContentWithLLM() logic
 * Part 2: Will add intelligent model selection and learning signal integration
 */
export class CoreContentOrchestrator {
  /**
   * Generate content using existing system
   * 
   * This is a wrapper that calls the same logic as planJob.generateContentWithLLM()
   * but through a clean interface for Phase 4 routing.
   */
  static async generate(request: CoreContentRequest): Promise<CoreContentResponse> {
    console.log(`[PHASE4][CoreContentOrchestrator] Generating content for decisionType=${request.decision_type} slot=${request.content_slot}`);

    // 🚨 CRITICAL FIX: Replies must NEVER use regular generators (they produce thread/single content)
    if (request.decision_type === 'reply') {
      console.log(`[PHASE4][CoreContentOrchestrator] 🚫 REPLY detected - using reply-specific generation (NOT regular generators)`);
      
      // Use reply-specific generation logic from replyJob
      const { generateReplyContent } = await import('../ai/replyGeneratorAdapter');
      const replyResult = await generateReplyContent({
        target_username: request.target_username || 'unknown',
        target_tweet_content: request.target_tweet_content || '',
        topic: request.topic || 'health',
        angle: request.angle || 'general',
        tone: request.tone || 'informative',
        model: request.model || 'gpt-4o-mini',
        relevance_score: (request as any).relevance_score,
        replyability_score: (request as any).replyability_score,
        // 🔒 NEW: Pass reply context for grounded replies
        reply_context: (request as any).reply_context
      });
      
      return {
        text: replyResult.content,
        format: 'single', // Replies are always single tweets
        topic: request.topic || 'health',
        angle: request.angle,
        tone: request.tone,
        visual_format: undefined,
        generator_used: replyResult.generator_used || 'reply_generator',
        angle_type: request.angle_type,
        tone_is_singular: request.tone_is_singular,
        tone_cluster: request.tone_cluster,
        structural_type: request.structural_type
      };
    }

    // For singles/threads: Use regular generator logic
    let matchedGenerator: string;
    
    if (request.generator_name) {
      matchedGenerator = request.generator_name;
      console.log(`[PHASE4][CoreContentOrchestrator] Using pre-matched generator: ${matchedGenerator}`);
    } else {
      // Import existing modules
      const { getGeneratorMatcher } = await import('../intelligence/generatorMatcher');
      const generatorMatcher = getGeneratorMatcher();

      // Select generator using existing logic
      matchedGenerator = await generatorMatcher.matchGenerator(
        request.angle || 'general',
        request.tone || 'informative'
      );

      console.log(`[PHASE4][CoreContentOrchestrator] Selected generator: ${matchedGenerator}`);
    }

    // Format selection (same logic as planJob)
    const selectedFormat: 'single' | 'thread' = Math.random() < 0.40 ? 'thread' : 'single';
    console.log(`[PHASE4][CoreContentOrchestrator] 📊 Format selected: ${selectedFormat}`);

    // Use explicit model from request, or default to gpt-4o-mini
    const model = request.model || 'gpt-4o-mini';
    console.log(`[PHASE4][CoreContentOrchestrator] Using model: ${model}`);

    // Call generator with explicit model via helper
    const { callGeneratorWithModel } = await import('./generatorCallHelper');
    const result = await callGeneratorWithModel(matchedGenerator, {
      topic: request.topic || 'health optimization',
      angle: request.angle,
      tone: request.tone,
      formatStrategy: request.formatStrategy,
      format: selectedFormat,
      growthIntelligence: request.growthIntelligence,
      viInsights: request.viInsights
    }, model);

    return {
      text: result.text,
      format: result.format,
      topic: result.topic,
      angle: result.angle,
      tone: result.tone,
      visual_format: result.visual_format,
      generator_used: matchedGenerator,
      angle_type: request.angle_type || result.angle_type,
      tone_is_singular: request.tone_is_singular || result.tone_is_singular,
      tone_cluster: request.tone_cluster || result.tone_cluster,
      structural_type: request.structural_type || result.structural_type
    };
  }

}

