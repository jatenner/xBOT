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

    // Call generator with GPT-4o override
    const result = await this.callDedicatedGeneratorWithExpertModel(matchedGenerator, {
      topic: request.topic || 'health optimization',
      angle: request.angle,
      tone: request.tone,
      formatStrategy: request.formatStrategy,
      dynamicTopic: request.dynamicTopic,
      growthIntelligence: request.growthIntelligence,
      viInsights: request.viInsights,
      angle_type: request.angle_type,
      tone_is_singular: request.tone_is_singular,
      tone_cluster: request.tone_cluster,
      structural_type: request.structural_type
    });

    return {
      text: result.text,
      format: result.format,
      topic: result.topic,
      angle: result.angle,
      tone: result.tone,
      visual_format: result.visual_format,
      generator_used: matchedGenerator,
      angle_type: result.angle_type,
      tone_is_singular: result.tone_is_singular,
      tone_cluster: result.tone_cluster,
      structural_type: result.structural_type
    };
  }

  /**
   * Call dedicated generator with GPT-4o model override
   */
  private static async callDedicatedGeneratorWithExpertModel(generatorName: string, context: any) {
    const { topic, angle, tone, formatStrategy, dynamicTopic, growthIntelligence, viInsights } = context;

    // Map generator names to their module files and function names
    const generatorMap: Record<string, { module: string, fn: string }> = {
      'provocateur': { module: 'provocateurGenerator', fn: 'generateProvocateurContent' },
      'dataNerd': { module: 'dataNerdGenerator', fn: 'generateDataNerdContent' },
      'mythBuster': { module: 'mythBusterGenerator', fn: 'generateMythBusterContent' },
      'contrarian': { module: 'contrarianGenerator', fn: 'generateContrarianContent' },
      'storyteller': { module: 'storytellerGenerator', fn: 'generateStorytellerContent' },
      'coach': { module: 'coachGenerator', fn: 'generateCoachContent' },
      'philosopher': { module: 'philosopherGenerator', fn: 'generatePhilosopherContent' },
      'culturalBridge': { module: 'culturalBridgeGenerator', fn: 'generateCulturalBridgeContent' },
      'newsReporter': { module: 'newsReporterGenerator', fn: 'generateNewsReporterContent' },
      'explorer': { module: 'explorerGenerator', fn: 'generateExplorerContent' },
      'thoughtLeader': { module: 'thoughtLeaderGenerator', fn: 'generateThoughtLeaderContent' },
      'interestingContent': { module: 'interestingContentGenerator', fn: 'generateInterestingContent' },
      'dynamicContent': { module: 'dynamicContentGenerator', fn: 'generateDynamicContent' },
      'popCultureAnalyst': { module: 'popCultureAnalystGenerator', fn: 'generatePopCultureContent' },
      'teacher': { module: 'teacherGenerator', fn: 'generateTeacherContent' },
      'investigator': { module: 'investigatorGenerator', fn: 'generateInvestigatorContent' },
      'connector': { module: 'connectorGenerator', fn: 'generateConnectorContent' },
      'pragmatist': { module: 'pragmatistGenerator', fn: 'generatePragmatistContent' },
      'historian': { module: 'historianGenerator', fn: 'generateHistorianContent' },
      'translator': { module: 'translatorGenerator', fn: 'generateTranslatorContent' },
      'patternFinder': { module: 'patternFinderGenerator', fn: 'generatePatternFinderContent' },
      'experimenter': { module: 'experimenterGenerator', fn: 'generateExperimenterContent' },
    };

    const config = generatorMap[generatorName];
    if (!config) {
      console.error(`[PHASE4][ExpertOrchestrator] ❌ Generator not mapped: ${generatorName}`);
      throw new Error(`Unknown generator: ${generatorName}`);
    }

    try {
      console.log(`[PHASE4][ExpertOrchestrator] 🎭 Calling ${config.module}.${config.fn}() with GPT-4o...`);

      const generatorModule = await import(`../generators/${config.module}`);
      const generateFn = generatorModule[config.fn];

      if (typeof generateFn !== 'function') {
        console.error(`[PHASE4][ExpertOrchestrator] ❌ Function ${config.fn} not found in ${config.module}`);
        throw new Error(`Generator function ${config.fn} not found`);
      }

      // Format selection (same logic as planJob)
      const selectedFormat: 'single' | 'thread' = Math.random() < 0.40 ? 'thread' : 'single';
      console.log(`[PHASE4][ExpertOrchestrator] 📊 Format selected: ${selectedFormat}`);

      // For ExpertOrchestrator, we need to override the model in the generator
      // Since generators use getContentGenerationModel(), we'll temporarily override via env
      // OR we can call the generator and then enhance with GPT-4o if needed
      // For Part 2, let's call generator normally but with GPT-4o override via monkey-patch
      // Actually, simpler: call generator, then if it uses createBudgetedChatCompletion internally,
      // we need a different approach. Let's check if generators accept model override.
      
      // For now, call generator normally - generators will use their default model
      // In Part 3, we can add model override parameter to generators
      // For Part 2, we'll enhance the prompt/context to get better results from GPT-4o-mini
      // Actually wait - generators call createBudgetedChatCompletion with getContentGenerationModel()
      // We can't easily override that without modifying generators
      
      // Solution: Temporarily override process.env.CONTENT_GENERATION_MODEL
      const originalModel = process.env.CONTENT_GENERATION_MODEL;
      process.env.CONTENT_GENERATION_MODEL = 'gpt-4o';
      
      try {
        const result = await generateFn({
          topic,
          angle,
          tone,
          formatStrategy,
          format: selectedFormat,
          intelligence: growthIntelligence,
          viInsights: viInsights || null
        });

        return {
          text: result.content,
          format: selectedFormat as 'single' | 'thread',
          topic,
          angle,
          tone,
          visual_format: result.visualFormat,
          angle_type: context.angle_type,
          tone_is_singular: context.tone_is_singular,
          tone_cluster: context.tone_cluster,
          structural_type: context.structural_type
        };
      } finally {
        // Restore original model
        if (originalModel !== undefined) {
          process.env.CONTENT_GENERATION_MODEL = originalModel;
        } else {
          delete process.env.CONTENT_GENERATION_MODEL;
        }
      }
    } catch (error: any) {
      console.error(`[PHASE4][ExpertOrchestrator] ❌ Error calling ${config.module}:`, error.message);
      throw error;
    }
  }
}

