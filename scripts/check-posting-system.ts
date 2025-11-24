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
  console.log(`   Posting enabled: ${!flags.postingDisabled}`);
  console.log(`   Max posts/hour: ${config.MAX_POSTS_PER_HOUR ?? 1}`);
  console.log(`   Max replies/hour: ${config.REPLIES_PER_HOUR ?? 4}`);
  console.log(`   Posting interval: ${config.JOBS_POSTING_INTERVAL_MIN ?? 5} minutes`);
  
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
  
  // 8. Summary and recommendations
  console.log('\n📊 SUMMARY:');
  const hasQueuedContent = (queuedContent?.length || 0) > 0;
  const hasQueuedReplies = (queuedReplies?.length || 0) > 0;
  const hasStuckPosts = (stuckPosts?.length || 0) > 0;
  const contentLimitReached = contentCount >= maxContent;
  const replyLimitReached = replyCount >= maxReplies;
  
  if (hasQueuedContent && !contentLimitReached) {
    console.log('   ✅ Content queued and rate limit OK - should post');
  } else if (hasQueuedContent && contentLimitReached) {
    console.log('   ⚠️ Content queued but rate limit reached - waiting for next hour');
  } else if (!hasQueuedContent) {
    console.log('   ⚠️ No content queued - check plan job');
  }
  
  if (hasStuckPosts) {
    console.log('   🚨 STUCK POSTS DETECTED - these need recovery!');
  }
  
  // 9. Manual trigger test
  console.log('\n9️⃣ MANUAL POSTING QUEUE TRIGGER:');
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

