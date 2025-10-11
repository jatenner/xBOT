/**
 * Environment Configuration
 * Includes feature flags for posting methods and all required exports
 */

export interface EnvConfig {
  // Database
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  
  // OpenAI
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  
  // Redis
  REDIS_URL?: string;
  
  // Twitter/X
  TWITTER_SESSION_B64?: string;
  
  // Feature Flags
  FEATURE_X_API_POSTING: boolean;
  ENABLE_METRICS_TRACKING: boolean;
  
  // X API Credentials (when FEATURE_X_API_POSTING is enabled)
  X_API_BEARER_TOKEN?: string;
  X_API_CLIENT_ID?: string;
  X_API_CLIENT_SECRET?: string;
  X_API_ACCESS_TOKEN?: string;
  X_API_ACCESS_TOKEN_SECRET?: string;
  
  // Posting Configuration
  MIN_POST_INTERVAL_MINUTES: number;
  FORCE_POST: boolean;
  
  // System
  MODE: 'live' | 'shadow' | 'dry';
  NODE_ENV: string;
  HOST: string;
  PORT: number;
}

export function getEnvConfig(): EnvConfig {
  return {
    // Database
    DATABASE_URL: process.env.DATABASE_URL || '',
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    
    // OpenAI
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    
    // Redis
    REDIS_URL: process.env.REDIS_URL,
    
    // Twitter/X
    TWITTER_SESSION_B64: process.env.TWITTER_SESSION_B64,
    
    // Feature Flags
    FEATURE_X_API_POSTING: process.env.FEATURE_X_API_POSTING === 'true',
    ENABLE_METRICS_TRACKING: process.env.ENABLE_METRICS_TRACKING === 'true',
    
    // X API Credentials
    X_API_BEARER_TOKEN: process.env.X_API_BEARER_TOKEN,
    X_API_CLIENT_ID: process.env.X_API_CLIENT_ID,
    X_API_CLIENT_SECRET: process.env.X_API_CLIENT_SECRET,
    X_API_ACCESS_TOKEN: process.env.X_API_ACCESS_TOKEN,
    X_API_ACCESS_TOKEN_SECRET: process.env.X_API_ACCESS_TOKEN_SECRET,
    
    // Posting Configuration
    MIN_POST_INTERVAL_MINUTES: parseInt(process.env.MIN_POST_INTERVAL_MINUTES || '30'),
    FORCE_POST: process.env.FORCE_POST === 'true',
    
    // System
    MODE: (process.env.MODE as any) || 'live',
    NODE_ENV: process.env.NODE_ENV || 'development',
    HOST: process.env.HOST || '0.0.0.0',
    PORT: parseInt(process.env.PORT || '8080')
  };
}

// Export individual variables for backward compatibility
const config = getEnvConfig();

export const DATABASE_URL = config.DATABASE_URL;
export const SUPABASE_URL = config.SUPABASE_URL;
export const SUPABASE_SERVICE_ROLE_KEY = config.SUPABASE_SERVICE_ROLE_KEY;
export const ENABLE_METRICS_TRACKING = config.ENABLE_METRICS_TRACKING;
export const MIN_POST_INTERVAL_MINUTES = config.MIN_POST_INTERVAL_MINUTES;
export const REDIS_URL = config.REDIS_URL;
export const FORCE_POST = config.FORCE_POST;
export const HOST = config.HOST;
export const PORT = config.PORT;

// Safe environment function for backward compatibility
export function getSafeEnvironment() {
  const env = getEnvConfig();
  return {
    NODE_ENV: env.NODE_ENV,
    MODE: env.MODE,
    PORT: env.PORT,
    HOST: env.HOST,
    hasDatabase: !!env.DATABASE_URL,
    hasOpenAI: !!env.OPENAI_API_KEY,
    hasRedis: !!env.REDIS_URL,
    hasTwitterSession: !!env.TWITTER_SESSION_B64,
    hasXApiCredentials: !!env.X_API_BEARER_TOKEN,
    featureXApiPosting: env.FEATURE_X_API_POSTING
  };
}