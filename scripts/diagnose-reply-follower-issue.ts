#!/usr/bin/env tsx
/**
 * Check why all accounts show 0 followers
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnose() {
  console.log('🔍 REPLY FOLLOWER COUNT DIAGNOSIS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check discovered_accounts
  const { data: accounts } = await supabase
    .from('discovered_accounts')
    .select('username, follower_count, engagement_rate, discovered_at')
    .order('discovered_at', { ascending: false })
    .limit(20);

  if (accounts && accounts.length > 0) {
    console.log('📊 RECENT DISCOVERED ACCOUNTS:\n');
    accounts.forEach((acc, i) => {
      console.log(`   ${i + 1}. @${acc.username}`);
      console.log(`      Followers: ${acc.follower_count || 0}`);
      console.log(`      Engagement: ${acc.engagement_rate || 'N/A'}`);
      console.log(`      Discovered: ${new Date(acc.discovered_at).toLocaleString()}`);
    });
    console.log('');
  }

  // Count accounts with 0 followers
  const { count: zeroFollowers } = await supabase
    .from('discovered_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('follower_count', 0);

  const { count: totalAccounts } = await supabase
    .from('discovered_accounts')
    .select('*', { count: 'exact', head: true });

  console.log(`📈 FOLLOWER COUNT STATUS:\n`);
  console.log(`   Total accounts: ${totalAccounts || 0}`);
  console.log(`   With follower_count = 0: ${zeroFollowers || 0}`);
  console.log(`   With valid follower_count: ${(totalAccounts || 0) - (zeroFollowers || 0)}`);
  console.log('');

  const percentage = totalAccounts && zeroFollowers ? (zeroFollowers / totalAccounts * 100).toFixed(1) : '0';
  console.log(`   🚨 ${percentage}% of accounts have ZERO followers recorded!\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check reply opportunities with follower data
  const { data: opportunities } = await supabase
    .from('reply_opportunities')
    .select(`
      *,
      discovered_accounts!inner(username, follower_count, engagement_rate)
    `)
    .eq('replied_to', false)
    .order('opportunity_score', { ascending: false })
    .limit(10);

  if (opportunities && opportunities.length > 0) {
    console.log('🎯 TOP REPLY OPPORTUNITIES (with follower data):\n');
    opportunities.forEach((opp: any, i) => {
      const account = opp.discovered_accounts;
      console.log(`   ${i + 1}. Score: ${opp.opportunity_score?.toFixed(2) || 'N/A'}`);
      console.log(`      Username: @${account?.username || opp.target_username || 'N/A'}`);
      console.log(`      Followers: ${account?.follower_count || 0}`);
      console.log(`      Engagement: ${account?.engagement_rate || 'N/A'}`);
      console.log(`      ${account?.follower_count >= 10000 ? '✅ MEETS THRESHOLD' : '❌ BELOW THRESHOLD (10K)'}`);
      console.log('');
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🩺 DIAGNOSIS:\n');

  if ((zeroFollowers || 0) > (totalAccounts || 1) * 0.8) {
    console.log('🚨 CRITICAL: 80%+ of accounts have follower_count = 0\n');
    console.log('   ROOT CAUSE: Follower counts not being scraped during account discovery\n');
    console.log('   RESULT: replyJob filters out ALL opportunities (min threshold: 10K)\n');
    console.log('');
    console.log('   🔧 FIX OPTIONS:\n');
    console.log('   1. IMMEDIATE: Lower follower threshold temporarily');
    console.log('      railway variables --set MIN_REPLY_FOLLOWER_THRESHOLD=1000 --service xBOT');
    console.log('');
    console.log('   2. PROPER: Fix account discovery job to scrape follower counts');
    console.log('      Check: accountDiscoveryJob.ts or mega_viral_harvester');
    console.log('      Ensure follower_count is populated during discovery');
    console.log('');
    console.log('   3. BACKFILL: Run engagement calculator to fill missing follower counts');
    console.log('      railway run --service xBOT -- pnpm job:engagement-calculator');
    console.log('');
  } else {
    console.log('✅ Follower counts are mostly populated');
  }
}

diagnose();

