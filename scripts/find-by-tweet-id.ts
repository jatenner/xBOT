/**
 * Find By Tweet ID - Comprehensive Search
 * 
 * Searches all possible DB locations for tweet IDs:
 * - tweet_id column (TEXT)
 * - thread_tweet_ids array (JSONB)
 * - Any metadata fields
 * - Both content_metadata view and base tables
 */

import { createClient } from '@supabase/supabase-js';

const TWEET_IDS_TO_FIND = [
  '2002063977095004544',
  '2002066239750090880'
];

async function findByTweetId(tweetId: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`SEARCHING FOR TWEET ID: ${tweetId}`);
  console.log('═'.repeat(70));
  
  const supabase = createClient(url, key);
  
  // Strategy 1: Search content_metadata view by tweet_id
  console.log('\n1️⃣  Searching content_metadata.tweet_id...');
  const { data: cm1, error: e1 } = await supabase
    .from('content_metadata')
    .select('decision_id, status, decision_type, tweet_id, thread_tweet_ids, created_at, posted_at, updated_at')
    .eq('tweet_id', tweetId)
    .limit(1);
  
  if (e1) {
    console.log(`   ⚠️  Error: ${e1.message}`);
  } else if (cm1 && cm1.length > 0) {
    console.log(`   ✅ FOUND in content_metadata.tweet_id`);
    printRow(cm1[0], 'content_metadata');
    return { source: 'content_metadata.tweet_id', row: cm1[0] };
  } else {
    console.log(`   ❌ Not found in tweet_id column`);
  }
  
  // Strategy 2: Search content_metadata where thread_tweet_ids contains the ID
  console.log('\n2️⃣  Searching content_metadata.thread_tweet_ids (JSONB)...');
  const { data: cm2, error: e2 } = await supabase
    .from('content_metadata')
    .select('decision_id, status, decision_type, tweet_id, thread_tweet_ids, created_at, posted_at, updated_at')
    .not('thread_tweet_ids', 'is', null);
  
  if (e2) {
    console.log(`   ⚠️  Error: ${e2.message}`);
  } else if (cm2) {
    for (const row of cm2) {
      if (row.thread_tweet_ids) {
        try {
          const ids = typeof row.thread_tweet_ids === 'string' 
            ? JSON.parse(row.thread_tweet_ids) 
            : row.thread_tweet_ids;
          
          if (Array.isArray(ids) && ids.includes(tweetId)) {
            console.log(`   ✅ FOUND in content_metadata.thread_tweet_ids`);
            printRow(row, 'content_metadata');
            return { source: 'content_metadata.thread_tweet_ids', row };
          }
        } catch (err) {
          // Invalid JSON, skip
        }
      }
    }
    console.log(`   ❌ Not found in thread_tweet_ids arrays (checked ${cm2.length} rows)`);
  }
  
  // Strategy 3: Search content_generation_metadata_comprehensive (base table)
  console.log('\n3️⃣  Searching content_generation_metadata_comprehensive (base table)...');
  const { data: cgmc1, error: e3 } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, decision_type, tweet_id, thread_tweet_ids, created_at, posted_at, updated_at')
    .eq('tweet_id', tweetId)
    .limit(1);
  
  if (e3) {
    console.log(`   ⚠️  Error: ${e3.message}`);
  } else if (cgmc1 && cgmc1.length > 0) {
    console.log(`   ✅ FOUND in content_generation_metadata_comprehensive.tweet_id`);
    printRow(cgmc1[0], 'content_generation_metadata_comprehensive');
    return { source: 'content_generation_metadata_comprehensive.tweet_id', row: cgmc1[0] };
  } else {
    console.log(`   ❌ Not found in base table tweet_id column`);
  }
  
  // Strategy 4: Search outcomes table
  console.log('\n4️⃣  Searching outcomes table...');
  const { data: outcomes, error: e4 } = await supabase
    .from('outcomes')
    .select('decision_id, tweet_id, likes, retweets, replies, impressions, collected_at')
    .eq('tweet_id', tweetId)
    .limit(1);
  
  if (e4) {
    console.log(`   ⚠️  Error: ${e4.message}`);
  } else if (outcomes && outcomes.length > 0) {
    console.log(`   ✅ FOUND in outcomes.tweet_id`);
    console.log(`      Decision ID: ${outcomes[0].decision_id}`);
    console.log(`      Tweet ID: ${outcomes[0].tweet_id}`);
    console.log(`      Engagement: ${outcomes[0].likes} likes, ${outcomes[0].retweets} RTs`);
    
    // Now fetch the full decision
    const { data: decision, error: e5 } = await supabase
      .from('content_metadata')
      .select('decision_id, status, decision_type, tweet_id, thread_tweet_ids, created_at, posted_at, updated_at')
      .eq('decision_id', outcomes[0].decision_id)
      .limit(1);
    
    if (decision && decision.length > 0) {
      printRow(decision[0], 'content_metadata (via outcomes)');
      return { source: 'outcomes → content_metadata', row: decision[0] };
    }
  } else {
    console.log(`   ❌ Not found in outcomes table`);
  }
  
  console.log('\n❌ TWEET ID NOT FOUND IN ANY TABLE');
  return null;
}

