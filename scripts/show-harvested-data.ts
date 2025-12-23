#!/usr/bin/env tsx
/**
 * Show exactly what data the harvester IS and ISN'T collecting
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function show() {
  console.log('🔍 WHAT DATA IS THE HARVESTER COLLECTING?\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { data: opportunities } = await supabase
    .from('reply_opportunities')
    .select('*')
    .eq('replied_to', false)
    .order('created_at', { ascending: false })
    .limit(5);

  if (opportunities && opportunities.length > 0) {
    opportunities.forEach((opp, i) => {
      console.log(`\n📋 OPPORTUNITY #${i + 1}:\n`);
      console.log('   ✅ TWEET DATA (What we ARE getting):\n');
      console.log(`      target_tweet_id:    ${opp.target_tweet_id || 'NULL'} ${opp.target_tweet_id ? '✅' : '❌'}`);
      console.log(`      target_username:    @${opp.target_username || 'NULL'} ${opp.target_username ? '✅' : '❌'}`);
      console.log(`      like_count:         ${(opp.like_count || 0).toLocaleString()} ${opp.like_count ? '✅' : '❌'}`);
      console.log(`      reply_count:        ${(opp.reply_count || 0).toLocaleString()} ${opp.reply_count ? '✅' : '❌'}`);
      console.log(`      retweet_count:      ${(opp.retweet_count || 0).toLocaleString()} ${opp.retweet_count ? '✅' : '❌'}`);
      console.log(`      view_count:         ${(opp.view_count || 0).toLocaleString()} ${opp.view_count ? '✅' : '❌'}`);
      console.log(`      tweet_text:         "${(opp.tweet_text || '').substring(0, 60)}..." ${opp.tweet_text ? '✅' : '❌'}`);
      console.log(`      posted_minutes_ago: ${opp.posted_minutes_ago || 'NULL'} ${opp.posted_minutes_ago !== null ? '✅' : '❌'}`);
      console.log('');
      console.log('   ❌ ACCOUNT DATA (What we are NOT getting):\n');
      console.log(`      target_followers:   ${opp.target_followers === null ? 'NULL' : opp.target_followers} ❌`);
      console.log(`      engagement_rate:    ${opp.engagement_rate || 'NULL'} ${opp.engagement_rate ? '✅' : '❌'}`);
      console.log('');
      console.log('   📊 CALCULATED SCORES:\n');
      console.log(`      opportunity_score:  ${opp.opportunity_score?.toFixed(2) || 'NULL'}`);
      console.log('');
      console.log('   ⏰ METADATA:\n');
      console.log(`      created_at:         ${new Date(opp.created_at).toLocaleString()}`);
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
  }

  console.log('\n\n📊 SUMMARY:\n');
  console.log('✅ HARVESTER IS COLLECTING:');
  console.log('   • Tweet ID (for replying)');
  console.log('   • Tweet text/content (so reply knows what to reply to)');
  console.log('   • Username (who posted it)');
  console.log('   • Like count (how popular the tweet is)');
  console.log('   • Reply/retweet/view counts (tweet engagement)');
  console.log('   • How old the tweet is (freshness)');
  console.log('');
  console.log('❌ HARVESTER IS NOT COLLECTING:');
  console.log('   • target_followers = How many followers @DiscussingFilm has');
  console.log('     (NOT the tweet likes, but the ACCOUNT\'s follower count)');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🎯 THE CONFUSION:\n');
  console.log('   "target_followers" ≠ Tweet likes/views');
  console.log('   "target_followers" = Account follower count\n');
  console.log('   Example:');
  console.log('   • @DiscussingFilm posts a tweet');
  console.log('   • Tweet gets 120,000 likes ✅ (we have this as "like_count")');
  console.log('   • @DiscussingFilm has 500,000 followers ❌ (we DON\'T have this)\n');
  console.log('   We need BOTH:');
  console.log('   • Tweet likes (for quality scoring) ✅ HAVE IT');
  console.log('   • Account followers (for filtering) ❌ MISSING\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🔍 WHY IT MATTERS:\n');
  console.log('   Filter code checks:');
  console.log('   "Does @DiscussingFilm have 10,000+ followers?"');
  console.log('   NOT "Does the tweet have 10,000+ likes?"');
  console.log('');
  console.log('   Current state:');
  console.log('   • like_count: 120,000 ✅ (tweet popularity)');
  console.log('   • target_followers: NULL ❌ (account size)');
  console.log('');
  console.log('   Filter sees: target_followers = NULL → treats as 0');
  console.log('   Filter checks: 0 < 10,000 → TRUE → SKIP');
  console.log('   Result: ALL opportunities skipped\n');
}

show();

