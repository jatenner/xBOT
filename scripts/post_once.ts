#!/usr/bin/env tsx
/**
 * 🚀 CLI SMOKE TEST - Post a single tweet immediately
 * 
 * Usage:
 *   tsx scripts/post_once.ts "Your tweet text here"
 *   tsx scripts/post_once.ts   # Uses default smoke text
 */

import { postNow } from '../src/posting/postNow';

const text = process.argv.slice(2).join(' ') || `xBOT smoke @ ${new Date().toISOString()}`;

console.log(`🚀 SMOKE_TEST: Posting tweet...`);
console.log(`📝 Text: "${text}"`);

postNow({ text })
  .then((result) => {
    if (result.success) {
      console.log(`✅ SMOKE_TEST_PASS: Tweet posted successfully!`);
      console.log(`   • Tweet ID: ${result.id}`);
      process.exit(0);
    } else {
      console.error(`❌ SMOKE_TEST_FAIL: ${result.error}`);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('❌ SMOKE_TEST_ERROR:', err);
    process.exit(1);
  });

