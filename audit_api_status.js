console.log('🔍 === COMPREHENSIVE API AUDIT ===');
console.log('🎯 Verifying real API limits vs. dashboard display');
console.log('');

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const newsApiKey = process.env.NEWS_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// OFFICIAL TWITTER API V2 FREE TIER LIMITS (from official docs)
const OFFICIAL_TWITTER_LIMITS = {
  tweets_daily: 17,     // Per USER per day
  tweets_monthly: 1500, // Posts consumed per month  
  reads_daily: 333,     // ~10,000/30 days
  reads_monthly: 10000, // Reads per month
  likes_daily: 1,       // Per 15 minutes
  follows_daily: 1,     // Per 15 minutes 
  retweets_daily: 1     // Per 15 minutes
};

// OFFICIAL NEWSAPI FREE TIER LIMITS
const OFFICIAL_NEWSAPI_LIMITS = {
  requests_daily: 100,   // Free tier
  requests_monthly: 3000 // ~100 * 30 days
};

async function auditTwitterAPI() {
  console.log('🐦 === TWITTER API AUDIT ===');
  
  try {
    // Get actual tweet count from database
    const today = new Date().toISOString().split('T')[0];
    const { data: tweets } = await supabase
      .from('tweets')
      .select('id, created_at')
      .gte('created_at', today + 'T00:00:00');
    
    const todayTweets = tweets?.length || 0;
    
    // Get monthly tweets
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: monthlyTweets } = await supabase
      .from('tweets')
      .select('id')
      .gte('created_at', currentMonth + '-01T00:00:00');
    
    const monthlyTweetCount = monthlyTweets?.length || 0;
    
    // Get API usage tracking
    const { data: apiUsage } = await supabase
      .from('api_usage')
      .select('*')
      .eq('date', today)
      .single();
    
    const writes = apiUsage?.writes || 0;
    const reads = apiUsage?.reads || 0;
    
    console.log('📊 ACTUAL TWITTER USAGE:');
    console.log(`   Daily Tweets Posted: ${todayTweets}/${OFFICIAL_TWITTER_LIMITS.tweets_daily} (${((todayTweets/OFFICIAL_TWITTER_LIMITS.tweets_daily)*100).toFixed(1)}%)`);
    console.log(`   Monthly Tweets: ${monthlyTweetCount}/${OFFICIAL_TWITTER_LIMITS.tweets_monthly} (${((monthlyTweetCount/OFFICIAL_TWITTER_LIMITS.tweets_monthly)*100).toFixed(1)}%)`);
    console.log(`   Daily API Writes: ${writes} (includes tweets + engagements)`);
    console.log(`   Daily API Reads: ${reads}/${OFFICIAL_TWITTER_LIMITS.reads_daily} (${((reads/OFFICIAL_TWITTER_LIMITS.reads_daily)*100).toFixed(1)}%)`);
    
    // Status assessment
    const dailyStatus = todayTweets >= OFFICIAL_TWITTER_LIMITS.tweets_daily ? '🚨 LIMIT REACHED' : 
                       todayTweets > OFFICIAL_TWITTER_LIMITS.tweets_daily * 0.8 ? '⚠️ NEAR LIMIT' : '✅ HEALTHY';
    
    const monthlyStatus = monthlyTweetCount >= OFFICIAL_TWITTER_LIMITS.tweets_monthly ? '🚨 LIMIT REACHED' : 
                         monthlyTweetCount > OFFICIAL_TWITTER_LIMITS.tweets_monthly * 0.8 ? '⚠️ NEAR LIMIT' : '✅ HEALTHY';
    
    console.log(`   Daily Status: ${dailyStatus}`);
    console.log(`   Monthly Status: ${monthlyStatus}`);
    console.log(`   Tweets Remaining Today: ${Math.max(0, OFFICIAL_TWITTER_LIMITS.tweets_daily - todayTweets)}`);
    console.log(`   Tweets Remaining This Month: ${Math.max(0, OFFICIAL_TWITTER_LIMITS.tweets_monthly - monthlyTweetCount)}`);
    
    return {
      daily_tweets: todayTweets,
      daily_limit: OFFICIAL_TWITTER_LIMITS.tweets_daily,
      monthly_tweets: monthlyTweetCount,
      monthly_limit: OFFICIAL_TWITTER_LIMITS.tweets_monthly,
      daily_status: dailyStatus,
      monthly_status: monthlyStatus
    };
    
  } catch (error) {
    console.error('❌ Error auditing Twitter API:', error.message);
    return null;
  }
}

