#!/usr/bin/env tsx
/**
 * 🔍 FORENSIC AUDIT - Rate Limit Inputs
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
  console.log('🔍 FORENSIC AUDIT - RATE LIMIT INPUTS (Last 2h)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // 1. Posts counting toward quota (EXACT postingQueue logic)
  console.log('1. POSTS COUNTING TOWARD HOURLY QUOTA:');
  console.log(`   Query: status='posted' AND tweet_id IS NOT NULL AND posted_at >= '${oneHourAgo}'`);
  
  const { count: postsThisHour, data: postsData } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, posted_at, tweet_id', { count: 'exact' })
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', oneHourAgo);

  console.log(`   Count: ${postsThisHour || 0}`);
  if (postsData && postsData.length > 0) {
    postsData.forEach(p => {
      console.log(`      - ${p.decision_type} ${p.decision_id} at ${p.posted_at}`);
    });
  }

  // 2. Replies counting toward quota
  console.log('\n2. REPLIES COUNTING TOWARD HOURLY QUOTA:');
  console.log(`   Query: decision_type='reply' AND status='posted' AND tweet_id IS NOT NULL AND posted_at >= '${oneHourAgo}'`);
  
  const { count: repliesThisHour, data: repliesData } = await supabase
    .from('content_metadata')
    .select('decision_id, posted_at, tweet_id', { count: 'exact' })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', oneHourAgo);

  console.log(`   Count: ${repliesThisHour || 0}`);
  if (repliesData && repliesData.length > 0) {
    repliesData.forEach(r => {
      console.log(`      - reply ${r.decision_id} at ${r.posted_at}`);
    });
  }

  // 3. Rate limit thresholds
  console.log('\n3. RATE LIMIT EVALUATION:');
  console.log(`   Posts this hour: ${postsThisHour || 0} / 2 (limit)`);
  console.log(`   Replies this hour: ${repliesThisHour || 0} / 5 (limit)`);
  console.log(`   Posts can proceed: ${(postsThisHour || 0) < 2 ? '✅ YES' : '❌ NO (rate limited)'}`);
  console.log(`   Replies can proceed: ${(repliesThisHour || 0) < 5 ? '✅ YES' : '❌ NO (rate limited)'}`);

  // 4. Last 2 hours for context
  console.log('\n4. LAST 2 HOURS CONTEXT:');
  const { count: posts2h } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', twoHoursAgo);

  const { count: replies2h } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', twoHoursAgo);

  console.log(`   Posts (last 2h): ${posts2h || 0}`);
  console.log(`   Replies (last 2h): ${replies2h || 0}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);

