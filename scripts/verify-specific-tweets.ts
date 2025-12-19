/**
 * Verify Specific Tweet IDs in Database
 * 
 * Checks that specific tweet IDs exist and are classified correctly:
 * - Thread root: 2002063977095004544 (should have tweet_ids_count > 1)
 * - Single tweet: 2002066239750090880 (should have exactly 1 tweet id)
 */

import { createClient } from '@supabase/supabase-js';

const TWEET_IDS_TO_VERIFY = {
  thread: '2002063977095004544',
  single: '2002066239750090880'
};

interface DecisionRow {
  decision_id: string;
  status: string;
  decision_type: string | null;
  tweet_id: string | null;
  thread_tweet_ids: string | null;
  created_at: string;
  posted_at: string | null;
}

async function verifyTweets() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(url, key);
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  VERIFYING SPECIFIC TWEET IDs IN DATABASE                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  let allPassed = true;
  
  // Check thread tweet
  console.log('1. THREAD TWEET VERIFICATION');
  console.log('   Tweet ID: ' + TWEET_IDS_TO_VERIFY.thread);
  console.log('   Expected: THREAD (tweet_ids_count > 1)\n');
  
  const threadResult = await verifyTweetId(supabase, TWEET_IDS_TO_VERIFY.thread, 'thread');
  if (!threadResult.passed) {
    allPassed = false;
  }
  
  console.log('\n' + '─'.repeat(65) + '\n');
  
  // Check single tweet
  console.log('2. SINGLE TWEET VERIFICATION');
  console.log('   Tweet ID: ' + TWEET_IDS_TO_VERIFY.single);
  console.log('   Expected: SINGLE (exactly 1 tweet ID)\n');
  
  const singleResult = await verifyTweetId(supabase, TWEET_IDS_TO_VERIFY.single, 'single');
  if (!singleResult.passed) {
    allPassed = false;
  }
  
  console.log('\n' + '═'.repeat(65));
  console.log(allPassed ? '✅ ALL VERIFICATIONS PASSED' : '❌ SOME VERIFICATIONS FAILED');
  console.log('═'.repeat(65) + '\n');
  
  process.exit(allPassed ? 0 : 1);
}

async function verifyTweetId(
  supabase: any,
  tweetId: string,
  expectedType: 'thread' | 'single'
): Promise<{ passed: boolean; row?: DecisionRow }> {
  // Query by tweet_id
  const { data: byTweetId, error: e1 } = await supabase
    .from('content_metadata')
    .select('decision_id, status, decision_type, tweet_id, thread_tweet_ids, created_at, posted_at')
    .eq('tweet_id', tweetId)
    .limit(1);
  
  if (e1) {
    console.log(`   ❌ Query error: ${e1.message}`);
    return { passed: false };
  }
  
  let row: DecisionRow | null = byTweetId && byTweetId.length > 0 ? byTweetId[0] : null;
  
  // If not found by tweet_id, try searching in thread_tweet_ids (JSONB array)
  if (!row) {
    console.log('   ⚠️  Not found by tweet_id, checking thread_tweet_ids...');
    
    const { data: byThreadIds, error: e2 } = await supabase
      .from('content_metadata')
      .select('decision_id, status, decision_type, tweet_id, thread_tweet_ids, created_at, posted_at')
      .not('thread_tweet_ids', 'is', null)
      .limit(1000); // Get all potential threads
    
    if (e2) {
      console.log(`   ❌ Query error: ${e2.message}`);
      return { passed: false };
    }
    
    // Search for tweet ID in thread_tweet_ids arrays
    if (byThreadIds) {
      for (const r of byThreadIds) {
        if (r.thread_tweet_ids) {
          try {
            const ids = JSON.parse(r.thread_tweet_ids);
            if (Array.isArray(ids) && ids.includes(tweetId)) {
              row = r;
              console.log(`   ✅ Found in thread_tweet_ids for decision ${r.decision_id.substring(0, 8)}...`);
              break;
            }
          } catch (err) {
            // Invalid JSON, skip
          }
        }
      }
    }
  }
  
  if (!row) {
    console.log('   ❌ MISSING: Tweet ID not found in database');
    console.log('   📝 Next step: Run reconciliation to recover from backup');
    return { passed: false };
  }
  
  // Print row details
  console.log('   ✅ FOUND IN DATABASE\n');
  console.log('   Decision ID: ' + row.decision_id);
  console.log('   Status: ' + row.status);
  console.log('   Decision Type: ' + (row.decision_type || 'null'));
  console.log('   Tweet ID: ' + (row.tweet_id || 'null'));
  
  // Parse thread_tweet_ids
  let threadIds: string[] = [];
  if (row.thread_tweet_ids) {
    try {
      threadIds = JSON.parse(row.thread_tweet_ids);
    } catch (err) {
      console.log('   ⚠️  thread_tweet_ids parse error');
    }
  }
  
  console.log('   Thread Tweet IDs: ' + (threadIds.length > 0 ? `[${threadIds.length} IDs]` : 'null'));
  if (threadIds.length > 0) {
    console.log('     → ' + threadIds.join(', '));
  }
  
  // Derive classification
  const tweetIdsCount = threadIds.length > 0 ? threadIds.length : (row.tweet_id ? 1 : 0);
  let derivedType: string;
  
  if (row.decision_type === 'reply') {
    derivedType = 'REPLY';
  } else if (tweetIdsCount > 1) {
    derivedType = 'THREAD';
  } else if (tweetIdsCount === 1) {
    derivedType = 'SINGLE';
  } else {
    derivedType = 'UNKNOWN (no tweet IDs)';
  }
  
  console.log('   Derived Classification: ' + derivedType);
  console.log('   Tweet IDs Count: ' + tweetIdsCount);
  console.log('   Created At: ' + row.created_at);
  console.log('   Posted At: ' + (row.posted_at || 'null'));
  
  // Verify against expected
  let passed = true;
  
  if (expectedType === 'thread') {
    if (tweetIdsCount <= 1) {
      console.log('\n   ❌ FAIL: Expected THREAD (tweet_ids_count > 1) but got ' + tweetIdsCount);
      passed = false;
    } else {
      console.log('\n   ✅ PASS: Correctly classified as THREAD');
    }
  } else if (expectedType === 'single') {
    if (tweetIdsCount !== 1) {
      console.log('\n   ❌ FAIL: Expected SINGLE (exactly 1 tweet ID) but got ' + tweetIdsCount);
      passed = false;
    } else {
      console.log('\n   ✅ PASS: Correctly classified as SINGLE');
    }
  }
  
  return { passed, row };
}

// Only run if SUPABASE credentials are available
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Loading environment variables...');
  try {
    require('dotenv/config');
  } catch (e) {
    // In Railway, env vars are already available
  }
}

verifyTweets().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

