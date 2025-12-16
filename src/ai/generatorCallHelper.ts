/**
 * Generator Call Helper
 * 
 * Shared helper for calling generators with explicit model selection
 * Used by both CoreContentOrchestrator and ExpertOrchestrator
 */

export interface GeneratorCallContext {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  growthIntelligence?: any;
  viInsights?: any;
}

export interface GeneratorCallResult {
  text: string;
  format: 'single' | 'thread';
  topic: string;
  angle: string;
  tone: string;
  visual_format: string;
  angle_type?: string;
  tone_is_singular?: boolean;
  tone_cluster?: string;
  structural_type?: string;
}

/**
 * Call a generator with explicit model selection
 * 
 * @param generatorName - Name of the generator to call
 * @param context - Generator call context
 * @param model - Explicit model to use ('gpt-4o-mini' or 'gpt-4o')
 * @returns Generator result
 */
export async function callGeneratorWithModel(
  generatorName: string,
  context: GeneratorCallContext,
  model: 'gpt-4o-mini' | 'gpt-4o'
): Promise<GeneratorCallResult> {
  const { topic, angle, tone, formatStrategy, growthIntelligence, viInsights } = context;

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

  // 🛡️ Safe fallback for unknown generators (e.g., "researcher" -> "dataNerd")
  let normalizedGeneratorName = generatorName;
  const generatorAliases: Record<string, string> = {
    'researcher': 'dataNerd', // Map "researcher" to "dataNerd" (closest match)
    'research': 'dataNerd'
  };
  
  if (generatorAliases[generatorName]) {
    normalizedGeneratorName = generatorAliases[generatorName];
    console.warn(`[GENERATOR_MATCH] ⚠️ Unknown generator "${generatorName}" mapped to "${normalizedGeneratorName}"`);
  }
  
  let config = generatorMap[normalizedGeneratorName];
  if (!config) {
    console.error(`[GENERATOR_MATCH] ❌ Unknown generator: ${normalizedGeneratorName} — falling back to thoughtLeader`);
    normalizedGeneratorName = 'thoughtLeader'; // Safe fallback
    config = generatorMap[normalizedGeneratorName];
    if (!config) {
      throw new Error(`Critical: Fallback generator "thoughtLeader" not found in generatorMap`);
    }
  }
  
  // Use normalized name for rest of function
  generatorName = normalizedGeneratorName;

  const generatorModule = await import(`../generators/${config.module}`);
  const generateFn = generatorModule[config.fn];

  if (typeof generateFn !== 'function') {
    throw new Error(`Generator function ${config.fn} not found in ${config.module}`);
  }

  // Temporarily override model via env var (cleanest approach without modifying all generators)
  // This is scoped to this function call and restored immediately after
  const originalModel = process.env.CONTENT_GENERATION_MODEL;
  process.env.CONTENT_GENERATION_MODEL = model;

  try {
    const result = await generateFn({
      topic,
      angle,
      tone,
      formatStrategy,
      format: context.format,
      intelligence: growthIntelligence,
      viInsights: viInsights || null
    });

    return {
      text: result.content,
      format: context.format,
      topic,
      angle: angle || 'general',
      tone: tone || 'informative',
      visual_format: result.visualFormat || 'paragraph',
      angle_type: (context as any).angle_type,
      tone_is_singular: (context as any).tone_is_singular,
      tone_cluster: (context as any).tone_cluster,
      structural_type: (context as any).structural_type
    };
  } finally {
    // Always restore original model setting
    if (originalModel !== undefined) {
      process.env.CONTENT_GENERATION_MODEL = originalModel;
    } else {
      delete process.env.CONTENT_GENERATION_MODEL;
    }
  }
}

