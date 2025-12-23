#!/usr/bin/env tsx
/**
 * Show the separation between Discovery, Harvester, and Filter
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyze() {
  console.log('🔍 SYSTEM ARCHITECTURE: Discovery → Harvester → Filter → Reply\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check discovered accounts
  const { count: discoveredAccounts } = await supabase
    .from('discovered_accounts')
    .select('*', { count: 'exact', head: true });

  const { data: sampleAccounts } = await supabase
    .from('discovered_accounts')
    .select('username, follower_count, engagement_rate, priority_score')
    .order('priority_score', { ascending: false })
    .limit(5);

  console.log('📍 STEP 1: ACCOUNT DISCOVERY\n');
  console.log('   Job: accountDiscoveryJob / mega_viral_harvester');
  console.log('   Purpose: Find interesting accounts to monitor\n');
  console.log(`   ✅ Status: ${discoveredAccounts || 0} accounts discovered\n`);
  
  if (sampleAccounts && sampleAccounts.length > 0) {
    console.log('   Top 5 accounts:\n');
    sampleAccounts.forEach((acc, i) => {
      console.log(`   ${i + 1}. @${acc.username}`);
      console.log(`      Followers: ${acc.follower_count?.toLocaleString() || 'N/A'}`);
      console.log(`      Priority: ${acc.priority_score || 'N/A'}`);
    });
  }
  console.log('');
  console.log('   ⚙️  USES: follower_count, engagement_rate, priority_score');
  console.log('   📊 FILTERS: By account quality (follower count, engagement)');
  console.log('   💾 STORES: discovered_accounts table');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check reply opportunities
  const { count: totalOpps } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false);

  const { data: recentOpps } = await supabase
    .from('reply_opportunities')
    .select('target_username, like_count, target_followers, created_at')
    .eq('replied_to', false)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('📍 STEP 2: TWEET HARVESTING\n');
  console.log('   Job: replyOpportunityHarvester');
  console.log('   Purpose: Find viral tweets from discovered accounts\n');
  console.log(`   ✅ Status: ${totalOpps || 0} opportunities harvested\n`);
  
  if (recentOpps && recentOpps.length > 0) {
    console.log('   Recent tweets harvested:\n');
    recentOpps.forEach((opp, i) => {
      const minutesAgo = Math.round((Date.now() - new Date(opp.created_at).getTime()) / 1000 / 60);
      console.log(`   ${i + 1}. @${opp.target_username}`);
      console.log(`      Tweet likes: ${opp.like_count?.toLocaleString() || 'N/A'}`);
      console.log(`      Account followers: ${opp.target_followers || 'NULL'}`);
      console.log(`      Harvested: ${minutesAgo}m ago`);
    });
  }
  console.log('');
  console.log('   ⚙️  USES: Tweet engagement (likes, replies, views)');
  console.log('   📊 FILTERS: By tweet quality (virality, freshness)');
  console.log('   💾 STORES: reply_opportunities table');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📍 STEP 3: REPLY FILTERING\n');
  console.log('   Job: replyJob');
  console.log('   Purpose: Select which opportunities to reply to\n');

  const minFollowers = parseInt(process.env.REPLY_MIN_FOLLOWERS || '10000');
  console.log(`   ⚙️  ENV: REPLY_MIN_FOLLOWERS = ${minFollowers}\n`);

  const { count: wouldPass } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .gte('target_followers', minFollowers);

  const { count: wouldBlock } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .or(`target_followers.is.null,target_followers.lt.${minFollowers}`);

  console.log(`   📊 CURRENT FILTER RESULTS:`);
  console.log(`      Would PASS: ${wouldPass || 0} opportunities`);
  console.log(`      Would BLOCK: ${wouldBlock || 0} opportunities`);
  console.log('');
  console.log('   ⚙️  USES: target_followers (account size)');
  console.log('   📊 FILTERS: By account follower count');
  console.log('   💾 CREATES: reply decisions in content_metadata');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📍 STEP 4: REPLY POSTING\n');
  console.log('   Job: postingQueue');
  console.log('   Purpose: Post replies to X and save to database\n');

  const { count: repliesPosted } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString());

  console.log(`   ✅ Status: ${repliesPosted || 0} replies posted in last 10 hours\n`);
  console.log('   ⚙️  USES: Reply decisions from Step 3');
  console.log('   📊 NO FILTERS: Posts whatever Step 3 decided');
  console.log('   💾 SAVES: tweet_id to content_metadata');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

  // Show impact analysis
  console.log('🎯 IMPACT ANALYSIS: Lowering REPLY_MIN_FOLLOWERS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('IF WE CHANGE: REPLY_MIN_FOLLOWERS = 10000 → 0\n');

  console.log('📍 STEP 1 (Discovery):');
  console.log('   ✅ NO CHANGE - Discovery runs independently');
  console.log('   ✅ Still finds the same accounts');
  console.log('   ✅ Still filters by account quality\n');

  console.log('📍 STEP 2 (Harvester):');
  console.log('   ✅ NO CHANGE - Harvester runs independently');
  console.log('   ✅ Still collects the same tweets');
  console.log('   ✅ Still filters by tweet quality (likes, views)\n');

  console.log('📍 STEP 3 (Reply Filter):');
  console.log('   🔄 CHANGES HERE - Filter becomes more permissive');
  console.log(`   Before: ${wouldPass || 0} opportunities pass filter`);
  console.log(`   After:  ${totalOpps || 0} opportunities pass filter (all of them)`);
  console.log('   📈 More reply decisions created\n');

  console.log('📍 STEP 4 (Posting):');
  console.log('   🔄 MORE ACTIVITY - More replies to post');
  console.log('   ✅ Same posting logic');
  console.log('   ✅ Same saving logic\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('✅ SUMMARY:\n');
  console.log('   Discovery:  ✅ NOT AFFECTED (runs independently)');
  console.log('   Harvester:  ✅ NOT AFFECTED (runs independently)');
  console.log('   Filter:     🔄 MORE PERMISSIVE (lets more through)');
  console.log('   Posting:    📈 MORE REPLIES (gets more to post)\n');

  console.log('🎯 QUALITY CONTROL:\n');
  console.log('   Harvester already filters by tweet quality:');
  console.log('   • Only collects tweets with high engagement');
  console.log('   • Prioritizes fresh tweets (<2 hours)');
  console.log('   • Scores by virality and opportunity');
  console.log('');
  console.log('   So even with REPLY_MIN_FOLLOWERS=0:');
  console.log('   ✅ Still only replying to VIRAL tweets');
  console.log('   ✅ Still only replying to DISCOVERED accounts');
  console.log('   ✅ Just not filtering by account follower count anymore\n');
}

analyze();

