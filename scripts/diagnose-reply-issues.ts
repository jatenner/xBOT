/**
 * Diagnose reply issues from screenshots
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index.js';

async function diagnose() {
  const supabase = getSupabaseClient();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 REPLY ISSUE DIAGNOSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Tweet IDs from screenshots
  const tweetIds = [
    '2005745380324172101', // "1/5 Start with a HIGH-PROTEIN base..."
    '2005744866840699050'  // Second screenshot
  ];
  
  for (const tweetId of tweetIds) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`TWEET ID: ${tweetId}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // Check content_metadata
    const { data: decision, error } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('tweet_id', tweetId)
      .single();
    
    if (error || !decision) {
      console.log(`❌ Not found in content_metadata`);
      
      // Check if it's in thread_tweet_ids
      const { data: threadDecisions } = await supabase
        .from('content_metadata')
        .select('*')
        .contains('thread_tweet_ids', [tweetId]);
      
      if (threadDecisions && threadDecisions.length > 0) {
        console.log(`⚠️  Found as part of a thread!`);
        console.log(`   Thread decision_id: ${threadDecisions[0].decision_id}`);
        console.log(`   Decision type: ${threadDecisions[0].decision_type}`);
      }
      continue;
    }
    
    console.log(`✅ Found in database`);
    console.log(`   Decision ID: ${decision.decision_id}`);
    console.log(`   Decision Type: ${decision.decision_type}`);
    console.log(`   Status: ${decision.status}`);
    console.log(`   Posted At: ${decision.posted_at}`);
    
    const metadata = decision.metadata || {};
    console.log(`\n📊 METADATA:`);
    console.log(`   Generator: ${metadata.generator || metadata.content_generator || 'N/A'}`);
    console.log(`   Target Tweet ID: ${metadata.target_tweet_id || 'N/A'}`);
    console.log(`   Target Username: ${metadata.target_username || 'N/A'}`);
    console.log(`   Parent Tweet ID: ${metadata.parent_tweet_id || 'N/A'}`);
    
    if (decision.thread_parts && Array.isArray(decision.thread_parts)) {
      console.log(`\n⚠️  ISSUE #1: HAS THREAD_PARTS (should be null for replies)`);
      console.log(`   Thread parts count: ${decision.thread_parts.length}`);
      console.log(`   First part preview: ${decision.thread_parts[0]?.substring(0, 60)}...`);
    }
    
    // Check if target was a reply itself
    if (metadata.target_tweet_id) {
      console.log(`\n🔍 Checking if target tweet is a reply...`);
      
      // Check reply_opportunities
      const { data: opportunity } = await supabase
        .from('reply_opportunities')
        .select('*')
        .eq('target_tweet_id', metadata.target_tweet_id)
        .single();
      
      if (opportunity) {
        console.log(`   Target tweet found in reply_opportunities`);
        console.log(`   Target tweet content: ${opportunity.tweet_content?.substring(0, 80)}...`);
        console.log(`   Target is_reply_to_reply: ${opportunity.is_reply_to_reply || 'N/A'}`);
        
        if (opportunity.is_reply_to_reply) {
          console.log(`\n⚠️  ISSUE #2: TARGET IS A REPLY TO ANOTHER REPLY`);
        }
      }
    }
    
    console.log(`\n📝 CONTENT PREVIEW:`);
    if (decision.content) {
      const preview = decision.content.substring(0, 200);
      console.log(`   ${preview}${decision.content.length > 200 ? '...' : ''}`);
    }
    
    // Check if content contains thread markers
    if (decision.content && (
      decision.content.includes('1/') || 
      decision.content.includes('2/') ||
      decision.content.includes('🧵')
    )) {
      console.log(`\n⚠️  ISSUE #1: CONTENT HAS THREAD MARKERS`);
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 CHECKING RECENT REPLIES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Check last 10 replies
  const { data: recentReplies } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, decision_type, content, thread_parts, metadata, posted_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(10);
  
  if (recentReplies) {
    let threadMarkerCount = 0;
    let replyToReplyCount = 0;
    let hasThreadPartsCount = 0;
    
    for (const reply of recentReplies) {
      // Check for thread markers
      if (reply.content && (
        reply.content.includes('1/') || 
        reply.content.includes('2/') ||
        reply.content.includes('🧵')
      )) {
        threadMarkerCount++;
      }
      
      // Check for thread_parts
      if (reply.thread_parts && Array.isArray(reply.thread_parts) && reply.thread_parts.length > 0) {
        hasThreadPartsCount++;
      }
      
      // Check if replying to a reply
      const metadata = reply.metadata || {};
      if (metadata.parent_tweet_id && metadata.parent_tweet_id !== metadata.target_tweet_id) {
        replyToReplyCount++;
      }
    }
    
    console.log(`Total recent replies checked: ${recentReplies.length}`);
    console.log(`\n⚠️  ISSUE #1 COUNT:`);
    console.log(`   Replies with thread markers (1/, 2/, 🧵): ${threadMarkerCount}/${recentReplies.length}`);
    console.log(`   Replies with thread_parts array: ${hasThreadPartsCount}/${recentReplies.length}`);
    console.log(`\n⚠️  ISSUE #2 COUNT:`);
    console.log(`   Replies to replies (not original posts): ${replyToReplyCount}/${recentReplies.length}`);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Done!');
}

diagnose();
