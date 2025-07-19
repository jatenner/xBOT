const path = require('path');

// Import the existing xClient
const { XService } = require('./src/utils/xClient.ts');
const { createClient } = require('@supabase/supabase-js');

async function importTweetsSafely() {
  console.log('🧠 SAFE TWEET IMPORT FOR BOT LEARNING');
  console.log('====================================');

  try {
    require('dotenv').config();
    
    // Use existing services
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Initialize X service (same as bot uses)
    const xService = new XService();
    
    console.log('✅ Using existing bot services');

    // Get recent tweets using the bot's own method
    console.log('\n📥 Fetching tweets using bot\'s safe method...');
    
    const tweets = await xService.getMyTweets(50); // Start with 50 tweets
    
    if (!tweets || tweets.length === 0) {
      console.log('❌ No tweets found to import');
      console.log('💡 This could be due to:');
      console.log('   - Rate limiting (try again in 15 minutes)');
      console.log('   - API permissions');
      console.log('   - Account has no tweets');
      return;
    }

    console.log(`✅ Found ${tweets.length} tweets to import`);

    // Import tweets into database
    let imported = 0;
    let skipped = 0;

    for (const tweet of tweets) {
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

        // Analyze content for categorization
        const content = tweet.text;
        let contentCategory = 'health_tech';
        let contentType = 'general';

        // Smart categorization
        if (content.includes('AI') || content.includes('artificial intelligence')) {
          contentCategory = 'ai_innovation';
        } else if (content.includes('research') || content.includes('study')) {
          contentCategory = 'research_insights';
        } else if (content.includes('breakthrough') || content.includes('discovery')) {
          contentCategory = 'breakthrough_news';
        } else if (content.includes('BREAKING')) {
          contentCategory = 'breaking_news';
        }

        // Calculate engagement score
        const engagementScore = (tweet.public_metrics?.like_count || 0) + 
                               (tweet.public_metrics?.retweet_count || 0) * 2 +
                               (tweet.public_metrics?.reply_count || 0) * 3;

        // Insert tweet into database
        const { error } = await supabase
          .from('tweets')
          .insert({
            tweet_id: tweet.id,
            content: content,
            tweet_type: 'original',
            content_type: contentType,
            content_category: contentCategory,
            source_attribution: 'Historical Import - Safe Method',
            engagement_score: engagementScore,
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
          
          // Show high-engagement tweets
          if (engagementScore > 10) {
            console.log(`🔥 HIGH ENGAGEMENT: "${content.substring(0, 50)}..." (Score: ${engagementScore})`);
          } else if (engagementScore > 5) {
            console.log(`✨ Good engagement: "${content.substring(0, 40)}..." (Score: ${engagementScore})`);
          }
        }

        // Small delay to be nice to APIs
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log(`❌ Error processing tweet ${tweet.id}:`, error.message);
      }
    }

    console.log('\n🎯 SAFE IMPORT SUMMARY');
    console.log('=====================');
    console.log(`✅ Successfully imported: ${imported} tweets`);
    console.log(`⏭️ Skipped (already exists): ${skipped} tweets`);
    console.log(`📊 Total processed: ${tweets.length} tweets`);

    if (imported > 0) {
      console.log('\n🧠 BOT MEMORY UPGRADE SUCCESSFUL!');
      console.log('=================================');
      console.log('✅ Bot now has historical context');
      console.log('✅ Can learn from past performance');
      console.log('✅ Understands successful content patterns');
      console.log('✅ Has engagement benchmarks');
      console.log('');
      console.log('🚀 Your bot evolved from ROOKIE to VETERAN!');
      
      // Show some stats
      const highEngagementCount = tweets.filter(t => 
        ((t.public_metrics?.like_count || 0) + 
         (t.public_metrics?.retweet_count || 0) + 
         (t.public_metrics?.reply_count || 0)) > 5
      ).length;
      
      if (highEngagementCount > 0) {
        console.log(`📈 Found ${highEngagementCount} high-performance tweets for learning`);
      }
    } else {
      console.log('\n💡 No new tweets imported - database may already be up to date');
    }

  } catch (error) {
    console.error('❌ Safe import failed:', error.message);
    
    if (error.message.includes('429')) {
      console.log('\n⏰ RATE LIMITED - TRY THESE OPTIONS:');
      console.log('===================================');
      console.log('1. Wait 15 minutes and try again');
      console.log('2. Your bot will learn from new tweets as it posts');
      console.log('3. Historical learning isn\'t critical for initial operation');
      console.log('');
      console.log('🚀 Your bot will still work perfectly without historical tweets!');
    }
  }
}

// Run the safe import
importTweetsSafely().catch(console.error); 