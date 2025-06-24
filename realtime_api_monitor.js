console.log('🔍 === REAL-TIME API USAGE MONITOR ===');
console.log('📊 Tracking all bot API activities in real-time');
console.log('');

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const app = express();
const PORT = 3005;

// Initialize Supabase (if available)
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// REAL API LIMITS (verified)
const API_LIMITS = {
  twitter: {
    daily_tweets: 17,
    monthly_tweets: 1500,
    daily_likes: 1000,
    daily_follows: 400,
    daily_retweets: 300,
    daily_replies: 300
  },
  newsapi: {
    daily_requests: 100,
    monthly_requests: 3000
  },
  openai: {
    daily_tokens: 40000,
    hourly_tokens: 1667
  }
};

// Get real-time API usage from your bot
async function getRealTimeApiUsage() {
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().substring(0, 7);
  const thisHour = new Date().toISOString().substring(0, 13);
  
  try {
    let usage = {
      twitter: {
        tweets_today: 0,
        tweets_this_month: 0,
        likes_today: 0,
        follows_today: 0,
        retweets_today: 0,
        replies_today: 0,
        last_tweet_time: null,
        last_activity_time: null
      },
      newsapi: {
        requests_today: 0,
        requests_this_month: 0,
        last_request_time: null,
        articles_fetched: 0
      },
      openai: {
        tokens_today: 0,
        tokens_this_hour: 0,
        requests_today: 0,
        last_request_time: null
      },
      bot_status: {
        is_active: false,
        last_seen: null,
        mode: 'unknown'
      }
    };

    if (supabase) {
      // Get Twitter activity from database
      const { data: tweets } = await supabase
        .from('tweets')
        .select('created_at, tweet_type')
        .gte('created_at', today + 'T00:00:00Z');
      
      if (tweets) {
        usage.twitter.tweets_today = tweets.length;
        usage.twitter.last_tweet_time = tweets.length > 0 ? tweets[tweets.length - 1].created_at : null;
      }

      // Get monthly tweets
      const { data: monthlyTweets } = await supabase
        .from('tweets')
        .select('created_at')
        .gte('created_at', thisMonth + '-01T00:00:00Z');
      
      if (monthlyTweets) {
        usage.twitter.tweets_this_month = monthlyTweets.length;
      }

      // Get engagement activities
      const { data: engagement } = await supabase
        .from('engagement_history')
        .select('action_type, created_at')
        .gte('created_at', today + 'T00:00:00Z');
      
      if (engagement) {
        usage.twitter.likes_today = engagement.filter(e => e.action_type === 'like').length;
        usage.twitter.follows_today = engagement.filter(e => e.action_type === 'follow').length;
        usage.twitter.retweets_today = engagement.filter(e => e.action_type === 'retweet').length;
        usage.twitter.replies_today = engagement.filter(e => e.action_type === 'reply').length;
        
        if (engagement.length > 0) {
          usage.twitter.last_activity_time = engagement[engagement.length - 1].created_at;
        }
      }

      // Get NewsAPI usage
      const { data: newsRequests } = await supabase
        .from('news_articles')
        .select('created_at')
        .gte('created_at', today + 'T00:00:00Z');
      
      if (newsRequests) {
        usage.newsapi.requests_today = newsRequests.length;
        usage.newsapi.articles_fetched = newsRequests.length;
        usage.newsapi.last_request_time = newsRequests.length > 0 ? newsRequests[newsRequests.length - 1].created_at : null;
      }

      // Get monthly NewsAPI usage
      const { data: monthlyNews } = await supabase
        .from('news_articles')
        .select('created_at')
        .gte('created_at', thisMonth + '-01T00:00:00Z');
      
      if (monthlyNews) {
        usage.newsapi.requests_this_month = monthlyNews.length;
      }

      // Estimate OpenAI usage (200 tokens per tweet)
      usage.openai.tokens_today = usage.twitter.tweets_today * 200;
      usage.openai.requests_today = usage.twitter.tweets_today;
      
      // Bot status
      const lastActivity = usage.twitter.last_tweet_time || usage.twitter.last_activity_time;
      if (lastActivity) {
        const lastActivityDate = new Date(lastActivity);
        const now = new Date();
        const minutesSinceActivity = (now - lastActivityDate) / (1000 * 60);
        
        usage.bot_status.is_active = minutesSinceActivity < 60; // Active if activity within last hour
        usage.bot_status.last_seen = lastActivity;
        usage.bot_status.mode = usage.bot_status.is_active ? 'active' : 'idle';
      }
    }

    return usage;
  } catch (error) {
    console.error('Error fetching API usage:', error);
    return null;
  }
}

