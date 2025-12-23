#!/usr/bin/env tsx
/**
 * Monitor Reply System Activation After REPLY_MIN_FOLLOWERS=0
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function monitor() {
  console.log('🔍 MONITORING REPLY SYSTEM ACTIVATION\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check environment
  const minFollowers = process.env.REPLY_MIN_FOLLOWERS || 'NOT SET';
  console.log(`✅ STEP 1: Environment Variable`);
  console.log(`   REPLY_MIN_FOLLOWERS = ${minFollowers}\n`);

  if (minFollowers !== '0') {
    console.log(`   ⚠️  WARNING: Expected 0, got ${minFollowers}`);
    console.log(`   Run: railway variables --service xBOT --set "REPLY_MIN_FOLLOWERS=0"\n`);
  }

  // Check opportunities available
  const { data: opportunities, count: totalOpps } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact' })
    .eq('replied_to', false)
    .order('created_at', { ascending: false });

  console.log(`✅ STEP 2: Available Opportunities`);
  console.log(`   Total opportunities: ${totalOpps || 0}`);
  
  if (opportunities && opportunities.length > 0) {
    const recent = opportunities.slice(0, 5);
    console.log(`\n   Recent 5:\n`);
    recent.forEach((opp, i) => {
      const minutesAgo = Math.round((Date.now() - new Date(opp.created_at).getTime()) / 1000 / 60);
      console.log(`   ${i + 1}. @${opp.target_username}`);
      console.log(`      Tweet likes: ${opp.like_count?.toLocaleString() || 'N/A'}`);
      console.log(`      Account followers: ${opp.target_followers || 'NULL'}`);
      console.log(`      Harvested: ${minutesAgo}m ago`);
      console.log(`      Would pass filter: ${minFollowers === '0' ? 'YES ✅' : 'NO ❌'}`);
    });
  }
  console.log('\n');

  // Check reply decisions
  const { data: replyDecisions, count: replyCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact' })
    .eq('decision_type', 'reply')
    .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  console.log(`✅ STEP 3: Reply Decisions (Last 30 Minutes)`);
  console.log(`   Total reply decisions: ${replyCount || 0}\n`);

  if (replyDecisions && replyDecisions.length > 0) {
    console.log(`   Recent decisions:\n`);
    replyDecisions.forEach((decision, i) => {
      const minutesAgo = Math.round((Date.now() - new Date(decision.created_at).getTime()) / 1000 / 60);
      console.log(`   ${i + 1}. Decision ${decision.decision_id?.slice(0, 8)}`);
      console.log(`      Target: @${decision.target_username || 'N/A'}`);
      console.log(`      Status: ${decision.status}`);
      console.log(`      Created: ${minutesAgo}m ago`);
    });
  } else {
    console.log(`   ⏳ No reply decisions yet`);
    console.log(`   💡 replyJob may not have run since environment change`);
  }
  console.log('\n');

  // Check posted replies
  const { data: postedReplies, count: postedCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact' })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false });

  console.log(`✅ STEP 4: Posted Replies (Last 2 Hours)`);
  console.log(`   Total posted: ${postedCount || 0}\n`);

  if (postedReplies && postedReplies.length > 0) {
    console.log(`   Recent posts:\n`);
    postedReplies.forEach((reply, i) => {
      const minutesAgo = Math.round((Date.now() - new Date(reply.posted_at!).getTime()) / 1000 / 60);
      console.log(`   ${i + 1}. Reply ${reply.decision_id?.slice(0, 8)}`);
      console.log(`      Target: @${reply.target_username || 'N/A'}`);
      console.log(`      Tweet ID: ${reply.tweet_id || 'MISSING'}`);
      console.log(`      Posted: ${minutesAgo}m ago`);
      if (reply.tweet_id) {
        console.log(`      URL: https://x.com/SignalAndSynapse/status/${reply.tweet_id}`);
      }
    });
  } else {
    console.log(`   ⏳ No replies posted yet`);
    console.log(`   💡 Wait for replyJob to run (every 15 minutes)`);
  }
  console.log('\n');

  // Check receipts
  const { data: receipts, count: receiptCount } = await supabase
    .from('post_receipts')
    .select('*', { count: 'exact' })
    .eq('post_type', 'reply')
    .gte('posted_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false });

  console.log(`✅ STEP 5: Post Receipts (Last 2 Hours)`);
  console.log(`   Total receipts: ${receiptCount || 0}\n`);

  if (receipts && receipts.length > 0) {
    console.log(`   Recent receipts:\n`);
    receipts.forEach((receipt, i) => {
      const minutesAgo = Math.round((Date.now() - new Date(receipt.posted_at).getTime()) / 1000 / 60);
      console.log(`   ${i + 1}. Receipt ${receipt.receipt_id?.slice(0, 8)}`);
      console.log(`      Tweet ID: ${receipt.root_tweet_id}`);
      console.log(`      Posted: ${minutesAgo}m ago`);
    });
  }
  console.log('\n');

  // Final verdict
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎯 STATUS:\n');

  if (minFollowers !== '0') {
    console.log('   ❌ REPLY_MIN_FOLLOWERS not set to 0');
    console.log('   🔧 Action: Set environment variable and redeploy\n');
  } else if (!totalOpps || totalOpps === 0) {
    console.log('   ⚠️  No opportunities available');
    console.log('   🔧 Action: Wait for harvester to run\n');
  } else if (!replyCount || replyCount === 0) {
    console.log('   ⏳ Opportunities available, no decisions yet');
    console.log('   🔧 Action: Wait for replyJob to run (every 15 min)\n');
  } else if (!postedCount || postedCount === 0) {
    console.log('   ⏳ Decisions created, not posted yet');
    console.log('   🔧 Action: Wait for postingQueue to process\n');
  } else {
    console.log('   ✅ REPLIES ARE WORKING!');
    console.log(`   📊 ${postedCount} replies posted in last 2 hours\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

monitor();

