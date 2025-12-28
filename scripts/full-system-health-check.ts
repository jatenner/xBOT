#!/usr/bin/env tsx
/**
 * COMPREHENSIVE SYSTEM HEALTH CHECK
 * Verifies all operations are working and provides evidence
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fullSystemCheck() {
  console.log('🏥 XBOT FULL SYSTEM HEALTH CHECK\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = {
    working: [] as string[],
    broken: [] as string[],
    warnings: [] as string[]
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. DATABASE CONNECTIVITY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('1️⃣  DATABASE CONNECTIVITY\n');
  try {
    const { data, error } = await supabase.from('content_metadata').select('decision_id').limit(1);
    if (error) throw error;
    console.log('   ✅ Database connected');
    console.log('   ✅ content_metadata table accessible\n');
    results.working.push('Database connectivity');
  } catch (err) {
    console.log('   ❌ Database connection failed\n');
    results.broken.push('Database connectivity');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CONTENT GENERATION (planJob)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('2️⃣  CONTENT GENERATION (planJob)\n');
  
  const { data: recentDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  const last24h = recentDecisions?.filter(d => 
    new Date(d.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
  );

  if (last24h && last24h.length > 0) {
    console.log(`   ✅ Generated ${last24h.length} decisions in last 24h`);
    const singles = last24h.filter(d => d.decision_type === 'single').length;
    const threads = last24h.filter(d => d.decision_type === 'thread').length;
    const replies = last24h.filter(d => d.decision_type === 'reply').length;
    console.log(`   📊 Singles: ${singles} | Threads: ${threads} | Replies: ${replies}`);
    console.log(`   ⏰ Interval: ${process.env.JOBS_PLAN_INTERVAL_MIN || '60'} minutes\n`);
    results.working.push('Content generation');
  } else {
    console.log('   ⚠️  No content generated in last 24h\n');
    results.warnings.push('Content generation (no recent activity)');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. POSTING SYSTEM (postingQueue)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('3️⃣  POSTING SYSTEM\n');
  
  const { data: recentPosts } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, status, posted_at, tweet_id')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false });

  if (recentPosts && recentPosts.length > 0) {
    const withIds = recentPosts.filter(p => p.tweet_id).length;
    const withoutIds = recentPosts.length - withIds;
    
    console.log(`   ✅ Posted ${recentPosts.length} tweets in last 24h`);
    console.log(`   ✅ ${withIds} have tweet_id saved`);
    if (withoutIds > 0) {
      console.log(`   ⚠️  ${withoutIds} missing tweet_id`);
      results.warnings.push(`Posting: ${withoutIds} tweets missing IDs`);
    }
    
    const singlesPosted = recentPosts.filter(p => p.decision_type === 'single').length;
    const threadsPosted = recentPosts.filter(p => p.decision_type === 'thread').length;
    const repliesPosted = recentPosts.filter(p => p.decision_type === 'reply').length;
    console.log(`   📊 Singles: ${singlesPosted} | Threads: ${threadsPosted} | Replies: ${repliesPosted}\n`);
    results.working.push('Posting system');
  } else {
    console.log('   ❌ No posts in last 24h\n');
    results.broken.push('Posting system (no posts)');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. POST RECEIPTS (Truth Backup)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('4️⃣  POST RECEIPTS (Truth Backup)\n');
  
  const { data: receipts } = await supabase
    .from('post_receipts')
    .select('receipt_id, post_type, posted_at')
    .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false });

  if (receipts && receipts.length > 0) {
    console.log(`   ✅ ${receipts.length} receipts written in last 24h`);
    const singles = receipts.filter(r => r.post_type === 'single').length;
    const threads = receipts.filter(r => r.post_type === 'thread').length;
    const replies = receipts.filter(r => r.post_type === 'reply').length;
    console.log(`   📊 Singles: ${singles} | Threads: ${threads} | Replies: ${replies}\n`);
    
    // Check for gap between posts and receipts
    const receiptCount = receipts.length;
    const postCount = recentPosts?.length || 0;
    const gap = Math.abs(receiptCount - postCount);
    
    if (gap > 3) {
      console.log(`   ⚠️  Gap of ${gap} between posts (${postCount}) and receipts (${receiptCount})\n`);
      results.warnings.push(`Receipt system: ${gap} gap between posts and receipts`);
    }
    
    results.working.push('Post receipts (truth backup)');
  } else {
    console.log('   ⚠️  No receipts in last 24h (truth backup not working)\n');
    results.warnings.push('Post receipts (no recent receipts)');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. REPLY SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('5️⃣  REPLY SYSTEM\n');
  
  // Check opportunities
  const { count: totalOpps } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false);

  const { data: freshOpps } = await supabase
    .from('reply_opportunities')
    .select('target_username, like_count, target_followers, created_at')
    .eq('replied_to', false)
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`   📊 Total opportunities: ${totalOpps || 0}`);
  console.log(`   📊 Fresh (< 2h): ${freshOpps?.length || 0}`);
  
  if (freshOpps && freshOpps.length > 0) {
    console.log('\n   Recent opportunities:');
    freshOpps.forEach((opp, i) => {
      const minutesAgo = Math.round((Date.now() - new Date(opp.created_at).getTime()) / 1000 / 60);
      console.log(`     ${i + 1}. @${opp.target_username}`);
      console.log(`        Likes: ${opp.like_count?.toLocaleString() || 'N/A'}`);
      console.log(`        Followers: ${opp.target_followers || 'NULL'}`);
      console.log(`        Harvested: ${minutesAgo}m ago`);
    });
  }
  
  // Check quality filters
  const minLikes = parseInt(process.env.REPLY_MIN_TWEET_LIKES || '5000');
  const minFollowers = parseInt(process.env.REPLY_MIN_FOLLOWERS || '0');
  console.log(`\n   ⚙️  REPLY_MIN_TWEET_LIKES: ${minLikes}`);
  console.log(`   ⚙️  REPLY_MIN_FOLLOWERS: ${minFollowers}`);
  
  // Count opportunities passing filters
  const { count: qualityOpps } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .gte('like_count', minLikes);

  console.log(`   📊 Opportunities passing quality filter: ${qualityOpps || 0}\n`);
  
  if ((qualityOpps || 0) > 0) {
    console.log('   ✅ Reply harvester working');
    console.log('   ✅ Quality filters active\n');
    results.working.push('Reply system (harvesting + filtering)');
  } else {
    console.log('   ⚠️  No opportunities passing quality filter\n');
    results.warnings.push('Reply system (no quality opportunities)');
  }

  // Check recent reply posts
  const recentReplies = recentPosts?.filter(p => p.decision_type === 'reply') || [];
  if (recentReplies.length > 0) {
    console.log(`   ✅ Reply posting working (${recentReplies.length} in last 24h)\n`);
    results.working.push('Reply posting');
  } else {
    console.log('   ⚠️  No replies posted in last 24h\n');
    results.warnings.push('Reply posting (no recent replies)');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. METRICS SCRAPING
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('6️⃣  METRICS SCRAPING\n');
  
  const { data: metricsData } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, actual_impressions, actual_likes, actual_reposts, actual_replies, posted_at')
    .eq('status', 'posted')
    .not('actual_impressions', 'is', null)
    .gte('posted_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false })
    .limit(10);

  if (metricsData && metricsData.length > 0) {
    console.log(`   ✅ ${metricsData.length} posts have metrics in last 48h`);
    const avgImpressions = Math.round(
      metricsData.reduce((sum, m) => sum + (m.actual_impressions || 0), 0) / metricsData.length
    );
    const avgLikes = Math.round(
      metricsData.reduce((sum, m) => sum + (m.actual_likes || 0), 0) / metricsData.length
    );
    console.log(`   📊 Avg impressions: ${avgImpressions.toLocaleString()}`);
    console.log(`   📊 Avg likes: ${avgLikes}`);
    console.log('   ✅ Metrics scraper working\n');
    results.working.push('Metrics scraping');
  } else {
    console.log('   ⚠️  No recent posts have metrics scraped\n');
    results.warnings.push('Metrics scraping (no recent data)');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. LEARNING SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('7️⃣  LEARNING SYSTEM\n');
  
  const { data: outcomes } = await supabase
    .from('outcomes')
    .select('decision_id, actual_impressions, actual_engagement_rate, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (outcomes && outcomes.length > 0) {
    console.log(`   ✅ Learning data being collected`);
    console.log(`   📊 ${outcomes.length} recent outcomes recorded`);
    console.log('   ✅ Learning pipeline active\n');
    results.working.push('Learning system (data collection)');
  } else {
    console.log('   ⚠️  No outcomes data (learning blocked)\n');
    results.warnings.push('Learning system (no outcomes data)');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. BROWSER POOL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('8️⃣  BROWSER POOL\n');
  
  console.log(`   ⚙️  MAX_CONTEXTS: ${process.env.MAX_CONTEXTS || '5'}`);
  console.log(`   ⚙️  Railway Plan: Pro (32GB RAM, 32 vCPU)`);
  
  // Check if browser operations are working by checking recent posts
  const recentPostTime = recentPosts?.[0]?.posted_at;
  if (recentPostTime) {
    const minutesAgo = Math.round((Date.now() - new Date(recentPostTime).getTime()) / 1000 / 60);
    console.log(`   ✅ Last browser operation: ${minutesAgo}m ago`);
    console.log('   ✅ Browser pool functional\n');
    results.working.push('Browser pool');
  } else {
    console.log('   ⚠️  No recent browser activity\n');
    results.warnings.push('Browser pool (no recent activity)');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. ENVIRONMENT CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('9️⃣  ENVIRONMENT CONFIGURATION\n');
  
  const criticalVars = {
    'SUPABASE_URL': process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing',
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing',
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
    'TWITTER_USERNAME': process.env.TWITTER_USERNAME ? '✅ Set' : '❌ Missing',
    'TWITTER_SESSION_B64': process.env.TWITTER_SESSION_B64 ? '✅ Set' : '❌ Missing'
  };

  Object.entries(criticalVars).forEach(([key, status]) => {
    console.log(`   ${status} ${key}`);
  });
  
  const allSet = Object.values(criticalVars).every(v => v.includes('✅'));
  if (allSet) {
    console.log('\n   ✅ All critical environment variables set\n');
    results.working.push('Environment configuration');
  } else {
    console.log('\n   ❌ Some critical variables missing\n');
    results.broken.push('Environment configuration (missing vars)');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. SYSTEM PERFORMANCE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔟 SYSTEM PERFORMANCE\n');
  
  const last24hPosts = recentPosts?.length || 0;
  const expectedPostsPerDay = Math.round(24 * 60 / parseInt(process.env.JOBS_PLAN_INTERVAL_MIN || '60'));
  const performanceRate = last24hPosts > 0 ? Math.round((last24hPosts / expectedPostsPerDay) * 100) : 0;
  
  console.log(`   📊 Posts in last 24h: ${last24hPosts}`);
  console.log(`   📊 Expected posts/day: ~${expectedPostsPerDay}`);
  console.log(`   📊 Performance rate: ${performanceRate}%`);
  
  if (performanceRate >= 80) {
    console.log('   ✅ System performing well\n');
    results.working.push('System performance');
  } else if (performanceRate >= 50) {
    console.log('   ⚠️  System performing below target\n');
    results.warnings.push(`System performance (${performanceRate}% of target)`);
  } else {
    console.log('   ❌ System significantly underperforming\n');
    results.broken.push(`System performance (${performanceRate}% of target)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 SYSTEM HEALTH SUMMARY\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`✅ WORKING (${results.working.length} systems):\n`);
  results.working.forEach(item => console.log(`   • ${item}`));
  
  if (results.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${results.warnings.length} items):\n`);
    results.warnings.forEach(item => console.log(`   • ${item}`));
  }
  
  if (results.broken.length > 0) {
    console.log(`\n❌ BROKEN (${results.broken.length} systems):\n`);
    results.broken.forEach(item => console.log(`   • ${item}`));
  }

  const healthScore = Math.round(
    (results.working.length / (results.working.length + results.broken.length + results.warnings.length)) * 100
  );
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`🎯 OVERALL HEALTH SCORE: ${healthScore}%\n`);
  
  if (healthScore >= 90) {
    console.log('   ✅ EXCELLENT - System is healthy and ready for full operation\n');
  } else if (healthScore >= 75) {
    console.log('   ⚠️  GOOD - System functional with minor issues to address\n');
  } else if (healthScore >= 50) {
    console.log('   ⚠️  FAIR - System partially functional, needs attention\n');
  } else {
    console.log('   ❌ POOR - System has critical issues requiring immediate fixes\n');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

fullSystemCheck();

