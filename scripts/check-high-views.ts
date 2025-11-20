/**
 * Check for posts with high view counts
 * Verify if they're actual posts or misattributed replies
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkHighViews() {
  try {
    const { getSupabaseClient } = await import('../src/db/index');
    const supabase = getSupabaseClient();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 CHECKING POSTS WITH HIGH VIEW COUNTS');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get recent posts with high impressions
    const { data: posts, error } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, content, generator_name, actual_impressions, actual_likes, actual_retweets, actual_engagement_rate, tweet_id, posted_at, status, thread_parts')
      .eq('status', 'posted')
      .not('actual_impressions', 'is', null)
      .gt('actual_impressions', 100) // Posts with more than 100 views
      .order('actual_impressions', { ascending: false })
      .limit(20);

    if (error) {
      console.error(`❌ Error querying posts: ${error.message}`);
      return;
    }

    if (!posts || posts.length === 0) {
      console.log('✅ No posts found with >100 views.');
    } else {
      console.log(`📊 Found ${posts.length} post(s) with >100 views:\n`);
      
      posts.forEach((post: any, idx: number) => {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`POST #${idx + 1}: ${post.decision_type.toUpperCase()}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Decision ID: ${post.decision_id}`);
        console.log(`Decision Type: ${post.decision_type}`);
        console.log(`Generator: ${post.generator_name || 'UNKNOWN'}`);
        console.log(`Posted At: ${post.posted_at || 'MISSING ⚠️'}`);
        console.log(`Tweet ID: ${post.tweet_id || 'MISSING ⚠️'}`);
        console.log(`Status: ${post.status}`);
        console.log(`\n📊 METRICS:`);
        console.log(`  • Views: ${post.actual_impressions || 0}`);
        console.log(`  • Likes: ${post.actual_likes || 0}`);
        console.log(`  • Retweets: ${post.actual_retweets || 0}`);
        console.log(`  • Engagement Rate: ${((post.actual_engagement_rate || 0) * 100).toFixed(2)}%`);
        
        if (post.tweet_id) {
          console.log(`\n🔗 Twitter Link: https://twitter.com/i/web/status/${post.tweet_id}`);
        }
        
        console.log(`\n📝 CONTENT:`);
        if (post.decision_type === 'thread' && post.thread_parts && Array.isArray(post.thread_parts)) {
          post.thread_parts.forEach((part: string, i: number) => {
            console.log(`  Tweet ${i + 1}/${post.thread_parts.length}: "${part.substring(0, 100)}${part.length > 100 ? '...' : ''}"`);
          });
        } else {
          console.log(`  "${post.content || 'NO CONTENT'}"`);
        }
        console.log('');
      });
    }

    // Also check for ANY posts vs replies
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY STATS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { data: allPosts } = await supabase
      .from('content_metadata')
      .select('decision_type, actual_impressions, generator_name')
      .eq('status', 'posted')
      .not('actual_impressions', 'is', null)
      .order('posted_at', { ascending: false })
      .limit(50);

    if (allPosts) {
      const postsOnly = allPosts.filter(p => p.decision_type === 'single' || p.decision_type === 'thread');
      const repliesOnly = allPosts.filter(p => p.decision_type === 'reply');
      
      const avgViewsPosts = postsOnly.length > 0
        ? postsOnly.reduce((sum, p) => sum + (p.actual_impressions || 0), 0) / postsOnly.length
        : 0;
      
      const avgViewsReplies = repliesOnly.length > 0
        ? repliesOnly.reduce((sum, p) => sum + (p.actual_impressions || 0), 0) / repliesOnly.length
        : 0;

      console.log(`📝 Posts (single/thread): ${postsOnly.length}`);
      console.log(`   Average views: ${avgViewsPosts.toFixed(0)}`);
      console.log(`   Max views: ${Math.max(...postsOnly.map(p => p.actual_impressions || 0), 0)}`);
      
      console.log(`\n💬 Replies: ${repliesOnly.length}`);
      console.log(`   Average views: ${avgViewsReplies.toFixed(0)}`);
      console.log(`   Max views: ${Math.max(...repliesOnly.map(p => p.actual_impressions || 0), 0)}`);

      // Check if high-view posts are misattributed replies
      const highViews = allPosts.filter(p => (p.actual_impressions || 0) > 1000);
      const misattributed = highViews.filter(p => p.decision_type === 'reply');
      
      if (misattributed.length > 0) {
        console.log(`\n⚠️ WARNING: ${misattributed.length} high-view items are marked as REPLIES (possible misattribution)`);
        misattributed.forEach((p: any) => {
          console.log(`   Reply ID: ${p.decision_id}, Views: ${p.actual_impressions}`);
        });
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

checkHighViews().catch(console.error);

