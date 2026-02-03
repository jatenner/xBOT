# ⏰ PRODUCTION HOURLY TICK LIVENESS VERIFICATION

**Date:** February 3, 2026  
**Status:** ⏳ **PENDING** - Awaiting deployment

---

## VERIFICATION STEPS

### 1. Deploy to Railway
```bash
railway service xBOT
railway up --detach
```

### 2. Check Logs for Hourly Tick
```bash
railway logs -n 400 | grep -E "HOURLY_TICK|SCHEMA_PREFLIGHT"
```

**Expected Output (if schema applied):**
```
[SCHEMA_PREFLIGHT] 🔒 Running schema preflight check...
[SCHEMA_PREFLIGHT] ✅ Table exists: bot_backoff_state
[SCHEMA_PREFLIGHT] ✅ Table exists: bot_run_counters
[SCHEMA_PREFLIGHT] ✅ Table exists: rate_controller_state
...
[SCHEMA_PREFLIGHT] ✅ PREFLIGHT PASSED: All schema elements present
[HOURLY_TICK] 🕐 Starting hourly tick...
[HOURLY_TICK] 📊 Targets: mode=WARMUP, replies=1, posts=0, allow_search=true
[HOURLY_TICK] 📊 {"timestamp":"...","mode":"WARMUP","targets":{...},"executed":{...}}
```

**Expected Output (if schema NOT applied):**
```
[SCHEMA_PREFLIGHT] ❌ Missing table: rate_controller_state
[SCHEMA_PREFLIGHT] ❌ PREFLIGHT FAILED: 1 missing items
[SCHEMA_PREFLIGHT] 🛡️ SAFE_MODE ACTIVATED: Rate controller disabled
[HOURLY_TICK] ❌ Schema preflight failed - SAFE_MODE activated
[HOURLY_TICK] 🛡️ Skipping execution (safe mode)
```

### 3. Verify rate_controller_state Table Populated
```sql
SELECT hour_start, mode, target_replies_this_hour, target_posts_this_hour,
       executed_replies, executed_posts, risk_score, yield_score
FROM rate_controller_state
ORDER BY hour_start DESC
LIMIT 10;
```

**Expected:** Rows with recent `hour_start` timestamps

---

## CURRENT STATUS

**Pre-Deployment:** Awaiting migration application and deployment

**Post-Deployment:** Will verify:
- ✅ Schema preflight passes
- ✅ Hourly tick executes
- ✅ JSON logs emitted
- ✅ rate_controller_state populated

---

**Status:** ⏳ **AWAITING DEPLOYMENT**
