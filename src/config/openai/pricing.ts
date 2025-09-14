/**
 * Centralized OpenAI Pricing Table
 * Keep this file authoritative and under version control
 * Prices in USD per 1K tokens
 */

export interface ModelPricing {
  input: number;   // $ per 1K input tokens
  output: number;  // $ per 1K output tokens
}

/**
 * Official OpenAI Pricing (as of September 2024)
 * https://openai.com/pricing
 */
export const OPENAI_PRICING: Record<string, ModelPricing> = {
  // GPT-4o Models
  'gpt-4o': {
    input: 0.0025,  // $2.50 per 1M tokens
    output: 0.0100  // $10.00 per 1M tokens
  },
  
  'gpt-4o-mini': {
    input: 0.0005,  // $0.15 per 1M tokens  
    output: 0.0015  // $0.60 per 1M tokens
  },
  
  // GPT-4 Models
  'gpt-4': {
    input: 0.0300,  // $30.00 per 1M tokens
    output: 0.0600  // $60.00 per 1M tokens
  },
  
  'gpt-4-turbo': {
    input: 0.0100,  // $10.00 per 1M tokens
    output: 0.0300  // $30.00 per 1M tokens
  },
  
  // GPT-3.5 Models
  'gpt-3.5-turbo': {
    input: 0.0005,  // $0.50 per 1M tokens
    output: 0.0015  // $1.50 per 1M tokens
  },
  
  'gpt-3.5-turbo-instruct': {
    input: 0.0015,  // $1.50 per 1M tokens
    output: 0.0020  // $2.00 per 1M tokens
  },
  
  // Embeddings
  'text-embedding-ada-002': {
    input: 0.0001,  // $0.10 per 1M tokens
    output: 0.0000  // No output tokens for embeddings
  },
  
  'text-embedding-3-small': {
    input: 0.0000,  // $0.02 per 1M tokens
    output: 0.0000
  },
  
  'text-embedding-3-large': {
    input: 0.0001,  // $0.13 per 1M tokens
    output: 0.0000
  }
};

/**
 * Get pricing for a model, with fallback to gpt-4o-mini
 */
export function getModelPricing(model: string): ModelPricing {
  // Handle model variants (e.g., gpt-4o-2024-05-13 -> gpt-4o)
  const baseModel = model.split('-').slice(0, 2).join('-');
  
  return OPENAI_PRICING[model] || 
         OPENAI_PRICING[baseModel] || 
         OPENAI_PRICING['gpt-4o-mini']; // Safe fallback
}

/**
 * Calculate cost for token usage
 */
export function calculateTokenCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getModelPricing(model);
  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  return Number((inputCost + outputCost).toFixed(6));
}

/**
 * Estimate tokens for text (rough approximation)
 */
export function estimateTokenCount(text: string): number {
  // Conservative estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Get model recommendations based on budget constraints
 */
export function getModelRecommendations(remainingBudget: number): {
  recommended: string;
  alternatives: string[];
  reasoning: string;
} {
  if (remainingBudget > 2.0) {
    return {
      recommended: 'gpt-4o',
      alternatives: ['gpt-4o-mini', 'gpt-3.5-turbo'],
      reasoning: 'Healthy budget - use premium model for best quality'
    };
  } else if (remainingBudget > 0.5) {
    return {
      recommended: 'gpt-4o-mini',
      alternatives: ['gpt-3.5-turbo'],
      reasoning: 'Moderate budget - balanced quality and cost'
    };
  } else if (remainingBudget > 0.1) {
    return {
      recommended: 'gpt-3.5-turbo',
      alternatives: ['gpt-4o-mini'],
      reasoning: 'Low budget - prioritize cost efficiency'
    };
  } else {
    return {
      recommended: 'none',
      alternatives: [],
      reasoning: 'Insufficient budget - consider caching or non-LLM alternatives'
    };
  }
}

/**
 * Pricing validation - ensure all models have valid pricing
 */
export function validatePricing(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  Object.entries(OPENAI_PRICING).forEach(([model, pricing]) => {
    if (pricing.input < 0) {
      errors.push(`${model}: negative input pricing`);
    }
    if (pricing.output < 0) {
      errors.push(`${model}: negative output pricing`);
    }
    if (pricing.input > 0.1) {
      errors.push(`${model}: suspiciously high input pricing (>${pricing.input})`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}
