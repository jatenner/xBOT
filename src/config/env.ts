import { z } from "zod";

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
  
  // Feature Flags
  FEAT_AUTOPAUSE: z.string().optional(),
  ENABLE_METRICS_TRACKING: z.string().optional(),
  FORCE_POST: z.string().optional(),
  
  // System
  NODE_ENV: z.string().default("production"),
  PORT: z.string().default("8080"),
  HOST: z.string().default("0.0.0.0"),
  MODE: z.enum(["live", "shadow", "dry"]).optional().default("live"),
});

export const ENV = envSchema.parse(process.env);

// Typed helpers
export const isProduction = ENV.NODE_ENV === "production";
export const isDevelopment = ENV.NODE_ENV === "development";
export const isAutopauseEnabled = ENV.FEAT_AUTOPAUSE === "true";
export const isMetricsEnabled = ENV.ENABLE_METRICS_TRACKING === "true";
