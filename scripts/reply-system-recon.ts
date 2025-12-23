#!/usr/bin/env tsx
/**
 * 🔍 REPLY SYSTEM RECONNAISSANCE
 * Trace entire reply chain to find the broken link
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function recon() {
  console.log('🔍 REPLY SYSTEM RECONNAISSANCE REPORT\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('MISSION: Identify which link in the reply chain is broken\n');
  console.log('METHOD: Verifiable evidence at each step\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

  const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);
  const now = new Date();

  // ═════════════════════════════════════════════════════════════════════
  // STEP 1: REPLY OPPORTUNITIES (Harvesting)
  // ═════════════════════════════════════════════════════════════════════
  
  console.log('📍 STEP 1: REPLY OPPORTUNITIES (Harvesting)\n');
  console.log('   Question: Are reply opportunities being found and stored?\n');

  const { count: totalOpps, error: oppsError } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false);

  const { count: recentOpps } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .gte('created_at', tenHoursAgo.toISOString());

  const { data: sampleOpps } = await supabase
    .from('reply_opportunities')
    .select('target_username, target_followers, like_count, opportunity_score, created_at')
    .eq('replied_to', false)
    .order('opportunity_score', { ascending: false })
    .limit(5);

  console.log(`   ✅ EVIDENCE: ${totalOpps || 0} total opportunities available`);
  console.log(`   ✅ EVIDENCE: ${recentOpps || 0} added in last 10 hours`);
  console.log('');
  console.log('   Sample opportunities (top 5 by score):\n');
  if (sampleOpps && sampleOpps.length > 0) {
    sampleOpps.forEach((opp, i) => {
      const minutesAgo = Math.round((now.getTime() - new Date(opp.created_at).getTime()) / 1000 / 60);
      console.log(`   ${i + 1}. @${opp.target_username}`);
      console.log(`      Followers: ${opp.target_followers || 0}`);
      console.log(`      Likes: ${(opp.like_count || 0).toLocaleString()}`);
      console.log(`      Score: ${opp.opportunity_score?.toFixed(2)}`);
      console.log(`      Age: ${minutesAgo} minutes ago`);
    });
  }
  console.log('');

  console.log(`   🎯 VERDICT STEP 1: ${(totalOpps || 0) > 0 ? '✅ WORKING' : '❌ BROKEN'}`);
  console.log(`      Harvester IS collecting opportunities\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

  // ═════════════════════════════════════════════════════════════════════
  // STEP 2: REPLY JOB (Generation & Filtering)
  // ═════════════════════════════════════════════════════════════════════

  console.log('📍 STEP 2: REPLY JOB (Generation & Filtering)\n');
  console.log('   Question: Is replyJob generating reply decisions?\n');

  // Check how many opportunities meet the follower threshold
  const minFollowers = parseInt(process.env.REPLY_MIN_FOLLOWERS || '10000');
  console.log(`   ⚙️  ENV: REPLY_MIN_FOLLOWERS = ${minFollowers}`);
  console.log('');

  const { count: meetsThreshold } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .gte('target_followers', minFollowers);

  const { count: belowThreshold } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .lt('target_followers', minFollowers);

  const { count: zeroFollowers } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .eq('target_followers', 0);

  console.log(`   ✅ EVIDENCE: ${meetsThreshold || 0} opportunities meet threshold (>= ${minFollowers} followers)`);
  console.log(`   ❌ EVIDENCE: ${belowThreshold || 0} opportunities below threshold`);
  console.log(`   ⚠️  EVIDENCE: ${zeroFollowers || 0} opportunities have ZERO followers recorded`);
  console.log('');

  // Check if any reply decisions were created in last 10 hours
  const { count: replyDecisions } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .gte('created_at', tenHoursAgo.toISOString());

  console.log(`   ✅ EVIDENCE: ${replyDecisions || 0} reply decisions created in last 10 hours`);
  console.log('');

  if (replyDecisions && replyDecisions > 0) {
    const { data: recentDecisions } = await supabase
      .from('content_metadata')
      .select('decision_id, status, created_at, content')
      .eq('decision_type', 'reply')
      .gte('created_at', tenHoursAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('   Recent reply decisions:\n');
    recentDecisions?.forEach((dec, i) => {
      const minutesAgo = Math.round((now.getTime() - new Date(dec.created_at).getTime()) / 1000 / 60);
      console.log(`   ${i + 1}. ${dec.status} | ${minutesAgo}m ago`);
      console.log(`      ${dec.content?.substring(0, 60)}...`);
    });
    console.log('');
  }

  console.log(`   🎯 VERDICT STEP 2: ${(replyDecisions || 0) > 0 ? '✅ WORKING' : '❌ BROKEN'}`);
  if ((replyDecisions || 0) === 0) {
    console.log(`      ❌ BROKEN: replyJob NOT generating any decisions`);
    if ((meetsThreshold || 0) === 0) {
      console.log(`      └─> ROOT CAUSE: 0 opportunities meet ${minFollowers} follower threshold`);
      console.log(`      └─> ${zeroFollowers || 0} opps have target_followers = 0 (data not populated)`);
    }
  } else {
    console.log(`      ✅ replyJob IS generating decisions`);
  }
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

  // ═════════════════════════════════════════════════════════════════════
  // STEP 3: POSTING QUEUE (Posting to X)
  // ═════════════════════════════════════════════════════════════════════

  console.log('📍 STEP 3: POSTING QUEUE (Posting to X)\n');
  console.log('   Question: Are replies being posted to X via Playwright?\n');

  // Check if any replies have status = 'posted'
  const { count: postedReplies } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', tenHoursAgo.toISOString());

  console.log(`   ✅ EVIDENCE: ${postedReplies || 0} replies marked as 'posted' in last 10 hours`);
  console.log('');

  if (postedReplies && postedReplies > 0) {
    const { data: postedData } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, posted_at, content')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', tenHoursAgo.toISOString())
      .order('posted_at', { ascending: false })
      .limit(5);

    console.log('   Posted replies:\n');
    postedData?.forEach((rep, i) => {
      const minutesAgo = Math.round((now.getTime() - new Date(rep.posted_at).getTime()) / 1000 / 60);
      const hasTweetId = rep.tweet_id ? '✅' : '❌';
      console.log(`   ${i + 1}. tweet_id: ${hasTweetId} | ${minutesAgo}m ago`);
      console.log(`      ID: ${rep.tweet_id || 'NULL'}`);
      console.log(`      ${rep.content?.substring(0, 60)}...`);
    });
    console.log('');
  }

  // Check for failed/retrying replies
  const { count: failedReplies } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .in('status', ['failed', 'retrying', 'failed_permanent'])
    .gte('created_at', tenHoursAgo.toISOString());

  console.log(`   ⚠️  EVIDENCE: ${failedReplies || 0} replies failed/retrying in last 10 hours`);
  console.log('');

  console.log(`   🎯 VERDICT STEP 3: ${(postedReplies || 0) > 0 ? '✅ WORKING' : '❌ BROKEN'}`);
  if ((postedReplies || 0) === 0) {
    if ((replyDecisions || 0) === 0) {
      console.log(`      └─> BLOCKED AT STEP 2 (no decisions to post)`);
    } else {
      console.log(`      ❌ BROKEN: Decisions created but NOT being posted`);
      console.log(`      └─> postingQueue may not be processing replies`);
    }
  } else {
    console.log(`      ✅ postingQueue IS posting replies to X`);
  }
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

  // ═════════════════════════════════════════════════════════════════════
  // STEP 4: DATABASE SAVE (markDecisionPosted)
  // ═════════════════════════════════════════════════════════════════════

  console.log('📍 STEP 4: DATABASE SAVE (markDecisionPosted)\n');
  console.log('   Question: Are posted replies being saved with tweet_id?\n');

  // Check replies with status=posted but tweet_id=NULL
  const { count: postedNoId } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .is('tweet_id', null)
    .gte('posted_at', tenHoursAgo.toISOString());

  // Check replies with both status=posted AND tweet_id
  const { count: postedWithId } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', tenHoursAgo.toISOString());

  console.log(`   ✅ EVIDENCE: ${postedWithId || 0} replies saved WITH tweet_id`);
  console.log(`   ❌ EVIDENCE: ${postedNoId || 0} replies marked 'posted' but tweet_id = NULL`);
  console.log('');

  // Check post_receipts for replies
  const { count: replyReceipts } = await supabase
    .from('post_receipts')
    .select('*', { count: 'exact', head: true })
    .eq('kind', 'reply')
    .gte('posted_at', tenHoursAgo.toISOString());

  console.log(`   ✅ EVIDENCE: ${replyReceipts || 0} reply receipts (backup system)`);
  console.log('');

  console.log(`   🎯 VERDICT STEP 4:`);
  if ((postedReplies || 0) === 0) {
    console.log(`      └─> BLOCKED AT EARLIER STEP (nothing to save)`);
  } else if ((postedNoId || 0) > 0) {
    console.log(`      ❌ BROKEN: ${postedNoId} replies posted but tweet_id NOT saved`);
    console.log(`      └─> markDecisionPosted() either not called or failing for replies`);
  } else if ((postedWithId || 0) > 0) {
    console.log(`      ✅ WORKING: All posted replies have tweet_id`);
  } else {
    console.log(`      ⚠️  UNKNOWN: Need more data`);
  }
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

  // ═════════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ═════════════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════════════\n');
  console.log('📊 FINAL RECONNAISSANCE REPORT\n');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log('REPLY CHAIN STATUS:\n');
  console.log(`   STEP 1 (Harvesting):      ${(totalOpps || 0) > 0 ? '✅ WORKING' : '❌ BROKEN'} (${totalOpps || 0} opportunities)`);
  console.log(`   STEP 2 (Generation):      ${(replyDecisions || 0) > 0 ? '✅ WORKING' : '❌ BROKEN'} (${replyDecisions || 0} decisions created)`);
  console.log(`   STEP 3 (Posting):         ${(postedReplies || 0) > 0 ? '✅ WORKING' : '❌ BROKEN'} (${postedReplies || 0} posted to X)`);
  console.log(`   STEP 4 (Saving):          ${(postedWithId || 0) > 0 ? '✅ WORKING' : '❌ BROKEN'} (${postedWithId || 0} saved with tweet_id)`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Identify the broken link
  console.log('🎯 PRIMARY BREAK POINT:\n');

  if ((replyDecisions || 0) === 0) {
    console.log('   ❌ STEP 2: REPLY GENERATION (replyJob)\n');
    console.log('   EVIDENCE:');
    console.log(`      • ${totalOpps || 0} opportunities available`);
    console.log(`      • ${meetsThreshold || 0} meet follower threshold (${minFollowers}+)`);
    console.log(`      • ${replyDecisions || 0} decisions created`);
    console.log('');
    console.log('   ROOT CAUSE:');
    if ((meetsThreshold || 0) === 0) {
      console.log(`      replyJob is filtering out ALL opportunities`);
      console.log(`      • Threshold: ${minFollowers} followers`);
      console.log(`      • ${(zeroFollowers || 0)} opportunities have target_followers = 0`);
      console.log(`      • Data not populated during harvesting`);
    } else {
      console.log(`      replyJob is not running or has other errors`);
    }
    console.log('');
    console.log('   VERIFICATION COMMAND:');
    console.log('      railway logs --service xBOT --lines 500 | grep "REPLY_JOB"');
    console.log('');
  } else if ((postedReplies || 0) === 0) {
    console.log('   ❌ STEP 3: POSTING QUEUE\n');
    console.log('   EVIDENCE:');
    console.log(`      • ${replyDecisions || 0} decisions created`);
    console.log(`      • ${postedReplies || 0} posted to X`);
    console.log('');
    console.log('   ROOT CAUSE:');
    console.log('      postingQueue is not processing reply decisions');
    console.log('');
    console.log('   VERIFICATION COMMAND:');
    console.log('      railway logs --service xBOT --lines 1000 | grep "decision_type.*reply"');
    console.log('');
  } else if ((postedNoId || 0) > 0) {
    console.log('   ❌ STEP 4: DATABASE SAVE\n');
    console.log('   EVIDENCE:');
    console.log(`      • ${postedReplies || 0} posted to X`);
    console.log(`      • ${postedNoId || 0} missing tweet_id`);
    console.log('');
    console.log('   ROOT CAUSE:');
    console.log('      markDecisionPosted() not called or failing for replies');
    console.log('');
    console.log('   VERIFICATION COMMAND:');
    console.log('      railway logs --service xBOT --lines 1000 | grep "markDecisionPosted.*reply"');
    console.log('');
  } else {
    console.log('   ✅ ALL STEPS WORKING (within last 10 hours)\n');
    console.log('   The 6-hour-old reply from screenshot must be from:');
    console.log('      • Manual posting (not automated system)');
    console.log('      • Test script/one-off command');
    console.log('      • Before the 10-hour window');
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Compare to singles/threads
  console.log('📊 COMPARISON: Singles vs Threads vs Replies (last 10 hours)\n');

  const { count: singlesPosted } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'single')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', tenHoursAgo.toISOString());

  const { count: threadsPosted } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'thread')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', tenHoursAgo.toISOString());

  console.log(`   Singles:  ${singlesPosted || 0} posted & saved ✅`);
  console.log(`   Threads:  ${threadsPosted || 0} posted & saved ✅`);
  console.log(`   Replies:  ${postedWithId || 0} posted & saved ${(postedWithId || 0) > 0 ? '✅' : '❌'}`);
  console.log('');

  if ((singlesPosted || 0) > 0 && (postedWithId || 0) === 0) {
    console.log('   🔍 OBSERVATION: Singles work but replies don\'t');
    console.log('      → Problem is BEFORE the shared code path (postingQueue)');
    console.log('      → Issue is in reply-specific generation or filtering');
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════════════\n');
  console.log('END OF RECONNAISSANCE REPORT\n');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

recon();

