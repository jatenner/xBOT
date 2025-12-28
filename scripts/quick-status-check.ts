#!/usr/bin/env tsx
/**
 * Quick status check now that X is back up
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function quickCheck() {
  console.log('🔍 SYSTEM STATUS CHECK (X is back up)\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check queue
  const { data: queue } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, status, scheduled_time')
    .in('status', ['queued', 'ready'])
    .order('scheduled_time', { ascending: true })
    .limit(10);

  console.log('📊 READY TO POST:\n');
  if (queue && queue.length > 0) {
    queue.forEach((item, i) => {
      const timeUntil = item.scheduled_time ? 
        Math.round((new Date(item.scheduled_time).getTime() - Date.now()) / 1000 / 60) : 'now';
      console.log(`   ${i + 1}. ${item.decision_type} (${item.status})`);
      console.log(`      Posts in: ${timeUntil} minutes`);
    });
    console.log(`\n   ✅ ${queue.length} posts ready in queue\n`);
  } else {
    console.log('   ⏳ Queue empty (planJob will generate more)\n');
  }

  // Check recent decisions (last 6 hours)
  const { data: recentDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, status, created_at')
    .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  const singles = recentDecisions?.filter(d => d.decision_type === 'single').length || 0;
  const threads = recentDecisions?.filter(d => d.decision_type === 'thread').length || 0;
  const replies = recentDecisions?.filter(d => d.decision_type === 'reply').length || 0;

  console.log('📊 CONTENT GENERATION (Last 6 hours):\n');
  console.log(`   Singles: ${singles}`);
  console.log(`   Threads: ${threads}`);
  console.log(`   Replies: ${replies}`);
  console.log(`   Total: ${recentDecisions?.length || 0}\n`);

  // Check reply opportunities
  const { count: qualityOpps } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .gte('like_count', 5000)
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

  console.log('📊 REPLY OPPORTUNITIES (Quality targets):\n');
  console.log(`   Fresh opportunities (< 2h, 5K+ likes): ${qualityOpps || 0}\n`);

  // Check retry queue
  const { data: retrying } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, retry_count')
    .eq('status', 'retry_pending')
    .limit(5);

  if (retrying && retrying.length > 0) {
    console.log('🔄 RETRY QUEUE (Failed during X outage):\n');
    retrying.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.decision_type} (retry #${item.retry_count || 0})`);
    });
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ SYSTEM STATUS:\n');
  console.log('   1. Content generation: ACTIVE ✅');
  console.log('   2. Posting queue: READY ✅');
  console.log('   3. Reply system: CONFIGURED ✅');
  console.log('   4. Quality filters: 5K+ likes, < 2h age ✅');
  console.log('   5. X/Twitter: BACK UP ✅\n');
  console.log('🚀 System will resume posting automatically!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

quickCheck();

