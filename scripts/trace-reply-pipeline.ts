/**
 * Trace reply pipeline for specific tweet IDs
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const tweetIds = process.argv.slice(2);
  if (tweetIds.length === 0) {
    console.error('Usage: tsx scripts/trace-reply-pipeline.ts <tweet_id1> <tweet_id2> ...');
    process.exit(1);
  }
  
  const supabase = getSupabaseClient();
  
  console.log(`🔍 Tracing ${tweetIds.length} reply tweet IDs...\n`);
  
  for (const tweetId of tweetIds) {
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`📋 Tweet ID: ${tweetId}`);
    console.log(`═══════════════════════════════════════════════════════════\n`);
    
    // Query content_metadata (try comprehensive table first)
    let decision: any = null;
    let error: any = null;
    
    const { data: decisions, error: err1 } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*')
      .eq('tweet_id', tweetId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (err1) {
      // Try content_metadata table
      const { data: decisions2, error: err2 } = await supabase
        .from('content_metadata')
        .select('*')
        .eq('tweet_id', tweetId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (err2) {
        console.error(`❌ Error querying both tables: ${err1.message} / ${err2.message}`);
        continue;
      }
      
      decision = decisions2?.[0];
    } else {
      decision = decisions?.[0];
    }
    
    if (!decision) {
      console.log(`⚠️  No decision found for tweet_id=${tweetId}`);
      continue;
    }
    
    console.log(`✅ Found decision record:`);
    console.log(`   decision_id: ${decision.decision_id}`);
    console.log(`   decision_type: ${decision.decision_type}`);
    console.log(`   status: ${decision.status}`);
    console.log(`   job_source: ${decision.job_source || 'N/A'}`);
    console.log(`   generator_name: ${decision.generator_name || 'N/A'}`);
    console.log(`   build_sha: ${decision.build_sha || 'N/A'}`);
    console.log(`   created_at: ${decision.created_at}`);
    console.log(`   posted_at: ${decision.posted_at || 'N/A'}`);
    console.log(`   target_tweet_id: ${decision.target_tweet_id || 'N/A'}`);
    console.log(`   target_username: ${decision.target_username || 'N/A'}`);
    console.log(`   root_tweet_id: ${decision.root_tweet_id || 'N/A'}`);
    console.log(`   target_tweet_content_snapshot: ${decision.target_tweet_content_snapshot ? decision.target_tweet_content_snapshot.substring(0, 100) + '...' : 'N/A'}`);
    console.log(`   content: ${decision.content ? decision.content.substring(0, 150) + '...' : 'N/A'}`);
    
    // Check if target tweet exists in reply_opportunities
    if (decision.target_tweet_id) {
      const { data: opp } = await supabase
        .from('reply_opportunities')
        .select('*')
        .eq('target_tweet_id', decision.target_tweet_id)
        .single();
      
      if (opp) {
        console.log(`\n📊 Reply Opportunity Record:`);
        console.log(`   is_root_tweet: ${opp.is_root_tweet}`);
        console.log(`   is_reply_tweet: ${opp.is_reply_tweet}`);
        console.log(`   target_in_reply_to_tweet_id: ${opp.target_in_reply_to_tweet_id || 'NULL'}`);
        console.log(`   root_tweet_id: ${opp.root_tweet_id || 'N/A'}`);
        console.log(`   target_tweet_content: ${opp.target_tweet_content ? opp.target_tweet_content.substring(0, 100) + '...' : 'N/A'}`);
        console.log(`   selection_reason: ${opp.selection_reason || 'N/A'}`);
      } else {
        console.log(`\n⚠️  No reply_opportunity record found for target_tweet_id=${decision.target_tweet_id}`);
      }
    }
    
    // Check if this is a reply to our own tweet (self-reply thread)
    if (decision.target_tweet_id) {
      const { data: targetDecision } = await supabase
        .from('content_metadata')
        .select('tweet_id, decision_type, target_username')
        .eq('tweet_id', decision.target_tweet_id)
        .single();
      
      if (targetDecision && targetDecision.target_username === 'Signal_Synapse') {
        console.log(`\n🚨 SELF-REPLY THREAD DETECTED:`);
        console.log(`   This reply targets our own tweet: ${decision.target_tweet_id}`);
        console.log(`   Target decision_type: ${targetDecision.decision_type}`);
      }
    }
  }
  
  // Also check last 2 hours of replies for reply-to-reply cases
  console.log(`\n\n═══════════════════════════════════════════════════════════`);
  console.log(`📊 Checking last 2 hours of replies for reply-to-reply cases...`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  // Try comprehensive table first
  let recentReplies: any[] = [];
  const { data: replies1 } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('tweet_id, decision_id, target_tweet_id, target_username, root_tweet_id, created_at, job_name')
    .eq('decision_type', 'reply')
    .in('status', ['posted', 'queued', 'ready'])
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (replies1) {
    recentReplies = replies1.map(r => ({ ...r, job_source: r.job_name }));
  } else {
    const { data: replies2 } = await supabase
      .from('content_metadata')
      .select('tweet_id, decision_id, target_tweet_id, target_username, root_tweet_id, created_at, job_source')
      .eq('decision_type', 'reply')
      .in('status', ['posted', 'queued', 'ready'])
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (replies2) {
      recentReplies = replies2;
    }
  }
  
  if (recentReplies && recentReplies.length > 0) {
    console.log(`Found ${recentReplies.length} recent replies:\n`);
    
    for (const reply of recentReplies) {
      // Check if target is a reply
      if (reply.target_tweet_id) {
        const { data: targetOpp } = await supabase
          .from('reply_opportunities')
          .select('is_root_tweet, is_reply_tweet, target_in_reply_to_tweet_id, root_tweet_id')
          .eq('target_tweet_id', reply.target_tweet_id)
          .single();
        
        const isReplyToReply = targetOpp && (
          targetOpp.is_reply_tweet === true ||
          targetOpp.target_in_reply_to_tweet_id !== null ||
          (targetOpp.is_root_tweet === false)
        );
        
        if (isReplyToReply) {
          console.log(`🚨 REPLY-TO-REPLY DETECTED:`);
          console.log(`   tweet_id: ${reply.tweet_id}`);
          console.log(`   target_tweet_id: ${reply.target_tweet_id}`);
          console.log(`   job_source: ${reply.job_source || 'N/A'}`);
          console.log(`   is_root_tweet: ${targetOpp.is_root_tweet}`);
          console.log(`   is_reply_tweet: ${targetOpp.is_reply_tweet}`);
          console.log(`   target_in_reply_to_tweet_id: ${targetOpp.target_in_reply_to_tweet_id || 'NULL'}`);
          console.log(`   root_tweet_id: ${targetOpp.root_tweet_id || 'N/A'}`);
          console.log('');
        }
      }
    }
  }
  
  process.exit(0);
}

main().catch(console.error);

