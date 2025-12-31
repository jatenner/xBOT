#!/usr/bin/env tsx
/**
 * 🔍 IMMEDIATE PRODUCTION VERIFICATION - Last 60 Minutes
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
  console.log('🔍 PRODUCTION VERIFICATION - LAST 60 MINUTES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // 1. Posts with tweet_id NOT NULL (successfully posted)
  console.log('1. POSTS SUCCESSFULLY POSTED (tweet_id NOT NULL):');
  const { count: postsPosted, data: postsData } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, posted_at', { count: 'exact' })
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', sixtyMinAgo);

  console.log(`   Count: ${postsPosted || 0}`);
  if (postsData && postsData.length > 0) {
    postsData.forEach(p => {
      console.log(`   - ${p.decision_id} → ${p.tweet_id} at ${p.posted_at}`);
    });
  }

  // 2. Replies with tweet_id NOT NULL
  console.log('\n2. REPLIES SUCCESSFULLY POSTED (tweet_id NOT NULL):');
  const { count: repliesPosted, data: repliesData } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, posted_at', { count: 'exact' })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', sixtyMinAgo);

  console.log(`   Count: ${repliesPosted || 0}`);
  if (repliesData && repliesData.length > 0) {
    repliesData.forEach(r => {
      console.log(`   - ${r.decision_id} → ${r.tweet_id} at ${r.posted_at}`);
    });
  }

  // 3. Queued decisions ready to post (scheduled_at <= now)
  console.log('\n3. QUEUED DECISIONS READY TO POST (scheduled_at <= NOW):');
  const { count: readyCount, data: readyData } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, scheduled_at, created_at', { count: 'exact' })
    .eq('status', 'queued')
    .lte('scheduled_at', now);

  console.log(`   Count: ${readyCount || 0}`);
  if (readyData && readyData.length > 0) {
    readyData.slice(0, 5).forEach(d => {
      const hoursAgo = ((Date.now() - new Date(d.scheduled_at).getTime()) / (1000 * 60 * 60)).toFixed(1);
      console.log(`   - [${d.decision_type}] ${d.decision_id} (due ${hoursAgo}h ago)`);
    });
  }

  // 4. Failures in last 60 minutes
  console.log('\n4. FAILURES (last 60 min):');
  const { count: failCount, data: failData } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, updated_at, status', { count: 'exact' })
    .eq('status', 'failed')
    .gte('updated_at', sixtyMinAgo);

  console.log(`   Count: ${failCount || 0}`);
  if (failData && failData.length > 0) {
    failData.slice(0, 3).forEach(f => {
      console.log(`   - [${f.decision_type}] ${f.decision_id} at ${f.updated_at}`);
    });
  }

  // 5. Recent activity summary
  console.log('\n5. ACTIVITY SUMMARY (last 60 min):');
  console.log(`   Posts created: ${await getCountCreated('single', 'thread', sixtyMinAgo)}`);
  console.log(`   Replies created: ${await getCountCreated('reply', null, sixtyMinAgo)}`);
  console.log(`   Posts posted: ${postsPosted || 0}`);
  console.log(`   Replies posted: ${repliesPosted || 0}`);
  console.log(`   Ready to post: ${readyCount || 0}`);
  console.log(`   Failed: ${failCount || 0}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
}

async function getCountCreated(type1: string, type2: string | null, since: string): Promise<number> {
  if (type2) {
    const { count } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', [type1, type2])
      .gte('created_at', since);
    return count || 0;
  } else {
    const { count } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', type1)
      .gte('created_at', since);
    return count || 0;
  }
}

main().catch(console.error);

