import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTweets() {
  const tweetIds = [
    '2005979408272863265',  // Curcumin/turmeric post (7:28 AM)
    '2005971984409329907'   // MATCHA post (6:59 AM)
  ];
  
  console.log('🔍 CHECKING IF POSTS ARE IN DATABASE\n');
  console.log('='.repeat(80));
  
  for (const tweetId of tweetIds) {
    console.log(`\n📝 Tweet ID: ${tweetId}`);
    
    // Check content_generation_metadata_comprehensive (main table)
    const { data: metadata } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*')
      .eq('tweet_id', tweetId)
      .maybeSingle();
    
    // Check post_receipts (truth source)
    const { data: receipt } = await supabase
      .from('post_receipts')
      .select('*')
      .eq('tweet_id', tweetId)
      .maybeSingle();
    
    // Check content_metadata (view)
    const { data: view } = await supabase
      .from('content_metadata')
      .select('decision_id, status, posted_at, content, generator_name')
      .eq('tweet_id', tweetId)
      .maybeSingle();
    
    if (!metadata && !receipt && !view) {
      console.log('   ❌ NOT FOUND in any table!');
      console.log('   🚨 POST WAS NOT SAVED TO DATABASE');
      continue;
    }
    
    console.log('\n   📊 Database Status:');
    
    if (receipt) {
      console.log('   ✅ post_receipts (truth source):');
      console.log(`      - Receipt ID: ${receipt.receipt_id}`);
      console.log(`      - Posted at: ${receipt.posted_at}`);
      console.log(`      - Content: ${receipt.content?.substring(0, 80)}...`);
      console.log(`      - Post type: ${receipt.post_type || 'NULL'}`);
    } else {
      console.log('   ❌ post_receipts: NOT FOUND');
    }
    
    if (metadata) {
      console.log('   ✅ content_generation_metadata_comprehensive:');
      console.log(`      - Decision ID: ${metadata.decision_id}`);
      console.log(`      - Status: ${metadata.status}`);
      console.log(`      - Decision type: ${metadata.decision_type}`);
      console.log(`      - Generator: ${metadata.generator_name || 'NULL'}`);
      console.log(`      - Posted at: ${metadata.posted_at || 'NULL'}`);
      console.log(`      - Content: ${metadata.content?.substring(0, 80)}...`);
    } else {
      console.log('   ❌ content_generation_metadata_comprehensive: NOT FOUND');
    }
    
    if (view) {
      console.log('   ✅ content_metadata (view):');
      console.log(`      - Status: ${view.status}`);
      console.log(`      - Posted at: ${view.posted_at || 'NULL'}`);
    } else {
      console.log('   ❌ content_metadata: NOT FOUND');
    }
    
    // Summary
    if (receipt && metadata) {
      console.log('\n   ✅ STATUS: FULLY RECORDED');
    } else if (receipt && !metadata) {
      console.log('\n   ⚠️  STATUS: In receipts but NOT synced to metadata (truth reconciliation needed)');
    } else if (!receipt && metadata) {
      console.log('\n   ⚠️  STATUS: In metadata but NO RECEIPT (posting may have failed)');
    } else {
      console.log('\n   ❌ STATUS: NOT SAVED (critical database write failure)');
    }
  }
  
  console.log('\n\n' + '='.repeat(80));
  console.log('💾 WHAT SHOULD BE IN DATABASE:\n');
  
  console.log('For each post, we should have:');
  console.log('1. post_receipts entry:');
  console.log('   - receipt_id (UUID)');
  console.log('   - tweet_id (from Twitter)');
  console.log('   - content (full tweet text)');
  console.log('   - posted_at (timestamp)');
  console.log('   - post_type (single/thread/reply)');
  console.log('   - root_tweet_id (same as tweet_id for singles)');
  console.log('');
  console.log('2. content_generation_metadata_comprehensive entry:');
  console.log('   - decision_id (UUID)');
  console.log('   - tweet_id (linked to receipt)');
  console.log('   - decision_type (post/thread/reply)');
  console.log('   - status (posted)');
  console.log('   - content (tweet text)');
  console.log('   - generator_name (which generator created it)');
  console.log('   - posted_at (timestamp)');
  console.log('   - created_at (when generated)');
  console.log('');
  console.log('3. content_metadata view should show both merged');
}

checkTweets().catch(console.error);

