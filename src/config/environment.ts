/**
 * 🔧 ENVIRONMENT VALIDATION
 * Centralized validation for all required environment variables
 */

interface EnvironmentConfig {
  // Cost logging
  COST_LOGGING_ENABLED: boolean;
  COST_LOGGING_MODE: 'rpc' | 'table';
  COST_LOGGING_RPC: string;
  COST_LOGGING_TABLE: string;
  
  // Redis / Smart cache
  SMART_CACHE_ENABLED: boolean;
  REDIS_DISABLE_CONFIG: boolean;
  SMART_CACHE_TTL_SEC: number;
  
  // Playwright/X hardening
  PLAYWRIGHT_NAV_TIMEOUT_MS: number;
  PLAYWRIGHT_REPLY_TIMEOUT_MS: number;
  PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS: number;
  PLAYWRIGHT_MAX_CONTEXT_RETRIES: number;
}

export const ENV: EnvironmentConfig = {
  // Cost logging
  COST_LOGGING_ENABLED: (process.env.COST_LOGGING_ENABLED ?? 'true') === 'true',
  COST_LOGGING_MODE: (process.env.COST_LOGGING_MODE ?? 'rpc') as 'rpc' | 'table',
  COST_LOGGING_RPC: process.env.COST_LOGGING_RPC ?? 'log_openai_usage',
  COST_LOGGING_TABLE: process.env.COST_LOGGING_TABLE ?? 'openai_usage_log',
  
  // Redis / Smart cache
  SMART_CACHE_ENABLED: (process.env.SMART_CACHE_ENABLED ?? 'true') === 'true',
  REDIS_DISABLE_CONFIG: (process.env.REDIS_DISABLE_CONFIG ?? 'true') === 'true',
  SMART_CACHE_TTL_SEC: parseInt(process.env.SMART_CACHE_TTL_SEC || '900', 10),
  
  // Playwright/X hardening
  PLAYWRIGHT_NAV_TIMEOUT_MS: parseInt(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS || '45000', 10),
  PLAYWRIGHT_REPLY_TIMEOUT_MS: parseInt(process.env.PLAYWRIGHT_REPLY_TIMEOUT_MS || '20000', 10),
  PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS: parseInt(process.env.PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS || '1200', 10),
  PLAYWRIGHT_MAX_CONTEXT_RETRIES: parseInt(process.env.PLAYWRIGHT_MAX_CONTEXT_RETRIES || '5', 10),
};

// Validation on module load
console.log('🔧 ENV_LOADED:', Object.keys(ENV));

// Export individual values for backward compatibility
export const {
  COST_LOGGING_ENABLED,
  COST_LOGGING_MODE,
  COST_LOGGING_RPC,
  COST_LOGGING_TABLE,
  SMART_CACHE_ENABLED,
  REDIS_DISABLE_CONFIG,
  SMART_CACHE_TTL_SEC,
  PLAYWRIGHT_NAV_TIMEOUT_MS,
  PLAYWRIGHT_REPLY_TIMEOUT_MS,
  PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS,
  PLAYWRIGHT_MAX_CONTEXT_RETRIES
} = ENV;