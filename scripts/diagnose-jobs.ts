#!/usr/bin/env tsx
/**
 * Quick diagnostic: Check why jobs aren't running
 */

import { config } from 'dotenv';
config();

console.log('═══════════════════════════════════════════════════════════════');
console.log('DIAGNOSTIC: WHY JOBS ARENT RUNNING');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('ENVIRONMENT VARIABLES:');
console.log('  MODE:', process.env.MODE || 'NOT SET (defaults to "live")');
console.log('  DISABLE_POSTING:', process.env.DISABLE_POSTING || 'NOT SET');
console.log('  ENABLE_REPLIES:', process.env.ENABLE_REPLIES || 'NOT SET (defaults to true)');
console.log('');

// Import and check feature flags
console.log('FEATURE FLAGS (computed from env):');
try {
  const { flags } = await import('../src/config/featureFlags.js');
  console.log('  mode:', flags.mode);
  console.log('  postingEnabled:', flags.postingEnabled);
  console.log('  plannerEnabled:', flags.plannerEnabled);
  console.log('  replyEnabled:', flags.replyEnabled);
  console.log('');
  
  console.log('DIAGNOSIS:');
  if (flags.postingEnabled) {
    console.log('  ✅ postingEnabled = true (jobs SHOULD start)');
  } else {
    console.log('  ❌ postingEnabled = false (jobs will NOT start)');
    console.log('  🔧 FIX: Set MODE=live in Railway env vars');
  }
} catch (error: any) {
  console.error('Error loading feature flags:', error.message);
}

console.log('\n═══════════════════════════════════════════════════════════════');

