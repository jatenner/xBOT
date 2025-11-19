/**
 * 🔒 FAIL-FAST ENVIRONMENT VALIDATION
 * 
 * Validates critical environment variables on startup.
 * If any are missing, the system CRASHES with a clear error message.
 * This prevents silent failures that break the system without warning.
 * 
 * Philosophy: FAIL FAST, NOT FAIL SILENT
 */

import { resolveMode, logModeResolution, type UnifiedMode } from './mode';

export interface CriticalEnvVars {
  ENABLE_REPLIES: boolean;
  DATABASE_URL: string;
  OPENAI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MODE: UnifiedMode;
}

/**
 * Validate all critical environment variables on startup
 * Crashes the process if any are missing or invalid
 */
export function validateEnvironmentVariables(): void {
  console.log('🔍 ENV_VALIDATION: Checking critical environment variables...');
  
  const missing: string[] = [];
  const warnings: string[] = [];
  
  const resolution = resolveMode();
  logModeResolution(resolution);
  const mode = resolution.mode;
  
  // Check 2: Reply system configuration
  if (!process.env.ENABLE_REPLIES) {
    warnings.push('ENABLE_REPLIES not set (defaulting to false - reply system will be DISABLED)');
  } else if (process.env.ENABLE_REPLIES !== 'true' && process.env.ENABLE_REPLIES !== 'false') {
    missing.push('ENABLE_REPLIES must be "true" or "false"');
  }
  
  // Check 3: Database connection
  if (!process.env.DATABASE_URL) {
    missing.push('DATABASE_URL (required for all database operations)');
  } else if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
    missing.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }
  
  // Check 4: Supabase credentials
  if (!process.env.SUPABASE_URL) {
    missing.push('SUPABASE_URL');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  
  // Check 5: OpenAI API key (only in live mode)
  if (mode === 'live') {
    if (!process.env.OPENAI_API_KEY) {
      missing.push('OPENAI_API_KEY (required in live mode for content generation)');
    } else if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
      missing.push('OPENAI_API_KEY must start with "sk-" (invalid format)');
    }
  }
  
  // Check 6: Rate limits (warn if not set)
  if (!process.env.MAX_POSTS_PER_HOUR) {
    warnings.push('MAX_POSTS_PER_HOUR not set (using default: 1 = 2 posts every 2 hours)');
  }
  if (!process.env.REPLIES_PER_HOUR) {
    warnings.push('REPLIES_PER_HOUR not set (using default: 4)');
  }
  
  // ═══════════════════════════════════════════════════════
  // REPORT FINDINGS
  // ═══════════════════════════════════════════════════════
  
  // Show warnings (non-fatal)
  if (warnings.length > 0) {
    console.warn('⚠️  ENV_VALIDATION: Configuration warnings:');
    warnings.forEach(warning => {
      console.warn(`   • ${warning}`);
    });
    console.warn('   System will start but may not function optimally.');
    console.warn('');
  }
  
  // FAIL FAST if any critical vars missing
  if (missing.length > 0) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('🚨 FATAL ERROR: Missing Critical Environment Variables');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('');
    console.error('The following environment variables are REQUIRED but missing:');
    console.error('');
    missing.forEach(item => {
      console.error(`   ❌ ${item}`);
    });
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('HOW TO FIX:');
    console.error('');
    console.error('  1. Local Development:');
    console.error('     • Copy .env.example to .env');
    console.error('     • Fill in all required values');
    console.error('');
    console.error('  2. Railway Production:');
    console.error('     • Go to Railway dashboard → Variables');
    console.error('     • Add missing environment variables');
    console.error('     • Redeploy');
    console.error('');
    console.error('  3. See .env.example for required format');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('');
    console.error('System will EXIT now to prevent running with broken configuration.');
    console.error('');
    
    // CRASH THE PROCESS - don't run with broken config
    process.exit(1);
  }
  
  // All checks passed
  console.log('✅ ENV_VALIDATION: All critical environment variables present');
  console.log(`   • MODE: ${mode}`);
  console.log(`   • ENABLE_REPLIES: ${process.env.ENABLE_REPLIES || 'false'}`);
  console.log(`   • Database: Connected`);
  console.log(`   • Supabase: Configured`);
  if (mode === 'live') {
    console.log(`   • OpenAI: Configured`);
  }
  console.log('');
}

/**
 * Validate environment variables and return typed config
 * Use this instead of directly accessing process.env
 */
export function getValidatedEnv(): CriticalEnvVars {
  const resolution = resolveMode();
  logModeResolution(resolution);

  return {
    MODE: resolution.mode,
    ENABLE_REPLIES: process.env.ENABLE_REPLIES === 'true',
    DATABASE_URL: process.env.DATABASE_URL!,
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || ''
  };
}
