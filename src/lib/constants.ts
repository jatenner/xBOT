/**
 * Constants for OpenAI models and configuration
 */

// Default GPT model for text-based analysis - use GPT-4o for best results
export const GPT_MODEL = 'gpt-4o';

// Fallback models in order of preference if GPT-4o is not available
export const FALLBACK_MODELS = [
  'gpt-4-0125-preview',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo-16k',
  'gpt-3.5-turbo'
];

// API request configuration
export const API_CONFIG = {
  MAX_TOKENS: 2000,     // Increased token limit for more detailed responses
  TEMPERATURE: 0.2,     // Lower temperature for more consistent/deterministic outputs
  TOP_P: 0.95,          // Slightly higher top_p for better creative suggestions
  FREQUENCY_PENALTY: 0, // No penalty for repeated token usage
  PRESENCE_PENALTY: 0.1, // Small penalty to encourage diversity
  DEFAULT_TIMEOUT_MS: 30000 // Default timeout of 30 seconds if not specified in env
};

/**
 * Response formats for nutrition analysis
 */
export const NUTRITION_FORMATS = {
  // Default format for returning analysis results
  DEFAULT: 'json',
  
  // Format for handling errors or fallbacks
  FALLBACK: 'simplified'
};

/**
 * Feature flags for controlling behavior
 */
export const FEATURE_FLAGS = {
  // Enable advanced validation of nutrition results
  VALIDATE_NUTRITION: true,
  
  // Enable confidence scoring for nutrient values
  CONFIDENCE_SCORING: true,
  
  // Use OCR text extraction (always enabled now)
  USE_OCR_EXTRACTION: true,
  
  // Enable Vision-based analysis
  USE_GPT4_VISION: true
};

/**
 * Logging settings
 */
export const LOG_CONFIG = {
  // Whether to log detailed information about analysis steps
  VERBOSE: true,
  
  // Whether to log nutrition API responses
  LOG_NUTRITION_RESPONSES: false,
  
  // Whether to log OpenAI responses
  LOG_OPENAI_RESPONSES: false,
  
  // Maximum length of text to log
  MAX_LOG_LENGTH: 200
}; 