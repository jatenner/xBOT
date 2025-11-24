/**
 * 🔍 DIAGNOSE POSTING BLOCKER
 * Checks all common reasons why posting might not be working
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { getSupabaseClient } from '../src/db/index';
import { getConfig, getModeFlags } from '../src/config/config';
import { isPostingAllowed } from '../src/config/envFlags';

async function diagnose() {
  console.log('🔍 POSTING BLOCKER DIAGNOSIS\n');
  console.log('='.repeat(60));
  
  // 1. Check environment flags
  console.log('\n1️⃣ ENVIRONMENT FLAGS:');
  const flags = getModeFlags();
  const postingCheck = isPostingAllowed();
  
  console.log(`   POSTING_DISABLED: ${flags.postingDisabled ? '❌ TRUE (BLOCKING)' : '✅ false'}`);
  console.log(`   LIVE_POSTS: ${process.env.LIVE_POSTS || 'not set'}`);
  console.log(`   isPostingAllowed(): ${postingCheck.allowed ? '✅ ALLOWED' : `❌ BLOCKED: ${postingCheck.reason}`}`);
  
  // 2. Check queued content
  console.log('\n2️⃣ QUEUED CONTENT:');
  const supabase = getSupabaseClient();
  const now = new Date();
  const graceWindow = new Date(now.getTime() + 5*60*1000);
  
  const { data: ready } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, scheduled_at, status')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .lte('scheduled_at', graceWindow.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(10);
  
  console.log(`   Ready to post: ${ready?.length || 0}`);
  if (ready && ready.length > 0) {
    ready.forEach((p, i) => {
      const scheduled = new Date(p.scheduled_at);
      const mins = Math.round((now.getTime() - scheduled.getTime())/60000);
      console.log(`   ${i+1}. ${p.decision_type} ${p.decision_id.substring(0,8)}... (${mins}min overdue)`);
    });
  } else {
    console.log('   ⚠️ NO CONTENT READY');
  }
  
  // 3. Check rate limits
  console.log('\n3️⃣ RATE LIMITS:');
  const oneHourAgo = new Date(now.getTime() - 60*60*1000);
  const { count: hourCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo.toISOString());
  
  const config = getConfig();
  const maxPerHour = parseInt(String(config.MAX_POSTS_PER_HOUR || 1));
  console.log(`   Posts in last hour: ${hourCount || 0}/${maxPerHour}`);
  console.log(`   Status: ${(hourCount || 0) >= maxPerHour ? '❌ LIMIT REACHED' : '✅ OK'}`);
  
  // 4. Check for stuck posts
  console.log('\n4️⃣ STUCK POSTS:');
  const fifteenMinAgo = new Date(now.getTime() - 15*60*1000);
  const { data: stuck } = await supabase
    .from('content_metadata')
    .select('decision_id, created_at')
    .eq('status', 'posting')
    .lt('created_at', fifteenMinAgo.toISOString());
  
  console.log(`   Stuck in 'posting' status: ${stuck?.length || 0}`);
  if (stuck && stuck.length > 0) {
    stuck.forEach((p, i) => {
      const created = new Date(p.created_at);
      const mins = Math.round((now.getTime() - created.getTime())/60000);
      console.log(`   ${i+1}. ${p.decision_id.substring(0,8)}... (stuck for ${mins}min)`);
    });
  }
  
  // 5. Check recent posts
  console.log('\n5️⃣ RECENT POSTS:');
  const { data: recent } = await supabase
    .from('content_metadata')
    .select('decision_id, status, posted_at, tweet_id, error_message')
    .in('decision_type', ['single', 'thread'])
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recent && recent.length > 0) {
    recent.forEach((p, i) => {
      console.log(`   ${i+1}. status=${p.status}, tweet_id=${p.tweet_id || 'none'}`);
      if (p.error_message) {
        console.log(`      error: ${p.error_message.substring(0, 100)}`);
      }
    });
  }
  
  // 6. Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:');
  
  const blockers: string[] = [];
  if (flags.postingDisabled) blockers.push('POSTING_DISABLED=true');
  if (!postingCheck.allowed) blockers.push(`isPostingAllowed() blocked: ${postingCheck.reason}`);
  if ((hourCount || 0) >= maxPerHour) blockers.push('Rate limit reached');
  if ((ready?.length || 0) === 0) blockers.push('No content ready to post');
  
  if (blockers.length > 0) {
    console.log('\n❌ BLOCKERS FOUND:');
    blockers.forEach(b => console.log(`   - ${b}`));
  } else {
    console.log('\n✅ NO OBVIOUS BLOCKERS');
    console.log('   System should be posting. Check Railway logs for errors.');
  }
  
  console.log('\n💡 NEXT STEPS:');
  if (flags.postingDisabled) {
    console.log('   1. Set POSTING_DISABLED=false in Railway');
  }
  if (!postingCheck.allowed && postingCheck.reason?.includes('LIVE_POSTS')) {
    console.log('   2. Set LIVE_POSTS=true in Railway');
  }
  if ((hourCount || 0) >= maxPerHour) {
    console.log('   3. Wait for rate limit to reset (1 hour)');
  }
  if ((ready?.length || 0) > 0 && blockers.length === 0) {
    console.log('   4. Check Railway logs: railway logs --lines 200 | grep POSTING_QUEUE');
    console.log('   5. Check circuit breaker: railway logs --lines 200 | grep "Circuit breaker"');
  }
}

diagnose().catch(console.error);

