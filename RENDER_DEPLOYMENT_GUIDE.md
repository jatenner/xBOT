# 🚀 Render Deployment Guide - Autonomous Growth Loop

## Pre-Deployment Checklist ✅

- [x] Autonomous Growth Loop System committed to git
- [x] Core agents implemented (Strategy Learner, Follow Growth, Engagement Feedback)  
- [x] Database migration ready (`migrations/20250625_growth_metrics.sql`)
- [x] Monitoring stack configured (Prometheus metrics, health checks)
- [x] CI/CD pipeline with k6 load testing
- [x] Build successful (`npm run build` ✅)
- [x] Core tests passing (Strategy Learner ε-greedy algorithm ✅)

## Database Setup (Required First)

```bash
# Apply growth metrics schema before deployment
export SUPABASE_URL='https://your-project.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'

# Run migration
./scripts/db_push.sh
```

## Render Service Configuration

### Production Service: `xbot-prod`
```yaml
Service Type: Web Service
Name: xbot-prod
Runtime: Node.js
Plan: Starter Plus
Build Command: npm install && npm run build
Start Command: node dist/main.js
Health Check Path: /health
```

#### Auto-Scaling:
- Min Instances: 1
- Max Instances: 3
- Auto-scale enabled

#### Environment Variables:
```bash
# Core Settings
NODE_ENV=production
GROWTH_LOOP_ENABLED=true
TZ=UTC

# Twitter API (Required)
TWITTER_APP_KEY=your_twitter_app_key
TWITTER_APP_SECRET=your_twitter_app_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret
TWITTER_BEARER_TOKEN=your_bearer_token

# Database (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI APIs (Required)
OPENAI_API_KEY=your_openai_key
NEWS_API_KEY=your_news_api_key
PEXELS_API_KEY=your_pexels_key
GUARDIAN_API_KEY=your_guardian_key

# Growth Loop Settings
MAX_DAILY_TWEETS=12
POST_FREQUENCY_HOURS=2
FOLLOW_LIMIT_DAILY=25
UNFOLLOW_LIMIT_DAILY=25

# Safety Settings
RATE_LIMIT_SAFETY=true
SPAM_PREVENTION=true
HUMAN_LIKE_TIMING=true

# Web Server
PORT=3000
```

### Staging Service: `xbot-stage` (Optional)
```yaml
Service Type: Worker
Name: xbot-stage
Runtime: Node.js
Plan: Starter
Build Command: npm install && npm run build
Start Command: node dist/main.js
```

#### Environment Variables (Same as production, plus):
```bash
NODE_ENV=staging
DRY_RUN=true
MAX_DAILY_TWEETS=4
POST_FREQUENCY_HOURS=6
FOLLOW_LIMIT_DAILY=5
UNFOLLOW_LIMIT_DAILY=5
```

## Post-Deployment Monitoring

### 1. Health Check Endpoints
- **Health**: `https://your-app.onrender.com/health`
  - Should return: `{"status":"healthy","growth_loop_enabled":true}`
  
- **Metrics**: `https://your-app.onrender.com/metrics`
  - Prometheus format with F/1K optimization metrics
  
- **Dashboard**: `https://your-app.onrender.com/dashboard`
  - Simple UI showing growth loop status

### 2. Key Metrics to Monitor
```
# F/1K Optimization (Primary Goal)
followers_per_1k_impressions (target: 3-5)

# Daily Activity
follow_actions_daily (should be ≤25)
unfollow_actions_daily (should be ≤25)
tweet_post_rate (posts in last 24h)

# System Health
system_health_score (0-1, should be >0.8)
strategy_epsilon (exploration rate: 0.1-0.3)
```

### 3. Grafana Dashboard Setup
Import the dashboard from `grafana_dashboard_growth.json`:
1. Add Prometheus data source pointing to `/metrics`
2. Import dashboard JSON
3. Monitor F/1K trends and growth metrics

## Expected Behavior After Deployment

### Immediate (0-10 minutes):
- ✅ Health endpoint responds
- ✅ Metrics endpoint serves Prometheus data
- ✅ Scheduler starts with growth agents

### First Hour:
- ✅ Engagement Feedback Agent runs (hourly)
- ✅ Tweet metrics collected and stored
- ✅ F/1K calculations begin

### First Day:
- ✅ Strategy Learner analyzes performance (2:30 AM UTC)
- ✅ Follow Growth Agent executes (every 4 hours)
- ✅ Autonomous learning adapts content strategy
- ✅ Growth metrics populate database

### Ongoing:
- 🎯 **F/1K optimization**: System learns best content styles
- 👥 **Strategic following**: 25 follows/unfollows daily
- 📊 **Performance tracking**: Continuous metric collection
- 🧠 **Strategy adaptation**: ε-greedy algorithm evolves

## Troubleshooting

### Common Issues:
1. **Build fails**: Check TypeScript compilation in logs
2. **Health check fails**: Verify PORT environment variable
3. **No metrics**: Check Supabase connection and permissions
4. **Growth loop inactive**: Ensure GROWTH_LOOP_ENABLED=true

### Log Monitoring:
- Look for: `🚀 Autonomous Growth Loop System` startup messages
- Monitor: F/1K metric calculations and strategy learning
- Watch: Follow/unfollow activity within daily limits

## Success Indicators

✅ **Day 1**: System posts tweets, tracks engagement, starts following
✅ **Day 3**: Strategy learning begins optimizing content styles  
✅ **Week 1**: Clear F/1K optimization trends visible in metrics
✅ **Month 1**: Sustained follower growth with automated learning

## Support

- **Logs**: Check Render dashboard deployment logs
- **Metrics**: Monitor `/metrics` endpoint for anomalies
- **Database**: Verify growth_metrics table populating
- **API Limits**: Ensure Twitter API quotas respected

🎯 **Goal**: Autonomous system achieving 3-5 new followers per 1000 tweet impressions through continuous learning and optimization. 