function printRow(row: any, source: string) {
  console.log(`\n   📊 MATCH DETAILS (source: ${source})`);
  console.log(`   ${'─'.repeat(66)}`);
  console.log(`   Decision ID:       ${row.decision_id}`);
  console.log(`   Status:            ${row.status}`);
  console.log(`   Decision Type:     ${row.decision_type || 'null'}`);
  console.log(`   Tweet ID:          ${row.tweet_id || 'null'}`);
  
  // Parse thread_tweet_ids
  let threadIds: string[] = [];
  if (row.thread_tweet_ids) {
    try {
      threadIds = typeof row.thread_tweet_ids === 'string' 
        ? JSON.parse(row.thread_tweet_ids) 
        : row.thread_tweet_ids;
    } catch (err) {
      // Invalid JSON
    }
  }
  
  console.log(`   Thread Tweet IDs:  ${threadIds.length > 0 ? `[${threadIds.length} IDs]` : 'null'}`);
  if (threadIds.length > 0) {
    console.log(`                      ${threadIds.join(', ')}`);
  }
  
  // Derive classification
  const tweetIdsCount = threadIds.length > 0 ? threadIds.length : (row.tweet_id ? 1 : 0);
  let classification: string;
  
  if (row.decision_type === 'reply') {
    classification = 'REPLY';
  } else if (tweetIdsCount > 1) {
    classification = 'THREAD';
  } else if (tweetIdsCount === 1) {
    classification = 'SINGLE';
  } else {
    classification = 'UNKNOWN';
  }
  
  console.log(`   Classification:    ${classification} (${tweetIdsCount} tweet ID${tweetIdsCount === 1 ? '' : 's'})`);
  console.log(`   Created At:        ${row.created_at || 'null'}`);
  console.log(`   Posted At:         ${row.posted_at || 'null'}`);
  console.log(`   Updated At:        ${row.updated_at || 'null'}`);
  console.log(`   ${'─'.repeat(66)}`);
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  COMPREHENSIVE TWEET ID SEARCH                                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  
  // Print environment info
  console.log('\n🔧 ENVIRONMENT INFO:');
  console.log(`   Supabase URL: ${process.env.SUPABASE_URL?.substring(0, 30)}...`);
  console.log(`   Service Key:  ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '[PRESENT]' : '[MISSING]'}`);
  
  const results: any[] = [];
  
  for (const tweetId of TWEET_IDS_TO_FIND) {
    const result = await findByTweetId(tweetId);
    results.push({ tweetId, result });
  }
  
  // Summary
  console.log('\n\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  SEARCH SUMMARY                                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');
  
  results.forEach(({ tweetId, result }) => {
    if (result) {
      console.log(`✅ ${tweetId}: FOUND in ${result.source}`);
      const classification = result.row.decision_type === 'reply' ? 'REPLY' 
        : (result.row.thread_tweet_ids ? 'THREAD' : 'SINGLE');
      console.log(`   → ${classification} | Status: ${result.row.status} | Decision: ${result.row.decision_id.substring(0, 8)}...`);
    } else {
      console.log(`❌ ${tweetId}: NOT FOUND`);
    }
  });
  
  const foundCount = results.filter(r => r.result !== null).length;
  console.log(`\n📊 Found ${foundCount}/${TWEET_IDS_TO_FIND.length} tweet IDs\n`);
  
  process.exit(foundCount === TWEET_IDS_TO_FIND.length ? 0 : 1);
}

// Load env vars
try {
  require('dotenv/config');
} catch (e) {
  // Railway provides env vars automatically
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

