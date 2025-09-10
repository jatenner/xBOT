# 💰 Budget Guardrails Runbook

**Complete guide to OpenAI cost management, hard caps, and ROI optimization**

## 🎯 Overview

The xBOT budget system provides **hard $5/day cost protection** with intelligent ROI-based optimization, Redis-powered breakers, and bulletproof Supabase logging.

### Key Features
- **Hard daily cap**: $5.00 (configurable)
- **Soft budget threshold**: $3.50 (70% of hard limit)
- **Redis cost breaker**: Real-time budget enforcement
- **ROI optimization**: Intelligent model selection based on intent performance
- **Bulletproof logging**: RPC-first with direct table fallback
- **Automatic migrations**: Self-managing database schema

---

## 🔧 Environment Variables

### Core Budget Controls
```bash
DAILY_COST_LIMIT_USD=5.00               # Hard daily cap
COST_SOFT_BUDGET_USD=3.50               # Soft budget threshold (70% of hard limit)
COST_TRACKER_STRICT=true                # Strict enforcement (blocks vs warns)
COST_TRACKER_ROLLOVER_TZ=UTC            # Timezone for daily rollover
```

### Redis Budget Breaker
```bash
REDIS_PREFIX=prod:                      # Key prefix (prod: / staging:)
REDIS_BREAKER_ENABLED=true              # Enable Redis cost tracking
REDIS_BUDGET_TTL_SECONDS=172800         # 2-day TTL for cost keys
```

### Budget Optimizer
```bash
BUDGET_OPTIMIZER_ENABLED=true           # Enable ROI-based optimization
BUDGET_STRATEGY=adaptive                # adaptive | conservative
BUDGET_PEAK_HOURS=17-23                 # UTC hours for higher spending
BUDGET_MIN_RESERVE_USD=0.50             # Emergency reserve buffer
```

### Cost Logging
```bash
COST_LOGGING_STORAGE=supabase           # Storage backend
COST_LOGGING_TABLE=openai_usage_log     # Supabase table name
```

---

## 📊 Monitoring & Health

### Health Endpoint
```bash
GET /budget/status
```

**Returns:**
```json
{
  "date_utc": "2025-01-09",
  "limit": 5.00,
  "soft_limit": 3.50,
  "today_spend": 2.75,
  "remaining": 2.25,
  "blocked": false,
  "percent_used": 55,
  "cost_controls": {
    "hard_limit": 5.00,
    "soft_limit": 3.50,
    "soft_budget_exceeded": false,
    "throttle_active": false,
    "emergency_mode": false
  },
  "optimizer": {
    "enabled": true,
    "strategy": "adaptive",
    "recommendation": "ROI-Adaptive: pace=-0.15, intentROI=1.2x, model=gpt-4o-mini",
    "allowExpensive": false,
    "recommendedModel": "gpt-4o-mini",
    "maxCostPerCall": 0.08,
    "postingFrequency": "normal"
  },
  "model_mix": {
    "gpt-4o-mini": 85.3,
    "gpt-4o": 14.7
  },
  "optimizer_state": {
    "strategic_engagement": 1.15,
    "viral_content": 1.78,
    "longform_thread": 0.92
  }
}
```

### Key Logs to Monitor
```bash
# Budget enforcement
💰 REDIS_BUDGET: $2.75 / $5.00 (key: prod:openai_cost:2025-01-09)
🚫 DAILY_LIMIT_REACHED: $5.02 used / $5.00 limit

# Cost logging success
💰 COST_LOG: RPC success $0.0045 (gpt-4o-mini) [uuid]
💰 COST_LOG: Direct insert succeeded $0.0045 (gpt-4o-mini)

# ROI optimization
🧠 BUDGET_OPTIMIZER: viral_content ROI = 1.78 (7 samples)
🎯 BUDGET_OPTIMIZER: ROI-Adaptive: pace=-0.15, intentROI=1.78x, model=gpt-4o [ROI: 1.780]

# Migration success
🧱 MIGRATION_APPLIED: 20250109_budget_guardrails_complete.sql
✅ MIGRATIONS: Applied 1 new migrations, skipped 23

# Posting resilience
THREAD_POST_FAIL: All 3 attempts exhausted - continuing system operation
🔄 THREAD_BACKOFF: Waiting 4000ms before retry 3
```

---

## 🔍 Verification Steps

### 1. Startup Verification
```bash
# Check Railway logs for successful initialization
railway logs --tail

# Expected logs:
✅ MIGRATION_URL_RESOLVER: Built from SUPABASE_URL (abc123)
🧱 MIGRATION_APPLIED: 20250109_budget_guardrails_complete.sql
✅ STARTUP_MIGRATIONS: All migrations completed successfully
✅ COST_TRACKER: Redis ready (cloud-safe mode)
```

### 2. Budget Status Check
```bash
curl https://your-app.railway.app/budget/status | jq

# Verify fields:
# - today_spend < limit
# - blocked = false (unless over limit)
# - optimizer.enabled = true
# - model_mix shows distribution
```

### 3. Database Verification
```sql
-- Check cost logging table exists
SELECT COUNT(*) FROM openai_usage_log;

-- Check RPC function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'log_openai_usage';

-- Check recent usage
SELECT model, intent, cost_usd, created_at 
FROM openai_usage_log 
ORDER BY created_at DESC 
LIMIT 10;
```

