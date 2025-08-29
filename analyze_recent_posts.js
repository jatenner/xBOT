#!/usr/bin/env node

/**
 * Quick script to analyze recent posts and engagement
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function analyzeRecentPosts() {
  try {
    console.log('🔍 ANALYZING RECENT POSTS...\n');
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get recent tweets
    const { data: tweets, error } = await supabase
      .from('tweets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Database error:', error.message);
      return;
    }

    if (!tweets || tweets.length === 0) {
      console.log('⚠️ No tweets found in database');
      return;
    }

    console.log(`📊 FOUND ${tweets.length} RECENT POSTS:\n`);

    tweets.forEach((tweet, index) => {
      console.log(`--- POST ${index + 1} ---`);
      console.log(`📅 Date: ${new Date(tweet.created_at).toLocaleDateString()}`);
      console.log(`🆔 ID: ${tweet.tweet_id}`);
      console.log(`📝 Content: "${tweet.content?.substring(0, 100)}${tweet.content?.length > 100 ? '...' : ''}"`);
      console.log(`📏 Length: ${tweet.content?.length || 0} chars`);
      console.log(`👀 Posted: ${tweet.posted_at ? 'Yes' : 'No'}`);
      console.log(`📊 Metrics: ${tweet.likes || 0} likes, ${tweet.retweets || 0} retweets, ${tweet.replies || 0} replies`);
      console.log('');
    });

    // Analyze patterns
    const avgLength = tweets.reduce((sum, t) => sum + (t.content?.length || 0), 0) / tweets.length;
    const totalEngagement = tweets.reduce((sum, t) => sum + (t.likes || 0) + (t.retweets || 0) + (t.replies || 0), 0);
    const avgEngagement = totalEngagement / tweets.length;

    console.log('📈 ANALYSIS:');
    console.log(`Average content length: ${Math.round(avgLength)} characters`);
    console.log(`Total engagement: ${totalEngagement} interactions`);
    console.log(`Average engagement per post: ${avgEngagement.toFixed(2)}`);
    console.log(`Engagement rate: ${((avgEngagement / 23) * 100).toFixed(2)}% of followers`);

    // Check for patterns
    const hasNumbers = tweets.filter(t => /\d+/.test(t.content || '')).length;
    const hasQuestions = tweets.filter(t => /\?/.test(t.content || '')).length;
    const hasEmoji = tweets.filter(t => /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(t.content || '')).length;

    console.log('\n🎯 CONTENT PATTERNS:');
    console.log(`Posts with numbers: ${hasNumbers}/${tweets.length} (${((hasNumbers/tweets.length)*100).toFixed(0)}%)`);
    console.log(`Posts with questions: ${hasQuestions}/${tweets.length} (${((hasQuestions/tweets.length)*100).toFixed(0)}%)`);
    console.log(`Posts with emojis: ${hasEmoji}/${tweets.length} (${((hasEmoji/tweets.length)*100).toFixed(0)}%)`);

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

analyzeRecentPosts();
