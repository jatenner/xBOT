/**
 * Environment configuration with safe defaults
 */

export const config = {
  // Threading
  ENABLE_THREADS: process.env.ENABLE_THREADS?.toLowerCase() === 'true',
  
  // Posting controls
  FORCE_POST: process.env.FORCE_POST?.toLowerCase() === 'true',
  MIN_HOURS_BETWEEN_POSTS: Number(process.env.MIN_HOURS_BETWEEN_POSTS ?? 2),
  
  // Quality controls
  QUALITY_MIN_SCORE: Number(process.env.QUALITY_MIN_SCORE ?? 85),
  ALLOW_HASHTAGS: process.env.ALLOW_HASHTAGS?.toLowerCase() === 'true',
  
  // AI configuration
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  OPENAI_TEMPERATURE: Number(process.env.OPENAI_TEMPERATURE ?? 0.4),
  
  // Database
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  
  // Other
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 8080),
};

export function validateEnvironment(lenient = false): void {
  const required = [
    'OPENAI_API_KEY',
    'SUPABASE_URL', 
    'SUPABASE_SERVICE_ROLE_KEY' // Use the existing service role key
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    if (lenient) {
      console.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`);
      console.warn('⚠️ Some features may not work in dry run mode');
    } else {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}

export function logConfiguration(): void {
  console.log('🔧 Bot Configuration:');
  console.log(`   ENABLE_THREADS: ${config.ENABLE_THREADS}`);
  console.log(`   FORCE_POST: ${config.FORCE_POST}`);
  console.log(`   MIN_HOURS_BETWEEN_POSTS: ${config.MIN_HOURS_BETWEEN_POSTS}`);
  console.log(`   QUALITY_MIN_SCORE: ${config.QUALITY_MIN_SCORE}`);
  console.log(`   ALLOW_HASHTAGS: ${config.ALLOW_HASHTAGS}`);
  console.log(`   OPENAI_MODEL: ${config.OPENAI_MODEL}`);
  console.log(`   NODE_ENV: ${config.NODE_ENV}`);
}
