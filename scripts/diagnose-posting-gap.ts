#!/usr/bin/env tsx
/**
 * 🔍 DIAGNOSE POSTING GAP
 * Checks why system hasn't posted in 6 hours
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnose() {
  console.log('🔍 POSTING GAP DIAGNOSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ═══════════════════════════════════════════════════════════
  // PART 1: VERIFY TWEET ID SAVED
  // ═══════════════════════════════════════════════════════════
  
  const targetTweetId = '2003023929087254923';
  console.log('📍 PART 1: Verify Tweet ID in Database\n');
  console.log(`Looking for tweet_id: ${targetTweetId}\n`);

  // Search in content_metadata
  const { data: contentMatch, error: contentError } = await supabase
    .from('content_metadata')
    .select('*')
    .or(`tweet_id.eq.${targetTweetId},thread_tweet_ids.cs.["${targetTweetId}"]`)
    .limit(1)
    .single();

  if (contentMatch) {
    console.log('✅ FOUND in content_metadata:');
    console.log(`   decision_id:     ${contentMatch.decision_id}`);
    console.log(`   decision_type:   ${contentMatch.decision_type}`);
    console.log(`   status:          ${contentMatch.status}`);
    console.log(`   tweet_id:        ${contentMatch.tweet_id}`);
    console.log(`   posted_at:       ${contentMatch.posted_at}`);
    console.log(`   created_at:      ${contentMatch.created_at}`);
    console.log(`   content:         ${contentMatch.content?.substring(0, 80)}...`);
    console.log('');
  } else {
    console.log('❌ NOT FOUND in content_metadata');
    console.log('');
  }

  // Search in post_receipts
  const { data: receiptMatch, error: receiptError } = await supabase
    .from('post_receipts')
    .select('*')
    .or(`root_tweet_id.eq.${targetTweetId},tweet_ids.cs.{${targetTweetId}}`)
    .limit(1)
    .single();

  if (receiptMatch) {
    console.log('✅ FOUND in post_receipts:');
    console.log(`   receipt_id:      ${receiptMatch.id}`);
    console.log(`   decision_id:     ${receiptMatch.decision_id}`);
    console.log(`   kind:            ${receiptMatch.kind}`);
    console.log(`   root_tweet_id:   ${receiptMatch.root_tweet_id}`);
    console.log(`   posted_at:       ${receiptMatch.posted_at}`);
    console.log('');
  } else {
    console.log('⚠️  NOT FOUND in post_receipts');
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ═══════════════════════════════════════════════════════════
  // PART 2: DIAGNOSE POSTING GAP
  // ═══════════════════════════════════════════════════════════

  console.log('📍 PART 2: Diagnose Why No Posts in 6 Hours\n');

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);

  // Check last post
  const { data: lastPost } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, tweet_id, posted_at, created_at')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(1)
    .single();

  if (lastPost) {
    const timeSince = Math.round((Date.now() - new Date(lastPost.posted_at).getTime()) / 1000 / 60);
    console.log('📊 LAST SUCCESSFUL POST:');
    console.log(`   decision_id:     ${lastPost.decision_id}`);
    console.log(`   decision_type:   ${lastPost.decision_type}`);
    console.log(`   tweet_id:        ${lastPost.tweet_id}`);
    console.log(`   posted_at:       ${lastPost.posted_at}`);
    console.log(`   ⏱️  TIME SINCE:    ${timeSince} minutes ago (${(timeSince / 60).toFixed(1)} hours)`);
    console.log('');
  }

  // Check queue
  const { data: queuedPosts, count: queuedCount } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at, scheduled_at', { count: 'exact' })
    .eq('status', 'queued')
    .order('scheduled_at', { ascending: true })
    .limit(10);

  console.log(`📋 QUEUED POSTS: ${queuedCount || 0} waiting\n`);
  if (queuedPosts && queuedPosts.length > 0) {
    queuedPosts.forEach((p, i) => {
      const scheduledAt = p.scheduled_at ? new Date(p.scheduled_at) : null;
      const isPastDue = scheduledAt && scheduledAt < new Date();
      console.log(`   ${i + 1}. ${p.decision_type} (${p.decision_id.substring(0, 8)})`);
      console.log(`      scheduled: ${p.scheduled_at || 'NULL'} ${isPastDue ? '⚠️ PAST DUE' : ''}`);
    });
    console.log('');
  }

  // Check retrying posts
  const { count: retryingCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'retrying');

  console.log(`🔄 RETRYING POSTS: ${retryingCount || 0}\n`);

  // Check failed posts in last 6 hours
  const { data: failedPosts, count: failedCount } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at, last_post_error', { count: 'exact' })
    .eq('status', 'failed')
    .gte('created_at', sixHoursAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`❌ FAILED POSTS (last 6h): ${failedCount || 0}\n`);
  if (failedPosts && failedPosts.length > 0) {
    failedPosts.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.decision_type} (${p.decision_id.substring(0, 8)})`);
      console.log(`      error: ${p.last_post_error?.substring(0, 100) || 'N/A'}`);
    });
    console.log('');
  }

  // Check recent content generation
  const { count: recentGenCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', twoHoursAgo.toISOString());

  console.log(`🎯 CONTENT GENERATED (last 2h): ${recentGenCount || 0}\n`);

  // Check system events
  const { data: systemEvents } = await supabase
    .from('system_events')
    .select('event_type, severity, details, created_at')
    .gte('created_at', oneHourAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (systemEvents && systemEvents.length > 0) {
    console.log(`🚨 SYSTEM EVENTS (last 1h): ${systemEvents.length}\n`);
    systemEvents.forEach((e, i) => {
      const severity = e.severity === 'error' ? '🔴' : e.severity === 'warning' ? '🟡' : 'ℹ️';
      console.log(`   ${severity} ${e.event_type}`);
      console.log(`      ${e.created_at}`);
      if (e.details) {
        const details = typeof e.details === 'string' ? e.details : JSON.stringify(e.details);
        console.log(`      ${details.substring(0, 100)}...`);
      }
    });
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ═══════════════════════════════════════════════════════════
  // DIAGNOSIS
  // ═══════════════════════════════════════════════════════════

  console.log('🩺 DIAGNOSIS:\n');

  const issues: string[] = [];
  const checks: string[] = [];

  if (!contentMatch && !receiptMatch) {
    issues.push('⚠️  Tweet ID 2003023929087254923 NOT found in database');
    checks.push('→ This confirms the 6-hour posting gap problem');
  }

  if (lastPost) {
    const hoursSince = Math.round((Date.now() - new Date(lastPost.posted_at).getTime()) / 1000 / 60 / 60 * 10) / 10;
    if (hoursSince >= 3) {
      issues.push(`🚨 Last post was ${hoursSince} hours ago (expected: 30-60 min intervals)`);
      checks.push('→ Check if planJob is running');
      checks.push('→ Check if postingQueue is processing');
    }
  }

  if (queuedCount === 0) {
    issues.push('⚠️  NO queued posts (should have 2-4 pending)');
    checks.push('→ planJob may not be running or generating content');
  }

  if (recentGenCount === 0) {
    issues.push('🚨 NO content generated in last 2 hours');
    checks.push('→ planJob is NOT running or is failing');
    checks.push('→ Check Railway logs for [PLAN_JOB] errors');
  }

  if ((failedCount || 0) > 3) {
    issues.push(`🚨 ${failedCount} failed posts in last 6 hours (high failure rate)`);
    checks.push('→ Check error messages above');
    checks.push('→ Likely browser/playwright issues or DB save failures');
  }

  if (issues.length === 0) {
    console.log('✅ No obvious issues detected in database');
    console.log('   → Likely a Railway deployment or job scheduling issue');
    console.log('   → Check Railway logs for job execution');
  } else {
    issues.forEach(issue => console.log(issue));
    console.log('');
    checks.forEach(check => console.log(check));
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🔍 NEXT STEPS:\n');
  console.log('1. Check Railway logs:');
  console.log('   railway logs --service xBOT --lines 500 | grep -E "PLAN_JOB|POSTING_QUEUE|JOB_MANAGER"');
  console.log('');
  console.log('2. Check if service is running:');
  console.log('   railway status --service xBOT');
  console.log('');
  console.log('3. Check for crashes or restarts:');
  console.log('   railway logs --service xBOT --lines 1000 | grep -E "ERROR|CRASH|RESTART|EXIT"');
  console.log('');
  console.log('4. Manually trigger planJob:');
  console.log('   railway run --service xBOT -- pnpm job:plan');
  console.log('');
}

diagnose().catch(error => {
  console.error('❌ Diagnosis failed:', error.message);
  process.exit(1);
});

