/**
 * 🏁 FEATURE FLAGS
 * Production-safe flags to control expensive operations
 */

export const FEATURE_FLAGS = {
  // Pipeline warmups and tests (disable in prod to prevent budget drain)
  PIPELINE_TEST_ENABLED: process.env.PIPELINE_TEST_ENABLED === 'true',
  
  // Fallback generation (disable in prod for strict budget control)
  ALLOW_FALLBACK_GENERATION: process.env.ALLOW_FALLBACK_GENERATION === 'true',
  
  // Cache warmups that call LLM
  ALLOW_LLM_CACHE_WARMUP: process.env.ALLOW_LLM_CACHE_WARMUP === 'true',
  
  // Posting control
  POSTING_DISABLED: process.env.POSTING_DISABLED === 'true',
  
  // Budget limits
  DAILY_OPENAI_LIMIT_USD: Number(process.env.DAILY_OPENAI_LIMIT_USD || 5),
  
  // Debug modes
  VERBOSE_BUDGET_LOGGING: process.env.VERBOSE_BUDGET_LOGGING === 'true'
} as const;

/**
 * Log feature flags at startup
 */
export function logFeatureFlags(): void {
  console.log('🏁 FEATURE_FLAGS:');
  console.log(`   PIPELINE_TEST_ENABLED: ${FEATURE_FLAGS.PIPELINE_TEST_ENABLED}`);
  console.log(`   ALLOW_FALLBACK_GENERATION: ${FEATURE_FLAGS.ALLOW_FALLBACK_GENERATION}`);
  console.log(`   ALLOW_LLM_CACHE_WARMUP: ${FEATURE_FLAGS.ALLOW_LLM_CACHE_WARMUP}`);
  console.log(`   POSTING_DISABLED: ${FEATURE_FLAGS.POSTING_DISABLED}`);
  console.log(`   DAILY_OPENAI_LIMIT_USD: $${FEATURE_FLAGS.DAILY_OPENAI_LIMIT_USD}`);
}