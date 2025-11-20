/**
 * 🔍 QUERY LATEST POSTS - Direct Database Access
 * Uses dotenv to load .env file
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

async function queryLatestPosts() {
  try {
    // Import after env is loaded
    const { getSupabaseClient } = await import('./src/db/index');
    const supabase = getSupabaseClient();
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 FINDING LATEST 2 POSTS (SINGLES/THREADS)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get latest 2 POSTS (singles/threads, NOT replies)
    const { data: latestPosts, error: postsError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, status, content, posted_at, created_at, tweet_id, actual_impressions, actual_likes, actual_retweets, actual_engagement_rate, target_tweet_id, target_username')
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(2);
    
    if (postsError) {
      console.log(`❌ Error querying posts: ${postsError.message}`);
      return;
    }
    
    if (!latestPosts || latestPosts.length === 0) {
      console.log('⚠️  NO POSTS FOUND!');
      console.log('\nThis means either:');
      console.log('  1. No singles/threads have been posted yet');
      console.log('  2. All recent items are replies');
      console.log('  3. Posts exist but status != "posted"');
      
      // Check if there are any singles/threads at all
      const { data: anyPosts } = await supabase
        .from('content_metadata')
        .select('decision_type, status, COUNT(*)')
        .in('decision_type', ['single', 'thread'])
        .limit(1);
      
      console.log('\nChecking for any singles/threads in database...');
      
      const { data: countData } = await supabase
        .from('content_metadata')
        .select('decision_type, status')
        .in('decision_type', ['single', 'thread']);
      
      if (countData && countData.length > 0) {
        const byStatus = countData.reduce((acc: any, item: any) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        }, {});
        
        console.log('\nFound singles/threads with these statuses:');
        Object.entries(byStatus).forEach(([status, count]: [string, any]) => {
          console.log(`  • ${status}: ${count}`);
        });
      } else {
        console.log('  ❌ No singles/threads found in database at all!');
      }
      
    } else {
      console.log(`✅ Found ${latestPosts.length} POST(S):\n`);
      
      latestPosts.forEach((post: any, idx: number) => {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`POST #${idx + 1}: ${post.decision_type.toUpperCase()}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Decision ID: ${post.decision_id}`);
        console.log(`Status: ${post.status}`);
        console.log(`Posted at: ${post.posted_at || 'MISSING ⚠️'}`);
        console.log(`Created at: ${post.created_at || 'MISSING ⚠️'}`);
        console.log(`Tweet ID: ${post.tweet_id || 'MISSING ⚠️'}`);
        console.log(`\nContent:`);
        console.log(`"${post.content || 'NO CONTENT'}"`);
        console.log(`\nMetrics:`);
        console.log(`  • Views: ${post.actual_impressions || 0}`);
        console.log(`  • Likes: ${post.actual_likes || 0}`);
        console.log(`  • Retweets: ${post.actual_retweets || 0}`);
        console.log(`  • Engagement Rate: ${post.actual_engagement_rate ? (post.actual_engagement_rate * 100).toFixed(2) + '%' : 'N/A'}`);
        
        if (post.target_tweet_id) {
          console.log(`\n⚠️  WARNING: This post has target_tweet_id (shouldn't for posts!):`);
          console.log(`  Target: @${post.target_username || 'unknown'} (${post.target_tweet_id})`);
        }
        console.log('');
      });
    }

    // Also show count by type
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 COUNT BY TYPE (Posted Items)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const { data: countData, error: countError } = await supabase
      .from('content_metadata')
      .select('decision_type, status')
      .eq('status', 'posted');
    
    if (countError) {
      console.log(`❌ Error: ${countError.message}`);
    } else {
      const counts = (countData || []).reduce((acc: any, item: any) => {
        const type = item.decision_type || 'NULL';
        if (!acc[type]) acc[type] = 0;
        acc[type]++;
        return acc;
      }, {});
      
      Object.entries(counts).forEach(([type, count]: [string, any]) => {
        const emoji = type === 'single' ? '📝' : type === 'thread' ? '🧵' : type === 'reply' ? '💬' : '❓';
        console.log(`${emoji} ${type.toUpperCase()}: ${count}`);
      });
      
      if (counts['reply'] && !counts['single'] && !counts['thread']) {
        console.log('\n⚠️  ALL POSTED ITEMS ARE REPLIES!');
        console.log('   This explains why dashboard shows only replies.');
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Query complete');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

queryLatestPosts().catch(console.error);