// API endpoint for usage data
app.get('/api/usage', async (req, res) => {
  try {
    const usage = await getRealTimeApiUsage();
    res.json(usage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Main dashboard
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>🔍 Real-Time API Usage Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui; 
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); 
            min-height: 100vh; 
            color: white;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; text-shadow: 0 4px 8px rgba(0,0,0,0.3); }
        .header p { font-size: 1.1rem; opacity: 0.9; }
        
        .status-bar { 
            background: rgba(255,255,255,0.1); 
            border-radius: 15px; 
            padding: 20px; 
            margin-bottom: 30px;
            backdrop-filter: blur(10px);
        }
        
        .bot-status { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; }
        .status-item { display: flex; align-items: center; gap: 10px; }
        .status-dot { width: 12px; height: 12px; border-radius: 50%; }
        .status-dot.active { background: #4ade80; animation: pulse 2s infinite; }
        .status-dot.idle { background: #f59e0b; }
        .status-dot.offline { background: #ef4444; }
        
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 25px; }
        
        .api-card { 
            background: rgba(255,255,255,0.1); 
            border-radius: 20px; 
            padding: 25px; 
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .card-header { display: flex; align-items: center; margin-bottom: 20px; }
        .card-icon { font-size: 2rem; margin-right: 15px; }
        .card-title { font-size: 1.4rem; font-weight: 600; }
        
        .metric { margin-bottom: 15px; }
        .metric-label { font-size: 0.9rem; opacity: 0.8; margin-bottom: 5px; }
        .metric-value { display: flex; justify-content: space-between; align-items: center; }
        .metric-number { font-size: 1.8rem; font-weight: 700; }
        .metric-limit { font-size: 0.9rem; opacity: 0.7; }
        
        .progress-bar { 
            width: 100%; 
            height: 8px; 
            background: rgba(255,255,255,0.2); 
            border-radius: 4px; 
            overflow: hidden; 
            margin-top: 8px;
        }
        .progress-fill { 
            height: 100%; 
            transition: width 0.6s ease; 
            border-radius: 4px;
        }
        .progress-green { background: linear-gradient(90deg, #4ade80, #22c55e); }
        .progress-yellow { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
        .progress-red { background: linear-gradient(90deg, #f87171, #ef4444); }
        
        .activity-feed { 
            grid-column: 1 / -1; 
            background: rgba(0,0,0,0.2); 
            border-radius: 20px; 
            padding: 25px;
        }
        .activity-item { 
            display: flex; 
            align-items: center; 
            padding: 10px 0; 
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .activity-item:last-child { border-bottom: none; }
        .activity-time { font-size: 0.8rem; opacity: 0.6; margin-left: auto; }
        
        .refresh-btn { 
            position: fixed; 
            bottom: 30px; 
            right: 30px; 
            background: #4ade80; 
            color: white; 
            border: none; 
            padding: 15px 20px; 
            border-radius: 50px; 
            cursor: pointer; 
            font-weight: 600;
            box-shadow: 0 8px 25px rgba(74, 222, 128, 0.3);
            transition: all 0.3s ease;
        }
        .refresh-btn:hover { transform: translateY(-2px); }
        
        .last-update { text-align: center; margin-top: 20px; opacity: 0.7; font-size: 0.9rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Real-Time API Usage Monitor</h1>
            <p>Live tracking of your bot's API consumption across all services</p>
        </div>
        
        <div class="status-bar">
            <div class="bot-status">
                <div class="status-item">
                    <div class="status-dot" id="botStatusDot"></div>
                    <span id="botStatusText">Checking bot status...</span>
                </div>
                <div class="status-item">
                    <span>📊 Last Activity: <span id="lastActivity">Loading...</span></span>
                </div>
                <div class="status-item">
                    <span>🔄 Auto-refresh: Every 10 seconds</span>
                </div>
            </div>
        </div>
        
        <div class="grid" id="apiGrid">
            <!-- API cards will be inserted here -->
        </div>
        
        <div class="last-update" id="lastUpdate">Last updated: Loading...</div>
    </div>
    
    <button class="refresh-btn" onclick="loadUsageData()">🔄 Refresh</button>

    <script>
        async function loadUsageData() {
            try {
                const response = await fetch('/api/usage');
                const usage = await response.json();
                
                if (!usage) {
                    document.getElementById('apiGrid').innerHTML = '<div class="api-card">❌ Unable to load usage data</div>';
                    return;
                }
                
                updateBotStatus(usage.bot_status);
                updateApiCards(usage);
                document.getElementById('lastUpdate').textContent = 'Last updated: ' + new Date().toLocaleTimeString();
                
            } catch (error) {
                console.error('Error loading usage data:', error);
                document.getElementById('apiGrid').innerHTML = '<div class="api-card">❌ Error loading data: ' + error.message + '</div>';
            }
        }
        
        function updateBotStatus(status) {
            const dot = document.getElementById('botStatusDot');
            const text = document.getElementById('botStatusText');
            const lastActivity = document.getElementById('lastActivity');
            
            if (status.is_active) {
                dot.className = 'status-dot active';
                text.textContent = '🤖 Bot is ACTIVE';
            } else {
                dot.className = 'status-dot idle';
                text.textContent = '😴 Bot is IDLE';
            }
            
            if (status.last_seen) {
                const lastSeen = new Date(status.last_seen);
                lastActivity.textContent = lastSeen.toLocaleString();
            } else {
                lastActivity.textContent = 'Unknown';
            }
        }
        
        function updateApiCards(usage) {
            const grid = document.getElementById('apiGrid');
            
            const twitterCard = createApiCard('🐦', 'Twitter API', [
                { label: 'Daily Tweets', value: usage.twitter.tweets_today, limit: ${API_LIMITS.twitter.daily_tweets} },
                { label: 'Monthly Tweets', value: usage.twitter.tweets_this_month, limit: ${API_LIMITS.twitter.monthly_tweets} },
                { label: 'Daily Likes', value: usage.twitter.likes_today, limit: ${API_LIMITS.twitter.daily_likes} },
                { label: 'Daily Replies', value: usage.twitter.replies_today, limit: ${API_LIMITS.twitter.daily_replies} },
                { label: 'Daily Follows', value: usage.twitter.follows_today, limit: ${API_LIMITS.twitter.daily_follows} },
                { label: 'Daily Retweets', value: usage.twitter.retweets_today, limit: ${API_LIMITS.twitter.daily_retweets} }
            ]);
            
            const newsCard = createApiCard('📰', 'NewsAPI', [
                { label: 'Daily Requests', value: usage.newsapi.requests_today, limit: ${API_LIMITS.newsapi.daily_requests} },
                { label: 'Monthly Requests', value: usage.newsapi.requests_this_month, limit: ${API_LIMITS.newsapi.monthly_requests} },
                { label: 'Articles Fetched', value: usage.newsapi.articles_fetched, limit: null }
            ]);
            
            const openaiCard = createApiCard('🤖', 'OpenAI GPT', [
                { label: 'Daily Tokens', value: usage.openai.tokens_today, limit: ${API_LIMITS.openai.daily_tokens} },
                { label: 'Daily Requests', value: usage.openai.requests_today, limit: 200 }
            ]);
            
            grid.innerHTML = twitterCard + newsCard + openaiCard;
        }
        
        function createApiCard(icon, title, metrics) {
            let cardHtml = '<div class="api-card">';
            cardHtml += '<div class="card-header">';
            cardHtml += '<div class="card-icon">' + icon + '</div>';
            cardHtml += '<div class="card-title">' + title + '</div>';
            cardHtml += '</div>';
            
            metrics.forEach(metric => {
                const percentage = metric.limit ? Math.min((metric.value / metric.limit) * 100, 100) : 0;
                
                let progressClass = 'progress-green';
                if (percentage > 90) progressClass = 'progress-red';
                else if (percentage > 70) progressClass = 'progress-yellow';
                
                cardHtml += '<div class="metric">';
                cardHtml += '<div class="metric-label">' + metric.label + '</div>';
                cardHtml += '<div class="metric-value">';
                cardHtml += '<span class="metric-number">' + metric.value.toLocaleString() + '</span>';
                if (metric.limit) {
                    cardHtml += '<span class="metric-limit">/ ' + metric.limit.toLocaleString() + '</span>';
                }
                cardHtml += '</div>';
                if (metric.limit) {
                    cardHtml += '<div class="progress-bar">';
                    cardHtml += '<div class="progress-fill ' + progressClass + '" style="width: ' + percentage + '%"></div>';
                    cardHtml += '</div>';
                }
                cardHtml += '</div>';
            });
            
            cardHtml += '</div>';
            return cardHtml;
        }
        
        // Auto-refresh every 10 seconds
        setInterval(loadUsageData, 10000);
        
        // Initial load
        loadUsageData();
    </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log('🚀 === REAL-TIME API USAGE MONITOR ===');
  console.log('🌐 Dashboard: http://localhost:' + PORT);
  console.log('📊 Features:');
  console.log('  • Live Twitter API usage tracking');
  console.log('  • Real-time NewsAPI monitoring');
  console.log('  • OpenAI token consumption');
  console.log('  • Bot activity status');
  console.log('  • Auto-refresh every 10 seconds');
  console.log('  • Color-coded progress bars');
  console.log('  • Real data from your database');
  console.log('✅ Monitor started successfully!');
  console.log('⏹️  Press Ctrl+C to stop');
  console.log('');
  console.log('📋 What you\'ll see:');
  console.log('  🐦 Twitter: Tweets, likes, replies, follows, retweets');
  console.log('  📰 NewsAPI: Daily/monthly requests, articles fetched');
  console.log('  🤖 OpenAI: Token usage, request counts');
  console.log('  🟢 Green: Safe usage (< 70%)');
  console.log('  🟡 Yellow: Warning (70-90%)');
  console.log('  🔴 Red: Critical (> 90%)');
}); 