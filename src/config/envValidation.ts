/**
 * 🔍 ENVIRONMENT VARIABLE VALIDATION
 * 
 * Validates environment variables on startup and warns about common mistakes
 */

/**
 * Validate environment variables and warn about deprecated/incorrect ones
 */
export function validateEnvironmentVariables(): void {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // ========================================
  // REPLY SYSTEM VALIDATION
  // ========================================
  
  // Check for deprecated ENABLE_REPLY_BOT (should be ENABLE_REPLIES)
  if (process.env.ENABLE_REPLY_BOT !== undefined) {
    warnings.push(`⚠️  DEPRECATED: ENABLE_REPLY_BOT is no longer used`);
    warnings.push(`   → Use ENABLE_REPLIES=true instead`);
    warnings.push(`   → Current reply status: ${process.env.ENABLE_REPLIES === 'true' ? 'ENABLED' : 'DISABLED'}`);
  }
  
  // Check if replies are enabled
  if (process.env.ENABLE_REPLIES === 'true') {
    console.log('✅ REPLIES: Enabled (ENABLE_REPLIES=true)');
  } else if (process.env.ENABLE_REPLIES === 'false') {
    console.log('⚠️  REPLIES: Explicitly disabled (ENABLE_REPLIES=false)');
  } else if (process.env.ENABLE_REPLIES === undefined) {
    warnings.push(`⚠️  REPLIES: ENABLE_REPLIES not set (defaulting to disabled)`);
    warnings.push(`   → Set ENABLE_REPLIES=true to enable reply system`);
  }
  
  // ========================================
  // OTHER VALIDATIONS
  // ========================================
  
  // Check for MODE setting
  if (!process.env.MODE) {
    warnings.push(`⚠️  MODE not set (defaulting to 'shadow' mode)`);
    warnings.push(`   → Set MODE=live for production`);
  }
  
  // Check for required API keys in live mode
  if (process.env.MODE === 'live' && !process.env.OPENAI_API_KEY) {
    errors.push(`❌ CRITICAL: MODE=live but OPENAI_API_KEY not set`);
    errors.push(`   → AI content generation will fail`);
  }
  
  // ========================================
  // PRINT RESULTS
  // ========================================
  
  if (warnings.length > 0) {
    console.log('');
    console.log('════════════════════════════════════════');
    console.log('  ⚠️  ENVIRONMENT VARIABLE WARNINGS');
    console.log('════════════════════════════════════════');
    warnings.forEach(w => console.log(w));
    console.log('════════════════════════════════════════');
    console.log('');
  }
  
  if (errors.length > 0) {
    console.log('');
    console.log('════════════════════════════════════════');
    console.log('  ❌ ENVIRONMENT VARIABLE ERRORS');
    console.log('════════════════════════════════════════');
    errors.forEach(e => console.log(e));
    console.log('════════════════════════════════════════');
    console.log('');
    throw new Error('Environment validation failed - fix errors above');
  }
}

/**
 * Get canonical environment variable names
 */
export const CANONICAL_ENV_VARS = {
  // Reply system
  ENABLE_REPLIES: 'ENABLE_REPLIES', // ✅ Correct
  
  // Deprecated (DO NOT USE)
  DEPRECATED: {
    ENABLE_REPLY_BOT: 'Use ENABLE_REPLIES instead',
  }
} as const;

