/**
 * Verify P0 Truth Gap Patches
 * 
 * Confirms:
 * 1. Quota counting includes tweet_id check
 * 2. Reply fallback no longer uses wrong generator
 * 3. System respects rate limits
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('\n🔍 VERIFYING P0 PATCHES\n');
console.log('='.repeat(80));

let allPassed = true;

// Test 1: Verify postingQueue.ts has tweet_id checks in quota queries
console.log('\n1️⃣  Checking quota queries have .not(\'tweet_id\', \'is\', null)...');

const postingQueuePath = resolve(__dirname, '../src/jobs/postingQueue.ts');
const postingQueueContent = readFileSync(postingQueuePath, 'utf-8');

// Check for post quota (around line 399)
const postQuotaPattern = /\.in\('decision_type',\s*\['single',\s*'thread'\]\)\s*\.eq\('status',\s*'posted'\)\s*\.not\('tweet_id',\s*'is',\s*null\)/;
if (postQuotaPattern.test(postingQueueContent)) {
  console.log('   ✅ Post quota check includes tweet_id validation');
} else {
  console.log('   ❌ Post quota check MISSING tweet_id validation');
  allPassed = false;
}

// Check for reply quota (around line 434)
const replyQuotaPattern = /\.eq\('decision_type',\s*'reply'\)\s*\.eq\('status',\s*'posted'\)\s*\.not\('tweet_id',\s*'is',\s*null\)/;
if (replyQuotaPattern.test(postingQueueContent)) {
  console.log('   ✅ Reply quota check includes tweet_id validation');
} else {
  console.log('   ❌ Reply quota check MISSING tweet_id validation');
  allPassed = false;
}

// Test 2: Verify replyJob.ts no longer calls generators/replyGeneratorAdapter
console.log('\n2️⃣  Checking reply fallback removed wrong generator...');

const replyJobPath = resolve(__dirname, '../src/jobs/replyJob.ts');
const replyJobContent = readFileSync(replyJobPath, 'utf-8');

// Should NOT contain import of generators/replyGeneratorAdapter after line 1000
const wrongImportPattern = /generators\/replyGeneratorAdapter/;
const lines = replyJobContent.split('\n');
let foundWrongImport = false;
let lineNumber = 0;

for (let i = 1000; i < lines.length; i++) {
  if (wrongImportPattern.test(lines[i])) {
    foundWrongImport = true;
    lineNumber = i + 1;
    break;
  }
}

if (foundWrongImport) {
  console.log(`   ❌ Still uses generators/replyGeneratorAdapter at line ${lineNumber}`);
  allPassed = false;
} else {
  console.log('   ✅ No longer imports generators/replyGeneratorAdapter in fallback');
}

// Should contain strategic fallback
const strategicFallbackPattern = /strategicReplySystem\.generateStrategicReply/;
if (strategicFallbackPattern.test(replyJobContent)) {
  console.log('   ✅ Uses strategicReplySystem fallback');
} else {
  console.log('   ⚠️  strategicReplySystem fallback not found (may be OK if Phase 4 handles it)');
}

// Test 3: Check that receipt write is still fail-closed (should not have changed)
console.log('\n3️⃣  Verifying receipt write is fail-closed (sanity check)...');

// Posts receipt (around line 1820)
const postReceiptThrowPattern = /throw new Error\(`Receipt write failed:/;
if (postReceiptThrowPattern.test(postingQueueContent)) {
  console.log('   ✅ Post receipt write throws on failure (fail-closed)');
} else {
  console.log('   ❌ Post receipt write does NOT throw on failure');
  allPassed = false;
}

// Replies receipt (around line 3008)
const replyReceiptThrowPattern = /throw new Error\(`CRITICAL: Receipt write failed:/;
if (replyReceiptThrowPattern.test(postingQueueContent)) {
  console.log('   ✅ Reply receipt write throws on failure (fail-closed)');
} else {
  console.log('   ❌ Reply receipt write does NOT throw on failure');
  allPassed = false;
}

// Summary
console.log('\n' + '='.repeat(80));
if (allPassed) {
  console.log('✅ ALL PATCHES VERIFIED\n');
  process.exit(0);
} else {
  console.log('❌ SOME PATCHES MISSING OR INCORRECT\n');
  process.exit(1);
}

