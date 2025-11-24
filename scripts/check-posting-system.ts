/**
 * 🔍 COMPREHENSIVE POSTING SYSTEM CHECK
 * Verifies posting queue, replies, and identifies blocking issues
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

import { getSupabaseClient } from '../src/db/index';
import { getConfig, getModeFlags } from '../src/config/config';
import { processPostingQueue } from '../src/jobs/postingQueue';

async function checkPostingSystem() {
  console.log('🔍 COMPREHENSIVE POSTING SYSTEM CHECK\n');
  console.log('='.repeat(60));
  
  const supabase = getSupabaseClient();
  const config = getConfig();
  const flags = getModeFlags(config);
  
  // 1. Check configuration
  console.log('\n1️⃣ CONFIGURATION CHECK:');
  console.log(`   Posting enabled: ${!flags.postingDisabled} ${flags.postingDisabled ? '❌ BLOCKING' : '✅'}`);
  console.log(`   Mode: ${config.MODE ?? 'live'}`);
  console.log(`   Max posts/hour: ${config.MAX_POSTS_PER_HOUR ?? 1} ${(config.MAX_POSTS_PER_HOUR ?? 1) < 2 ? '⚠️ LOW (should be 2)' : '✅'}`);
  console.log(`   Max replies/hour: ${config.REPLIES_PER_HOUR ?? 4} ✅`);
  console.log(`   Posting interval: ${config.JOBS_POSTING_INTERVAL_MIN ?? 5} minutes ✅`);
  console.log(`   Plan interval: ${config.JOBS_PLAN_INTERVAL_MIN ?? 60} minutes ${(config.JOBS_PLAN_INTERVAL_MIN ?? 60) > 120 ? '⚠️ HIGH (should be ≤60)' : '✅'}`);
  console.log(`   Reply interval: ${config.JOBS_REPLY_INTERVAL_MIN ?? 30} minutes ✅`);
  
  // Check environment variables
  console.log('\n   Environment Variables:');
  console.log(`   POSTING_DISABLED: ${process.env.POSTING_DISABLED ?? 'not set'} ${process.env.POSTING_DISABLED === 'true' ? '❌ BLOCKING' : '✅'}`);
  console.log(`   DRY_RUN: ${process.env.DRY_RUN ?? 'not set'} ${process.env.DRY_RUN === 'true' ? '❌ BLOCKING' : '✅'}`);
  console.log(`   MODE: ${process.env.MODE ?? 'not set'} ${process.env.MODE === 'shadow' ? '❌ BLOCKING' : '✅'}`);
  
  // 2. Check queued content
  console.log('\n2️⃣ QUEUED CONTENT:');
  const { data: queuedContent } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, scheduled_at, created_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .order('scheduled_at', { ascending: true })
    .limit(10);
  
  console.log(`   Found: ${queuedContent?.length || 0} queued content posts`);
  if (queuedContent && queuedContent.length > 0) {
    const now = new Date();
    queuedContent.forEach((p: any) => {
      const scheduled = new Date(p.scheduled_at);
      const ready = scheduled <= now;
      const minsAgo = Math.round((now.getTime() - scheduled.getTime()) / 60000);
      console.log(`   - ${p.decision_type} ${p.decision_id.substring(0, 8)}... (ready: ${ready}, ${minsAgo}min ago)`);
    });
  }
  
  // 3. Check queued replies
  console.log('\n3️⃣ QUEUED REPLIES:');
  const { data: queuedReplies } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, scheduled_at')
    .eq('status', 'queued')
    .eq('decision_type', 'reply')
    .order('scheduled_at', { ascending: true })
    .limit(10);
  
  console.log(`   Found: ${queuedReplies?.length || 0} queued replies`);
  
  // 4. Check recent posts (last hour)
  console.log('\n4️⃣ RECENT POSTS (last hour):');
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, posted_at, tweet_id')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo);
  
  console.log(`   Posted: ${recentPosts?.length || 0}`);
  if (recentPosts && recentPosts.length > 0) {
    recentPosts.forEach((p: any) => {
      const posted = new Date(p.posted_at);
      const minsAgo = Math.round((Date.now() - posted.getTime()) / 60000);
      console.log(`   - ${p.decision_type} ${p.decision_id.substring(0, 8)}... (${minsAgo}min ago, tweet_id: ${p.tweet_id || 'NULL'})`);
    });
  }
  
  // 5. Check recent replies (last hour)
  console.log('\n5️⃣ RECENT REPLIES (last hour):');
  const { data: recentReplies } = await supabase
    .from('content_metadata')
    .select('decision_id, status, posted_at, tweet_id')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo);
  
  console.log(`   Posted: ${recentReplies?.length || 0}`);
  
  // 6. Check stuck posts
  console.log('\n6️⃣ STUCK POSTS (status=posting >30min):');
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: stuckPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at')
    .eq('status', 'posting')
    .lt('created_at', thirtyMinAgo);
  
  console.log(`   Found: ${stuckPosts?.length || 0}`);
  if (stuckPosts && stuckPosts.length > 0) {
    stuckPosts.forEach((p: any) => {
      const created = new Date(p.created_at);
      const minsStuck = Math.round((Date.now() - created.getTime()) / 60000);
      console.log(`   - ${p.decision_type} ${p.decision_id.substring(0, 8)}... (stuck ${minsStuck}min)`);
    });
  }
  
  // 7. Check rate limits
  console.log('\n7️⃣ RATE LIMIT CHECK:');
  const { data: postsThisHour } = await supabase
    .from('content_metadata')
    .select('decision_type')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo);
  
  const { data: repliesThisHour } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo);
  
  const contentCount = postsThisHour?.length || 0;
  const replyCount = repliesThisHour?.length || 0;
  const maxContent = config.MAX_POSTS_PER_HOUR ?? 1;
  const maxReplies = config.REPLIES_PER_HOUR ?? 4;
  
  console.log(`   Content: ${contentCount}/${maxContent} (${contentCount >= maxContent ? 'LIMIT REACHED' : 'OK'})`);
  console.log(`   Replies: ${replyCount}/${maxReplies} (${replyCount >= maxReplies ? 'LIMIT REACHED' : 'OK'})`);
  
  // 8. Check for blockers
  console.log('\n8️⃣ BLOCKER CHECK:');
  const blockers: string[] = [];
  
  if (flags.postingDisabled) {
    blockers.push('❌ POSTING_DISABLED=true or MODE=shadow');
  }
  if ((config.MAX_POSTS_PER_HOUR ?? 1) < 2) {
    blockers.push(`⚠️ MAX_POSTS_PER_HOUR=${config.MAX_POSTS_PER_HOUR ?? 1} (should be 2)`);
  }
  if (contentLimitReached) {
    blockers.push(`⛔ Content rate limit reached: ${contentCount}/${maxContent}`);
  }
  if (replyLimitReached) {
    blockers.push(`⛔ Reply rate limit reached: ${replyCount}/${maxReplies}`);
  }
  if ((queuedContent?.length || 0) === 0 && (queuedReplies?.length || 0) === 0) {
    blockers.push('⚠️ No queued content or replies - check plan/reply jobs');
  }
  if ((config.JOBS_PLAN_INTERVAL_MIN ?? 60) > 120) {
    blockers.push(`⚠️ JOBS_PLAN_INTERVAL_MIN=${config.JOBS_PLAN_INTERVAL_MIN ?? 60} (too high, should be ≤60)`);
  }
  
  if (blockers.length === 0) {
    console.log('   ✅ No blockers detected - system should be posting');
  } else {
    console.log('   🚨 BLOCKERS DETECTED:');
    blockers.forEach(b => console.log(`      ${b}`));
  }
  
  // 9. Summary and recommendations
  console.log('\n📊 SUMMARY:');
  const hasQueuedContent = (queuedContent?.length || 0) > 0;
  const hasQueuedReplies = (queuedReplies?.length || 0) > 0;
  const hasStuckPosts = (stuckPosts?.length || 0) > 0;
  const contentLimitReached = contentCount >= maxContent;
  const replyLimitReached = replyCount >= maxReplies;
  
  if (hasQueuedContent && !contentLimitReached && !flags.postingDisabled) {
    console.log('   ✅ Content queued and rate limit OK - should post');
  } else if (hasQueuedContent && contentLimitReached) {
    console.log('   ⚠️ Content queued but rate limit reached - waiting for next hour');
  } else if (!hasQueuedContent) {
    console.log('   ⚠️ No content queued - check plan job');
  }
  
  if (hasStuckPosts) {
    console.log('   🚨 STUCK POSTS DETECTED - these need recovery!');
  }
  
  // Recommendations
  if (blockers.length > 0) {
    console.log('\n🔧 RECOMMENDED FIXES:');
    if (flags.postingDisabled) {
      console.log('   1. Set POSTING_DISABLED=false or MODE=live');
    }
    if ((config.MAX_POSTS_PER_HOUR ?? 1) < 2) {
      console.log('   2. Set MAX_POSTS_PER_HOUR=2');
    }
    if ((config.JOBS_PLAN_INTERVAL_MIN ?? 60) > 120) {
      console.log('   3. Set JOBS_PLAN_INTERVAL_MIN=60');
    }
    console.log('\n   Run: railway variables --set <VAR>=<VALUE>');
  }
  
  // 10. Manual trigger test
  console.log('\n🔟 MANUAL POSTING QUEUE TRIGGER:');
  console.log('   Attempting to run posting queue manually...\n');
  
  try {
    await processPostingQueue();
    console.log('   ✅ Posting queue executed successfully');
  } catch (error: any) {
    console.error('   ❌ Posting queue failed:', error.message);
    console.error('   Stack:', error.stack?.substring(0, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Check complete');
}

checkPostingSystem().catch(console.error);

