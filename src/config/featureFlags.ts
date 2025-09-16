/**
 * Feature Flags - Control costly operations in production
 * Centralized feature flag management for budget control and resilience
 */

export interface FeatureFlags {
  PIPELINE_TEST_ENABLED: boolean;
  ALLOW_FALLBACK_GENERATION: boolean;
  ALLOW_LLM_CACHE_WARMUP: boolean;
  POSTING_DISABLED: boolean;
  POSTING_ENABLED: boolean;
  AI_QUOTA_CIRCUIT_OPEN: boolean;
  AI_COOLDOWN_MINUTES: number;
  LEARNING_DEBOUNCE_MINUTES: number;
  DAILY_OPENAI_LIMIT_USD: number;
  MIGRATIONS_RUNTIME_ENABLED: boolean;
  OPENAI_ORG?: string;
  OPENAI_PROJECT?: string;
  ALERT_WEBHOOK_URL?: string;
}

export const FEATURE_FLAGS: FeatureFlags = {
  PIPELINE_TEST_ENABLED: process.env.PIPELINE_TESTS_ENABLED === 'true',
  ALLOW_FALLBACK_GENERATION: process.env.ALLOW_FALLBACK_GENERATION === 'true',
  ALLOW_LLM_CACHE_WARMUP: process.env.ALLOW_LLM_CACHE_WARMUP === 'true',
  POSTING_DISABLED: process.env.POSTING_DISABLED === 'true',
  POSTING_ENABLED: process.env.POSTING_ENABLED !== 'false',
  AI_QUOTA_CIRCUIT_OPEN: process.env.AI_QUOTA_CIRCUIT_OPEN === 'true',
  AI_COOLDOWN_MINUTES: parseInt(process.env.AI_COOLDOWN_MINUTES || '60', 10),
  LEARNING_DEBOUNCE_MINUTES: parseInt(process.env.LEARNING_DEBOUNCE_MINUTES || '60', 10),
  DAILY_OPENAI_LIMIT_USD: parseFloat(process.env.DAILY_OPENAI_LIMIT_USD || '5.0'),
  MIGRATIONS_RUNTIME_ENABLED: process.env.MIGRATIONS_RUNTIME_ENABLED !== 'false',
  OPENAI_ORG: process.env.OPENAI_ORG,
  OPENAI_PROJECT: process.env.OPENAI_PROJECT,
  ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL
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
  console.log(`   POSTING_ENABLED: ${FEATURE_FLAGS.POSTING_ENABLED}`);
  console.log(`   AI_QUOTA_CIRCUIT_OPEN: ${FEATURE_FLAGS.AI_QUOTA_CIRCUIT_OPEN}`);
  console.log(`   AI_COOLDOWN_MINUTES: ${FEATURE_FLAGS.AI_COOLDOWN_MINUTES}`);
  console.log(`   LEARNING_DEBOUNCE_MINUTES: ${FEATURE_FLAGS.LEARNING_DEBOUNCE_MINUTES}`);
  console.log(`   DAILY_OPENAI_LIMIT_USD: $${FEATURE_FLAGS.DAILY_OPENAI_LIMIT_USD}`);
  console.log(`   MIGRATIONS_RUNTIME_ENABLED: ${FEATURE_FLAGS.MIGRATIONS_RUNTIME_ENABLED}`);
  if (FEATURE_FLAGS.ALERT_WEBHOOK_URL) {
    console.log(`   ALERT_WEBHOOK_URL: configured`);
  }
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