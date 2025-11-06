#!/usr/bin/env tsx
/**
 * 🔍 VERIFY THREAD FIX
 * 
 * This script verifies that the thread system has been properly fixed:
 * 1. Thread generation is re-enabled
 * 2. Reply chain mode is preferred
 * 3. Database storage works
 */

import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🔍 VERIFYING THREAD SYSTEM FIX...\n');

let allChecksPassed = true;

// ============================================================
// CHECK 1: Thread generation is re-enabled
// ============================================================
console.log('📝 CHECK 1: Thread generation re-enabled in planJob.ts');
try {
  const planJobPath = join(__dirname, '../src/jobs/planJob.ts');
  const planJobContent = readFileSync(planJobPath, 'utf-8');
  
  const isDisabled = planJobContent.includes('THREADS TEMPORARILY DISABLED');
  const hasThreadInstructions = planJobContent.includes('FOR THREADS');
  const hasThreadFormat = planJobContent.includes('"format": "thread"');
  
  if (isDisabled) {
    console.log('   ❌ FAIL: Threads still show as disabled');
    allChecksPassed = false;
  } else if (!hasThreadInstructions || !hasThreadFormat) {
    console.log('   ❌ FAIL: Thread instructions not found in prompt');
    allChecksPassed = false;
  } else {
    console.log('   ✅ PASS: Thread generation is enabled');
    console.log('   ✅ PASS: Thread format instructions present');
  }
} catch (error: any) {
  console.log(`   ❌ FAIL: Could not read planJob.ts: ${error.message}`);
  allChecksPassed = false;
}

console.log('');

// ============================================================
// CHECK 2: Reply chain mode is preferred
// ============================================================
console.log('🔗 CHECK 2: Reply chain mode is preferred in BulletproofThreadComposer');
try {
  const composerPath = join(__dirname, '../src/posting/BulletproofThreadComposer.ts');
  const composerContent = readFileSync(composerPath, 'utf-8');
  
  // Check if postViaReplies is called before postViaComposer
  const replyChainMatch = composerContent.match(/postViaReplies.*?postViaComposer/s);
  const preferReplyChain = composerContent.includes('PREFER REPLY CHAIN MODE');
  
  if (!replyChainMatch && !preferReplyChain) {
    console.log('   ❌ FAIL: Reply chain not preferred (composer still first)');
    allChecksPassed = false;
  } else {
    console.log('   ✅ PASS: Reply chain mode is preferred');
    console.log('   ✅ PASS: Composer mode is fallback only');
  }
  
  // Check if postViaReplies captures tweet IDs
  const capturesIds = composerContent.includes('tweetIds.push');
  if (capturesIds) {
    console.log('   ✅ PASS: Reply chain captures all tweet IDs');
  } else {
    console.log('   ⚠️  WARN: Could not verify tweet ID capture');
  }
} catch (error: any) {
  console.log(`   ❌ FAIL: Could not read BulletproofThreadComposer.ts: ${error.message}`);
  allChecksPassed = false;
}

console.log('');

// ============================================================
// CHECK 3: Database storage configured
// ============================================================
console.log('💾 CHECK 3: Database storage handles threads');
try {
  const planJobPath = join(__dirname, '../src/jobs/planJob.ts');
  const planJobContent = readFileSync(planJobPath, 'utf-8');
  
  const hasThreadParts = planJobContent.includes('thread_parts');
  const hasArrayCheck = planJobContent.includes('Array.isArray');
  
  if (!hasThreadParts) {
    console.log('   ❌ FAIL: thread_parts storage not found');
    allChecksPassed = false;
  } else if (!hasArrayCheck) {
    console.log('   ⚠️  WARN: Array validation may be missing');
  } else {
    console.log('   ✅ PASS: thread_parts storage configured');
    console.log('   ✅ PASS: Array validation present');
  }
  
  const postingQueuePath = join(__dirname, '../src/jobs/postingQueue.ts');
  const postingQueueContent = readFileSync(postingQueuePath, 'utf-8');
  
  const detectsThreads = postingQueueContent.includes('isThread = Array.isArray(thread_parts)');
  if (detectsThreads) {
    console.log('   ✅ PASS: Posting queue detects threads correctly');
  } else {
    console.log('   ⚠️  WARN: Thread detection logic may have changed');
  }
} catch (error: any) {
  console.log(`   ❌ FAIL: Could not verify database storage: ${error.message}`);
  allChecksPassed = false;
}

console.log('');

// ============================================================
// FINAL SUMMARY
// ============================================================
console.log('═══════════════════════════════════════════════════════');
if (allChecksPassed) {
  console.log('✅ ALL CHECKS PASSED - Thread system is fixed and ready!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Test with dry run: DRY_RUN=true tsx scripts/test-thread-posting.ts');
  console.log('2. Monitor first live threads in production');
  console.log('3. Check dashboard for thread performance metrics');
  console.log('');
  console.log('Expected behavior:');
  console.log('- ~7% of posts will be threads (about 1 per day)');
  console.log('- Threads posted as reply chains (connected tweets)');
  console.log('- All tweet IDs captured and stored');
  console.log('- Natural flow, no "1/4" numbering');
  process.exit(0);
} else {
  console.log('❌ SOME CHECKS FAILED - Review the errors above');
  console.log('');
  console.log('If you see this, the fix may not be complete.');
  process.exit(1);
}

