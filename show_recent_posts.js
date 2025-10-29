#!/usr/bin/env node

/**
 * Show ALL Recent Posts
 * - Posts with full metadata (topic, tone, angle, structure): Full details
 * - Posts without full metadata (older system): Basic info
 * Shows EVERY post, including all new posts as they're created
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function showAllRecentPosts() {
  console.log('📋 ALL RECENT POSTS\n');
  console.log('═'.repeat(80));

  try {
    // Get ALL posted content (up to 1000)
    const { data: allPosts, error } = await supabase
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
      .limit(1000);

    if (error) {
      console.log('❌ Error fetching posts:', error.message);
      return;
    }

    if (!allPosts || allPosts.length === 0) {
      console.log('⚠️  No posted content found');
      return;
    }

    console.log(`\n📊 Showing ${allPosts.length} total posts\n`);
    console.log('═'.repeat(80));

    // Display each post - full details for posts with metadata, basic for others
    allPosts.forEach((post, i) => {
      const num = i + 1;
      const hasFullMetadata = post.tone || post.angle || post.format_strategy;

      if (hasFullMetadata) {
        // FULL DETAILS for posts with complete metadata
        console.log(`\n📄 POST ${num} [FULL METADATA]`);
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
      } else {
        // BASIC INFO for older posts without full metadata
        const date = new Date(post.posted_at).toLocaleDateString();
        const time = new Date(post.posted_at).toLocaleTimeString();
        const content = post.content?.substring(0, 80) || 'N/A';
        const gen = post.generator_name || 'N/A';
        const topic = post.topic_cluster || 'N/A';
        
        console.log(`\n${num}. [${date} ${time}] ${gen} | Topic: ${topic}`);
        console.log(`   "${content}${post.content?.length > 80 ? '...' : ''}"`);
      }
    });

    console.log('\n' + '═'.repeat(80));
    
    // Summary stats
    const withMetadata = allPosts.filter(p => p.tone || p.angle || p.format_strategy).length;
    const withoutMetadata = allPosts.length - withMetadata;
    
    console.log(`\n✅ SUMMARY:`);
    console.log(`   • Total posts: ${allPosts.length}`);
    console.log(`   • With full metadata: ${withMetadata} (new system)`);
    console.log(`   • Basic info only: ${withoutMetadata} (older system)`);
    console.log(`\n💡 All new posts will have full metadata (topic, tone, angle, structure, generator)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

showAllRecentPosts().catch(console.error);

