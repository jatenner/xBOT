# 🚀 xBOT Live Posting & Learning System - RUNBOOK

## **🎯 OVERVIEW**

This runbook provides exact copy-paste commands for deploying, monitoring, and operating the xBOT live posting & learning system. The system features:

- **Real OpenAI content generation** with budget safety
- **Actual Twitter posting** via browser automation
- **Real-time analytics collection** from Twitter
- **Unified learning system** with bandits and predictors
- **Safety gates** (uniqueness, quality, rotation)
- **Comprehensive observability** and admin endpoints

---

## **🛡️ SAFETY-FIRST DEPLOYMENT**

### **Required Environment Variables**

Set these **exactly** in Railway for production:

```bash
# Core Mode & Safety
MODE=live
JOBS_AUTOSTART=true
ADMIN_TOKEN=<your-secure-admin-token>

# Budget Safety (CRITICAL)
DAILY_OPENAI_LIMIT_USD=5.0
DISABLE_LLM_WHEN_BUDGET_HIT=true
MAX_POSTS_PER_HOUR=1
REPLY_MAX_PER_DAY=0

# Quality & Safety Gates
MIN_QUALITY_SCORE=0.75
DUP_COSINE_THRESHOLD=0.85
FORCE_NO_HASHTAGS=true
EMOJI_MAX=2

# Infrastructure
PORT=8080
DATABASE_URL=postgresql://<user>:<pass>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
REDIS_URL=redis://default:<password>@<host>:<port>
SUPABASE_URL=https://<your>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# LLM
OPENAI_API_KEY=<your-openai-key>
OPENAI_MODEL=gpt-4o-mini

# Twitter (use one method)
TWITTER_USERNAME=<username>
TWITTER_PASSWORD=<password>
# OR
TWITTER_SESSION_B64=<base64-encoded-session>

# Job Intervals (minutes)
JOBS_PLAN_INTERVAL_MIN=15
JOBS_REPLY_INTERVAL_MIN=30
JOBS_POSTING_INTERVAL_MIN=5
JOBS_LEARN_INTERVAL_MIN=60
```

---

## **🚀 DEPLOYMENT PIPELINE**

### **1. Deploy to Railway**

```bash
# Commit and push changes
git add .
git commit -m "feat: enable real plan/reply + live outcomes & learning"
git push origin main

# Monitor deployment
railway logs --follow
```

### **2. Run Database Migrations**

```bash
# Using Railway CLI
railway run node tools/db/migrate.js

# Or via API
curl -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=migrate"
```

### **3. Initial System Test**

```bash
# Run system integration tests
npm test

# Or using ts-node directly
npx ts-node scripts/test-system-integration.ts
```

---

## **🔄 LIVE OPERATION COMMANDS**

### **Manual Job Execution**

Use these commands to manually trigger specific jobs:

```bash
# 1. Generate content (creates decisions in queue)
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=plan"

# 2. Process posting queue (posts to Twitter)
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=posting"

# 3. Generate replies
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=reply"

# 4. Collect Twitter analytics
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=analyticsCollector"

# 5. Store real outcomes from analytics
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=realOutcomes"

# 6. Run learning cycle (update bandits & predictors)
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=learn"

# 7. Train predictor models
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=trainPredictor"
```

### **Complete End-to-End Test Cycle**

Run this sequence to test the full pipeline:

```bash
#!/bin/bash
export APP_URL="https://your-app.up.railway.app"
export ADMIN_TOKEN="your-admin-token"

echo "🚀 Starting end-to-end test cycle..."

echo "1. Generate content..."
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=plan"

sleep 10

echo "2. Process posting queue..."
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=posting"

sleep 30

echo "3. Collect analytics..."
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=analyticsCollector"

sleep 10

echo "4. Store real outcomes..."
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=realOutcomes"

sleep 10

echo "5. Run learning cycle..."
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=learn"

echo "✅ End-to-end cycle completed!"
```

---

## **📊 MONITORING & OBSERVABILITY**

### **System Metrics**

```bash
# Real-time system metrics
curl -s "$APP_URL/metrics" | jq '{
  openaiCalls: .openaiCalls,
  outcomesWritten: .outcomesWritten,
  postsPosted: .postsPosted,
  qualityBlocksCount: .qualityBlocksCount,
  uniqueBlocksCount: .uniqueBlocksCount,
  rotationBlocksCount: .rotationBlocksCount
}'

# Job schedule and status
curl -s -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/schedule" | jq '.jobs[] | {name, status, nextRun}'

# Learning system status
curl -s "$APP_URL/learn/status" | jq '{
  bandits: .bandits,
  predictorVersion: .predictorVersion,
  timingHeatmap: .timingHeatmap
}'

# General system status
curl -s "$APP_URL/status" | jq '{
  mode: .mode,
  posting: .posting,
  uptime: .uptime,
  dbStatus: .dbStatus
}'
```

