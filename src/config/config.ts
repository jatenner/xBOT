/**
 * 🔧 UNIFIED CONFIGURATION SYSTEM
 * Single source of truth for all xBOT configuration with MODE-based switching
 */

import { z } from 'zod';

// Core mode enum
const ModeSchema = z.enum(['shadow', 'live']);
export type Mode = z.infer<typeof ModeSchema>;

// Unified configuration schema
const ConfigSchema = z.object({
  // Core mode switch
  MODE: ModeSchema,
  NODE_ENV: z.string().default('development'),
  PORT: z.number().default(8080),
  
  // Database & Storage
  DATABASE_URL: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  REDIS_URL: z.string().optional(),
  
  // AI Services (only used in live mode)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  EMBED_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_TEMPERATURE: z.number().min(0).max(2).default(0.7),
  OPENAI_TOP_P: z.number().min(0).max(1).default(1.0),
  
  // AI Budget Controls
  DAILY_OPENAI_LIMIT_USD: z.number().default(5.0),
  BUDGET_STRICT: z.boolean().default(false),
  DISABLE_LLM_WHEN_BUDGET_HIT: z.boolean().default(false),
  
  // Learning Parameters
  EXPLORE_RATIO_MIN: z.number().min(0).max(1).default(0.1),
  EXPLORE_RATIO_MAX: z.number().min(0).max(1).default(0.3),
  MIN_QUALITY_SCORE: z.number().min(0).max(1).default(0.7),
  DUP_COSINE_THRESHOLD: z.number().min(0).max(1).default(0.9),
  SIMILARITY_THRESHOLD: z.number().min(0).max(1).default(0.9),
  
  // Job Scheduling - AGGRESSIVE GROWTH SETTINGS
  JOBS_AUTOSTART: z.boolean().default(true), // Auto-start jobs
  JOBS_PLAN_INTERVAL_MIN: z.number().default(15), // Plan content every 15 minutes (4x per hour)
  JOBS_REPLY_INTERVAL_MIN: z.number().default(20), // Check for replies every 20 minutes (3 per hour)
  JOBS_LEARN_INTERVAL_MIN: z.number().default(60), // Learn more frequently
  JOBS_POSTING_INTERVAL_MIN: z.number().default(5), // Check posting queue every 5 minutes
  
  // Rate Limits - AGGRESSIVE GROWTH
  MAX_POSTS_PER_HOUR: z.number().default(2), // 2 posts per hour
  MAX_DAILY_POSTS: z.number().default(48), // 2 per hour * 24 hours
  
  // Security
  ADMIN_TOKEN: z.string().default('dev-admin-token')
});

export type Config = z.infer<typeof ConfigSchema>;

// Legacy environment variable mappings for backward compatibility
const LEGACY_MAPPINGS: Record<string, { env: string; description: string }> = {
  POSTING_DISABLED: { env: 'POSTING_DISABLED', description: 'Use MODE=shadow instead' },
  DRY_RUN: { env: 'DRY_RUN', description: 'Use MODE=shadow instead' },
  ENABLE_BANDIT_LEARNING: { env: 'ENABLE_BANDIT_LEARNING', description: 'Always enabled, controlled by MODE' },
  STARTUP_ACCEPTANCE_ENABLED: { env: 'STARTUP_ACCEPTANCE_ENABLED', description: 'Use MODE=shadow for testing' },
  THREAD_PIPELINE_ONLY: { env: 'THREAD_PIPELINE_ONLY', description: 'No longer needed' },
  ENABLE_REAL_TIME_ANALYTICS: { env: 'ENABLE_REAL_TIME_ANALYTICS', description: 'Always enabled' },
  BOT_PHASE: { env: 'BOT_PHASE', description: 'Use MODE instead' },
  DEPLOYMENT_MODE: { env: 'DEPLOYMENT_MODE', description: 'Use NODE_ENV instead' },
  LIVE_POSTING_ENABLED: { env: 'LIVE_POSTING_ENABLED', description: 'Use MODE=live instead' },
  STRATEGIST_USAGE_RATE: { env: 'STRATEGIST_USAGE_RATE', description: 'Always 1.0 in live mode, synthetic in shadow' }
};

