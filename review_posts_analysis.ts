/**
 * 🔍 COMPREHENSIVE POST REVIEW
 * Analyzes actual posts, content, and engagement to understand why views/engagement are low
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function reviewPosts() {
  try {
    const { getSupabaseClient } = await import('./src/db/index');
    const supabase = getSupabaseClient();
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 COMPREHENSIVE POST ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get last 20 posted items (singles/threads) with full metrics
    const { data: posts, error } = await supabase
      .from('content_metadata')
      .select(`
        decision_id,
        decision_type,
        status,
        content,
        thread_parts,
        raw_topic,
        angle,
        tone,
        generator_name,
        format_strategy,
        posted_at,
        created_at,
        tweet_id,
        actual_impressions,
        actual_likes,
        actual_retweets,
        actual_replies,
        actual_engagement_rate,
        target_tweet_id
      `)
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return;
    }

    if (!posts || posts.length === 0) {
      console.log('⚠️  No posted singles/threads found!');
      return;
    }

    console.log(`📝 Found ${posts.length} posts to analyze\n`);

    // Calculate averages for context
    const postsWithMetrics = posts.filter(p => p.actual_impressions !== null && p.actual_impressions > 0);
    const avgViews = postsWithMetrics.length > 0 
      ? postsWithMetrics.reduce((sum, p) => sum + (p.actual_impressions || 0), 0) / postsWithMetrics.length 
      : 0;
    const avgLikes = postsWithMetrics.length > 0
      ? postsWithMetrics.reduce((sum, p) => sum + (p.actual_likes || 0), 0) / postsWithMetrics.length
      : 0;
    const avgER = postsWithMetrics.length > 0
      ? postsWithMetrics.reduce((sum, p) => sum + (p.actual_engagement_rate || 0), 0) / postsWithMetrics.length
      : 0;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 OVERALL STATISTICS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total posts analyzed: ${posts.length}`);
    console.log(`Posts with metrics: ${postsWithMetrics.length}`);
    console.log(`Average views: ${Math.round(avgViews)}`);
    console.log(`Average likes: ${Math.round(avgLikes)}`);
    console.log(`Average engagement rate: ${(avgER * 100).toFixed(2)}%`);
    console.log('');

    // Sort by performance
    const sortedByViews = [...posts].sort((a, b) => 
      (b.actual_impressions || 0) - (a.actual_impressions || 0)
    );
    const sortedByLikes = [...posts].sort((a, b) => 
      (b.actual_likes || 0) - (a.actual_likes || 0)
    );
    const sortedByER = [...posts].sort((a, b) => 
      (b.actual_engagement_rate || 0) - (a.actual_engagement_rate || 0)
    );

    // Top 3 performers
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🏆 TOP 3 POSTS BY VIEWS');
    console.log('═══════════════════════════════════════════════════════════\n');

    sortedByViews.slice(0, 3).forEach((post, idx) => {
      console.log(`\n${idx + 1}. ${post.decision_type.toUpperCase()} - ${post.raw_topic || 'No topic'}`);
      console.log(`   Posted: ${new Date(post.posted_at || post.created_at).toLocaleString()}`);
      console.log(`   Generator: ${post.generator_name || 'unknown'}`);
      console.log(`   Tone: ${post.tone || 'unknown'}`);
      console.log(`   Views: ${post.actual_impressions || 0}`);
      console.log(`   Likes: ${post.actual_likes || 0}`);
      console.log(`   Retweets: ${post.actual_retweets || 0}`);
      console.log(`   Engagement Rate: ${post.actual_engagement_rate ? (post.actual_engagement_rate * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`   Tweet ID: ${post.tweet_id || 'MISSING'}`);
      
      // Show full content
      if (post.decision_type === 'thread' && post.thread_parts) {
        console.log(`   Content (Thread):`);
        const parts = Array.isArray(post.thread_parts) ? post.thread_parts : [];
        parts.forEach((part: string, i: number) => {
          console.log(`      ${i + 1}. "${part}"`);
        });
      } else {
        console.log(`   Content: "${post.content || 'NO CONTENT'}"`);
      }
    });

    // Bottom 3 performers
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📉 BOTTOM 3 POSTS BY VIEWS');
    console.log('═══════════════════════════════════════════════════════════\n');

    sortedByViews.slice(-3).reverse().forEach((post, idx) => {
      console.log(`\n${idx + 1}. ${post.decision_type.toUpperCase()} - ${post.raw_topic || 'No topic'}`);
      console.log(`   Posted: ${new Date(post.posted_at || post.created_at).toLocaleString()}`);
      console.log(`   Generator: ${post.generator_name || 'unknown'}`);
      console.log(`   Tone: ${post.tone || 'unknown'}`);
      console.log(`   Views: ${post.actual_impressions || 0} ⚠️ LOW`);
      console.log(`   Likes: ${post.actual_likes || 0}`);
      console.log(`   Retweets: ${post.actual_retweets || 0}`);
      console.log(`   Engagement Rate: ${post.actual_engagement_rate ? (post.actual_engagement_rate * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`   Tweet ID: ${post.tweet_id || 'MISSING'}`);
      
      // Show full content
      if (post.decision_type === 'thread' && post.thread_parts) {
        console.log(`   Content (Thread):`);
        const parts = Array.isArray(post.thread_parts) ? post.thread_parts : [];
        parts.forEach((part: string, i: number) => {
          console.log(`      ${i + 1}. "${part}"`);
        });
      } else {
        console.log(`   Content: "${post.content || 'NO CONTENT'}"`);
      }
    });

    // Detailed analysis of all posts
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📋 ALL POSTS DETAILED BREAKDOWN');
    console.log('═══════════════════════════════════════════════════════════\n');

    posts.forEach((post, idx) => {
      const views = post.actual_impressions || 0;
      const likes = post.actual_likes || 0;
      const er = post.actual_engagement_rate ? (post.actual_engagement_rate * 100).toFixed(2) + '%' : 'N/A';
      const daysAgo = post.posted_at 
        ? Math.round((Date.now() - new Date(post.posted_at).getTime()) / (1000 * 60 * 60 * 24))
        : 'N/A';
      
      const performance = views < 10 ? '🔴 VERY LOW' : views < 50 ? '🟠 LOW' : views < 200 ? '🟡 MEDIUM' : '🟢 GOOD';
      
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`POST #${idx + 1} - ${performance}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Type: ${post.decision_type.toUpperCase()}`);
      console.log(`Topic: ${post.raw_topic || 'NO TOPIC'}`);
      console.log(`Angle: ${post.angle || 'NO ANGLE'}`);
      console.log(`Tone: ${post.tone || 'NO TONE'}`);
      console.log(`Generator: ${post.generator_name || 'unknown'}`);
      console.log(`Format: ${post.format_strategy || 'none'}`);
      console.log(`Posted: ${new Date(post.posted_at || post.created_at).toLocaleString()} (${daysAgo} days ago)`);
      console.log(`Tweet ID: ${post.tweet_id || '❌ MISSING TWEET ID'}`);
      console.log(`\nMetrics:`);
      console.log(`  Views: ${views}`);
      console.log(`  Likes: ${likes}`);
      console.log(`  Retweets: ${post.actual_retweets || 0}`);
      console.log(`  Replies: ${post.actual_replies || 0}`);
      console.log(`  Engagement Rate: ${er}`);
      
      // Content analysis
      if (post.decision_type === 'thread' && post.thread_parts) {
        const parts = Array.isArray(post.thread_parts) ? post.thread_parts : [];
        console.log(`\nThread Content (${parts.length} parts):`);
        parts.forEach((part: string, i: number) => {
          const length = part.length;
          console.log(`  ${i + 1}. [${length} chars] "${part}"`);
        });
      } else {
        const content = post.content || 'NO CONTENT';
        const length = content.length;
        console.log(`\nContent [${length} chars]:`);
        console.log(`  "${content}"`);
      }

      // Issue detection
      const issues: string[] = [];
      if (!post.tweet_id) issues.push('❌ Missing tweet_id (may not have posted)');
      if (views === 0) issues.push('⚠️  Zero views (possible scraping issue or very new post)');
      if (views > 0 && likes === 0 && views > 50) issues.push('⚠️  No likes despite views (content may not resonate)');
      if (post.content && post.content.length > 280) issues.push('⚠️  Content exceeds 280 chars (may be truncated)');
      if (post.content && post.content.length < 50) issues.push('⚠️  Very short content (may lack substance)');
      if (!post.raw_topic) issues.push('⚠️  Missing topic metadata');
      
      if (issues.length > 0) {
        console.log(`\nIssues detected:`);
        issues.forEach(issue => console.log(`  ${issue}`));
      }
    });

    // Pattern analysis
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('🔍 PATTERN ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');

    // By generator
    const byGenerator: Record<string, { count: number; avgViews: number; totalViews: number }> = {};
    posts.forEach(post => {
      const gen = post.generator_name || 'unknown';
      if (!byGenerator[gen]) {
        byGenerator[gen] = { count: 0, avgViews: 0, totalViews: 0 };
      }
      byGenerator[gen].count++;
      byGenerator[gen].totalViews += post.actual_impressions || 0;
    });
    Object.keys(byGenerator).forEach(gen => {
      byGenerator[gen].avgViews = byGenerator[gen].totalViews / byGenerator[gen].count;
    });

    console.log('By Generator:');
    Object.entries(byGenerator)
      .sort((a, b) => b[1].avgViews - a[1].avgViews)
      .forEach(([gen, stats]) => {
        console.log(`  ${gen}: ${stats.count} posts, avg ${Math.round(stats.avgViews)} views`);
      });

    // By type
    const byType: Record<string, { count: number; avgViews: number }> = {};
    posts.forEach(post => {
      const type = post.decision_type || 'unknown';
      if (!byType[type]) {
        byType[type] = { count: 0, avgViews: 0, totalViews: 0 };
      }
      byType[type].count++;
      byType[type].totalViews = (byType[type].totalViews || 0) + (post.actual_impressions || 0);
    });
    Object.keys(byType).forEach(type => {
      byType[type].avgViews = (byType[type].totalViews || 0) / byType[type].count;
    });

    console.log('\nBy Type:');
    Object.entries(byType)
      .sort((a, b) => b[1].avgViews - a[1].avgViews)
      .forEach(([type, stats]) => {
        console.log(`  ${type}: ${stats.count} posts, avg ${Math.round(stats.avgViews)} views`);
      });

    // Missing tweet IDs
    const missingTweetIds = posts.filter(p => !p.tweet_id);
    if (missingTweetIds.length > 0) {
      console.log(`\n⚠️  ${missingTweetIds.length} posts missing tweet_id (may not have posted successfully)`);
    }

    // Zero views
    const zeroViews = posts.filter(p => (p.actual_impressions || 0) === 0);
    if (zeroViews.length > 0) {
      console.log(`\n⚠️  ${zeroViews.length} posts with zero views (possible scraping issue or very new posts)`);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Analysis complete');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

reviewPosts().catch(console.error);

