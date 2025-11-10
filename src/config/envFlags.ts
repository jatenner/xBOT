/**
 * Environment Flags - Single Source of Truth
 * Consolidated environment variable semantics with deprecation warnings
 */

import { resolveMode, type UnifiedMode } from './mode';

export type AppMode = UnifiedMode;

export interface EnvConfig {
  MODE: AppMode;
  REAL_METRICS_ENABLED: boolean;
  OPENAI_API_KEY: string;
  ADMIN_TOKEN: string;
  REDIS_URL: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export function getEnvConfig(): EnvConfig {
  const MODE = resolveMode().mode;
  
  return {
    MODE,
    REAL_METRICS_ENABLED: process.env.REAL_METRICS_ENABLED === 'true',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
    REDIS_URL: process.env.REDIS_URL || '',
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

export function isLLMAllowed(): { allowed: boolean; reason?: string } {
  const config = getEnvConfig();
  
  if (!config.OPENAI_API_KEY) {
    return { allowed: false, reason: 'OPENAI_API_KEY not set' };
  }
  
  if (process.env.AI_QUOTA_CIRCUIT_OPEN === 'true') {
    return { allowed: false, reason: 'AI_QUOTA_CIRCUIT_OPEN=true' };
  }
  
  return { allowed: true };
}

export function isPostingAllowed(): { allowed: boolean; reason?: string } {
  const config = getEnvConfig();
  
  if (config.MODE === 'shadow') {
    return { allowed: false, reason: 'MODE=shadow (no posting in shadow mode)' };
  }
  
  if (config.MODE === 'live') {
    return { allowed: true };
  }
  
  return { allowed: false, reason: 'Unknown mode' };
}

export function isRealMetricsAllowed(): { allowed: boolean; reason?: string } {
  const config = getEnvConfig();
  
  if (!config.REAL_METRICS_ENABLED) {
    return { allowed: false, reason: 'REAL_METRICS_ENABLED=false' };
  }
  
  return { allowed: true };
}

// Startup validation
export function validateEnvOrExit(): void {
  const config = getEnvConfig();
  const missing: string[] = [];
  const warnings: string[] = [];
  
  if (!config.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  if (!config.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!config.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!config.REDIS_URL) {
    warnings.push('REDIS_URL not set. Budget enforcement will use in-memory fallback (non-persistent).');
  }
  
  if (missing.length > 0) {
    console.error(`❌ FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  
  if (!config.ADMIN_TOKEN) {
    console.warn('⚠️ WARNING: ADMIN_TOKEN not set. Admin endpoints will be unavailable.');
  }
  warnings.forEach((warn) => console.warn(`⚠️ WARNING: ${warn}`));
  
  console.log(`✅ ENV_CONFIG: MODE=${config.MODE}, REAL_METRICS=${config.REAL_METRICS_ENABLED}`);
}
