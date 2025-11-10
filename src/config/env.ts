import { z } from "zod";
import { resolveMode, logModeResolution } from "./mode";

const envSchema = z.object({
  // Core Database
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().optional(),
  
  // OpenAI
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  
  // Redis (optional)
  REDIS_URL: z.string().optional(),
  
  // Twitter/X Session
  TWITTER_SESSION_B64: z.string().optional(),
  TWITTER_BEARER_TOKEN: z.string().optional(),
  TWITTER_USERNAME: z.string().optional(),
  
  // X API Credentials
  X_API_BEARER_TOKEN: z.string().optional(),
  X_API_CLIENT_ID: z.string().optional(),
  X_API_CLIENT_SECRET: z.string().optional(),
  X_API_ACCESS_TOKEN: z.string().optional(),
  X_API_ACCESS_TOKEN_SECRET: z.string().optional(),
  
  // Feature Flags
  FEAT_AUTOPAUSE: z.string().optional(),
  ENABLE_METRICS_TRACKING: z.string().optional(),
  FEATURE_X_API_POSTING: z.string().optional().default("false"),
  FORCE_POST: z.string().optional(),
  GRACE_MINUTES: z.string().optional(),
  MIN_POST_INTERVAL_MINUTES: z.string().optional(),
  VISUAL_INTELLIGENCE_ENABLED: z.string().optional().default("false"),
  
  // Observability
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional().default("production"),
  SENTRY_TRACES_SAMPLE_RATE: z.string().optional().default("0.1"),
  
  // System
  NODE_ENV: z.string().default("production"),
  PORT: z.string().default("8080"),
  HOST: z.string().default("0.0.0.0"),
  MODE: z.string().optional(),
});

const parsedEnv = envSchema.parse(process.env);
const modeResolution = resolveMode();
logModeResolution(modeResolution);

export const ENV = {
  ...parsedEnv,
  MODE: modeResolution.mode,
} as const;

// Typed helpers
export const isProduction = ENV.NODE_ENV === "production";
export const isDevelopment = ENV.NODE_ENV === "development";
export const isAutopauseEnabled = ENV.FEAT_AUTOPAUSE === "true";
export const isMetricsEnabled = ENV.ENABLE_METRICS_TRACKING === "true";
export const isVisualIntelligenceEnabled = ENV.VISUAL_INTELLIGENCE_ENABLED === "true";

// Backward compatibility exports (for files not yet refactored)
export const DATABASE_URL = ENV.DATABASE_URL;
export const SUPABASE_URL = ENV.SUPABASE_URL;
export const SUPABASE_SERVICE_ROLE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
export const SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY;
export const OPENAI_API_KEY = ENV.OPENAI_API_KEY;
export const OPENAI_MODEL = ENV.OPENAI_MODEL;
export const REDIS_URL = ENV.REDIS_URL;
export const TWITTER_SESSION_B64 = ENV.TWITTER_SESSION_B64;
export const TWITTER_BEARER_TOKEN = ENV.TWITTER_BEARER_TOKEN;
export const TWITTER_USERNAME = ENV.TWITTER_USERNAME;
export const X_API_BEARER_TOKEN = ENV.X_API_BEARER_TOKEN;
export const X_API_CLIENT_ID = ENV.X_API_CLIENT_ID;
export const X_API_CLIENT_SECRET = ENV.X_API_CLIENT_SECRET;
export const X_API_ACCESS_TOKEN = ENV.X_API_ACCESS_TOKEN;
export const X_API_ACCESS_TOKEN_SECRET = ENV.X_API_ACCESS_TOKEN_SECRET;
export const ENABLE_METRICS_TRACKING = ENV.ENABLE_METRICS_TRACKING === "true";
export const FEATURE_X_API_POSTING = ENV.FEATURE_X_API_POSTING === "true";
export const FORCE_POST = ENV.FORCE_POST === "true";
export const MIN_POST_INTERVAL_MINUTES = parseInt(ENV.MIN_POST_INTERVAL_MINUTES || "30");
export const GRACE_MINUTES = parseInt(ENV.GRACE_MINUTES || "5");
export const HOST = ENV.HOST;
export const PORT = parseInt(ENV.PORT);

// Legacy function for backward compatibility
export function getEnvConfig() {
  return {
    DATABASE_URL: ENV.DATABASE_URL,
    SUPABASE_URL: ENV.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: ENV.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: ENV.SUPABASE_ANON_KEY,
    OPENAI_API_KEY: ENV.OPENAI_API_KEY,
    OPENAI_MODEL: ENV.OPENAI_MODEL,
    REDIS_URL: ENV.REDIS_URL,
    TWITTER_SESSION_B64: ENV.TWITTER_SESSION_B64,
    ENABLE_METRICS_TRACKING: ENV.ENABLE_METRICS_TRACKING === "true",
    FEATURE_X_API_POSTING: ENV.FEATURE_X_API_POSTING === "true",
    X_API_BEARER_TOKEN: ENV.X_API_BEARER_TOKEN,
    X_API_ACCESS_TOKEN: ENV.X_API_ACCESS_TOKEN,
    X_API_ACCESS_TOKEN_SECRET: ENV.X_API_ACCESS_TOKEN_SECRET,
    FORCE_POST: ENV.FORCE_POST === "true",
    NODE_ENV: ENV.NODE_ENV,
    PORT: ENV.PORT,
    HOST: ENV.HOST,
    MODE: ENV.MODE,
  };
}

export function getSafeEnvironment() {
  return {
    NODE_ENV: ENV.NODE_ENV,
    MODE: ENV.MODE,
    PORT: ENV.PORT,
    HOST: ENV.HOST,
    hasDatabase: !!ENV.DATABASE_URL,
    hasOpenAI: !!ENV.OPENAI_API_KEY,
    hasRedis: !!ENV.REDIS_URL,
    hasTwitterSession: !!ENV.TWITTER_SESSION_B64,
  };
}
