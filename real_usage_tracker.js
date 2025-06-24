console.log('🔍 === REAL USAGE TRACKER ===');
console.log('📊 Connecting to your actual database for real usage data');

const { createClient } = require('@supabase/supabase-js');

// Try to connect to your real database
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('✅ Connected to your Supabase database');
} else {
  console.log('⚠️ Environment variables not set - run with your .env file');
  console.log('💡 Usage: source .env && node real_usage_tracker.js');
  process.exit(1);
}

async function checkRealUsage() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7);
    
    console.log('📅 Checking usage for:', today);
    console.log('');
    
    // Check tweets posted today
    const { data: tweets, error: tweetsError } = await supabase
      .from('tweets')
      .select('*')
      .gte('created_at', today);
    
    if (tweetsError) {
      console.log('❌ Error fetching tweets:', tweetsError.message);
    } else {
      console.log('🐦 TWITTER ACTIVITY TODAY:');
      console.log(`  📝 Tweets posted: ${tweets?.length || 0}/17 (${Math.round(((tweets?.length || 0) / 17) * 100)}% of daily limit)`);
    }
    
    // Check engagement actions
    const { data: likes, error: likesError } = await supabase
      .from('engagement_tracking')
      .select('*')
      .eq('action_type', 'like')
      .gte('created_at', today);
      
    const { data: retweets, error: retweetsError } = await supabase
      .from('engagement_tracking')
      .select('*')
      .eq('action_type', 'retweet')
      .gte('created_at', today);
      
    const { data: replies, error: repliesError } = await supabase
      .from('engagement_tracking')
      .select('*')
      .eq('action_type', 'reply')
      .gte('created_at', today);
      
    const { data: follows, error: followsError } = await supabase
      .from('engagement_tracking')
      .select('*')
      .eq('action_type', 'follow')
      .gte('created_at', today);
    
    console.log(`  💖 Likes given: ${likes?.length || 0}/1000 (${Math.round(((likes?.length || 0) / 1000) * 100)}% of daily limit)`);
    console.log(`  🔄 Retweets: ${retweets?.length || 0}/300 (${Math.round(((retweets?.length || 0) / 300) * 100)}% of daily limit)`);
    console.log(`  �� Replies: ${replies?.length || 0}/300 (${Math.round(((replies?.length || 0) / 300) * 100)}% of daily limit)`);
    console.log(`  👥 Follows: ${follows?.length || 0}/400 (${Math.round(((follows?.length || 0) / 400) * 100)}% of daily limit)`);
    console.log('');
    
    // Check NewsAPI usage
    const { data: newsArticles, error: newsError } = await supabase
      .from('news_articles')
      .select('*')
      .gte('created_at', today);
    
    if (!newsError) {
      console.log('📰 NEWSAPI ACTIVITY TODAY:');
      console.log(`  📄 Articles fetched: ${newsArticles?.length || 0}/100 (${Math.round(((newsArticles?.length || 0) / 100) * 100)}% of daily limit)`);
      if ((newsArticles?.length || 0) === 0) {
        console.log('  ⚠️  NewsAPI appears to be unused - bot may be using fallback content');
      }
    }
    console.log('');
    
    // Monthly stats
    const { data: monthlyTweets, error: monthlyError } = await supabase
      .from('tweets')
      .select('*')
      .gte('created_at', thisMonth + '-01');
      
    if (!monthlyError) {
      console.log('📊 MONTHLY STATISTICS:');
      console.log(`  📝 Monthly tweets: ${monthlyTweets?.length || 0}/1500 (${Math.round(((monthlyTweets?.length || 0) / 1500) * 100)}% of monthly cap)`);
    }
    
    const totalActions = (tweets?.length || 0) + (likes?.length || 0) + (retweets?.length || 0) + (replies?.length || 0) + (follows?.length || 0);
    console.log('');
    console.log('🎯 SUMMARY:');
    console.log(`  📊 Total actions today: ${totalActions}`);
    console.log(`  🔥 Bot activity level: ${totalActions > 50 ? 'HIGH' : totalActions > 20 ? 'MODERATE' : 'LOW'}`);
    
    if ((tweets?.length || 0) >= 15) {
      console.log('  🚨 WARNING: Close to daily tweet limit!');
    }
    if ((newsArticles?.length || 0) === 0) {
      console.log('  💡 TIP: NewsAPI is unused - could fetch more articles for content');
    }
    
  } catch (error) {
    console.error('❌ Error checking usage:', error);
  }
}

checkRealUsage();
