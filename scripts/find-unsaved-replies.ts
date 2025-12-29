/**
 * Find tweets posted to X but not in database
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index.js';

async function find() {
  const supabase = getSupabaseClient();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 CHECKING FOR UNSAVED TWEETS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Check post_receipts for tweets not in content_metadata
  const { data: receipts } = await supabase
    .from('post_receipts')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(50);
  
  console.log(`📊 Checking last 50 post_receipts...\n`);
  
  let orphanCount = 0;
  
  for (const receipt of receipts || []) {
    const rootTweetId = receipt.root_tweet_id || receipt.tweet_ids?.[0];
    
    if (!rootTweetId) continue;
    
    // Check if in content_metadata
    const { data: decision } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, status')
      .eq('tweet_id', rootTweetId)
      .single();
    
    if (!decision) {
      orphanCount++;
      console.log(`⚠️  ORPHAN RECEIPT:`);
      console.log(`   Receipt ID: ${receipt.receipt_id}`);
      console.log(`   Tweet ID: ${rootTweetId}`);
      console.log(`   Post Type: ${receipt.kind}`);
      console.log(`   Posted At: ${receipt.posted_at}`);
      console.log(`   Decision ID: ${receipt.decision_id || 'NULL'}`);
      
      if (receipt.kind === 'reply') {
        console.log(`   Target: @${receipt.metadata?.target_username}`);
        console.log(`   Parent Tweet: ${receipt.parent_tweet_id}`);
      }
      
      if (receipt.tweet_ids?.length > 1) {
        console.log(`   ⚠️  MULTI-TWEET (thread): ${receipt.tweet_ids.length} tweets`);
      }
      
      console.log('');
    }
  }
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total receipts checked: ${receipts?.length || 0}`);
  console.log(`   Orphan receipts (not in DB): ${orphanCount}`);
  console.log('');
  
  // Check for thread_parts in replies
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`           🔍 CHECKING REPLY CONTENT GENERATION`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const { data: recentDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, content, thread_parts')
    .eq('decision_type', 'reply')
    .order('created_at', { ascending: false })
    .limit(20);
  
  let threadContentInReplyCount = 0;
  
  for (const decision of recentDecisions || []) {
    const hasThreadMarkers = decision.content?.match(/^\d+\/\d+/) || decision.content?.includes('🧵');
    const hasThreadParts = decision.thread_parts && Array.isArray(decision.thread_parts) && decision.thread_parts.length > 0;
    
    if (hasThreadMarkers || hasThreadParts) {
      threadContentInReplyCount++;
      console.log(`⚠️  REPLY WITH THREAD CONTENT:`);
      console.log(`   Decision ID: ${decision.decision_id}`);
      
      if (hasThreadMarkers) {
        console.log(`   Content: "${decision.content.substring(0, 80)}..."`);
      }
      
      if (hasThreadParts) {
        console.log(`   Thread Parts: ${decision.thread_parts.length}`);
      }
      
      console.log('');
    }
  }
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📊 CONTENT GENERATION ISSUE:`);
  console.log(`   Replies checked: ${recentDecisions?.length || 0}`);
  console.log(`   Replies with thread content: ${threadContentInReplyCount}`);
  console.log('');
}

find();
