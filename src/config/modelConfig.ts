/**
 * 💰 MODEL CONFIGURATION
 * 
 * Centralized model selection for budget optimization
 * Switch between gpt-4o (expensive, high quality) and gpt-4o-mini (cheap, good quality)
 */

/**
 * Get the model to use for content generation
 * Default: gpt-4o-mini (10x cheaper, 80% quality)
 * Override with CONTENT_GENERATION_MODEL env var
 */
export function getContentGenerationModel(): string {
  const model = process.env.CONTENT_GENERATION_MODEL || 'gpt-4o-mini';
  return model;
}

/**
 * Get the model to use for AI judge (picks best option)
 * Default: gpt-4o (needs to be smart)
 * Override with AI_JUDGE_MODEL env var
 */
export function getAIJudgeModel(): string {
  const model = process.env.AI_JUDGE_MODEL || 'gpt-4o';
  return model;
}

/**
 * Get the model to use for AI refiner (polishes content)
 * Default: gpt-4o-mini (good enough for refinement)
 * Override with AI_REFINER_MODEL env var
 */
export function getAIRefinerModel(): string {
  const model = process.env.AI_REFINER_MODEL || 'gpt-4o-mini';
  return model;
}

/**
 * Get the model to use for replies
 * Default: gpt-4o-mini (replies can be simpler)
 * Override with REPLY_GENERATION_MODEL env var
 */
export function getReplyGenerationModel(): string {
  const model = process.env.REPLY_GENERATION_MODEL || 'gpt-4o-mini';
  return model;
}

/**
 * Pricing reference (per 1M tokens)
 */
export const MODEL_PRICING = {
  'gpt-4o': {
    input: 5.00,    // $5 per 1M input tokens
    output: 15.00   // $15 per 1M output tokens
  },
  'gpt-4o-mini': {
    input: 0.150,   // $0.15 per 1M input tokens (30x cheaper!)
    output: 0.600   // $0.60 per 1M output tokens (25x cheaper!)
  }
};

/**
 * Log current model configuration
 */
export function logModelConfig(): void {
  console.log('💰 MODEL_CONFIG:');
  console.log(`   Content Generation: ${getContentGenerationModel()}`);
  console.log(`   AI Judge: ${getAIJudgeModel()}`);
  console.log(`   AI Refiner: ${getAIRefinerModel()}`);
  console.log(`   Reply Generation: ${getReplyGenerationModel()}`);
  
  const contentModel = getContentGenerationModel() as keyof typeof MODEL_PRICING;
  const pricing = MODEL_PRICING[contentModel] || MODEL_PRICING['gpt-4o-mini'];
  console.log(`   Estimated cost per tweet: $${((pricing.input * 1000 + pricing.output * 200) / 1000000).toFixed(4)}`);
}

