/**
 * Centralized environment configuration with validation
 */

// Core posting controls
export const MIN_POST_INTERVAL_MINUTES = parseInt(process.env.MIN_POST_INTERVAL_MINUTES || '5', 10);
export const MAX_DAILY_POSTS = parseInt(process.env.MAX_DAILY_POSTS || '12', 10);
export const FORCE_POST = process.env.FORCE_POST === 'true';

// Feature toggles
export const ENABLE_METRICS_TRACKING = (process.env.ENABLE_METRICS_TRACKING || 'true') === 'true';
export const ENABLE_THREADS = process.env.ENABLE_THREADS !== 'false';
export const LIVE_POSTS_ENABLED = process.env.LIVE_POSTS !== 'false';

// Content quality settings
export const MIN_QUALITY_SCORE = parseInt(process.env.MIN_QUALITY_SCORE || '75', 10);
export const MAX_REGENERATION_ATTEMPTS = parseInt(process.env.MAX_REGENERATION_ATTEMPTS || '3', 10);

// Thread configuration
export const THREAD_MIN_TWEETS = parseInt(process.env.THREAD_MIN_TWEETS || '5', 10);
export const THREAD_MAX_TWEETS = parseInt(process.env.THREAD_MAX_TWEETS || '9', 10);
export const TWEET_MAX_CHARS = parseInt(process.env.TWEET_MAX_CHARS || '279', 10);

// OpenAI configuration
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
export const OPENAI_TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE || '0.4');
export const OPENAI_TOP_P = parseFloat(process.env.OPENAI_TOP_P || '0.9');
export const OPENAI_PRESENCE_PENALTY = parseFloat(process.env.OPENAI_PRESENCE_PENALTY || '0.3');
export const OPENAI_FREQUENCY_PENALTY = parseFloat(process.env.OPENAI_FREQUENCY_PENALTY || '0.4');

// Database configuration
export const DATABASE_URL = process.env.DATABASE_URL;
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Redis configuration
export const REDIS_URL = process.env.REDIS_URL;

// Server configuration
export const PORT = parseInt(process.env.PORT || '8080', 10);
export const HOST = process.env.HOST || '0.0.0.0';

// Validation
export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required');
  }

  if (!SUPABASE_URL) {
    errors.push('SUPABASE_URL is required');
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  if (!DATABASE_URL && !SUPABASE_URL) {
    errors.push('Either DATABASE_URL or SUPABASE_URL is required');
  }

  // Validate database URL doesn't use local sockets
  if (DATABASE_URL && (DATABASE_URL.includes('localhost') || DATABASE_URL.includes('/tmp/'))) {
    console.warn('WARNING: DATABASE_URL appears to use localhost/socket. Ensure sslmode=require for remote connections.');
  }

  if (MIN_POST_INTERVAL_MINUTES < 1) {
    errors.push('MIN_POST_INTERVAL_MINUTES must be at least 1');
  }

  if (MIN_QUALITY_SCORE < 0 || MIN_QUALITY_SCORE > 100) {
    errors.push('MIN_QUALITY_SCORE must be between 0 and 100');
  }

  if (THREAD_MIN_TWEETS < 1 || THREAD_MAX_TWEETS < THREAD_MIN_TWEETS) {
    errors.push('Invalid thread tweet count configuration');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Safe environment export (no secrets)
export function getSafeEnvironment() {
  return {
    minPostIntervalMinutes: MIN_POST_INTERVAL_MINUTES,
    maxDailyPosts: MAX_DAILY_POSTS,
    forcePost: FORCE_POST,
    enableMetricsTracking: ENABLE_METRICS_TRACKING,
    enableThreads: ENABLE_THREADS,
    livePostsEnabled: LIVE_POSTS_ENABLED,
    minQualityScore: MIN_QUALITY_SCORE,
    threadMinTweets: THREAD_MIN_TWEETS,
    threadMaxTweets: THREAD_MAX_TWEETS,
    tweetMaxChars: TWEET_MAX_CHARS,
    openaiModel: OPENAI_MODEL,
    openaiTemperature: OPENAI_TEMPERATURE,
    hasOpenaiKey: !!process.env.OPENAI_API_KEY,
    hasSupabaseUrl: !!SUPABASE_URL,
    hasRedisUrl: !!REDIS_URL,
    port: PORT,
    host: HOST
  };
}
