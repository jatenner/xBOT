/**
 * Check recent replies for the two issues
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index.js';

async function check() {
  const supabase = getSupabaseClient();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 REPLY PATTERN ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Get last 20 posted replies
  const { data: replies } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, content, thread_parts, metadata, posted_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(20);
  
  if (!replies || replies.length === 0) {
    console.log('❌ No recent replies found\n');
    return;
  }
  
  console.log(`Found ${replies.length} recent replies\n`);
  
  let issue1Count = 0; // Thread markers in replies
  let issue2Count = 0; // Replying to replies
  
  for (const reply of replies) {
    const metadata = reply.metadata || {};
    const content = reply.content || '';
    
    // ISSUE #1: Check for thread markers
    const hasThreadMarkers = content.includes('1/') || content.includes('2/') || 
                            content.includes('3/') || content.includes('🧵');
    const hasThreadParts = reply.thread_parts && Array.isArray(reply.thread_parts) && 
                          reply.thread_parts.length > 0;
    
    // ISSUE #2: Check if target is a reply
    const targetTweetId = metadata.target_tweet_id;
    let targetIsReply = false;
    
    if (targetTweetId) {
      // Check if this target tweet is actually a reply to someone else
      const { data: opp } = await supabase
        .from('reply_opportunities')
        .select('is_reply, parent_tweet_id, target_username')
        .eq('target_tweet_id', targetTweetId)
        .single();
      
      if (opp && (opp.is_reply || opp.parent_tweet_id)) {
        targetIsReply = true;
      }
    }
    
    if (hasThreadMarkers || hasThreadParts || targetIsReply) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Tweet ID: ${reply.tweet_id}`);
      console.log(`Posted: ${reply.posted_at}`);
      
      if (hasThreadMarkers) {
        console.log(`⚠️  ISSUE #1: Has thread markers in content`);
        const preview = content.substring(0, 100);
        console.log(`   Preview: ${preview}...`);
        issue1Count++;
      }
      
      if (hasThreadParts) {
        console.log(`⚠️  ISSUE #1: Has thread_parts array (${reply.thread_parts.length} parts)`);
        issue1Count++;
      }
      
      if (targetIsReply) {
        console.log(`⚠️  ISSUE #2: Replying to a reply (not original post)`);
        console.log(`   Target tweet ID: ${targetTweetId}`);
        console.log(`   Target username: ${metadata.target_username}`);
        issue2Count++;
      }
      
      console.log('');
    }
  }
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`           📊 SUMMARY (last 20 replies)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`⚠️  ISSUE #1 (Thread markers/parts in replies): ${issue1Count}/20`);
  console.log(`⚠️  ISSUE #2 (Replying to replies, not posts): ${issue2Count}/20`);
  console.log('');
  
  if (issue1Count > 0 || issue2Count > 0) {
    console.log(`❌ ISSUES CONFIRMED - Fix needed\n`);
  } else {
    console.log(`✅ No issues found in recent replies\n`);
  }
}

check();
