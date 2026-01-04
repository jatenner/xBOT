#!/usr/bin/env tsx
/**
 * Trace a tweet_id backward through the system to understand how it was generated
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function traceTweet(tweetId: string) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`🔍 TRACING TWEET: ${tweetId}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // 1. Find in content_metadata
  const { data: metadata, error: metaError } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('tweet_id', tweetId)
    .single();
  
  if (metaError || !metadata) {
    console.error('❌ Tweet not found in content_metadata:', metaError?.message);
    return;
  }
  
  console.log('📋 CONTENT_METADATA:');
  console.log(`   ID: ${metadata.id}`);
  console.log(`   Type: ${metadata.decision_type}`);
  console.log(`   Status: ${metadata.status}`);
  console.log(`   Created: ${new Date(metadata.created_at).toLocaleString()}`);
  console.log(`   Posted: ${metadata.posted_at ? new Date(metadata.posted_at).toLocaleString() : 'N/A'}`);
  console.log(`   Target Tweet ID: ${metadata.target_tweet_id || 'N/A'}`);
  console.log(`   Generator: ${metadata.generator_used || 'N/A'}`);
  console.log(`   Content: "${metadata.content?.substring(0, 100)}..."`);
  console.log('');
  
  // 2. Check if target_tweet_id exists - find in reply_opportunities
  if (metadata.target_tweet_id) {
    const { data: opp } = await supabase
      .from('reply_opportunities')
      .select('*')
      .eq('target_tweet_id', metadata.target_tweet_id)
      .single();
    
    if (opp) {
      console.log('🎯 REPLY_OPPORTUNITY:');
      console.log(`   Target ID: ${opp.target_tweet_id}`);
      console.log(`   Target Author: @${opp.target_username}`);
      console.log(`   Target Content: "${opp.target_tweet_content?.substring(0, 80)}..."`);
      console.log(`   Likes: ${opp.like_count}`);
      console.log(`   Posted: ${opp.tweet_posted_at ? new Date(opp.tweet_posted_at).toLocaleString() : 'N/A'}`);
      console.log(`   Is Reply Tweet: ${opp.is_reply_tweet || 'N/A'}`);
      console.log('');
      
      // Calculate target age
      if (opp.tweet_posted_at && metadata.created_at) {
        const targetTime = new Date(opp.tweet_posted_at).getTime();
        const replyTime = new Date(metadata.created_at).getTime();
        const ageMinutes = (replyTime - targetTime) / (60 * 1000);
        console.log(`⏰ TARGET AGE: ${Math.round(ageMinutes)} minutes at reply time`);
        console.log('');
      }
    } else {
      console.log('⚠️  No reply_opportunity found for target_tweet_id\n');
    }
  }
  
  // 3. Analyze reply content
  const content = metadata.content || '';
  
  // Check for thread markers
  const threadMarkers = [
    /\b\d+\/\d+\b/,
    /PROTOCOL:/i,
    /TIP:/i,
    /THREAD/i,
    /🧵/,
  ];
  
  const hasThreadMarkers = threadMarkers.some(pattern => pattern.test(content));
  const matchedMarkers = threadMarkers
    .filter(pattern => pattern.test(content))
    .map(pattern => pattern.source);
  
  console.log('🔬 CONTENT ANALYSIS:');
  console.log(`   Length: ${content.length} chars`);
  console.log(`   Line breaks: ${(content.match(/\n/g) || []).length}`);
  console.log(`   Has thread markers: ${hasThreadMarkers}`);
  if (hasThreadMarkers) {
    console.log(`   Matched patterns: ${matchedMarkers.join(', ')}`);
  }
  
  // Check if starts with @
  const startsWithMention = content.trim().startsWith('@');
  console.log(`   Starts with @: ${startsWithMention}`);
  console.log('');
  
  // 4. Determine what job generated it
  console.log('🎭 GENERATION SOURCE:');
  if (metadata.decision_type === 'reply') {
    console.log('   Job: replyJob (reply generation)');
  } else if (metadata.decision_type === 'post') {
    console.log('   Job: planJob (post generation)');
  } else if (metadata.decision_type === 'thread') {
    console.log('   Job: planJob (thread generation)');
  } else {
    console.log(`   Job: unknown (type=${metadata.decision_type})`);
  }
  
  if (metadata.generator_used) {
    console.log(`   Generator: ${metadata.generator_used}`);
  }
  
  console.log('');
  
  // 5. Root cause analysis
  console.log('💡 ROOT CAUSE ANALYSIS:');
  
  if (hasThreadMarkers && metadata.decision_type === 'reply') {
    console.log('   ❌ ISSUE: Thread-style content posted as reply');
    console.log('   REASON: Reply format guard not enforcing single-reply contract');
  }
  
  if (metadata.target_tweet_id && !metadata.decision_type) {
    console.log('   ❌ ISSUE: Has target but no decision_type');
  }
  
  if (metadata.decision_type === 'thread' && metadata.target_tweet_id) {
    console.log('   ❌ ISSUE: Thread content posted as reply (lane confusion)');
    console.log('   REASON: Thread job used target_tweet_id incorrectly');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

async function main() {
  const tweetIds = [
    '2007394704745476527',
    '2007393260239728702',
    '2007392376818675887'
  ];
  
  for (const id of tweetIds) {
    await traceTweet(id);
  }
}

main().catch(console.error);

