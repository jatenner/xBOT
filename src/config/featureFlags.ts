/**
 * Feature Flags - Control costly operations in production
 * Centralized feature flag management for budget control
 */

export interface FeatureFlags {
  PIPELINE_TEST_ENABLED: boolean;
  ALLOW_FALLBACK_GENERATION: boolean;
  ALLOW_LLM_CACHE_WARMUP: boolean;
  POSTING_DISABLED: boolean;
  DAILY_OPENAI_LIMIT_USD: number;
}

export const FEATURE_FLAGS: FeatureFlags = {
  PIPELINE_TEST_ENABLED: process.env.PIPELINE_TESTS_ENABLED === 'true',
  ALLOW_FALLBACK_GENERATION: process.env.ALLOW_FALLBACK_GENERATION === 'true',
  ALLOW_LLM_CACHE_WARMUP: process.env.ALLOW_LLM_CACHE_WARMUP === 'true',
  POSTING_DISABLED: process.env.POSTING_DISABLED === 'true',
  DAILY_OPENAI_LIMIT_USD: parseFloat(process.env.DAILY_OPENAI_LIMIT_USD || '5.0')
};

/**
 * Log feature flags at startup for visibility
 */
export function logFeatureFlags(): void {
  console.log('🏁 FEATURE_FLAGS:');
  console.log(`   PIPELINE_TEST_ENABLED: ${FEATURE_FLAGS.PIPELINE_TEST_ENABLED}`);
  console.log(`   ALLOW_FALLBACK_GENERATION: ${FEATURE_FLAGS.ALLOW_FALLBACK_GENERATION}`);
  console.log(`   ALLOW_LLM_CACHE_WARMUP: ${FEATURE_FLAGS.ALLOW_LLM_CACHE_WARMUP}`);
  console.log(`   POSTING_DISABLED: ${FEATURE_FLAGS.POSTING_DISABLED}`);
  console.log(`   DAILY_OPENAI_LIMIT_USD: $${FEATURE_FLAGS.DAILY_OPENAI_LIMIT_USD}`);
}

/**
 * Check if a feature flag allows operation to proceed
 */
export function checkFeatureFlag(flag: keyof FeatureFlags): boolean {
  return FEATURE_FLAGS[flag] as boolean;
}

/**
 * Guard function that throws if feature is disabled
 */
export function guardFeatureFlag(flag: keyof FeatureFlags, operation: string): void {
  if (!checkFeatureFlag(flag)) {
    throw new Error(`Feature disabled: ${operation} (${flag}=false)`);
  }
}