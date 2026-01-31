#!/usr/bin/env tsx
/**
 * Check Harvester Throughput
 * 
 * Shows harvester effectiveness for root opportunities
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🌾 Harvester Throughput Check');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Check opportunities by age
  const { data: opps } = await supabase
    .from('reply_opportunities')
    .select('tweet_posted_at, is_root_tweet, replied_to, like_count')
    .eq('is_root_tweet', true)
    .eq('replied_to', false);
  
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const threeHoursAgo = now - 3 * 60 * 60 * 1000;
  const sixHoursAgo = now - 6 * 60 * 60 * 1000;
  
  const fresh1h = opps?.filter(o => {
    if (!o.tweet_posted_at) return false;
    return new Date(o.tweet_posted_at).getTime() > oneHourAgo;
  }).length || 0;
  
  const fresh3h = opps?.filter(o => {
    if (!o.tweet_posted_at) return false;
    return new Date(o.tweet_posted_at).getTime() > threeHoursAgo;
  }).length || 0;
  
  const fresh6h = opps?.filter(o => {
    if (!o.tweet_posted_at) return false;
    return new Date(o.tweet_posted_at).getTime() > sixHoursAgo;
  }).length || 0;
  
  console.log(`📊 Root Opportunities:`);
  console.log(`   Total unclaimed: ${opps?.length || 0}`);
  console.log(`   Fresh <1h: ${fresh1h}`);
  console.log(`   Fresh <3h: ${fresh3h}`);
  console.log(`   Fresh <6h: ${fresh6h}`);
  
  if (opps && opps.length > 0) {
    const newest = opps.reduce((newest, o) => {
      if (!o.tweet_posted_at) return newest;
      const oTime = new Date(o.tweet_posted_at).getTime();
      const newestTime = newest ? new Date(newest).getTime() : 0;
      return oTime > newestTime ? o.tweet_posted_at : newest;
    }, null as string | null);
    console.log(`   Newest: ${newest || 'N/A'}`);
    
    const avgLikes = opps.reduce((sum, o) => sum + (o.like_count || 0), 0) / opps.length;
    console.log(`   Avg likes: ${Math.round(avgLikes)}`);
  }
  
  // Check recent harvester runs
  const { data: harvestEvents } = await supabase
    .from('system_events')
    .select('created_at, event_data')
    .eq('event_type', 'HARVEST_COMPLETE')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(`\n📊 Recent Harvester Runs:`);
  if (harvestEvents && harvestEvents.length > 0) {
    harvestEvents.forEach((e, i) => {
      const data = typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data;
      console.log(`   ${i + 1}. ${e.created_at}: harvested=${data.total_harvested || 0} pool=${data.final_pool_size || 0}`);
    });
  } else {
    console.log(`   No recent harvest events found`);
  }
  
  // Check harvester cadence (job manager logs)
  console.log(`\n💡 Harvester Cadence:`);
  console.log(`   Default: Every 15 minutes (JOBS_HARVEST_INTERVAL_MIN)`);
  console.log(`   For P1: Consider setting JOBS_HARVEST_INTERVAL_MIN=10 for faster throughput`);
}

main().catch(console.error);
