#!/usr/bin/env tsx
/**
 * Verify exact state of target_followers field
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
  console.log('🔍 FOLLOWER DATA VERIFICATION\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get raw data
  const { data: opps } = await supabase
    .from('reply_opportunities')
    .select('target_username, target_followers, like_count')
    .eq('replied_to', false)
    .order('opportunity_score', { ascending: false })
    .limit(20);

  if (opps && opps.length > 0) {
    console.log('RAW DATA (top 20 opportunities):\n');
    opps.forEach((opp, i) => {
      const followers = opp.target_followers;
      const followerType = followers === null ? 'NULL' : 
                           followers === 0 ? 'ZERO' : 
                           typeof followers === 'undefined' ? 'UNDEFINED' : 
                           'VALUE';
      console.log(`${i + 1}. @${opp.target_username}`);
      console.log(`   target_followers: ${followers} (${followerType})`);
      console.log(`   like_count: ${opp.like_count}`);
    });
    console.log('');
  }

  // Count by value type
  const { count: total } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false);

  const { count: isNull } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .is('target_followers', null);

  const { count: isZero } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .eq('target_followers', 0);

  const { count: hasValue } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .not('target_followers', 'is', null)
    .neq('target_followers', 0);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 FOLLOWER DATA BREAKDOWN:\n');
  console.log(`   Total opportunities: ${total}`);
  console.log(`   target_followers = NULL:  ${isNull}`);
  console.log(`   target_followers = 0:     ${isZero}`);
  console.log(`   target_followers > 0:     ${hasValue}`);
  console.log('');

  const nullPercent = total ? (isNull! / total * 100).toFixed(1) : '0';
  const zeroPercent = total ? (isZero! / total * 100).toFixed(1) : '0';
  const hasValuePercent = total ? (hasValue! / total * 100).toFixed(1) : '0';

  console.log(`   NULL:  ${nullPercent}%`);
  console.log(`   ZERO:  ${zeroPercent}%`);
  console.log(`   VALUE: ${hasValuePercent}%`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎯 DIAGNOSIS:\n');

  if ((isNull || 0) > (total! * 0.9)) {
    console.log('   ❌ CRITICAL: 90%+ of opportunities have NULL target_followers\n');
    console.log('   This means the harvester is NOT populating follower counts at all');
    console.log('');
  } else if ((isZero || 0) > (total! * 0.9)) {
    console.log('   ❌ CRITICAL: 90%+ of opportunities have ZERO target_followers\n');
    console.log('   This means harvester is setting it to 0 (placeholder/default)');
    console.log('');
  } else if ((hasValue || 0) < 10) {
    console.log('   ❌ CRITICAL: Less than 10 opportunities have valid follower counts\n');
    console.log('   With MIN_FOLLOWERS=10000, replyJob will skip almost everything');
    console.log('');
  }
}

verify();

