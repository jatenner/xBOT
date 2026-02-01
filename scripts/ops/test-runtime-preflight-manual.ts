#!/usr/bin/env tsx
/**
 * Test runtime preflight manually on a specific tweet ID
 */

import 'dotenv/config';
import { fetchTweetData } from '../../src/gates/contextLockVerifier';

async function main() {
  const tweetId = process.argv[2];
  if (!tweetId) {
    console.error('Usage: pnpm tsx scripts/ops/test-runtime-preflight-manual.ts <tweet_id>');
    process.exit(1);
  }
  
  console.log(`🔍 Testing runtime preflight for tweet: ${tweetId}\n`);
  
  const startTime = Date.now();
  try {
    const result = await fetchTweetData(tweetId);
    const latency = Date.now() - startTime;
    
    if (result) {
      console.log(`✅ SUCCESS: Tweet accessible`);
      console.log(`   Text length: ${result.text.length}`);
      console.log(`   Text preview: ${result.text.substring(0, 100)}...`);
      console.log(`   Is reply: ${result.isReply}`);
      console.log(`   Latency: ${latency}ms`);
    } else {
      console.log(`❌ FAILED: Tweet returned null`);
      console.log(`   Latency: ${latency}ms`);
    }
  } catch (error: any) {
    const latency = Date.now() - startTime;
    console.log(`❌ ERROR: ${error.message}`);
    console.log(`   Failure reason: ${error.failureReason || 'unknown'}`);
    console.log(`   Marker: ${error.classificationMarker || 'unknown'}`);
    console.log(`   Latency: ${latency}ms`);
  }
}

main().catch(console.error);