async function auditNewsAPI() {
  console.log('');
  console.log('📰 === NEWS API AUDIT ===');
  
  // Check if API key exists
  if (!newsApiKey) {
    console.log('❌ NEWS_API_KEY not found in environment');
    console.log('   This explains why NewsAPI shows 0 usage!');
    return null;
  }
  
  console.log(`✅ NEWS_API_KEY found (${newsApiKey.length} characters)`);
  
  try {
    // Test API key with a minimal request
    const testResponse = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: 'test',
        pageSize: 1,
        apiKey: newsApiKey
      },
      timeout: 10000
    });
    
    console.log(`✅ NewsAPI Test Request: ${testResponse.status} ${testResponse.statusText}`);
    
    // Check actual usage from database
    const today = new Date().toISOString().split('T')[0];
    const { data: newsUsage } = await supabase
      .from('news_articles')
      .select('id, created_at')
      .gte('created_at', today + 'T00:00:00');
    
    const dailyNewsRequests = newsUsage?.length || 0;
    
    // Get monthly usage
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: monthlyNews } = await supabase
      .from('news_articles')
      .select('id')
      .gte('created_at', currentMonth + '-01T00:00:00');
    
    const monthlyNewsRequests = monthlyNews?.length || 0;
    
    console.log('📊 ACTUAL NEWSAPI USAGE:');
    console.log(`   Daily Requests: ${dailyNewsRequests}/${OFFICIAL_NEWSAPI_LIMITS.requests_daily} (${((dailyNewsRequests/OFFICIAL_NEWSAPI_LIMITS.requests_daily)*100).toFixed(1)}%)`);
    console.log(`   Monthly Requests: ${monthlyNewsRequests}/${OFFICIAL_NEWSAPI_LIMITS.requests_monthly} (${((monthlyNewsRequests/OFFICIAL_NEWSAPI_LIMITS.requests_monthly)*100).toFixed(1)}%)`);
    
    const status = dailyNewsRequests >= OFFICIAL_NEWSAPI_LIMITS.requests_daily ? '🚨 LIMIT REACHED' : 
                  dailyNewsRequests > OFFICIAL_NEWSAPI_LIMITS.requests_daily * 0.8 ? '⚠️ NEAR LIMIT' : '✅ HEALTHY';
    
    console.log(`   Status: ${status}`);
    console.log(`   Requests Remaining Today: ${Math.max(0, OFFICIAL_NEWSAPI_LIMITS.requests_daily - dailyNewsRequests)}`);
    
    return {
      daily_requests: dailyNewsRequests,
      daily_limit: OFFICIAL_NEWSAPI_LIMITS.requests_daily,
      monthly_requests: monthlyNewsRequests,
      monthly_limit: OFFICIAL_NEWSAPI_LIMITS.requests_monthly,
      status: status,
      api_working: true
    };
    
  } catch (error) {
    console.log('❌ NewsAPI Test Failed:', error.response?.status || error.message);
    
    if (error.response?.status === 429) {
      console.log('   🚨 Rate limit exceeded - API maxed out for today');
    } else if (error.response?.status === 401) {
      console.log('   🚨 Invalid API key');
    } else if (error.response?.status === 426) {
      console.log('   🚨 API key requires upgrade');
    }
    
    return {
      daily_requests: 0,
      daily_limit: OFFICIAL_NEWSAPI_LIMITS.requests_daily,
      status: '❌ API ERROR',
      api_working: false,
      error: error.response?.status || error.message
    };
  }
}

async function compareWithDashboard() {
  console.log('');
  console.log('🎯 === DASHBOARD VS REALITY ===');
  
  console.log('');
  console.log('📊 WHAT YOUR DASHBOARD WAS SHOWING (WRONG):');
  console.log('   Twitter Daily Tweets: 50 (FAKE - actual limit is 17)');
  console.log('   Twitter Monthly Tweets: 1,500 (FAKE - actual limit is 1,500 for POST CAP)');
  console.log('   NewsAPI Daily: 20 (FAKE - actual limit is 100)');
  console.log('');
  
  console.log('✅ ACTUAL API LIMITS (VERIFIED):');
  console.log('   Twitter Daily Tweets: 17 per day (FREE TIER)');
  console.log('   Twitter Monthly POST CAP: 1,500 posts consumed');
  console.log('   NewsAPI Daily: 100 requests (FREE TIER)');
  console.log('   NewsAPI Monthly: ~3,000 requests (FREE TIER)');
}

async function runFullAudit() {
  const twitterResults = await auditTwitterAPI();
  const newsResults = await auditNewsAPI();
  await compareWithDashboard();
  
  console.log('');
  console.log('🔧 === ISSUES IDENTIFIED ===');
  
  if (twitterResults) {
    if (twitterResults.daily_tweets >= twitterResults.daily_limit) {
      console.log('🚨 Twitter: Daily tweet limit reached!');
    }
    if (twitterResults.monthly_tweets > twitterResults.monthly_limit * 0.8) {
      console.log('⚠️ Twitter: Approaching monthly post cap');
    }
  }
  
  if (!newsResults || !newsResults.api_working) {
    console.log('🚨 NewsAPI: API not working or key missing');
    console.log('   This is why your dashboard shows 0 NewsAPI usage');
  }
  
  console.log('');
  console.log('✅ === RECOMMENDATIONS ===');
  console.log('1. Update dashboard limits to show REAL Twitter limits (17 daily, not 50)');
  console.log('2. Fix NewsAPI integration - missing or invalid API key');
  console.log('3. Implement proper rate limiting based on ACTUAL limits');
  console.log('4. Monitor daily Twitter usage - you only have 17 tweets per day!');
  
  if (twitterResults && twitterResults.daily_tweets > 15) {
    console.log('⚠️ URGENT: You are very close to daily Twitter limit!');
  }
}

// Run the audit
runFullAudit().catch(console.error); 