#!/usr/bin/env tsx
/**
 * 🔍 FORENSIC AUDIT - Last Activity Times
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
  console.log('🔍 FORENSIC AUDIT - LAST ACTIVITY TIMES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Last posted SINGLE/THREAD
  console.log('1. LAST POSTED SINGLE/THREAD (tweet_id NOT NULL):');
  const { data: lastPost } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, posted_at, decision_type, content')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(1);

  if (lastPost && lastPost.length > 0) {
    console.log(`   Decision ID: ${lastPost[0].decision_id}`);
    console.log(`   Tweet ID: ${lastPost[0].tweet_id}`);
    console.log(`   Posted At: ${lastPost[0].posted_at}`);
    console.log(`   Type: ${lastPost[0].decision_type}`);
    console.log(`   Content: "${lastPost[0].content?.substring(0, 60)}..."`);
  } else {
    console.log('   ❌ NO POSTS FOUND');
  }

  // 2. Last posted REPLY
  console.log('\n2. LAST POSTED REPLY (tweet_id NOT NULL):');
  const { data: lastReply } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, posted_at, target_tweet_id, content')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(1);

  if (lastReply && lastReply.length > 0) {
    console.log(`   Decision ID: ${lastReply[0].decision_id}`);
    console.log(`   Tweet ID: ${lastReply[0].tweet_id}`);
    console.log(`   Posted At: ${lastReply[0].posted_at}`);
    console.log(`   Target Tweet: ${lastReply[0].target_tweet_id}`);
    console.log(`   Content: "${lastReply[0].content?.substring(0, 60)}..."`);
  } else {
    console.log('   ❌ NO REPLIES FOUND');
  }

  // 3. Count posted in last 6 hours
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  
  console.log('\n3. POSTED IN LAST 6 HOURS:');
  const { count: postsCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', sixHoursAgo);

  const { count: repliesCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', sixHoursAgo);

  console.log(`   Posts (single/thread): ${postsCount || 0}`);
  console.log(`   Replies: ${repliesCount || 0}`);

  // 4. Failed in last 6 hours
  console.log('\n4. FAILED IN LAST 6 HOURS:');
  const { data: failed } = await supabase
    .from('content_metadata')
    .select('decision_type, last_error')
    .eq('status', 'failed')
    .gte('updated_at', sixHoursAgo);

  if (failed && failed.length > 0) {
    const failedByType: Record<string, number> = {};
    failed.forEach(f => {
      failedByType[f.decision_type] = (failedByType[f.decision_type] || 0) + 1;
    });
    Object.entries(failedByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} failures`);
    });
    console.log('\n   Sample errors:');
    failed.slice(0, 3).forEach((f, i) => {
      console.log(`   ${i + 1}. [${f.decision_type}] ${f.last_error || 'no error message'}`);
    });
  } else {
    console.log('   No failures in last 6 hours');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);

