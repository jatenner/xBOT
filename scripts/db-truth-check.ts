#!/usr/bin/env tsx
/**
 * Check DB for recent activity
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
  console.log('DB TRUTH CHECK - LAST 2 HOURS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // 1. Last posted single/thread
  const { data: lastPost } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, posted_at, decision_type')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(1);

  console.log('1. LAST POSTED SINGLE/THREAD:');
  if (lastPost && lastPost.length > 0) {
    console.log(`   ${lastPost[0].decision_id} → ${lastPost[0].tweet_id}`);
    console.log(`   Posted at: ${lastPost[0].posted_at}`);
  } else {
    console.log('   ❌ NO POSTS FOUND');
  }

  // 2. Last posted reply
  const { data: lastReply } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, posted_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(1);

  console.log('\n2. LAST POSTED REPLY:');
  if (lastReply && lastReply.length > 0) {
    console.log(`   ${lastReply[0].decision_id} → ${lastReply[0].tweet_id}`);
    console.log(`   Posted at: ${lastReply[0].posted_at}`);
  } else {
    console.log('   ❌ NO REPLIES FOUND');
  }

  // 3. Count posted in last 2h
  const { count: postsCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', twoHoursAgo);

  const { count: repliesCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', twoHoursAgo);

  console.log('\n3. POSTED IN LAST 2 HOURS:');
  console.log(`   Posts: ${postsCount || 0}`);
  console.log(`   Replies: ${repliesCount || 0}`);

  // 4. Queued decisions ready now
  const now = new Date().toISOString();
  const { data: queued } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, scheduled_at')
    .eq('status', 'queued')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(5);

  console.log('\n4. QUEUED DECISIONS READY NOW:');
  if (queued && queued.length > 0) {
    queued.forEach(q => {
      const hoursAgo = ((Date.now() - new Date(q.scheduled_at).getTime()) / (1000 * 60 * 60)).toFixed(1);
      console.log(`   [${q.decision_type}] ${q.decision_id} (due ${hoursAgo}h ago)`);
    });
  } else {
    console.log('   None');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);

