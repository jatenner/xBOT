# 📊 Production Monitoring Guide

## 🎯 Health Check Endpoints

### Primary Health Check (Railway)
```
GET /health
```
**Purpose**: Railway container health check  
**Response**: `200 OK` with `"ok"` body  
**Location**: Port 10000 (default)

### Detailed System Health
```
GET /api/health
```
**Response**: Complete system health JSON with component status

### Metrics (Prometheus Compatible)
```
GET /api/metrics  
```
**Response**: Prometheus-formatted metrics
**Format**: `text/plain; version=0.0.4; charset=utf-8`

## 📈 Key Metrics to Monitor

### Bot Performance
- `posts_total` - Total posts made
- `posts_success_rate` - Success rate percentage  
- `last_post_minutes_ago` - Minutes since last successful post
- `consecutive_failures` - Current failure streak

### Budget & Cost
- `daily_budget_spent` - Daily spend ($)
- `daily_budget_remaining` - Remaining budget ($)
- `budget_lockdown_active` - 0 or 1 (boolean)

### System Health  
- `system_uptime_hours` - Bot uptime in hours
- `browser_automation_status` - 0=failed, 1=operational
- `database_connection_status` - 0=failed, 1=operational

### Engagement
- `followers_total` - Current follower count
- `engagement_actions_24h` - Engagement actions in last 24h
- `content_generation_status` - Content system status

## 🚨 Alert Thresholds

### Critical Alerts
- `last_post_minutes_ago > 180` - No posts in 3+ hours
- `consecutive_failures >= 5` - Multiple consecutive failures
- `budget_lockdown_active = 1` - Budget lockdown activated
- `browser_automation_status = 0` - Browser system failed

### Warning Alerts  
- `posts_success_rate < 80%` - Low success rate
- `daily_budget_spent > 6.0` - High budget usage
- `system_uptime_hours < 1` - Recent restart

## 🔍 Monitoring Tools

### 1. Manual Check (CLI)
```bash
# Quick health check
curl https://your-app.up.railway.app/health

# Detailed metrics
curl https://your-app.up.railway.app/api/metrics

# System status
curl https://your-app.up.railway.app/api/health | jq
```

### 2. Railway Logs (Live)
```bash
npm run logs
```
Uses `perfect_railway_logs.js` for continuous CLI monitoring.

### 3. Dashboard (Web)
```
https://your-app.up.railway.app/
```
Real-time web dashboard with system overview.

## 📱 External Monitoring

### Railway Built-in
- **Usage**: Railway dashboard → Metrics tab
- **Features**: CPU, Memory, Network usage
- **Alerts**: Set up usage alerts in Railway

### Uptime Robot (Free)
- **Setup**: Monitor `/health` endpoint
- **Frequency**: Every 5 minutes  
- **Alerts**: Email/SMS on downtime

### Grafana + Prometheus (Advanced)
- **Metrics Source**: `/api/metrics` endpoint
- **Dashboards**: Custom charts and alerts
- **Setup**: Point Prometheus to metrics URL

## 🔧 Troubleshooting

### Bot Not Posting
1. Check `/api/health` - look for component failures
2. Check budget status - may be locked down
3. Check browser automation status
4. Review logs for specific errors

### High Budget Usage
1. Check `/api/metrics` for `daily_budget_spent`
2. Review cost breakdown in health endpoint
3. Adjust budget limits if needed
4. Check for OpenAI API loops

### System Restarts
1. Railway containers restart after 24h (normal)
2. Check Railway logs for crash reasons
3. Monitor memory usage trends
4. Check for dependency failures

## 📋 Daily Monitoring Checklist

### Every Morning
- [ ] Check follower count growth
- [ ] Verify posts from last 24h  
- [ ] Check budget utilization
- [ ] Review any error alerts

### Weekly Review  
- [ ] Analyze posting success rate trends
- [ ] Review budget efficiency
- [ ] Check system uptime patterns
- [ ] Update monitoring thresholds if needed

## 🚀 Quick Start

```bash
# 1. Deploy to Railway
git push origin main

# 2. Set up basic monitoring
curl https://your-app.up.railway.app/health

# 3. Start log monitoring
npm run logs

# 4. Open dashboard
open https://your-app.up.railway.app/
```

**That's it!** Your bot is now fully monitored and ready for autonomous operation.