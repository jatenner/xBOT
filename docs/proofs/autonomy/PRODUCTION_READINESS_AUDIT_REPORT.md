# Production Readiness Audit Report

**Date:** 2026-02-04  
**Auditor:** Operator  
**Status:** ❌ FAIL

## Executive Summary

xBOT is **NOT** running autonomously in production. Hourly tick is scheduled but not executing. Configuration needs locking before 72-hour runtime can begin.

## 1. Configuration Lock Audit

### Railway Variables (Current)

```
EXECUTION_MODE=control                    ✅ (correct)
DRY_RUN=false                            ✅ (correct)
MAX_REPLIES_PER_HOUR=3                   ⚠️ (needs: 2)
POSTS_PER_HOUR=2                         ⚠️ (needs: 0)
CANARY_MODE=unknown                      ⚠️ (needs: false)
REPLIES_ENABLED=true                     ✅ (correct)
HARVESTING_ENABLED=true                  ✅ (correct)
DATABASE_URL=set                         ✅ (correct)
TWITTER_SESSION_B64=set                  ✅ (correct)
```

### Hard Assertions

- ✅ `DRY_RUN=false` (real posting enabled)
- ✅ `EXECUTION_MODE=control` (Railway control-plane)
- ⚠️ `MAX_REPLIES_PER_HOUR=3` (should be 2 for runtime lock)
- ⚠️ `POSTS_PER_HOUR=2` (should be 0 for runtime lock)
- ⚠️ `CANARY_MODE` not set (should be explicitly false)

**Action Required:** Lock configuration before runtime start.

## 2. SHA / Deploy Sanity

### Boot Logs

- ✅ Boot events found in `system_events` (`EXECUTOR_HEALTH_BOOT`)
- ⚠️ Runtime SHA not extracted from boot logs (shows "unknown")

**Status:** Partial - boot events exist but SHA extraction needs verification.

## 3. Hourly Tick Liveness

### Evidence

**Rate Controller State (24H):**
- ❌ **ZERO rows** in `rate_controller_state` table for last 24 hours
- ❌ **ZERO** `HOURLY_TICK` or `RATE_CONTROLLER_TICK` events in `system_events`

**Other Timer Events:**
- ✅ `reply_v2_hourly_summary` timer firing every 30 minutes (not hourly tick)
- ✅ Worker alive heartbeat logs present

### Analysis

**Hourly tick is scheduled but NOT executing.**

**Possible Causes:**
1. `flags.postingEnabled` is false (jobs not started)
2. `JOBS_AUTOSTART` is false (job scheduling disabled)
3. Schema preflight failing (safe mode activated)
4. Hourly tick job failing silently

**Evidence:**
- No `rate_controller_state` rows = hourly tick never executed
- No `HOURLY_TICK` events = job not firing or failing silently
- Worker logs show `POSTING_QUEUE` ticks but no hourly tick logs

## 4. Execution Evidence

### Replies Posted (6H)

- **Count:** 1 reply posted in last 6 hours
- **Last Reply URL:** `https://x.com/i/status/2018833101187682556`
- **Timestamp:** [From DB query]

### Execution Events (6H)

- **Count:** 0 execution-related events (`REPLY_POSTED`, `SAFE_GOTO_ATTEMPT`, etc.)

### Analysis

**Execution is happening but NOT via hourly tick.**

The single reply was likely posted via:
- Legacy posting queue (if enabled)
- Manual execution
- Reply V2 job (independent of hourly tick)

**Evidence:** No `SAFE_GOTO_*` events suggests execution may be via different path or events not being logged.

## 5. Throughput Analysis

### Expected vs Actual

- **Expected (6h):** 18 replies (`MAX_REPLIES_PER_HOUR=3 × 6 hours`)
- **Actual (6h):** 1 reply
- **Gap:** 17 replies missing

### Top Limiters

**Skip Reasons (6H):**
- `unknown`: 3 occurrences

**Infra Blocks (6H):**
- None found in last 6 hours

**Backoff Events (6H):**
- 0 events

**Auth Failures (6H):**
- 0 events

### Analysis

**Primary Limiter: Hourly tick not executing**

Without hourly tick:
- Rate controller not computing targets
- No systematic reply execution
- Replies only happen via other paths (legacy queue, manual)

## 6. Root Cause Diagnosis

### Why Hourly Tick Not Executing

**Check 1: Job Manager Startup**
```bash
railway logs --service xBOT | grep -E "JOB_MANAGER|postingEnabled|enableJobScheduling"
```

**Check 2: Schema Preflight**
```bash
railway logs --service xBOT | grep -E "Schema preflight|SAFE_MODE|Missing"
```

**Check 3: JOBS_AUTOSTART**
```bash
railway variables --service xBOT | grep JOBS_AUTOSTART
```

**Most Likely Cause:** `flags.postingEnabled=false` or `JOBS_AUTOSTART=false` preventing job scheduling.

## 7. Final Verdict

### ❌ FAIL

**Reason:** Hourly tick not executing - no `rate_controller_state` rows, no `HOURLY_TICK` events.

**Evidence:**
- ✅ Configuration partially correct (needs locking)
- ✅ Executor daemon running (worker alive)
- ❌ Hourly tick not firing (0 ticks in 24h)
- ⚠️ Execution happening via alternate path (1 reply, but not via hourly tick)

### Actions Required

**Before Runtime Start:**

1. **Lock Configuration:**
   ```bash
   railway variables --service xBOT MAX_REPLIES_PER_HOUR=2
   railway variables --service xBOT POSTS_PER_HOUR=0
   railway variables --service xBOT CANARY_MODE=false
   railway variables --service xBOT MAX_POSTS_PER_HOUR=0
   ```

2. **Verify Job Manager Started:**
   ```bash
   railway logs --service xBOT | grep -E "JOB_MANAGER.*Job scheduling ENABLED|Rate controller hourly tick enabled"
   ```

3. **Verify Hourly Tick Executing:**
   ```bash
   # Wait 1 hour, then check:
   railway run --service xBOT pnpm exec tsx -e "
   import('dotenv/config').then(async () => {
     const { Client } = await import('pg');
     const client = new Client({ connectionString: process.env.DATABASE_URL });
     await client.connect();
     const { rows } = await client.query('SELECT * FROM rate_controller_state ORDER BY hour_start DESC LIMIT 1');
     console.log(JSON.stringify(rows, null, 2));
     await client.end();
   });
   "
   ```

4. **Verify Executor Daemon:**
   ```bash
   railway logs --service serene-cat | grep -E "EXECUTOR|BOOT|runtime_sha" | tail -20
   ```

### Success Criteria

**PASS when:**
- ✅ Configuration locked
- ✅ Hourly tick executing (rows in `rate_controller_state`)
- ✅ Execution evidence (`SAFE_GOTO_*` events or posted replies)
- ✅ No auth failures
- ✅ Throughput approaching target

**Current Status:** ❌ FAIL - Hourly tick not executing

## 8. Recommendation

**DO NOT START 72-HOUR RUNTIME** until:
1. Configuration is locked
2. Hourly tick is verified executing
3. At least one successful hourly tick cycle completes

**Next Steps:**
1. Fix hourly tick execution issue
2. Lock configuration
3. Verify one full hourly tick cycle
4. Then start 72-hour runtime
