# 🚀 xBOT Operations Runbook

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Environment Configuration](#environment-configuration)
3. [Enabling Posting (Go-Live)](#enabling-posting-go-live)
4. [Verifying Collectors](#verifying-collectors)
5. [Learning System](#learning-system)
6. [Safe Rollback](#safe-rollback)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Troubleshooting](#troubleshooting)

---

## System Overview

xBOT is an autonomous Twitter/X growth bot with the following components:

### Core Jobs
- **Plan Job** (`planJob.ts`): Generates content decisions using LLM
- **Reply Job** (`replyJob.ts`): Generates reply decisions
- **Posting Queue** (`postingQueue.ts`): Posts queued content to X
- **Analytics Collector** (`analyticsCollectorJobV2.ts`): Collects real metrics in 2 passes (T+1h, T+24h)
- **Learn Job** (`learnJob.ts`): Updates predictors based on outcomes

### Key Tables
- `content_metadata`: Decision queue with features
- `posted_decisions`: Archive of posted content
- `outcomes`: Engagement metrics (simulated vs real)
- `bandit_arms`: Thompson sampling state
- `api_usage`: OpenAI cost tracking

---

## Environment Configuration

### Phase 1: Testing (Today - Posting OFF)
```bash
# Core flags
MODE=live                        # Attempt real LLM calls
POSTING_DISABLED=true            # DO NOT post to X
LIVE_POSTS=false                 # Shadow mode
REAL_METRICS_ENABLED=false       # No real metrics collection

# LLM flags
AI_QUOTA_CIRCUIT_OPEN=false      # Allow LLM calls (if quota available)
DAILY_OPENAI_LIMIT_USD=10.00     # Budget cap
BUDGET_STRICT=true               # Enforce hard budget limit
DISABLE_LLM_WHEN_BUDGET_HIT=true # Stop LLM on quota exhaustion

# Posting limits (not used when posting disabled)
MAX_POSTS_PER_HOUR=2
MIN_POST_INTERVAL_MINUTES=30
REPLY_MAX_PER_DAY=10
```

### Phase 2: Production (Tomorrow - Posting ON)
```bash
# Core flags - CHANGES ONLY
POSTING_DISABLED=false           # ✅ Enable posting
LIVE_POSTS=true                  # ✅ Post for real
REAL_METRICS_ENABLED=true        # ✅ Collect real metrics

# All other flags stay the same
```

---

## Enabling Posting (Go-Live)

### Pre-Flight Checklist
- [ ] OpenAI quota reset confirmed (check `/api/metrics`)
- [ ] At least 5 real decisions in queue (`SELECT COUNT(*) FROM content_metadata WHERE status='queued' AND generation_source='real'`)
- [ ] Browser session authenticated to X (check `src/login/sessionManager.ts`)
- [ ] Railway deployment healthy (no errors in logs)
- [ ] Database migrations applied successfully

### Step-by-Step Go-Live

#### 1. Verify System Health
```bash
# Check API metrics
curl https://xbot-production.railway.app/api/metrics

# Expected:
# - openaiCalls_total > 0
# - openaiCalls_failed = 0 (or low)
# - postsQueued > 0
```

#### 2. Update Environment Variables

**Option A: Railway Dashboard**
1. Navigate to Railway project → xBOT service
2. Go to Variables tab
3. Update:
   - `POSTING_DISABLED` = `false`
   - `LIVE_POSTS` = `true`
   - `REAL_METRICS_ENABLED` = `true`
4. Click "Deploy" to restart service

**Option B: Railway CLI**
```bash
railway variables set POSTING_DISABLED=false
railway variables set LIVE_POSTS=true
railway variables set REAL_METRICS_ENABLED=true

# Redeploy
railway up
```

#### 3. Monitor First Post
Watch Railway logs for:
```
[POSTING_ORCHESTRATOR] 📋 Found N decisions in queue
[POSTING_ORCHESTRATOR] ✅ Posted successfully tweet_id=1234567890 decision_id=abc-123
```

#### 4. Verify Outcomes Collection (T+1h)
After 1 hour, check logs for:
```
[ANALYTICS_COLLECTOR] ✅ Pass 1 stored: decision_id=abc-123 ER=X.XX% FPKI=Y.YY follows=Z
```

#### 5. Verify Learning (After 5+ Posts)
Check logs for:
```
[LEARN_JOB] ✅ coeffs_updated=v1 arms_trained=5 explore_ratio=0.20
```

---

## Verifying Collectors

### Analytics Collector (Real Metrics)

**Check Pass 1 (T+1h)**
```sql
SELECT 
  decision_id,
  tweet_id,
  impressions,
  likes,
  follows,
  er_calculated,
  collected_pass,
  collected_at
FROM outcomes
WHERE simulated = false
  AND collected_pass = 1
ORDER BY collected_at DESC
LIMIT 10;
```

**Check Pass 2 (T+24h)**
```sql
SELECT 
  decision_id,
  tweet_id,
  impressions,
  follows,
  reward_composite,
  collected_pass,
  collected_at
FROM outcomes
WHERE simulated = false
  AND collected_pass = 2
ORDER BY collected_at DESC
LIMIT 10;
```

**Verify Collector is Running**
```bash
# Railway logs
railway logs --filter "ANALYTICS_COLLECTOR"

# Expected output (every hour):
# [ANALYTICS_COLLECTOR] 📊 Starting real analytics collection (V2)...
# [ANALYTICS_COLLECTOR] ✅ Pass 1 stored: decision_id=...
```

---

## Learning System

### Check Learning Status
```bash
curl https://xbot-production.railway.app/api/learning/status

# Expected:
# {
#   "predictorVersion": "v1",
#   "exploreRate": 0.20,
#   "arms": [
#     {"name": "educational", "successes": 5, "failures": 2, ...},
#     ...
#   ]
# }
```

### Force Learning Update (Admin)
```bash
# SSH into Railway or use admin endpoint
curl -X POST https://xbot-production.railway.app/api/admin/trigger-learn \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Verify Predictor Versioning
```sql
SELECT 
  arm_name,
  scope,
  successes,
  failures,
  last_updated
FROM bandit_arms
ORDER BY last_updated DESC;
```

---

## Safe Rollback

### Emergency Stop (Disable Posting Immediately)
```bash
# Option 1: Railway CLI
railway variables set POSTING_DISABLED=true
railway restart

# Option 2: Railway Dashboard
# Set POSTING_DISABLED=true → Deploy
```

### Partial Rollback (Keep LLM, Stop Posting)
```bash
railway variables set POSTING_DISABLED=true
railway variables set LIVE_POSTS=false
railway restart

# This will:
# ✅ Continue generating content
# ✅ Queue decisions
# ❌ NOT post to X
```

### Full Rollback (Stop All AI Activity)
```bash
railway variables set AI_QUOTA_CIRCUIT_OPEN=true
railway variables set POSTING_DISABLED=true
railway restart

# This will:
# ❌ Stop all LLM calls
# ❌ Stop posting
# ✅ System stays running (no crashes)
```

### Database Rollback (Last Resort)
```bash
# Connect to Supabase
psql $SUPABASE_DB_URL

# Rollback migration (if needed)
BEGIN;
-- See migration file for DOWN commands
ALTER TABLE outcomes DROP COLUMN IF EXISTS follows CASCADE;
ALTER TABLE outcomes DROP COLUMN IF EXISTS reward_composite CASCADE;
-- ... etc
COMMIT;
```

---

## Monitoring & Alerts

### Key Metrics to Watch

#### 1. Growth Metrics (`/api/growth`)
- `followers_today`: New followers today
- `fpki_avg_7d`: Average follows per 1K impressions (7 days)
- `top_posts`: Best performing content

#### 2. Learning Metrics (`/api/learning/status`)
- `predictorVersion`: Should increment with learning
- `exploreRate`: Should decay from 0.20 → 0.05 over 14 days
- `arms`: Check success/failure ratios

#### 3. Cost Metrics (`/api/metrics`)
- `openaiCalls_total`: Total LLM calls
- `openaiCalls_failed`: Failed calls (should be low)
- `daily_cost_usd`: Today's OpenAI spend

### Log Patterns to Monitor

**Success Patterns:**
```
✅ Real LLM content queued decision_id=...
✅ Posted successfully tweet_id=...
✅ Pass 1 stored: decision_id=... ER=... FPKI=...
✅ coeffs_updated=v1 arms_trained=...
```

**Warning Patterns:**
```
⚠️  429 rate limit hit (expected if quota exhausted)
⚠️  Could not fetch metrics for tweet_id=...
⚠️  Training skipped: insufficient real outcomes (need 5)
```

**Error Patterns:**
```
❌ Failed to post decision
❌ Analytics collection failed
❌ Max retries exceeded
❌ Budget exceeded
```

### Alerts Configuration

**Recommended Alert Rules:**
1. **High failure rate**: `openaiCalls_failed / openaiCalls_total > 0.10` (10%)
2. **No posts in 4 hours**: `postsPosted_4h == 0` (when posting enabled)
3. **Budget near limit**: `daily_cost_usd > DAILY_OPENAI_LIMIT_USD * 0.9` (90%)
4. **Follower drop**: `followers_24h < -10` (lost 10+ followers)

---

## Troubleshooting

### Issue: No Content Being Generated

**Symptoms:**
```
[PLAN_JOB] ⏭️ Skipping: AI_QUOTA_CIRCUIT_OPEN=true
```

**Solution:**
```bash
# Check quota status
curl https://xbot-production.railway.app/api/metrics | jq '.daily_cost_usd'

# If under budget, check circuit breaker
railway variables get AI_QUOTA_CIRCUIT_OPEN

# Reset if needed
railway variables set AI_QUOTA_CIRCUIT_OPEN=false
```

---

### Issue: Content Generated But Not Posted

**Symptoms:**
```
[POSTING_ORCHESTRATOR] ⏭️ Skipped posting decision_id=...: POSTING_DISABLED=true
```

**Solution:**
```bash
# Verify flag
railway variables get POSTING_DISABLED

# Should be "false" for posting to work
railway variables set POSTING_DISABLED=false
```

---

### Issue: Posts Failing with Playwright Errors

**Symptoms:**
```
[POST_RETRY] ⚠️ Retry 1/3 after timeout
❌ Failed to post: Navigation timeout
```

**Solution:**
```bash
# Check browser session
# Re-authenticate if needed
npm run login

# Verify session storage
ls -la .playwright/
```

---

### Issue: No Outcomes Being Collected

**Symptoms:**
```
[ANALYTICS_COLLECTOR] ℹ️ No posts ready for Pass 1 (T+1h)
```

**Solution:**
```sql
-- Check if posts exist
SELECT COUNT(*) FROM posted_decisions 
WHERE posted_at > NOW() - INTERVAL '2 hours';

-- Check if outcomes already collected
SELECT COUNT(*) FROM outcomes 
WHERE collected_pass = 1 
  AND collected_at > NOW() - INTERVAL '2 hours';
```

---

### Issue: Learning Not Updating

**Symptoms:**
```
[LEARN_JOB] ⚠️ Training skipped: insufficient real outcomes (need 5)
```

**Solution:**
```sql
-- Check real outcomes count
SELECT COUNT(*) FROM outcomes WHERE simulated = false;

-- If < 5, wait for more posts and collections
-- If >= 5, check logs for errors
```

---

## 7-Day Experiment Plan

### Day 1-2: Baseline Establishment
- **Experiments**: None (control group)
- **Goal**: Establish baseline metrics (FPKI, ER, follower growth)
- **Monitor**: Quality scores, gate blocks, novelty distribution

### Day 3-4: Hook Pattern Testing
- **Experiment**: `question_cta` (30% of content)
- **Goal**: Test if question-based hooks improve engagement
- **Monitor**: Compare `question_cta` arm vs control

### Day 5-6: Timing Optimization
- **Experiment**: `late_evening_slot` (20% of posts)
- **Goal**: Test if late evening (8-10 PM) improves reach
- **Monitor**: Impressions and FPKI by time slot

### Day 7: Analysis & Adjustment
- **Action**: Review experiment results
- **Decision**: Keep winning experiments, disable losers
- **Plan**: Design next week's experiments based on learnings

---

## Quick Reference Commands

```bash
# Deploy to staging
railway up --environment staging

# Deploy to production
railway up --environment production

# View logs (live)
railway logs --tail

# Check environment
railway variables

# Run migrations
npx supabase db push --db-url $SUPABASE_DB_URL

# Trigger learn job manually
curl -X POST $APP_URL/api/admin/trigger-learn -H "Authorization: Bearer $ADMIN_TOKEN"

# Check queue status
psql $SUPABASE_DB_URL -c "SELECT status, generation_source, COUNT(*) FROM content_metadata GROUP BY 1,2;"
```

---

**Last Updated**: 2025-09-30  
**Maintained By**: Platform Engineering  
**Emergency Contact**: Check #xbot-alerts Slack channel
