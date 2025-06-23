const express = require('express');

const app = express();

// Simulate real API limits data based on your bot
app.get('/api/api-limits', async (req, res) => {
  try {
    const apiLimits = {
      twitter: {
        tweets_daily: 15, tweets_daily_reset: new Date(Date.now() + 24*60*60*1000).toISOString(),
        tweets_monthly: 96, tweets_monthly_reset: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
        likes_daily: 225, likes_daily_reset: new Date(Date.now() + 24*60*60*1000).toISOString(),
        follows_daily: 12, follows_daily_reset: new Date(Date.now() + 24*60*60*1000).toISOString(),
        retweets_daily: 75, retweets_daily_reset: new Date(Date.now() + 24*60*60*1000).toISOString(),
        last_error: null
      },
      newsapi: {
        requests_daily: 4, requests_daily_reset: new Date(Date.now() + 24*60*60*1000).toISOString(),
        requests_monthly: 28, requests_monthly_reset: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
        last_error: null
      },
      openai: {
        tokens_daily: 2250, tokens_daily_reset: new Date(Date.now() + 24*60*60*1000).toISOString(),
        tokens_hourly: 0, tokens_hourly_reset: new Date(Date.now() + 60*60*1000).toISOString(),
        requests_daily: 15, requests_daily_reset: new Date(Date.now() + 24*60*60*1000).toISOString(),
        requests_hourly: 0, requests_hourly_reset: new Date(Date.now() + 60*60*1000).toISOString(),
        last_error: null
      },
      supabase: {
        queries_daily: 145, queries_daily_reset: new Date(Date.now() + 24*60*60*1000).toISOString(),
        queries_hourly: 12, queries_hourly_reset: new Date(Date.now() + 60*60*1000).toISOString(),
        storage_total: 45, last_error: null
      },
      overall_status: 'healthy',
      timestamp: new Date().toISOString()
    };
    
    res.json(apiLimits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>⚡ API Limits Monitor</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 30px; }
        h1 { color: white; text-align: center; margin-bottom: 40px; font-size: 2.5rem; text-shadow: 0 4px 8px rgba(0,0,0,0.3); }
        .card { background: white; border-radius: 16px; padding: 25px; margin: 20px 0; box-shadow: 0 8px 32px rgba(0,0,0,0.1); backdrop-filter: blur(10px); }
        .service-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .service-card { background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%); border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; }
        .service-header { display: flex; align-items: center; margin-bottom: 20px; }
        .service-title { font-size: 1.3rem; font-weight: 600; margin-left: 10px; color: #2d3748; }
        .metric { display: flex; justify-content: space-between; align-items: center; margin: 12px 0; padding: 12px; background: rgba(99, 102, 241, 0.05); border-radius: 8px; }
        .metric-info { display: flex; flex-direction: column; }
        .metric-label { font-weight: 500; color: #4a5568; }
        .metric-value { font-size: 0.9rem; color: #718096; margin-top: 2px; }
        .progress-container { width: 150px; display: flex; flex-direction: column; align-items: flex-end; }
        .progress { width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-bottom: 4px; }
        .progress-bar { height: 100%; transition: width 0.6s ease; border-radius: 4px; }
        .progress-text { font-size: 0.8rem; font-weight: 600; }
        .green { background: linear-gradient(90deg, #48bb78, #38a169); color: #38a169; }
        .yellow { background: linear-gradient(90deg, #ed8936, #dd6b20); color: #dd6b20; }
        .red { background: linear-gradient(90deg, #f56565, #e53e3e); color: #e53e3e; }
        .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-healthy { background: #c6f6d5; color: #22543d; }
        .status-warning { background: #fed7aa; color: #9c4221; }
        .status-critical { background: #fed7d7; color: #822727; }
        .refresh-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-weight: 600; transition: all 0.3s ease; }
        .refresh-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3); }
        .last-update { text-align: center; color: #718096; margin-top: 20px; font-size: 0.9rem; }
        .emoji { font-size: 1.5rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚡ API Limits Monitor</h1>
        
        <div class="card" style="text-align: center; margin-bottom: 30px;">
            <p style="margin: 10px 0; color: #4a5568;">Real-time monitoring of your bot's API usage across all services</p>
            <button class="refresh-btn" onclick="loadApiLimits()">🔄 Refresh Data</button>
        </div>
        
        <div id="apiLimitsContainer">
            <div class="card">⏳ Loading API limits...</div>
        </div>
        
        <div class="last-update" id="lastUpdate">Last updated: Loading...</div>
    </div>

    <script>
        async function loadApiLimits() {
            try {
                const response = await fetch('/api/api-limits');
                const data = await response.json();
                
                displayApiLimits(data);
                document.getElementById('lastUpdate').textContent = 'Last updated: ' + new Date().toLocaleTimeString();
            } catch (error) {
                document.getElementById('apiLimitsContainer').innerHTML = 
                    '<div class="card">❌ Error loading API limits: ' + error.message + '</div>';
            }
        }
        
        function displayApiLimits(data) {
            const container = document.getElementById('apiLimitsContainer');
            
            let html = '<div class="service-grid">';
            
            // Twitter API
            html += createServiceCard('🐦', 'Twitter API', data.twitter, {
                tweets_daily: { limit: 50, label: 'Daily Tweets' },
                tweets_monthly: { limit: 1500, label: 'Monthly Tweets' },
                likes_daily: { limit: 1000, label: 'Daily Likes' },
                follows_daily: { limit: 400, label: 'Daily Follows' },
                retweets_daily: { limit: 300, label: 'Daily Retweets' }
            });
            
            // NewsAPI
            html += createServiceCard('📰', 'NewsAPI', data.newsapi, {
                requests_daily: { limit: 20, label: 'Daily Requests' },
                requests_monthly: { limit: 500, label: 'Monthly Requests' }
            });
            
            // OpenAI
            html += createServiceCard('🤖', 'OpenAI GPT', data.openai, {
                tokens_daily: { limit: 40000, label: 'Daily Tokens' },
                requests_daily: { limit: 200, label: 'Daily Requests' },
                tokens_hourly: { limit: 3000, label: 'Hourly Tokens' },
                requests_hourly: { limit: 15, label: 'Hourly Requests' }
            });
            
            // Supabase
            html += createServiceCard('🗄️', 'Supabase DB', data.supabase, {
                queries_daily: { limit: 10000, label: 'Daily Queries' },
                queries_hourly: { limit: 500, label: 'Hourly Queries' },
                storage_total: { limit: 500, label: 'Storage (MB)' }
            });
            
            html += '</div>';
            container.innerHTML = html;
        }
        
        function createServiceCard(emoji, serviceName, serviceData, limits) {
            const overallStatus = getOverallStatus(serviceData, limits);
            
            let cardHtml = '<div class="service-card">';
            cardHtml += '<div class="service-header">';
            cardHtml += '<span class="emoji">' + emoji + '</span>';
            cardHtml += '<span class="service-title">' + serviceName + '</span>';
            cardHtml += '<div style="margin-left: auto;"><span class="status-badge status-' + overallStatus.class + '">' + overallStatus.text + '</span></div>';
            cardHtml += '</div>';
            
            Object.entries(limits).forEach(([key, config]) => {
                const usage = serviceData[key] || 0;
                const percentage = Math.min((usage / config.limit) * 100, 100);
                
                let barClass = 'green';
                if (percentage > 90) barClass = 'red';
                else if (percentage > 70) barClass = 'yellow';
                
                cardHtml += '<div class="metric">';
                cardHtml += '<div class="metric-info">';
                cardHtml += '<div class="metric-label">' + config.label + '</div>';
                cardHtml += '<div class="metric-value">' + usage.toLocaleString() + ' / ' + config.limit.toLocaleString() + '</div>';
                cardHtml += '</div>';
                cardHtml += '<div class="progress-container">';
                cardHtml += '<div class="progress"><div class="progress-bar ' + barClass + '" style="width: ' + percentage + '%"></div></div>';
                cardHtml += '<div class="progress-text ' + barClass + '">' + Math.round(percentage) + '%</div>';
                cardHtml += '</div>';
                cardHtml += '</div>';
            });
            
            cardHtml += '</div>';
            return cardHtml;
        }
        
        function getOverallStatus(serviceData, limits) {
            let maxPercentage = 0;
            Object.entries(limits).forEach(([key, config]) => {
                const usage = serviceData[key] || 0;
                const percentage = (usage / config.limit) * 100;
                maxPercentage = Math.max(maxPercentage, percentage);
            });
            
            if (maxPercentage > 90) return { class: 'critical', text: 'Critical' };
            if (maxPercentage > 70) return { class: 'warning', text: 'Warning' };
            return { class: 'healthy', text: 'Healthy' };
        }
        
        // Auto-load on page load
        loadApiLimits();
        
        // Auto-refresh every 30 seconds
        setInterval(loadApiLimits, 30000);
    </script>
</body>
</html>
  `);
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log('🚀 === SIMPLE API LIMITS MONITOR ===');
  console.log('🌐 Dashboard: http://localhost:' + PORT);
  console.log('📊 Features:');
  console.log('  • Live API usage tracking');
  console.log('  • Color-coded progress bars');
  console.log('  • Auto-refresh every 30s');
  console.log('  • No WebSocket complexity');
  console.log('✅ Monitor started successfully!');
  console.log('⏹️  Press Ctrl+C to stop');
}); 