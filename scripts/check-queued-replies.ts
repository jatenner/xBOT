#!/usr/bin/env tsx
/**
 * Check for QUEUED replies (not just posted)
 */

import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 QUEUED REPLIES CHECK');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Get queued replies
  const { data: queuedReplies, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, tweet_id, target_tweet_id, root_tweet_id, original_candidate_tweet_id, resolved_via_root, created_at, posted_at, status')
    .eq('decision_type', 'reply')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  }
  
  if (!queuedReplies || queuedReplies.length === 0) {
    console.log('ℹ️  No queued replies found');
    
    // Check for replies in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentReplies } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, status, created_at')
      .eq('decision_type', 'reply')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false });
    
    if (recentReplies && recentReplies.length > 0) {
      console.log(`\n📊 Found ${recentReplies.length} replies created in last hour:`);
      for (const r of recentReplies) {
        const age = Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000);
        console.log(`   ${r.decision_id.substring(0, 8)}: status=${r.status} (${age} min ago)`);
      }
    } else {
      console.log('\n⚠️  No replies created in last hour either');
    }
    
    return;
  }
  
  console.log(`Found ${queuedReplies.length} queued replies:\n`);
  
  for (const reply of queuedReplies) {
    const decisionShort = reply.decision_id?.substring(0, 8) || 'N/A';
    const createdTime = new Date(reply.created_at);
    const age = Math.round((Date.now() - createdTime.getTime()) / 60000);
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Decision: ${decisionShort}`);
    console.log(`Status: ${reply.status}`);
    console.log(`Created: ${createdTime.toISOString()} (${age} min ago)`);
    console.log(`Target: ${reply.target_tweet_id || 'N/A'}`);
    console.log(`Root: ${reply.root_tweet_id || 'N/A'}`);
    console.log(`Original Candidate: ${reply.original_candidate_tweet_id || 'N/A'}`);
    console.log(`Resolved via Root: ${reply.resolved_via_root || false}`);
    
    if (reply.root_tweet_id && reply.original_candidate_tweet_id) {
      if (reply.root_tweet_id === reply.original_candidate_tweet_id) {
        console.log(`✅ Candidate was already a root tweet`);
      } else {
        console.log(`✅ Resolved: ${reply.original_candidate_tweet_id} → ROOT ${reply.root_tweet_id}`);
      }
    }
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📊 SUMMARY: ${queuedReplies.length} queued replies ready to post`);
}

main().catch(console.error);

