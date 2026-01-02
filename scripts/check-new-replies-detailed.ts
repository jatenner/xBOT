#!/usr/bin/env tsx
/**
 * Check most recent replies in detail (queued + posted)
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
  console.log('🔍 DETAILED REPLY CHECK (Including Queued)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Get last 10 replies by created_at (including queued)
  const { data: replies, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, tweet_id, target_tweet_id, root_tweet_id, original_candidate_tweet_id, resolved_via_root, created_at, posted_at, status')
    .eq('decision_type', 'reply')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  }
  
  if (!replies || replies.length === 0) {
    console.log('ℹ️  No replies found');
    process.exit(0);
  }
  
  console.log(`Found ${replies.length} recent replies:\n`);
  
  for (const reply of replies) {
    const decisionShort = reply.decision_id?.substring(0, 8) || 'N/A';
    const createdTime = new Date(reply.created_at);
    const age = Math.round((Date.now() - createdTime.getTime()) / 60000);
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Decision: ${decisionShort}`);
    console.log(`Status: ${reply.status}`);
    console.log(`Created: ${createdTime.toISOString()} (${age} min ago)`);
    console.log(`Posted: ${reply.posted_at || 'Not posted yet'}`);
    console.log(`Tweet ID: ${reply.tweet_id || 'N/A'}`);
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
  
  const rootResolvedCount = replies.filter(r => r.resolved_via_root).length;
  const withRootField = replies.filter(r => r.root_tweet_id).length;
  const queued = replies.filter(r => r.status === 'queued').length;
  const posted = replies.filter(r => r.status === 'posted').length;
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total: ${replies.length}`);
  console.log(`   Queued: ${queued}, Posted: ${posted}`);
  console.log(`   With root_tweet_id: ${withRootField} (${((withRootField/replies.length)*100).toFixed(1)}%)`);
  console.log(`   Resolved via root: ${rootResolvedCount} (${((rootResolvedCount/replies.length)*100).toFixed(1)}%)`);
}

main().catch(console.error);

