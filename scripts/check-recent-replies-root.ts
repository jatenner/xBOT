#!/usr/bin/env tsx
/**
 * Check recent replies for root resolution
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
  console.log('🎯 RECENT REPLIES ROOT-RESOLUTION CHECK');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Get last 20 replies by posted_at
  const { data: replies, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, tweet_id, target_tweet_id, original_candidate_tweet_id, root_tweet_id, resolved_via_root, created_at, posted_at, status')
    .eq('decision_type', 'reply')
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(20);
  
  if (error) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  }
  
  if (!replies || replies.length === 0) {
    console.log('ℹ️  No replies found');
    process.exit(0);
  }
  
  console.log(`Found ${replies.length} recent replies:\n`);
  console.log('┌──────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ Decision ID (8) │ Posted At           │ Root Resolved? │ Root ≠ Candidate? │');
  console.log('├──────────────────────────────────────────────────────────────────────────────┤');
  
  let rootResolvedCount = 0;
  let rootDiffersCount = 0;
  
  for (const reply of replies) {
    const decisionShort = reply.decision_id?.substring(0, 8) || 'N/A';
    const postedAt = reply.posted_at ? new Date(reply.posted_at).toISOString().substring(0, 19).replace('T', ' ') : 'Not posted';
    const rootResolved = reply.resolved_via_root ? 'YES' : 'NO';
    const rootDiffers = reply.root_tweet_id && reply.original_candidate_tweet_id && 
                        reply.root_tweet_id !== reply.original_candidate_tweet_id ? 'YES' : 'NO';
    
    if (reply.resolved_via_root) rootResolvedCount++;
    if (rootDiffers === 'YES') rootDiffersCount++;
    
    console.log(`│ ${decisionShort.padEnd(15)} │ ${postedAt.padEnd(19)} │ ${rootResolved.padEnd(14)} │ ${rootDiffers.padEnd(17)} │`);
  }
  
  console.log('└──────────────────────────────────────────────────────────────────────────────┘');
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total replies: ${replies.length}`);
  console.log(`   Root resolved: ${rootResolvedCount} (${((rootResolvedCount/replies.length)*100).toFixed(1)}%)`);
  console.log(`   Root ≠ Candidate: ${rootDiffersCount} (${((rootDiffersCount/replies.length)*100).toFixed(1)}%)`);
  
  // Show detailed view of first 3
  console.log(`\n📋 DETAILED VIEW (First 3):`);
  for (let i = 0; i < Math.min(3, replies.length); i++) {
    const r = replies[i];
    console.log(`\n${i+1}. Decision: ${r.decision_id?.substring(0, 8)}`);
    console.log(`   Tweet ID: ${r.tweet_id || 'N/A'}`);
    console.log(`   Target: ${r.target_tweet_id || 'N/A'}`);
    console.log(`   Original Candidate: ${r.original_candidate_tweet_id || 'N/A'}`);
    console.log(`   Root: ${r.root_tweet_id || 'N/A'}`);
    console.log(`   Resolved via Root: ${r.resolved_via_root || false}`);
    console.log(`   Posted: ${r.posted_at || 'Not posted'}`);
  }
}

main().catch(console.error);