### **Database Queries**

```sql
-- Check recent decisions and posting status
SELECT id, decision_type, status, created_at, posted_at, tweet_id
FROM unified_ai_intelligence 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Check real vs simulated outcomes
SELECT simulated, COUNT(*) as count, AVG(er_calculated) as avg_er
FROM outcomes 
WHERE collected_at > NOW() - INTERVAL '7 days'
GROUP BY simulated;

-- Check gate blocking patterns
SELECT 
  COUNT(*) FILTER (WHERE content LIKE '%quality%') as quality_blocks,
  COUNT(*) FILTER (WHERE content LIKE '%uniqueness%') as uniqueness_blocks,
  COUNT(*) FILTER (WHERE content LIKE '%rotation%') as rotation_blocks
FROM unified_ai_intelligence 
WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours';

-- Check posting rate compliance
SELECT 
  DATE_TRUNC('hour', posted_at) as hour,
  COUNT(*) as posts_per_hour
FROM unified_ai_intelligence 
WHERE status = 'posted' AND posted_at > NOW() - INTERVAL '24 hours'
GROUP BY hour 
ORDER BY hour DESC;
```

### **Log Monitoring**

```bash
# Monitor Railway logs in real-time
railway logs --follow | grep -E "(JOB_|GATE_|POST_|LEARN_|❌|✅)"

# Check for errors
railway logs --lines 100 | grep "❌"

# Monitor posting activity
railway logs --lines 50 | grep "POSTING_QUEUE"

# Check budget usage
railway logs --lines 50 | grep "BUDGET"
```

---

## **🚨 EMERGENCY PROCEDURES**

### **Emergency Stop Posting**

```bash
# Method 1: Disable via environment variable (Railway)
railway variables set MODE=shadow

# Method 2: Disable jobs via admin API
curl -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/emergency/disable-posting"

# Method 3: Scale to zero (temporary)
railway scale --service xBOT --replicas 0
```

### **Budget Emergency Stop**

```bash
# Check current budget usage
curl -s "$APP_URL/metrics" | jq '.openaiCostUsd'

# Emergency budget disable
railway variables set DISABLE_LLM_WHEN_BUDGET_HIT=true
railway variables set DAILY_OPENAI_LIMIT_USD=0.01
```

### **Reset to Shadow Mode**

```bash
# Switch to shadow mode (safe testing)
railway variables set MODE=shadow
railway variables set POSTING_DISABLED=true

# Restart service
railway restart --service xBOT
```

---

## **🔧 TROUBLESHOOTING**

### **Common Issues**

**1. "Real LLM generation not yet implemented" in logs**
```bash
# Check MODE setting
railway variables get MODE

# Should be "live" for production
railway variables set MODE=live
```

**2. "No outcomes data found" in learning**
```bash
# Check if analytics are being collected
curl -s "$APP_URL/metrics" | jq '.outcomesWritten'

# Manually trigger analytics collection
curl -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=analyticsCollector"
```

**3. "Failed to store decision" errors**
```bash
# Check database connectivity
curl -s "$APP_URL/status" | jq '.dbStatus'

# Run schema verification
npm run test:schema
```

**4. "Budget exceeded" errors**
```bash
# Check current budget status
curl -s "$APP_URL/metrics" | jq '{spent: .openaiCostUsd, limit: .dailyLimit}'

# Reset budget tracking (if needed)
railway variables set DAILY_OPENAI_LIMIT_USD=10.0
```

### **Health Checks**

```bash
# Quick system health check
#!/bin/bash
APP_URL="https://your-app.up.railway.app"

echo "🏥 System Health Check"
echo "====================="

# 1. Basic connectivity
if curl -s "$APP_URL/status" > /dev/null; then
  echo "✅ App responding"
else
  echo "❌ App not responding"
fi

# 2. Database connectivity
DB_STATUS=$(curl -s "$APP_URL/status" | jq -r '.dbStatus')
echo "DB Status: $DB_STATUS"

# 3. Recent activity
RECENT_POSTS=$(curl -s "$APP_URL/metrics" | jq '.postsPosted')
echo "Posts today: $RECENT_POSTS"

# 4. Budget usage
BUDGET_USED=$(curl -s "$APP_URL/metrics" | jq '.openaiCostUsd')
echo "Budget used: \$$BUDGET_USED"

# 5. Error count
ERROR_COUNT=$(curl -s "$APP_URL/metrics" | jq '.errors')
echo "Errors: $ERROR_COUNT"
```