/**
 * Load and validate configuration from environment
 */
export function loadConfig(): Config {
  // Infer MODE from legacy flags if not set
  let mode: Mode = 'shadow'; // Default to safe mode
  
  if (process.env.MODE) {
    mode = process.env.MODE as Mode;
  } else if (process.env.POSTING_DISABLED === 'false' && process.env.DRY_RUN === 'false') {
    mode = 'live';
  } else if (process.env.POSTING_DISABLED === 'true' || process.env.DRY_RUN === 'true') {
    mode = 'shadow';
  }

  const rawConfig = {
    MODE: mode,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT ? parseInt(process.env.PORT) : undefined,
    
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    REDIS_URL: process.env.REDIS_URL,
    
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    EMBED_MODEL: process.env.EMBED_MODEL,
    OPENAI_TEMPERATURE: process.env.OPENAI_TEMPERATURE ? parseFloat(process.env.OPENAI_TEMPERATURE) : undefined,
    OPENAI_TOP_P: process.env.OPENAI_TOP_P ? parseFloat(process.env.OPENAI_TOP_P) : undefined,
    
    DAILY_OPENAI_LIMIT_USD: process.env.DAILY_OPENAI_LIMIT_USD ? parseFloat(process.env.DAILY_OPENAI_LIMIT_USD) : undefined,
    BUDGET_STRICT: process.env.BUDGET_STRICT === 'true',
    DISABLE_LLM_WHEN_BUDGET_HIT: process.env.DISABLE_LLM_WHEN_BUDGET_HIT === 'true',
    
    EXPLORE_RATIO_MIN: process.env.EXPLORE_RATIO_MIN ? parseFloat(process.env.EXPLORE_RATIO_MIN) : undefined,
    EXPLORE_RATIO_MAX: process.env.EXPLORE_RATIO_MAX ? parseFloat(process.env.EXPLORE_RATIO_MAX) : undefined,
    MIN_QUALITY_SCORE: process.env.MIN_QUALITY_SCORE ? parseFloat(process.env.MIN_QUALITY_SCORE) : undefined,
    DUP_COSINE_THRESHOLD: process.env.DUP_COSINE_THRESHOLD ? parseFloat(process.env.DUP_COSINE_THRESHOLD) : undefined,
    SIMILARITY_THRESHOLD: process.env.SIMILARITY_THRESHOLD ? parseFloat(process.env.SIMILARITY_THRESHOLD) : undefined,
    
    JOBS_AUTOSTART: process.env.JOBS_AUTOSTART === 'true',
    JOBS_PLAN_INTERVAL_MIN: process.env.JOBS_PLAN_INTERVAL_MIN ? parseInt(process.env.JOBS_PLAN_INTERVAL_MIN) : undefined,
    JOBS_REPLY_INTERVAL_MIN: process.env.JOBS_REPLY_INTERVAL_MIN ? parseInt(process.env.JOBS_REPLY_INTERVAL_MIN) : undefined,
    JOBS_LEARN_INTERVAL_MIN: process.env.JOBS_LEARN_INTERVAL_MIN ? parseInt(process.env.JOBS_LEARN_INTERVAL_MIN) : undefined,
    JOBS_POSTING_INTERVAL_MIN: process.env.JOBS_POSTING_INTERVAL_MIN ? parseInt(process.env.JOBS_POSTING_INTERVAL_MIN) : undefined,
    
    MAX_POSTS_PER_HOUR: process.env.MAX_POSTS_PER_HOUR ? parseInt(process.env.MAX_POSTS_PER_HOUR) : undefined,
    REPLY_MAX_PER_DAY: process.env.REPLY_MAX_PER_DAY ? parseInt(process.env.REPLY_MAX_PER_DAY) : undefined,
    
    ADMIN_TOKEN: process.env.ADMIN_TOKEN
  };

  try {
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    console.error('❌ Configuration validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  • ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw new Error('Invalid configuration');
  }
}

/**
 * Print configuration summary on startup
 */
export function printConfigSummary(config: Config): void {
  console.log('🔧 CONFIG_SUMMARY:');
  console.log(`   • Mode: ${config.MODE.toUpperCase()}`);
  console.log(`   • Environment: ${config.NODE_ENV}`);
  console.log(`   • Port: ${config.PORT}`);
  console.log(`   • Jobs Autostart: ${config.JOBS_AUTOSTART ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   • OpenAI: ${config.OPENAI_API_KEY ? 'CONFIGURED' : 'NOT_SET'}`);
  console.log(`   • Redis: ${config.REDIS_URL ? 'CONFIGURED' : 'NOT_SET'}`);
  
  if (config.MODE === 'shadow') {
    console.log('   • Shadow Mode: Synthetic generation, no posting, simulated outcomes');
  } else {
    console.log('   • Live Mode: Real LLM calls, actual posting enabled');
  }
}

/**
 * Print deprecation warnings for legacy environment variables
 */
export function printDeprecationWarnings(): void {
  const deprecatedVars = Object.keys(LEGACY_MAPPINGS).filter(key => process.env[key]);
  
  if (deprecatedVars.length > 0) {
    console.log('⚠️ DEPRECATION_WARNINGS:');
    deprecatedVars.forEach(varName => {
      const mapping = LEGACY_MAPPINGS[varName];
      console.log(`   • ${varName}: ${mapping.description}`);
    });
    console.log('   These legacy variables are ignored but do not break startup.');
  }
}

/**
 * Get mode-aware behavior flags
 */
export function getModeFlags(config: Config) {
  const isShadow = config.MODE === 'shadow';
  
  return {
    // Posting behavior
    postingDisabled: isShadow,
    dryRun: isShadow,
    
    // AI usage
    useRealLLM: !isShadow && !!config.OPENAI_API_KEY,
    useSyntheticGeneration: isShadow,
    
    // Learning behavior
    simulateOutcomes: isShadow,
    enableRealOutcomes: !isShadow,
    
    // Safety
    enforceQualityGate: true, // Always enabled
    enableUniquenessGate: true, // Always enabled
    
    // Jobs
    enableJobScheduling: config.JOBS_AUTOSTART
  };
}

// Global configuration instance
let globalConfig: Config | null = null;

/**
 * Get or load global configuration
 */
export function getConfig(): Config {
  if (!globalConfig) {
    globalConfig = loadConfig();
  }
  return globalConfig;
}

/**
 * Export for endpoint access (with secrets redacted)
 */
export function getRedactedConfig(config: Config): Partial<Config> {
  return {
    MODE: config.MODE,
    NODE_ENV: config.NODE_ENV,
    PORT: config.PORT,
    EXPLORE_RATIO_MIN: config.EXPLORE_RATIO_MIN,
    EXPLORE_RATIO_MAX: config.EXPLORE_RATIO_MAX,
    MIN_QUALITY_SCORE: config.MIN_QUALITY_SCORE,
    JOBS_AUTOSTART: config.JOBS_AUTOSTART,
    JOBS_PLAN_INTERVAL_MIN: config.JOBS_PLAN_INTERVAL_MIN,
    JOBS_REPLY_INTERVAL_MIN: config.JOBS_REPLY_INTERVAL_MIN,
    JOBS_LEARN_INTERVAL_MIN: config.JOBS_LEARN_INTERVAL_MIN,
    // Secrets redacted
    DATABASE_URL: config.DATABASE_URL ? '[REDACTED]' : undefined,
    SUPABASE_URL: config.SUPABASE_URL ? '[REDACTED]' : undefined,
    SUPABASE_SERVICE_ROLE_KEY: '[REDACTED]',
    REDIS_URL: config.REDIS_URL ? '[REDACTED]' : undefined,
    OPENAI_API_KEY: config.OPENAI_API_KEY ? '[REDACTED]' : undefined,
    ADMIN_TOKEN: '[REDACTED]'
  };
}
