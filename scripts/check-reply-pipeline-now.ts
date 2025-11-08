#!/usr/bin/env tsx

/**
 * Quick check of reply system status in production
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function quickCheck() {
  console.log('🔍 REPLY SYSTEM QUICK CHECK\n');
  
  // Check opportunities
  const { data: opps } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true });
  
  const { data: recentOpps } = await supabase
    .from('reply_opportunities')
    .select('created_at, like_count, health_relevance_score')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('📊 REPLY OPPORTUNITIES:');
  console.log(`   Total in DB: ${opps || 0}`);
  if (recentOpps && recentOpps.length > 0) {
    console.log('   Most recent:');
    recentOpps.forEach((opp: any, i: number) => {
      const age = Math.round((Date.now() - new Date(opp.created_at).getTime()) / 60000);
      console.log(`     ${i+1}. ${age}min ago | ${opp.like_count} likes | Score: ${opp.health_relevance_score}`);
    });
  } else {
    console.log('   ⚠️  No opportunities found');
  }
  
  // Check replies
  const { data: replies } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply');
  
  const { data: queuedReplies } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'queued');
  
  const { data: recentReplies } = await supabase
    .from('content_metadata')
    .select('created_at, status, content_text')
    .eq('decision_type', 'reply')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('\n💬 REPLIES:');
  console.log(`   Total generated: ${replies || 0}`);
  console.log(`   Currently queued: ${queuedReplies || 0}`);
  if (recentReplies && recentReplies.length > 0) {
    console.log('   Most recent:');
    recentReplies.forEach((reply: any, i: number) => {
      const age = Math.round((Date.now() - new Date(reply.created_at).getTime()) / 60000);
      console.log(`     ${i+1}. ${age}min ago | ${reply.status} | ${reply.content_text?.substring(0, 50)}...`);
    });
  } else {
    console.log('   ⚠️  No replies found');
  }
  
  // Check posted replies
  const { data: postedLast24h } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  console.log('\n🚀 POSTED REPLIES:');
  console.log(`   Last 24h: ${postedLast24h || 0}`);
  
  // Summary
  console.log('\n📋 SUMMARY:');
  if (!opps || opps === 0) {
    console.log('   ❌ No opportunities found - Harvester may not have run yet');
  } else if (!replies || replies === 0) {
    console.log('   ❌ Opportunities found but no replies generated - Reply generation issue');
  } else if (queuedReplies && queuedReplies > 0 && (!postedLast24h || postedLast24h === 0)) {
    console.log('   ⚠️  Replies queued but not posting - Posting system issue');
  } else if (postedLast24h && postedLast24h > 0) {
    console.log('   ✅ System working! Replies are being posted');
  } else {
    console.log('   ⏳ System may be warming up - check again in 1-2 hours');
  }
}

quickCheck().catch(console.error);