---

## **📋 REGULAR MAINTENANCE**

### **Daily Checks** (5 minutes)

```bash
# 1. Check system status
curl -s "$APP_URL/status" | jq '{mode, posting, uptime}'

# 2. Check posting activity (should be ~24 posts/day max)
curl -s "$APP_URL/metrics" | jq '{postsPosted, postingErrors}'

# 3. Check budget usage
curl -s "$APP_URL/metrics" | jq '{openaiCostUsd, dailyLimit: 5.0}'

# 4. Check error rate
curl -s "$APP_URL/metrics" | jq '.errors'
```

### **Weekly Maintenance** (15 minutes)

```bash
# 1. Review learning performance
curl -s "$APP_URL/learn/status" | jq '.predictorVersion'

# 2. Check database growth
psql $DATABASE_URL -c "
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY n_tup_ins DESC;
"

# 3. Train new predictor model
curl -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "$APP_URL/admin/jobs/run?name=trainPredictor"

# 4. Review gate effectiveness
curl -s "$APP_URL/metrics" | jq '{
  qualityBlocks: .qualityBlocksCount,
  uniquenessBlocks: .uniqueBlocksCount,
  rotationBlocks: .rotationBlocksCount
}'
```

---

## **🎛️ CONFIGURATION TUNING**

### **Adjust Posting Rate**

```bash
# Increase posting (carefully!)
railway variables set MAX_POSTS_PER_HOUR=2
railway variables set JOBS_PLAN_INTERVAL_MIN=10

# Enable replies (start small)
railway variables set REPLY_MAX_PER_DAY=2
```

### **Adjust Quality Thresholds**

```bash
# Higher quality requirement
railway variables set MIN_QUALITY_SCORE=0.85

# Lower similarity threshold (more strict uniqueness)
railway variables set DUP_COSINE_THRESHOLD=0.80

# Restart to apply changes
railway restart --service xBOT
```

### **Budget Adjustments**

```bash
# Increase daily budget (if needed)
railway variables set DAILY_OPENAI_LIMIT_USD=10.0

# Disable budget hard stop (not recommended)
railway variables set DISABLE_LLM_WHEN_BUDGET_HIT=false
```

---

## **📈 SUCCESS METRICS**

### **Daily Success Indicators**

- **✅ Posts Created**: 15-24 per day (within rate limits)
- **✅ Gate Pass Rate**: >60% (quality content gets through)
- **✅ Error Rate**: <5% (minimal system failures) 
- **✅ Budget Usage**: <$5/day (within limits)
- **✅ Learning Active**: Predictor version updates weekly

### **Weekly Performance Review**

```bash
# Generate weekly report
#!/bin/bash
echo "📊 WEEKLY PERFORMANCE REPORT"
echo "=============================="

# Posts and engagement
psql $DATABASE_URL -c "
SELECT 
  COUNT(*) as total_posts,
  AVG(predicted_er) as avg_predicted_er,
  COUNT(*) FILTER (WHERE status = 'posted') as successful_posts
FROM unified_ai_intelligence 
WHERE created_at > NOW() - INTERVAL '7 days';
"

# Learning system health
curl -s "$APP_URL/learn/status" | jq '{
  predictorVersion: .predictorVersion,
  banditArmCount: (.bandits | length),
  topPerformingArm: .bandits[0]
}'

# Budget efficiency
curl -s "$APP_URL/metrics" | jq '{
  totalSpent: .openaiCostUsd,
  costPerPost: (.openaiCostUsd / .postsPosted),
  budgetEfficiency: (.postsPosted / .openaiCostUsd)
}'
```

---

## **🔗 USEFUL LINKS**

- **Railway App**: https://your-app.up.railway.app
- **Metrics Dashboard**: https://your-app.up.railway.app/metrics
- **System Status**: https://your-app.up.railway.app/status
- **Learning Dashboard**: https://your-app.up.railway.app/learn/status
- **Admin Jobs**: https://your-app.up.railway.app/admin/jobs/schedule
- **Database**: [Supabase Dashboard](https://supabase.com/dashboard)
- **Redis**: [Redis Cloud Dashboard](https://app.redislabs.com)
- **Railway Logs**: `railway logs --follow`

---

**⚠️ REMEMBER**: Always test changes in shadow mode first (`MODE=shadow`) before switching to live mode (`MODE=live`).

**🛡️ SAFETY**: The system is designed to fail safe. When in doubt, switch to shadow mode and investigate.

**📞 SUPPORT**: Check logs first, then review this runbook. Most issues have copy-paste solutions above.