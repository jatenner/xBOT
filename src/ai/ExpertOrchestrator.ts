/**
 * Phase 4 Expert Content Orchestrator
 * 
 * Part 2: Uses GPT-4o for high-value content
 * - Wraps same generation logic as CoreContentOrchestrator
 * - Overrides model to GPT-4o for enhanced quality
 * - Used for high-value slots and high-priority replies
 */

import type { CoreContentRequest, CoreContentResponse } from './CoreContentOrchestrator';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface ExpertContentRequest extends CoreContentRequest {
  upgrade_reason?: 'high_value_slot' | 'high_priority_reply' | 'banger_analysis';
}

/**
 * Expert Content Orchestrator
 * 
 * Uses GPT-4o for high-value content generation
 */
export class ExpertOrchestrator {
  /**
   * Generate content using GPT-4o
   * 
   * Reuses same generator logic as CoreContentOrchestrator but with GPT-4o model
   */
  static async generate(request: ExpertContentRequest): Promise<CoreContentResponse> {
    const reason = request.upgrade_reason || 'high_value_slot';
    console.log(`[PHASE4][ExpertOrchestrator] Using GPT-4o for decisionType=${request.decision_type} slot=${request.content_slot} reason=${reason}`);

    // Use pre-matched generator if provided, otherwise match ourselves
    let matchedGenerator: string;
    
    if (request.generator_name) {
      matchedGenerator = request.generator_name;
      console.log(`[PHASE4][ExpertOrchestrator] Using pre-matched generator: ${matchedGenerator}`);
    } else {
      const { getGeneratorMatcher } = await import('../intelligence/generatorMatcher');
      const generatorMatcher = getGeneratorMatcher();
      matchedGenerator = await generatorMatcher.matchGenerator(
        request.angle || 'general',
        request.tone || 'informative'
      );
      console.log(`[PHASE4][ExpertOrchestrator] Selected generator: ${matchedGenerator}`);
    }

    // Format selection (same logic as planJob)
    const selectedFormat: 'single' | 'thread' = Math.random() < 0.40 ? 'thread' : 'single';
    console.log(`[PHASE4][ExpertOrchestrator] 📊 Format selected: ${selectedFormat}`);

    // Use explicit model from request, default to gpt-4o for ExpertOrchestrator
    const model = request.model || 'gpt-4o';
    console.log(`[PHASE4][ExpertOrchestrator] Using model: ${model}`);

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

