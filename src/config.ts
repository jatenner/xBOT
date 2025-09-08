/**
 * Configuration Management for xBOT
 * Centralizes all environment variables and settings
 */

export interface Config {
  // App Settings
  appEnv: string;
  timezone: string;
  botTopic: string;
  dryRun: boolean;
  headless: boolean;
  
  // API Keys
  openaiApiKey: string;
  
  // Database
  supabaseUrl: string;
  supabaseAnonKey?: string;
  supabaseServiceRole: string;
  
  // Redis
  redisUrl: string;
  
  // Playwright/Twitter
  twitterSessionB64?: string;
  playwrightStoragePath?: string;
  
  // Rate Limits
  postsPerDay: number;
  repliesPerHour: number;
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnvVar(name: string, defaultValue?: string): string | undefined {
  return process.env[name] || defaultValue;
}

export const config: Config = {
  // App Settings
  appEnv: getEnvVar('APP_ENV', 'development'),
  timezone: getEnvVar('TIMEZONE', 'America/New_York'),
  botTopic: getEnvVar('BOT_TOPIC', 'health'),
  dryRun: process.env.DRY_RUN === '1',
  headless: process.env.HEADLESS !== 'false',
  
  // API Keys
  openaiApiKey: getEnvVar('OPENAI_API_KEY'),
  
  // Database
  supabaseUrl: getEnvVar('SUPABASE_URL'),
  supabaseAnonKey: getOptionalEnvVar('SUPABASE_ANON_KEY'),
  supabaseServiceRole: getEnvVar('SUPABASE_SERVICE_ROLE'),
  
  // Redis
  redisUrl: getEnvVar('REDIS_URL'),
  
  // Playwright/Twitter
  twitterSessionB64: getOptionalEnvVar('TWITTER_SESSION_B64'),
  playwrightStoragePath: getOptionalEnvVar('PLAYWRIGHT_STORAGE_PATH', 'playwright/storage.json'),
  
  // Rate Limits
  postsPerDay: parseInt(getEnvVar('POSTS_PER_DAY', '6')),
  repliesPerHour: parseInt(getEnvVar('REPLIES_PER_HOUR', '4'))
};

export default config;