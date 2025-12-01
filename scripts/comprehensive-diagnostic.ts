/**
 * 🔍 COMPREHENSIVE SYSTEM DIAGNOSTIC
 * Thoroughly checks all system components using Supabase
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env file
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Check if .env file exists
import fs from 'fs';
if (!fs.existsSync(envPath)) {
  console.log('⚠️ .env file not found. Using environment variables from system.\n');
}

// Import after env is loaded
import { getSupabaseClient } from '../src/db/index';

async function runDiagnostic() {
  console.log('🔍 COMPREHENSIVE SYSTEM DIAGNOSTIC');
  console.log('='.repeat(70));
  console.log(`📅 Started: ${new Date().toISOString()}\n`);

  const supabase = getSupabaseClient();

  try {
    // Test connection
    const { error: testError } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .limit(1);
    
    if (testError) {
      console.log(`❌ Database connection failed: ${testError.message}`);
      return;
    }
    
    console.log('✅ Database connection successful\n');

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // ============================================================
    // 1. RECENT POSTING ACTIVITY (Last 24 Hours)
    // ============================================================
    console.log('1️⃣ RECENT POSTING ACTIVITY (Last 24 Hours):');
    console.log('-'.repeat(70));
    const { data: recentData, error: recentError } = await supabase
      .from('content_metadata')
      .select('decision_type, status, posted_at, tweet_id')
      .gte('posted_at', oneDayAgo)
      .in('decision_type', ['single', 'thread', 'reply']);
    
    if (recentError) {
      console.log(`   ❌ Error: ${recentError.message}\n`);
    } else if (!recentData || recentData.length === 0) {
      console.log('   🚨 NO POSTS IN LAST 24 HOURS\n');
    } else {
      const grouped: any = {};
      recentData.forEach((item: any) => {
        const key = `${item.decision_type}_${item.status}`;
        if (!grouped[key]) {
          grouped[key] = {
            decision_type: item.decision_type,
            status: item.status,
            count: 0,
            last_post: null,
            null_tweet_ids: 0
          };
        }
        grouped[key].count++;
        if (!grouped[key].last_post || new Date(item.posted_at) > new Date(grouped[key].last_post)) {
          grouped[key].last_post = item.posted_at;
        }
        if (!item.tweet_id) {
          grouped[key].null_tweet_ids++;
        }
      });
      
      Object.values(grouped).forEach((r: any) => {
        console.log(`   ${r.decision_type} (${r.status}): ${r.count} posts`);
        if (r.last_post) {
          const hoursAgo = (Date.now() - new Date(r.last_post).getTime()) / (1000 * 60 * 60);
          console.log(`      Last post: ${hoursAgo.toFixed(1)} hours ago`);
        }
        if (r.null_tweet_ids > 0) {
          console.log(`      ⚠️ ${r.null_tweet_ids} with NULL tweet_id`);
        }
      });
      console.log('');
    }

    // ============================================================
    // 2. QUEUED CONTENT STATUS
    // ============================================================
    console.log('2️⃣ QUEUED CONTENT STATUS:');
    console.log('-'.repeat(70));
    const { data: queuedData, error: queuedError } = await supabase
      .from('content_metadata')
      .select('decision_type, status, scheduled_at')
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread', 'reply']);
    
    if (queuedError) {
      console.log(`   ❌ Error: ${queuedError.message}\n`);
    } else if (!queuedData || queuedData.length === 0) {
      console.log('   🚨 NO QUEUED CONTENT - This is likely the problem!\n');
    } else {
      const now = new Date();
      const grouped: any = {};
      let readyCount = 0;
      
      queuedData.forEach((item: any) => {
        const key = item.decision_type;
        if (!grouped[key]) {
          grouped[key] = {
            decision_type: item.decision_type,
            count: 0,
            earliest: null,
            latest: null
          };
        }
        grouped[key].count++;
        if (!grouped[key].earliest || new Date(item.scheduled_at) < new Date(grouped[key].earliest)) {
          grouped[key].earliest = item.scheduled_at;
        }
        if (!grouped[key].latest || new Date(item.scheduled_at) > new Date(grouped[key].latest)) {
          grouped[key].latest = item.scheduled_at;
        }
        if (new Date(item.scheduled_at) <= now) {
          readyCount++;
        }
      });
      
      Object.values(grouped).forEach((r: any) => {
        console.log(`   ${r.decision_type}: ${r.count} queued`);
        if (r.earliest) {
          const minsUntil = (new Date(r.earliest).getTime() - Date.now()) / (1000 * 60);
          console.log(`      Earliest: ${minsUntil > 0 ? Math.round(minsUntil) + ' min' : 'NOW'}`);
        }
      });
      console.log(`   Ready to post now: ${readyCount}\n`);
    }

    // ============================================================
    // 3. STUCK POSTS
    // ============================================================
    console.log('3️⃣ STUCK POSTS (status=posting >15min):');
    console.log('-'.repeat(70));
    const { data: stuckData, error: stuckError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, created_at')
      .eq('status', 'posting')
      .lt('created_at', fifteenMinAgo)
      .order('created_at', { ascending: true })
      .limit(10);
    
    if (stuckError) {
      console.log(`   ❌ Error: ${stuckError.message}\n`);
    } else if (!stuckData || stuckData.length === 0) {
      console.log('   ✅ No stuck posts\n');
    } else {
      console.log(`   🚨 Found ${stuckData.length} stuck posts:`);
      stuckData.forEach((r: any) => {
        const minutesStuck = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60);
        console.log(`      ${r.decision_type} ${r.decision_id.substring(0, 8)}... (stuck ${Math.round(minutesStuck)} min)`);
      });
      console.log('');
    }

    // ============================================================
    // 4. CONTENT GENERATION STATUS (Last 24 Hours)
    // ============================================================
    console.log('4️⃣ CONTENT GENERATION STATUS (Last 24 Hours):');
    console.log('-'.repeat(70));
    const { data: generatedData, error: generatedError } = await supabase
      .from('content_metadata')
      .select('decision_type, status, created_at')
      .gte('created_at', oneDayAgo)
      .in('decision_type', ['single', 'thread']);
    
    if (generatedError) {
      console.log(`   ❌ Error: ${generatedError.message}\n`);
    } else if (!generatedData || generatedData.length === 0) {
      console.log('   🚨 NO CONTENT GENERATED IN LAST 24 HOURS - Plan job not working!\n');
    } else {
      const grouped: any = {};
      generatedData.forEach((item: any) => {
        const key = `${item.decision_type}_${item.status}`;
        if (!grouped[key]) {
          grouped[key] = {
            decision_type: item.decision_type,
            status: item.status,
            count: 0,
            last_generated: null
          };
        }
        grouped[key].count++;
        if (!grouped[key].last_generated || new Date(item.created_at) > new Date(grouped[key].last_generated)) {
          grouped[key].last_generated = item.created_at;
        }
      });
      
      Object.values(grouped).forEach((r: any) => {
        console.log(`   ${r.decision_type} (${r.status}): ${r.count} generated`);
        if (r.last_generated) {
          const hoursAgo = (Date.now() - new Date(r.last_generated).getTime()) / (1000 * 60 * 60);
          console.log(`      Last: ${hoursAgo.toFixed(1)} hours ago`);
        }
      });
      console.log('');
    }

    // ============================================================
    // 5. RATE LIMIT CHECK
    // ============================================================
    console.log('5️⃣ RATE LIMIT CHECK (Last Hour):');
    console.log('-'.repeat(70));
    const { data: rateLimitData, error: rateLimitError } = await supabase
      .from('content_metadata')
      .select('decision_type')
      .gte('posted_at', oneHourAgo)
      .eq('status', 'posted')
      .in('decision_type', ['single', 'thread', 'reply']);
    
    if (rateLimitError) {
      console.log(`   ❌ Error: ${rateLimitError.message}\n`);
    } else if (!rateLimitData || rateLimitData.length === 0) {
      console.log('   ✅ No posts in last hour (rate limit OK)\n');
    } else {
      const grouped: any = {};
      rateLimitData.forEach((item: any) => {
        if (!grouped[item.decision_type]) {
          grouped[item.decision_type] = 0;
        }
        grouped[item.decision_type]++;
      });
      
      Object.entries(grouped).forEach(([type, count]: [string, any]) => {
        const limit = type === 'reply' ? 4 : 2;
        const status = count >= limit ? '⛔ LIMIT REACHED' : '✅ OK';
        console.log(`   ${status} ${type}: ${count}/${limit}`);
      });
      console.log('');
    }

    // ============================================================
    // 6. NULL TWEET IDS
    // ============================================================
    console.log('6️⃣ NULL TWEET IDS (Posted but ID not saved):');
    console.log('-'.repeat(70));
    const { data: nullIdsData, error: nullIdsError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, posted_at')
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', oneDayAgo)
      .order('posted_at', { ascending: false })
      .limit(10);
    
    if (nullIdsError) {
      console.log(`   ❌ Error: ${nullIdsError.message}\n`);
    } else if (!nullIdsData || nullIdsData.length === 0) {
      console.log('   ✅ No posts with NULL tweet_id\n');
    } else {
      console.log(`   ⚠️ Found ${nullIdsData.length} posts with NULL tweet_id:`);
      nullIdsData.forEach((r: any) => {
        const minutesAgo = (Date.now() - new Date(r.posted_at).getTime()) / (1000 * 60);
        console.log(`      ${r.decision_type} ${r.decision_id.substring(0, 8)}... (${Math.round(minutesAgo)} min ago)`);
      });
      console.log('');
    }

    // ============================================================
    // 7. SYSTEM HEALTH SUMMARY
    // ============================================================
    console.log('7️⃣ SYSTEM HEALTH SUMMARY:');
    console.log('-'.repeat(70));
    
    // Content posts (24h)
    const { count: contentPosts24h } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .gte('posted_at', oneDayAgo)
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted');
    
    // Replies (24h)
    const { count: replies24h } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .gte('posted_at', oneDayAgo)
      .eq('decision_type', 'reply')
      .eq('status', 'posted');
    
    // Queued content
    const { count: queuedContent } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread']);
    
    // Queued replies
    const { count: queuedReplies } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .eq('decision_type', 'reply');
    
    // Stuck posts
    const { count: stuckPosts } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posting')
      .lt('created_at', fifteenMinAgo);
    
    // NULL tweet IDs
    const { count: nullTweetIds } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', oneDayAgo);
    
    // Content generated (24h)
    const { count: contentGenerated24h } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo)
      .in('decision_type', ['single', 'thread']);
    
    const metrics = [
      { name: 'Content Posts (24h)', value: contentPosts24h || 0, critical: false },
      { name: 'Replies (24h)', value: replies24h || 0, critical: false },
      { name: 'Queued Content', value: queuedContent || 0, critical: true },
      { name: 'Queued Replies', value: queuedReplies || 0, critical: false },
      { name: 'Stuck Posts', value: stuckPosts || 0, critical: true },
      { name: 'NULL Tweet IDs', value: nullTweetIds || 0, critical: true },
      { name: 'Content Generated (24h)', value: contentGenerated24h || 0, critical: true }
    ];
    
    metrics.forEach(m => {
      let icon = '📊';
      if (m.value === 0 && m.critical && (m.name.includes('Generated') || m.name.includes('Queued'))) {
        icon = '🚨';
      } else if (m.value === 0 && m.critical) {
        icon = '✅';
      } else if (m.value > 0 && m.critical && (m.name.includes('Stuck') || m.name.includes('NULL'))) {
        icon = '⚠️';
      }
      console.log(`   ${icon} ${m.name}: ${m.value}`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Diagnostic complete');
    console.log('='.repeat(70));
    
    // ============================================================
    // 8. DIAGNOSIS SUMMARY
    // ============================================================
    console.log('\n8️⃣ DIAGNOSIS SUMMARY:');
    console.log('-'.repeat(70));
    
    const issues: string[] = [];
    
    if ((contentGenerated24h || 0) === 0) {
      issues.push('🚨 Plan job not generating content');
    }
    if ((queuedContent || 0) === 0 && (queuedReplies || 0) === 0) {
      issues.push('🚨 No content in queue to post');
    }
    if ((contentPosts24h || 0) === 0 && (replies24h || 0) === 0) {
      issues.push('🚨 No posts in last 24 hours');
    }
    if ((stuckPosts || 0) > 0) {
      issues.push(`⚠️ ${stuckPosts} stuck posts need recovery`);
    }
    if ((nullTweetIds || 0) > 0) {
      issues.push(`⚠️ ${nullTweetIds} posts missing tweet IDs`);
    }
    
    if (issues.length === 0) {
      console.log('   ✅ No critical issues detected');
    } else {
      issues.forEach(issue => console.log(`   ${issue}`));
    }
    
    console.log('');

  } catch (err: any) {
    console.error('\n❌ Diagnostic error:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack.substring(0, 500));
    }
  }
}

runDiagnostic().catch(console.error);
