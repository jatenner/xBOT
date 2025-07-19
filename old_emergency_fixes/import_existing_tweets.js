const { createClient } = require('@supabase/supabase-js');
const { TwitterApi } = require('twitter-api-v2');

async function importExistingTweets() {
  console.log('🧠 IMPORTING EXISTING TWEETS FOR BOT LEARNING');
  console.log('==============================================');

  try {
    // Initialize clients
    require('dotenv').config();
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Use the same environment variables as xClient.ts
    const twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_APP_KEY,
      appSecret: process.env.TWITTER_APP_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    console.log('✅ Clients initialized with correct environment variables');

    // Get your Twitter username
    const me = await twitterClient.v2.me();
    console.log(`📱 Account: @${me.data.username} (${me.data.name})`);

    // Fetch your recent tweets (up to 100 most recent)
    console.log('\n📥 Fetching your existing tweets...');
    
    const tweets = await twitterClient.v2.userTimeline(me.data.id, {
      max_results: 100,
      'tweet.fields': ['created_at', 'public_metrics', 'text', 'context_annotations'],
      exclude: ['retweets', 'replies'] // Only original tweets
    });

    if (!tweets.data?.length) {
      console.log('❌ No tweets found to import');
      return;
    }

    console.log(`✅ Found ${tweets.data.length} tweets to import`);

    // Import tweets into database
    let imported = 0;
    let skipped = 0;

    for (const tweet of tweets.data) {
      try {
        // Check if tweet already exists
        const { data: existing } = await supabase
          .from('tweets')
          .select('id')
          .eq('tweet_id', tweet.id)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        // Determine content category based on tweet content
        const content = tweet.text;
        let contentCategory = 'health_tech'; // Default
        let contentType = 'general';

        // Analyze content for better categorization
        if (content.includes('AI') || content.includes('artificial intelligence')) {
          contentCategory = 'ai_innovation';
        } else if (content.includes('research') || content.includes('study')) {
          contentCategory = 'research_insights';
        } else if (content.includes('breakthrough') || content.includes('discovery')) {
          contentCategory = 'breakthrough_news';
        }

        // Insert tweet into database
        const { error } = await supabase
          .from('tweets')
          .insert({
            tweet_id: tweet.id,
            content: content,
            tweet_type: 'original',
            content_type: contentType,
            content_category: contentCategory,
            source_attribution: 'Historical Import',
            engagement_score: (tweet.public_metrics?.like_count || 0) + 
                            (tweet.public_metrics?.retweet_count || 0) * 2 +
                            (tweet.public_metrics?.reply_count || 0) * 3,
            likes: tweet.public_metrics?.like_count || 0,
            retweets: tweet.public_metrics?.retweet_count || 0,
            replies: tweet.public_metrics?.reply_count || 0,
            impressions: tweet.public_metrics?.impression_count || 0,
            has_snap2health_cta: content.toLowerCase().includes('snap2health'),
            created_at: tweet.created_at,
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.log(`❌ Failed to import tweet ${tweet.id}:`, error.message);
        } else {
          imported++;
          
          // Show progress for high-engagement tweets
          const totalEngagement = (tweet.public_metrics?.like_count || 0) + 
                                 (tweet.public_metrics?.retweet_count || 0) + 
                                 (tweet.public_metrics?.reply_count || 0);
          
          if (totalEngagement > 5) {
            console.log(`✨ High-engagement tweet imported: ${content.substring(0, 60)}... (${totalEngagement} total engagement)`);
          }
        }

      } catch (error) {
        console.log(`❌ Error processing tweet ${tweet.id}:`, error.message);
      }
    }

    console.log('\n🎯 IMPORT SUMMARY');
    console.log('================');
    console.log(`✅ Successfully imported: ${imported} tweets`);
    console.log(`⏭️ Skipped (already exists): ${skipped} tweets`);
    console.log(`📊 Total processed: ${tweets.data.length} tweets`);

    if (imported > 0) {
      console.log('\n🧠 BOT INTELLIGENCE UPGRADE COMPLETE!');
      console.log('====================================');
      console.log('✅ Bot now has access to your tweet history');
      console.log('✅ Can learn from your successful content patterns');
      console.log('✅ Understands your engagement performance');
      console.log('✅ Has context for content strategy');
      console.log('');
      console.log('🚀 Your bot is now a LEGEND with full memory!');
    }

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    
    if (error.code === 429) {
      console.log('⚠️ Rate limited - try again in 15 minutes');
    } else if (error.code === 401) {
      console.log('⚠️ Authentication failed - check your Twitter API credentials');
      console.log('💡 Make sure these environment variables are set:');
      console.log('   - TWITTER_APP_KEY');
      console.log('   - TWITTER_APP_SECRET');
      console.log('   - TWITTER_ACCESS_TOKEN');
      console.log('   - TWITTER_ACCESS_SECRET');
    }
  }
}

// Run the import
importExistingTweets().catch(console.error); 