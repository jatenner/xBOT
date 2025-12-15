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

    // Use pre-matched generator if provided (Part 1: for compatibility with planJob)
    // Otherwise, match generator ourselves
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

    // Call dedicated generator (same as planJob.callDedicatedGenerator)
    const result = await this.callDedicatedGenerator(matchedGenerator, {
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
   * Call dedicated generator (same logic as planJob.callDedicatedGenerator)
   */
  private static async callDedicatedGenerator(generatorName: string, context: any) {
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
      console.error(`[PHASE4][CoreContentOrchestrator] ❌ Generator not mapped: ${generatorName}`);
      throw new Error(`Unknown generator: ${generatorName}`);
    }

    try {
      console.log(`[PHASE4][CoreContentOrchestrator] 🎭 Calling ${config.module}.${config.fn}()...`);

      const generatorModule = await import(`../generators/${config.module}`);
      const generateFn = generatorModule[config.fn];

      if (typeof generateFn !== 'function') {
        console.error(`[PHASE4][CoreContentOrchestrator] ❌ Function ${config.fn} not found in ${config.module}`);
        throw new Error(`Generator function ${config.fn} not found`);
      }

      // Format selection (same logic as planJob)
      const selectedFormat: 'single' | 'thread' = Math.random() < 0.40 ? 'thread' : 'single';
      console.log(`[PHASE4][CoreContentOrchestrator] 📊 Format selected: ${selectedFormat}`);

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
    } catch (error: any) {
      console.error(`[PHASE4][CoreContentOrchestrator] ❌ Error calling ${config.module}:`, error.message);
      throw error;
    }
  }
}

