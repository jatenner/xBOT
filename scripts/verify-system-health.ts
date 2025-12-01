/**
 * 🔍 COMPREHENSIVE SYSTEM HEALTH VERIFICATION
 * Checks Railway config, Supabase database, and posting/reply status
 */

import dotenv from 'dotenv';
import path from 'path';
import { Client } from 'pg';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

import { getSupabaseClient } from '../src/db/index';
import { getConfig, getModeFlags } from '../src/config/config';

async function verifySystemHealth() {
  console.log('🔍 COMPREHENSIVE SYSTEM HEALTH VERIFICATION\n');
  console.log('='.repeat(70));
  
  const supabase = getSupabaseClient();
  const config = getConfig();
  const flags = getModeFlags(config);
  
  let allChecksPassed = true;
  
  // ============================================================
  // 1. CONFIGURATION CHECK
  // ============================================================
  console.log('\n1️⃣ CONFIGURATION CHECK:');
  console.log('-'.repeat(70));
  
  const configIssues: string[] = [];
  
  // Check posting enabled
  if (flags.postingDisabled) {
    configIssues.push('❌ POSTING_DISABLED=true or MODE=shadow (BLOCKING POSTS)');
    allChecksPassed = false;
  } else {
    console.log('   ✅ Posting enabled');
  }
  
  // Check rate limits
  const maxPostsPerHour = config.MAX_POSTS_PER_HOUR ?? 2;
  if (maxPostsPerHour < 2) {
    configIssues.push(`⚠️ MAX_POSTS_PER_HOUR=${maxPostsPerHour} (should be ≥2)`);
  } else {
    console.log(`   ✅ MAX_POSTS_PER_HOUR=${maxPostsPerHour} (good)`);
  }
  
  const repliesPerHour = config.REPLIES_PER_HOUR ?? 4;
  console.log(`   ✅ REPLIES_PER_HOUR=${repliesPerHour} (good)`);
  
  // Check intervals
  const planInterval = config.JOBS_PLAN_INTERVAL_MIN ?? 60;
  if (planInterval > 120) {
    configIssues.push(`⚠️ JOBS_PLAN_INTERVAL_MIN=${planInterval} (should be ≤60)`);
  } else {
    console.log(`   ✅ JOBS_PLAN_INTERVAL_MIN=${planInterval} (good)`);
  }
  
  const postingInterval = config.JOBS_POSTING_INTERVAL_MIN ?? 5;
  console.log(`   ✅ JOBS_POSTING_INTERVAL_MIN=${postingInterval} (good)`);
  
  const replyInterval = config.JOBS_REPLY_INTERVAL_MIN ?? 30;
  console.log(`   ✅ JOBS_REPLY_INTERVAL_MIN=${replyInterval} (good)`);
  
  if (configIssues.length > 0) {
    console.log('\n   ⚠️ CONFIGURATION ISSUES:');
    configIssues.forEach(issue => console.log(`      ${issue}`));
  }
  
  // ============================================================
  // 2. DATABASE CONNECTIVITY
  // ============================================================
  console.log('\n2️⃣ DATABASE CONNECTIVITY:');
  console.log('-'.repeat(70));
  
  try {
    const { data, error } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .limit(1);
    
    if (error) {
      console.log(`   ❌ Database connection failed: ${error.message}`);
      allChecksPassed = false;
    } else {
      console.log('   ✅ Database connection successful');
    }
  } catch (error: any) {
    console.log(`   ❌ Database error: ${error.message}`);
    allChecksPassed = false;
  }
  
  // ============================================================
  // 3. QUEUE STATUS
  // ============================================================
  console.log('\n3️⃣ QUEUE STATUS:');
  console.log('-'.repeat(70));
  
  // Check queued content
  const { data: queuedContent } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, scheduled_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .order('scheduled_at', { ascending: true })
    .limit(10);
  
  const queuedContentCount = queuedContent?.length || 0;
  console.log(`   Queued content: ${queuedContentCount}`);
  
  if (queuedContentCount === 0) {
    console.log('   ⚠️ No content in queue - check plan job');
  } else {
    const now = new Date();
    const readyCount = queuedContent?.filter((p: any) => 
      new Date(p.scheduled_at) <= now
    ).length || 0;
    console.log(`   Ready to post: ${readyCount}`);
  }
  
  // Check queued replies
  const { data: queuedReplies } = await supabase
    .from('content_metadata')
    .select('decision_id, status, scheduled_at')
    .eq('status', 'queued')
    .eq('decision_type', 'reply')
    .order('scheduled_at', { ascending: true })
    .limit(10);
  
  const queuedRepliesCount = queuedReplies?.length || 0;
  console.log(`   Queued replies: ${queuedRepliesCount}`);
  
  // ============================================================
  // 4. RECENT POSTING ACTIVITY
  // ============================================================
  console.log('\n4️⃣ RECENT POSTING ACTIVITY (last 24 hours):');
  console.log('-'.repeat(70));
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  // Content posts
  const { data: recentContent } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, posted_at, tweet_id')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneDayAgo)
    .order('posted_at', { ascending: false });
  
  const contentLast24h = recentContent?.length || 0;
  const contentLastHour = recentContent?.filter((p: any) => 
    new Date(p.posted_at) >= new Date(oneHourAgo)
  ).length || 0;
  
  console.log(`   Content posts (last 24h): ${contentLast24h}`);
  console.log(`   Content posts (last hour): ${contentLastHour}/${maxPostsPerHour}`);
  
  if (contentLastHour >= maxPostsPerHour) {
    console.log('   ⛔ Rate limit reached for content');
  }
  
  // Replies
  const { data: recentReplies } = await supabase
    .from('content_metadata')
    .select('decision_id, status, posted_at, tweet_id')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', oneDayAgo)
    .order('posted_at', { ascending: false });
  
  const repliesLast24h = recentReplies?.length || 0;
  const repliesLastHour = recentReplies?.filter((p: any) => 
    new Date(p.posted_at) >= new Date(oneHourAgo)
  ).length || 0;
  
  console.log(`   Replies (last 24h): ${repliesLast24h}`);
  console.log(`   Replies (last hour): ${repliesLastHour}/${repliesPerHour}`);
  
  if (repliesLastHour >= repliesPerHour) {
    console.log('   ⛔ Rate limit reached for replies');
  }
  
  // ============================================================
  // 5. STUCK POSTS
  // ============================================================
  console.log('\n5️⃣ STUCK POSTS CHECK:');
  console.log('-'.repeat(70));
  
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: stuckPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at')
    .eq('status', 'posting')
    .lt('created_at', fifteenMinAgo);
  
  const stuckCount = stuckPosts?.length || 0;
  if (stuckCount > 0) {
    console.log(`   🚨 Found ${stuckCount} stuck posts (status='posting' >15min)`);
    allChecksPassed = false;
  } else {
    console.log('   ✅ No stuck posts');
  }
  
  // ============================================================
  // 6. NULL TWEET IDS (POSTED BUT NOT SAVED)
  // ============================================================
  console.log('\n6️⃣ NULL TWEET IDS CHECK:');
  console.log('-'.repeat(70));
  
  const { data: nullTweetIds } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, posted_at')
    .eq('status', 'posted')
    .is('tweet_id', null)
    .gte('posted_at', oneDayAgo);
  
  const nullCount = nullTweetIds?.length || 0;
  if (nullCount > 0) {
    console.log(`   ⚠️ Found ${nullCount} posts with NULL tweet_id (posted but ID not saved)`);
    console.log('   💡 Background recovery job should fix these');
  } else {
    console.log('   ✅ No posts with NULL tweet_id');
  }
  
  // ============================================================
  // 7. DIRECT DATABASE CONNECTION TEST
  // ============================================================
  console.log('\n7️⃣ DIRECT DATABASE CONNECTION TEST:');
  console.log('-'.repeat(70));
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('   ⚠️ DATABASE_URL not set - cannot test direct connection');
  } else {
    try {
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      console.log('   ✅ Direct PostgreSQL connection successful');
      console.log(`   📅 Database time: ${result.rows[0].current_time}`);
      await client.end();
    } catch (error: any) {
      console.log(`   ❌ Direct connection failed: ${error.message}`);
      allChecksPassed = false;
    }
  }
  
  // ============================================================
  // 8. SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(70));
  
  if (allChecksPassed && configIssues.length === 0) {
    console.log('✅ ALL CHECKS PASSED - System is healthy');
  } else {
    console.log('⚠️ ISSUES DETECTED:');
    if (!allChecksPassed) {
      console.log('   - Some checks failed (see above)');
    }
    if (configIssues.length > 0) {
      console.log('   - Configuration issues (see above)');
    }
  }
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (flags.postingDisabled) {
    console.log('   1. Set MODE=live or POSTING_DISABLED=false');
  }
  if (queuedContentCount === 0) {
    console.log('   2. Check plan job is running (should generate content)');
  }
  if (stuckCount > 0) {
    console.log('   3. Stuck posts will auto-recover on next posting queue run');
  }
  if (nullCount > 0) {
    console.log('   4. NULL tweet_ids will be recovered by background job');
  }
  
  console.log('\n' + '='.repeat(70));
}

verifySystemHealth().catch(console.error);

