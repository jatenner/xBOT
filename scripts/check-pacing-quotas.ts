#!/usr/bin/env tsx
/**
 * Check pacing and quota behavior
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
  console.log('⏱️  PACING & QUOTA CHECK');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Check replies per hour (last 3 hours)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  
  const { data: lastHour } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, posted_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo);
  
  const { data: last2Hours } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, posted_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', twoHoursAgo)
    .lt('posted_at', oneHourAgo);
  
  const { data: last3Hours } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, posted_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', threeHoursAgo)
    .lt('posted_at', twoHoursAgo);
  
  console.log('📊 REPLIES PER HOUR:');
  console.log(`   Last 1 hour: ${lastHour?.length || 0} replies`);
  console.log(`   Hour -2: ${last2Hours?.length || 0} replies`);
  console.log(`   Hour -3: ${last3Hours?.length || 0} replies`);
  console.log(`   Target: 4 replies/hour`);
  console.log(`   Status: ${(lastHour?.length || 0) <= 4 ? '✅ Within limit' : '⚠️ EXCEEDED LIMIT'}\n`);
  
  // Check posts per day (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: postsLast24h } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, posted_at, tweet_id')
    .eq('decision_type', 'post')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', oneDayAgo);
  
  console.log('📊 POSTS PER DAY:');
  console.log(`   Last 24 hours: ${postsLast24h?.length || 0} posts (with tweet_id)`);
  console.log(`   Target: ~2 posts/day`);
  console.log(`   Status: ${(postsLast24h?.length || 0) <= 6 ? '✅ Within expected range' : '⚠️ High volume'}\n`);
  
  // Check gap timing for last 10 replies
  const { data: recentReplies } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, posted_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(10);
  
  if (recentReplies && recentReplies.length > 1) {
    console.log('⏱️  GAP TIMING (Last 10 Replies):');
    for (let i = 0; i < recentReplies.length - 1; i++) {
      const current = new Date(recentReplies[i].posted_at);
      const next = new Date(recentReplies[i + 1].posted_at);
      const gapMinutes = Math.round((current.getTime() - next.getTime()) / 60000);
      const status = gapMinutes >= 12 ? '✅' : '⚠️';
      console.log(`   ${status} Gap ${i + 1}: ${gapMinutes} min (target: 12-20 min)`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ PACING CHECK COMPLETE');
}

main().catch(console.error);

