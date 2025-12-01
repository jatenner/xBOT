/**
 * 🔍 DIRECT DATABASE CHECK
 * Connects directly to PostgreSQL and runs verification queries
 */

import dotenv from 'dotenv';
import path from 'path';
import { getSupabaseClient } from '../src/db/index';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkDatabase() {
  console.log('🔍 DIRECT DATABASE VERIFICATION\n');
  console.log('='.repeat(70));
  
  const supabase = getSupabaseClient();
  
  try {
    // Test connection
    const { data: testData, error: testError } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .limit(1);
    
    if (testError) {
      console.error('❌ Database connection failed:', testError.message);
      return;
    }
    
    console.log('✅ Database connection successful\n');
    
    // ============================================================
    // 1. RECENT POSTING ACTIVITY (Last 24 Hours)
    // ============================================================
    console.log('1️⃣ RECENT POSTING ACTIVITY (Last 24 Hours):');
    console.log('-'.repeat(70));
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentActivity, error: recentError } = await supabase
      .from('content_metadata')
      .select('decision_type, status, posted_at, tweet_id')
      .gte('posted_at', oneDayAgo)
      .in('decision_type', ['single', 'thread', 'reply']);
    
    if (recentError) {
      console.error('   ❌ Error:', recentError.message);
    } else {
      // Group by decision_type and status
      const grouped = (recentActivity || []).reduce((acc: any, item: any) => {
        const key = `${item.decision_type}_${item.status}`;
        if (!acc[key]) {
          acc[key] = { decision_type: item.decision_type, status: item.status, count: 0, last_post: null, null_tweet_ids: 0 };
        }
        acc[key].count++;
        if (!acc[key].last_post || new Date(item.posted_at) > new Date(acc[key].last_post)) {
          acc[key].last_post = item.posted_at;
        }
        if (!item.tweet_id) {
          acc[key].null_tweet_ids++;
        }
        return acc;
      }, {});
      
      const groupedArray = Object.values(grouped);
      
      if (groupedArray.length === 0) {
        console.log('   ⚠️ No posts in last 24 hours');
      } else {
        groupedArray.forEach((row: any) => {
          console.log(`   ${row.decision_type} (${row.status}): ${row.count} posts`);
          if (row.last_post) {
            const lastPost = new Date(row.last_post);
            const hoursAgo = (Date.now() - lastPost.getTime()) / (1000 * 60 * 60);
            console.log(`      Last post: ${hoursAgo.toFixed(1)} hours ago`);
          }
          if (row.null_tweet_ids > 0) {
            console.log(`      ⚠️ ${row.null_tweet_ids} posts with NULL tweet_id`);
          }
        });
      }
    }
    
    if (recentActivity.rows.length === 0) {
      console.log('   ⚠️ No posts in last 24 hours');
    } else {
      recentActivity.rows.forEach((row: any) => {
        console.log(`   ${row.decision_type} (${row.status}): ${row.count} posts`);
        if (row.last_post) {
          const lastPost = new Date(row.last_post);
          const hoursAgo = (Date.now() - lastPost.getTime()) / (1000 * 60 * 60);
          console.log(`      Last post: ${hoursAgo.toFixed(1)} hours ago`);
        }
        if (row.null_tweet_ids > 0) {
          console.log(`      ⚠️ ${row.null_tweet_ids} posts with NULL tweet_id`);
        }
      });
    }
    
    // ============================================================
    // 2. POSTING ACTIVITY BY HOUR (Last 24 Hours)
    // ============================================================
    console.log('\n2️⃣ POSTING ACTIVITY BY HOUR (Last 24 Hours):');
    console.log('-'.repeat(70));
    
    const hourlyActivity = await client.query(`
      SELECT 
        DATE_TRUNC('hour', posted_at) as hour,
        decision_type,
        COUNT(*) as posts_count
      FROM content_metadata
      WHERE posted_at >= NOW() - INTERVAL '24 hours'
        AND status = 'posted'
        AND decision_type IN ('single', 'thread', 'reply')
      GROUP BY DATE_TRUNC('hour', posted_at), decision_type
      ORDER BY hour DESC, decision_type
      LIMIT 24;
    `);
    
    if (hourlyActivity.rows.length === 0) {
      console.log('   ⚠️ No hourly activity data');
    } else {
      hourlyActivity.rows.forEach((row: any) => {
        const hour = new Date(row.hour);
        console.log(`   ${hour.toLocaleString()}: ${row.decision_type} = ${row.posts_count} posts`);
      });
    }
    
    // ============================================================
    // 3. QUEUE STATUS
    // ============================================================
    console.log('\n3️⃣ QUEUE STATUS:');
    console.log('-'.repeat(70));
    
    const queueStatus = await client.query(`
      SELECT 
        decision_type,
        status,
        COUNT(*) as count,
        MIN(scheduled_at) as earliest_scheduled,
        MAX(scheduled_at) as latest_scheduled,
        COUNT(CASE WHEN scheduled_at <= NOW() THEN 1 END) as ready_to_post
      FROM content_metadata
      WHERE status IN ('queued', 'posting')
        AND decision_type IN ('single', 'thread', 'reply')
      GROUP BY decision_type, status
      ORDER BY decision_type, status;
    `);
    
    if (queueStatus.rows.length === 0) {
      console.log('   ⚠️ No items in queue');
    } else {
      queueStatus.rows.forEach((row: any) => {
        console.log(`   ${row.decision_type} (${row.status}): ${row.count} items`);
        console.log(`      Ready to post: ${row.ready_to_post}`);
        if (row.earliest_scheduled) {
          const earliest = new Date(row.earliest_scheduled);
          const minsUntil = (earliest.getTime() - Date.now()) / (1000 * 60);
          console.log(`      Earliest: ${minsUntil > 0 ? `${minsUntil.toFixed(0)} min` : 'NOW'}`);
        }
      });
    }
    
    // ============================================================
    // 4. STUCK POSTS
    // ============================================================
    console.log('\n4️⃣ STUCK POSTS (Status="posting" >15 minutes):');
    console.log('-'.repeat(70));
    
    const stuckPosts = await client.query(`
      SELECT 
        decision_id,
        decision_type,
        status,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_stuck
      FROM content_metadata
      WHERE status = 'posting'
        AND created_at < NOW() - INTERVAL '15 minutes'
      ORDER BY created_at ASC
      LIMIT 10;
    `);
    
    if (stuckPosts.rows.length === 0) {
      console.log('   ✅ No stuck posts');
    } else {
      console.log(`   🚨 Found ${stuckPosts.rows.length} stuck posts:`);
      stuckPosts.rows.forEach((row: any) => {
        console.log(`      ${row.decision_type} ${row.decision_id.substring(0, 8)}... (stuck ${Math.round(row.minutes_stuck)} min)`);
      });
    }
    
    // ============================================================
    // 5. NULL TWEET IDS
    // ============================================================
    console.log('\n5️⃣ NULL TWEET IDS (Posted but ID not saved):');
    console.log('-'.repeat(70));
    
    const nullTweetIds = await client.query(`
      SELECT 
        decision_id,
        decision_type,
        status,
        posted_at,
        EXTRACT(EPOCH FROM (NOW() - posted_at))/60 as minutes_ago
      FROM content_metadata
      WHERE status = 'posted'
        AND tweet_id IS NULL
        AND posted_at >= NOW() - INTERVAL '24 hours'
      ORDER BY posted_at DESC
      LIMIT 10;
    `);
    
    if (nullTweetIds.rows.length === 0) {
      console.log('   ✅ No posts with NULL tweet_id');
    } else {
      console.log(`   ⚠️ Found ${nullTweetIds.rows.length} posts with NULL tweet_id:`);
      nullTweetIds.rows.forEach((row: any) => {
        console.log(`      ${row.decision_type} ${row.decision_id.substring(0, 8)}... (${Math.round(row.minutes_ago)} min ago)`);
      });
    }
    
    // ============================================================
    // 6. RATE LIMIT CHECK (Last Hour)
    // ============================================================
    console.log('\n6️⃣ RATE LIMIT CHECK (Last Hour):');
    console.log('-'.repeat(70));
    
    const rateLimitCheck = await client.query(`
      SELECT 
        decision_type,
        COUNT(*) as posts_last_hour,
        CASE 
          WHEN decision_type IN ('single', 'thread') THEN 2
          WHEN decision_type = 'reply' THEN 4
        END as rate_limit,
        CASE 
          WHEN decision_type IN ('single', 'thread') AND COUNT(*) >= 2 THEN 'LIMIT REACHED'
          WHEN decision_type = 'reply' AND COUNT(*) >= 4 THEN 'LIMIT REACHED'
          ELSE 'OK'
        END as status
      FROM content_metadata
      WHERE posted_at >= NOW() - INTERVAL '1 hour'
        AND status = 'posted'
        AND decision_type IN ('single', 'thread', 'reply')
      GROUP BY decision_type;
    `);
    
    if (rateLimitCheck.rows.length === 0) {
      console.log('   ✅ No posts in last hour (rate limit OK)');
    } else {
      rateLimitCheck.rows.forEach((row: any) => {
        const status = row.status === 'LIMIT REACHED' ? '⛔' : '✅';
        console.log(`   ${status} ${row.decision_type}: ${row.posts_last_hour}/${row.rate_limit} (${row.status})`);
      });
    }
    
    // ============================================================
    // 7. SYSTEM HEALTH SUMMARY
    // ============================================================
    console.log('\n7️⃣ SYSTEM HEALTH SUMMARY:');
    console.log('-'.repeat(70));
    
    const healthSummary = await client.query(`
      SELECT 
        'Content Posts (24h)' as metric,
        COUNT(*)::text as value
      FROM content_metadata
      WHERE posted_at >= NOW() - INTERVAL '24 hours'
        AND decision_type IN ('single', 'thread')
        AND status = 'posted'
      
      UNION ALL
      
      SELECT 
        'Replies (24h)' as metric,
        COUNT(*)::text as value
      FROM content_metadata
      WHERE posted_at >= NOW() - INTERVAL '24 hours'
        AND decision_type = 'reply'
        AND status = 'posted'
      
      UNION ALL
      
      SELECT 
        'Queued Content' as metric,
        COUNT(*)::text as value
      FROM content_metadata
      WHERE status = 'queued'
        AND decision_type IN ('single', 'thread')
      
      UNION ALL
      
      SELECT 
        'Queued Replies' as metric,
        COUNT(*)::text as value
      FROM content_metadata
      WHERE status = 'queued'
        AND decision_type = 'reply'
      
      UNION ALL
      
      SELECT 
        'Stuck Posts' as metric,
        COUNT(*)::text as value
      FROM content_metadata
      WHERE status = 'posting'
        AND created_at < NOW() - INTERVAL '15 minutes'
      
      UNION ALL
      
      SELECT 
        'NULL Tweet IDs' as metric,
        COUNT(*)::text as value
      FROM content_metadata
      WHERE status = 'posted'
        AND tweet_id IS NULL
        AND posted_at >= NOW() - INTERVAL '24 hours';
    `);
    
    healthSummary.rows.forEach((row: any) => {
      const value = parseInt(row.value) || 0;
      const icon = value === 0 && (row.metric.includes('Stuck') || row.metric.includes('NULL')) ? '✅' : 
                   value > 0 && (row.metric.includes('Stuck') || row.metric.includes('NULL')) ? '⚠️' : '📊';
      console.log(`   ${icon} ${row.metric}: ${value}`);
    });
    
    // ============================================================
    // 8. CONTENT GENERATION STATUS
    // ============================================================
    console.log('\n8️⃣ CONTENT GENERATION STATUS (Last 24 Hours):');
    console.log('-'.repeat(70));
    
    const contentGen = await client.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        decision_type,
        status,
        COUNT(*) as count
      FROM content_metadata
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND decision_type IN ('single', 'thread')
      GROUP BY DATE_TRUNC('hour', created_at), decision_type, status
      ORDER BY hour DESC, decision_type, status
      LIMIT 24;
    `);
    
    if (contentGen.rows.length === 0) {
      console.log('   ⚠️ No content generated in last 24 hours');
    } else {
      const byHour = new Map<string, any>();
      contentGen.rows.forEach((row: any) => {
        const hour = new Date(row.hour).toISOString();
        if (!byHour.has(hour)) {
          byHour.set(hour, { hour, counts: {} });
        }
        byHour.get(hour).counts[`${row.decision_type}_${row.status}`] = row.count;
      });
      
      Array.from(byHour.values()).slice(0, 12).forEach((entry: any) => {
        const hour = new Date(entry.hour);
        const queued = (entry.counts['single_queued'] || 0) + (entry.counts['thread_queued'] || 0);
        const posted = (entry.counts['single_posted'] || 0) + (entry.counts['thread_posted'] || 0);
        console.log(`   ${hour.toLocaleString()}: Generated ${queued + posted} (${queued} queued, ${posted} posted)`);
      });
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Database check complete');
    
  } catch (error: any) {
    console.error('\n❌ Database error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.substring(0, 500));
    }
  } finally {
    await client.end();
  }
}

checkDatabase().catch(console.error);