### 4. Redis Verification
```bash
# Check cost keys exist (use Redis CLI or dashboard)
KEYS prod:openai_cost:*
KEYS prod:budget:roi:*

# Example keys:
# prod:openai_cost:2025-01-09 -> "2.75"
# prod:budget:roi:viral_content -> sorted set of ROI scores
```

---

## 🚨 Troubleshooting

### Migration Errors
```bash
❌ STARTUP_MIGRATIONS_FAILED: DATABASE_URL required for migrations
```
**Fix:** Ensure `DATABASE_URL` is set OR provide:
- `SUPABASE_DB_PASSWORD` 
- `SUPABASE_URL` or `PRODUCTION_PROJECT_REF`

### Cost Logging Failures
```bash
💰 RPC_FALLBACK: Function not found, trying direct table insert
💰 COST_LOG_FAILED: Both RPC and table insert failed
```
**Fix:** 
1. Run migration: `20250109_budget_guardrails_complete.sql`
2. Check table permissions for `service_role`
3. Verify RPC function exists

### Redis Connection Issues
```bash
⚠️ COST_TRACKER: Redis connection issue: READONLY
ERR Unsupported CONFIG parameter: maxmemory
```
**Fix:**
1. Set `REDIS_PREFIX=prod:` (no CONFIG commands)
2. Use managed Redis URL with proper permissions
3. Verify `REDIS_BREAKER_ENABLED=true`

### Budget Breaker Not Working
```bash
# Check logs for Redis keys
💰 REDIS_BUDGET: $2.75 / $5.00 (key: prod:openai_cost:2025-01-09)
```
**Expected behavior:**
- Under limit: Requests proceed normally
- Over limit: `🚫 DAILY_LIMIT_REACHED` + requests blocked

### Thread Posting Failures
```bash
THREAD_POST_FAIL: All 3 attempts exhausted
```
**Fix:**
1. Check `PLAYWRIGHT_MAX_CONTEXT_RETRIES=3`
2. Verify `TWITTER_SESSION_B64` is valid
3. System continues operation (non-fatal)

---

## 🎯 Performance Tuning

### Budget Strategy Adjustment
```bash
# Conservative (more cautious)
BUDGET_STRATEGY=conservative

# Adaptive (ROI-driven, default)
BUDGET_STRATEGY=adaptive
```

### ROI Optimization Tuning
```bash
# Disable optimizer (uses defaults)
BUDGET_OPTIMIZER_ENABLED=false

# Adjust peak hours for your audience
BUDGET_PEAK_HOURS=18-24  # 6 PM - midnight UTC

# Increase reserve buffer
BUDGET_MIN_RESERVE_USD=1.00
```

### Cost Model Preferences
```bash
# Default model (overridden by optimizer)
OPENAI_MODEL=gpt-4o-mini

# Force strict enforcement
COST_TRACKER_STRICT=true
```

---

## 🧪 Manual Testing

### Test Budget Enforcement
```bash
# Set very low limit for testing
DAILY_COST_LIMIT_USD=0.01

# Generate content and watch for:
🚫 DAILY_LIMIT_REACHED: $0.02 used / $0.01 limit
```

### Test RPC Fallback
```sql
-- Temporarily drop RPC function
DROP FUNCTION IF EXISTS log_openai_usage(jsonb);

-- Generate content, should see:
-- 💰 RPC_FALLBACK: Function not found, trying direct table insert
-- 💰 COST_LOG: Direct insert succeeded $0.0045 (gpt-4o-mini)

-- Restore function by running migration again
```

### Test ROI Optimization
```bash
# Check optimizer state
curl /budget/status | jq .optimizer_state

# Expected: Different ROI scores per intent
# {
#   "strategic_engagement": 1.15,
#   "viral_content": 1.78,
#   "longform_thread": 0.92
# }
```

---

## 📈 ROI Data Analysis

### View ROI Performance
```sql
-- Daily ROI by intent
SELECT 
  intent,
  date_utc,
  engagement_score,
  followers_gained,
  cost_usd,
  roi_score
FROM budget_roi_tracking
ORDER BY date_utc DESC, roi_score DESC;

-- Average ROI by intent (last 7 days)
SELECT 
  intent,
  AVG(roi_score) as avg_roi,
  SUM(cost_usd) as total_cost,
  SUM(followers_gained) as total_followers
FROM budget_roi_tracking
WHERE date_utc >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY intent
ORDER BY avg_roi DESC;
```

### Optimize Intent Performance
High ROI intents get:
- Better model allocation (`gpt-4o` vs `gpt-4o-mini`)
- Higher token limits
- More budget allocation during peak hours

Low ROI intents get:
- Cheaper models
- Reduced token limits
- Budget conservation

---

## 🔒 Security & Compliance

### Data Protection
- All cost data stored in Supabase with RLS
- Redis keys use configurable prefixes
- No secrets logged in cost tracking
- Automatic data cleanup via TTL

### Access Control
- RPC functions have proper grants
- Service role access for cost logging
- Read-only health endpoints
- Environment-based key prefixes

---

## 🎉 Success Criteria

✅ **Startup:** Migrations apply automatically, no manual SQL steps  
✅ **Budget:** Hard cap enforced, spending tracked in Redis  
✅ **Logging:** All OpenAI calls logged to Supabase (RPC + fallback)  
✅ **Optimization:** ROI-driven model selection working  
✅ **Resilience:** Posting failures don't crash the system  
✅ **Monitoring:** `/budget/status` returns comprehensive data  

**The system is production-ready when all logs show success and `/budget/status` returns valid data.** 🚀
