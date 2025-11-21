/**
 * 🔍 POSTING SYSTEM DIAGNOSTIC
 * Checks why system hasn't posted in 4-5 hours
 */

import { getSupabaseClient } from '../src/db/index';
import { getConfig, getModeFlags } from '../src/config/config';

async function diagnosePostingIssue() {
  console.log('🔍 POSTING SYSTEM DIAGNOSTIC\n');
  console.log('═'.repeat(60));
  
  const supabase = getSupabaseClient();
  const config = getConfig();
  const flags = getModeFlags(config);
  
  // 1. Check posting flags
  console.log('\n📋 1. POSTING FLAGS:');
  console.log(`   postingDisabled: ${flags.postingDisabled}`);
  console.log(`   postingEnabled: ${flags.postingEnabled}`);
  console.log(`   MODE: ${config.MODE}`);
  console.log(`   DRY_RUN: ${process.env.DRY_RUN || 'not set'}`);
  console.log(`   POSTING_DISABLED: ${process.env.POSTING_DISABLED || 'not set'}`);
  
  if (flags.postingDisabled) {
    console.log('   ❌ POSTING IS DISABLED - This is blocking all posts!');
  } else {
    console.log('   ✅ Posting flags OK');
  }
  
  // 2. Check plan job interval
  console.log('\n📋 2. PLAN JOB CONFIG:');
  console.log(`   JOBS_PLAN_INTERVAL_MIN: ${config.JOBS_PLAN_INTERVAL_MIN} minutes`);
  console.log(`   Planner enabled: ${flags.plannerEnabled}`);
  
  // 3. Check last content generation
  console.log('\n📋 3. LAST CONTENT GENERATION:');
  const { data: lastContent, error: contentError } = await supabase
    .from('content_metadata')
    .select('decision_id, created_at, decision_type, status, scheduled_at')
    .in('decision_type', ['single', 'thread'])
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (contentError) {
    console.log(`   ❌ Error: ${contentError.message}`);
  } else if (!lastContent || lastContent.length === 0) {
    console.log('   ❌ NO CONTENT GENERATED - Plan job may not be running!');
  } else {
    const mostRecent = lastContent[0];
    const hoursAgo = (Date.now() - new Date(String(mostRecent.created_at)).getTime()) / (1000 * 60 * 60);
    console.log(`   Last content: ${hoursAgo.toFixed(1)} hours ago`);
    console.log(`   Decision ID: ${mostRecent.decision_id}`);
    console.log(`   Type: ${mostRecent.decision_type}`);
    console.log(`   Status: ${mostRecent.status}`);
    console.log(`   Scheduled: ${mostRecent.scheduled_at}`);
    
    if (hoursAgo > 4) {
      console.log(`   ⚠️ WARNING: Last content generated ${hoursAgo.toFixed(1)}h ago (>4h)`);
    }
    
    console.log(`\n   Recent content (last 5):`);
    lastContent.forEach((c, i) => {
      const h = (Date.now() - new Date(String(c.created_at)).getTime()) / (1000 * 60 * 60);
      console.log(`   ${i + 1}. ${c.decision_type} - ${h.toFixed(1)}h ago - status: ${c.status}`);
    });
  }
  
  // 4. Check queued posts
  console.log('\n📋 4. QUEUED POSTS:');
  const { data: queuedPosts, error: queueError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, scheduled_at, created_at, retry_count')
    .eq('status', 'queued')
    .order('scheduled_at', { ascending: true })
    .limit(10);
  
  if (queueError) {
    console.log(`   ❌ Error: ${queueError.message}`);
  } else if (!queuedPosts || queuedPosts.length === 0) {
    console.log('   ⚠️ NO QUEUED POSTS - Nothing waiting to be posted');
  } else {
    console.log(`   ✅ Found ${queuedPosts.length} queued posts:`);
    queuedPosts.forEach((p, i) => {
      const scheduled = new Date(String(p.scheduled_at));
      const now = new Date();
      const minutesUntil = Math.round((scheduled.getTime() - now.getTime()) / (1000 * 60));
      const status = minutesUntil <= 5 ? 'READY' : `scheduled in ${minutesUntil}min`;
      console.log(`   ${i + 1}. ${p.decision_type} - ${status} - retries: ${p.retry_count || 0}`);
    });
  }
  
  // 5. Check recent posts
  console.log('\n📋 5. RECENT POSTS (last 24h):');
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { data: recentPosts, error: postsError } = await supabase
    .from('posted_decisions')
    .select('decision_id, posted_at, decision_type')
    .gte('posted_at', oneDayAgo.toISOString())
    .order('posted_at', { ascending: false })
    .limit(10);
  
  if (postsError) {
    console.log(`   ❌ Error: ${postsError.message}`);
  } else if (!recentPosts || recentPosts.length === 0) {
    console.log('   ⚠️ NO POSTS IN LAST 24 HOURS');
  } else {
    console.log(`   ✅ Found ${recentPosts.length} posts in last 24h:`);
    recentPosts.forEach((p, i) => {
      const hoursAgo = (Date.now() - new Date(String(p.posted_at)).getTime()) / (1000 * 60 * 60);
      console.log(`   ${i + 1}. ${p.decision_type} - ${hoursAgo.toFixed(1)}h ago`);
    });
    
    const mostRecentPost = recentPosts[0];
    const hoursSinceLastPost = (Date.now() - new Date(String(mostRecentPost.posted_at)).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastPost > 4) {
      console.log(`\n   ⚠️ WARNING: Last post was ${hoursSinceLastPost.toFixed(1)}h ago (>4h)`);
    }
  }
  
  // 6. Check rate limits
  console.log('\n📋 6. RATE LIMITS:');
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const { data: postsThisHour } = await supabase
    .from('posted_decisions')
    .select('decision_id')
    .in('decision_type', ['single', 'thread'])
    .gte('posted_at', oneHourAgo.toISOString());
  
  const { data: repliesThisHour } = await supabase
    .from('posted_decisions')
    .select('decision_id')
    .eq('decision_type', 'reply')
    .gte('posted_at', oneHourAgo.toISOString());
  
  const contentCount = postsThisHour?.length || 0;
  const replyCount = repliesThisHour?.length || 0;
  const maxContent = config.MAX_POSTS_PER_HOUR || 2;
  const maxReplies = config.MAX_REPLIES_PER_HOUR || 4;
  
  console.log(`   Content posts this hour: ${contentCount}/${maxContent}`);
  console.log(`   Replies this hour: ${replyCount}/${maxReplies}`);
  
  if (contentCount >= maxContent) {
    console.log(`   ⚠️ CONTENT RATE LIMIT REACHED - Blocking new content posts`);
  }
  if (replyCount >= maxReplies) {
    console.log(`   ⚠️ REPLY RATE LIMIT REACHED - Blocking new replies`);
  }
  
  // 7. Check for stuck posts
  console.log('\n📋 7. STUCK POSTS (status="posting" >30min):');
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const { data: stuckPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at')
    .eq('status', 'posting')
    .lt('created_at', thirtyMinAgo.toISOString());
  
  if (stuckPosts && stuckPosts.length > 0) {
    console.log(`   ⚠️ Found ${stuckPosts.length} stuck posts (status="posting" >30min):`);
    stuckPosts.forEach((p, i) => {
      const minutesAgo = (Date.now() - new Date(String(p.created_at)).getTime()) / (1000 * 60);
      console.log(`   ${i + 1}. ${p.decision_type} - stuck for ${minutesAgo.toFixed(0)}min`);
    });
  } else {
    console.log('   ✅ No stuck posts');
  }
  
  // 8. Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 DIAGNOSIS SUMMARY:\n');
  
  const issues: string[] = [];
  
  if (flags.postingDisabled) {
    issues.push('❌ Posting is DISABLED (flags.postingDisabled=true)');
  }
  
  if (!lastContent || lastContent.length === 0) {
    issues.push('❌ No content generated - Plan job may not be running');
  } else {
    const hoursAgo = (Date.now() - new Date(String(lastContent[0].created_at)).getTime()) / (1000 * 60 * 60);
    if (hoursAgo > 4) {
      issues.push(`⚠️ Last content generated ${hoursAgo.toFixed(1)}h ago (plan job may be stuck)`);
    }
  }
  
  if (!queuedPosts || queuedPosts.length === 0) {
    issues.push('⚠️ No queued posts - Nothing waiting to post');
  }
  
  if (!recentPosts || recentPosts.length === 0) {
    issues.push('❌ No posts in last 24 hours');
  } else {
    const hoursAgo = (Date.now() - new Date(String(recentPosts[0].posted_at)).getTime()) / (1000 * 60 * 60);
    if (hoursAgo > 4) {
      issues.push(`⚠️ Last post was ${hoursAgo.toFixed(1)}h ago`);
    }
  }
  
  if (contentCount >= maxContent) {
    issues.push(`⚠️ Content rate limit reached (${contentCount}/${maxContent})`);
  }
  
  if (issues.length === 0) {
    console.log('✅ No obvious issues found - System appears healthy');
  } else {
    console.log('ISSUES DETECTED:');
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }
  
  console.log('\n' + '═'.repeat(60));
}

diagnosePostingIssue().catch(console.error);

