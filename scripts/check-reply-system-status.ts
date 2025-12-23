#!/usr/bin/env tsx
/**
 * Check why reply system isn't posting
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('🔍 REPLY SYSTEM STATUS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check reply opportunities
  const { count: opportunitiesCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false);

  console.log(`📋 REPLY OPPORTUNITIES: ${opportunitiesCount || 0} available\n`);

  if ((opportunitiesCount || 0) > 0) {
    const { data: topOps } = await supabase
      .from('reply_opportunities')
      .select('*')
      .eq('replied_to', false)
      .order('opportunity_score', { ascending: false })
      .limit(5);

    if (topOps && topOps.length > 0) {
      console.log('   Top 5 opportunities:\n');
      topOps.forEach((op, i) => {
        console.log(`   ${i + 1}. Score: ${op.opportunity_score?.toFixed(2) || 'N/A'} | ${op.target_username || 'N/A'}`);
        console.log(`      Created: ${new Date(op.created_at).toLocaleString()}`);
      });
      console.log('');
    }
  }

  // Check when last reply was attempted
  const { data: lastReply } = await supabase
    .from('content_metadata')
    .select('decision_id, status, created_at, posted_at, last_post_error')
    .eq('decision_type', 'reply')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (lastReply) {
    const hoursAgo = Math.round((Date.now() - new Date(lastReply.created_at).getTime()) / 1000 / 60 / 60 * 10) / 10;
    console.log(`⏱️  LAST REPLY ATTEMPT: ${hoursAgo} hours ago`);
    console.log(`   status: ${lastReply.status}`);
    if (lastReply.posted_at) {
      console.log(`   posted_at: ${lastReply.posted_at}`);
    }
    if (lastReply.last_post_error) {
      console.log(`   error: ${lastReply.last_post_error.substring(0, 100)}`);
    }
    console.log('');
  } else {
    console.log('⚠️  NO reply attempts found in database\n');
  }

  // Check system events for reply job
  const { data: replyEvents } = await supabase
    .from('system_events')
    .select('*')
    .ilike('event_type', '%reply%')
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (replyEvents && replyEvents.length > 0) {
    console.log(`🚨 RECENT REPLY SYSTEM EVENTS (last 2h): ${replyEvents.length}\n`);
    replyEvents.forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.event_type}`);
      console.log(`      ${e.created_at}`);
      if (e.details) {
        const details = typeof e.details === 'string' ? e.details : JSON.stringify(e.details);
        console.log(`      ${details.substring(0, 100)}`);
      }
    });
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Diagnosis
  console.log('🩺 DIAGNOSIS:\n');

  if ((opportunitiesCount || 0) === 0) {
    console.log('🚨 NO REPLY OPPORTUNITIES AVAILABLE');
    console.log('   → Harvester may not be running or finding targets');
    console.log('   → Check: mega_viral_harvester job status');
    console.log('');
  } else if (!lastReply || (lastReply && (Date.now() - new Date(lastReply.created_at).getTime()) / 1000 / 60 / 60 > 2)) {
    console.log('🚨 REPLY JOB NOT RUNNING');
    console.log('   → Opportunities exist but replyJob not generating replies');
    console.log('   → Check Railway logs for [REPLY_JOB] errors');
    console.log('   → Check if replyEnabled flag is true in jobManager');
    console.log('');
  } else {
    console.log('⚠️  Reply system WAS running but stopped recently');
    console.log('   → Check last error message above');
    console.log('');
  }

  console.log('🔍 NEXT STEPS:\n');
  console.log('1. Check if replyJob is registered and running:');
  console.log('   railway logs --service xBOT --lines 500 | grep "REPLY_JOB"');
  console.log('');
  console.log('2. Check for reply job errors:');
  console.log('   railway logs --service xBOT --lines 1000 | grep -E "REPLY.*ERROR|replyJob.*failed"');
  console.log('');
  console.log('3. Manually trigger reply job:');
  console.log('   railway run --service xBOT -- pnpm job:reply');
  console.log('');
}

check();

