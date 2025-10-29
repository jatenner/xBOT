#!/usr/bin/env node

/**
 * Show Recent Posts
 * - Last 5 posts: Full details with all metadata
 * - Next up to 1000 posts: Compact summary
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function showRecentPosts() {
  console.log('📋 RECENT POSTS OVERVIEW\n');
  console.log('═'.repeat(80));

  try {
    // Get last 5 posts with full details
    const { data: recentFive, error: error1 } = await supabase
      .from('content_metadata')
      .select(`
        decision_id, 
        content, 
        topic_cluster, 
        generator_name, 
        angle, 
        tone, 
        format_strategy,
        posted_at,
        actual_likes,
        actual_retweets,
        actual_replies,
        actual_impressions
      `)
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(5);

    if (error1) {
      console.log('❌ Error fetching recent 5:', error1.message);
      return;
    }

    if (!recentFive || recentFive.length === 0) {
      console.log('⚠️  No posted content found');
      return;
    }

    // Display last 5 posts with full details
    console.log('\n🔥 LAST 5 POSTS (FULL DETAILS)\n');
    
    recentFive.forEach((post, i) => {
      console.log(`\n📄 POST ${i + 1}`);
      console.log('─'.repeat(80));
      console.log(`📝 Content: ${post.content?.substring(0, 150)}${post.content?.length > 150 ? '...' : ''}`);
      console.log(`📌 Topic: ${post.topic_cluster || 'N/A'}`);
      console.log(`🎭 Tone: ${post.tone || 'N/A'}`);
      console.log(`🎯 Angle: ${post.angle || 'N/A'}`);
      console.log(`📐 Structure: ${post.format_strategy || 'N/A'}`);
      console.log(`🤖 Generator: ${post.generator_name || 'N/A'}`);
      console.log(`📅 Posted: ${new Date(post.posted_at).toLocaleString()}`);
      
      if (post.actual_impressions || post.actual_likes || post.actual_retweets || post.actual_replies) {
        console.log(`📊 Performance: ${post.actual_impressions || 0} views, ${post.actual_likes || 0} likes, ${post.actual_retweets || 0} retweets, ${post.actual_replies || 0} replies`);
      }
    });

    // Get next 1000 posts for compact summary
    const { data: olderPosts, error: error2 } = await supabase
      .from('content_metadata')
      .select(`
        content, 
        topic_cluster, 
        generator_name, 
        angle, 
        tone, 
        format_strategy,
        posted_at
      `)
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .range(5, 1005); // Skip first 5, get next 1000

    if (error2) {
      console.log('❌ Error fetching older posts:', error2.message);
      return;
    }

    // Display compact summary of older posts
    if (olderPosts && olderPosts.length > 0) {
      console.log('\n\n' + '═'.repeat(80));
      console.log(`\n📚 NEXT ${olderPosts.length} POSTS (COMPACT SUMMARY)\n`);
      console.log('─'.repeat(80));
      
      olderPosts.forEach((post, i) => {
        const num = i + 6; // Start from 6 since first 5 are shown above
        const date = new Date(post.posted_at).toLocaleDateString();
        const content = post.content?.substring(0, 60) || 'N/A';
        const topic = post.topic_cluster || 'N/A';
        const gen = post.generator_name || 'N/A';
        const tone = post.tone ? post.tone.substring(0, 30) : 'N/A';
        const angle = post.angle ? post.angle.substring(0, 40) : 'N/A';
        
        console.log(`${num}. [${date}] ${gen} | Topic: ${topic} | "${content}..."`);
      });
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`\n✅ Total: ${recentFive.length + (olderPosts?.length || 0)} posts`);
    console.log(`   • Last 5 posts: Full details`);
    console.log(`   • Next ${olderPosts?.length || 0} posts: Compact summary`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

showRecentPosts().catch(console.error);

