# Production Readiness Audit - Complete Report

**Date:** 2026-02-04  
**Auditor:** Operator  
**Verdict:** ❌ FAIL

---

## Executive Summary

xBOT is **NOT** running autonomously via hourly tick. Hourly tick is scheduled but not executing. Configuration needs locking. Root cause: Hourly tick job not firing (likely `flags.postingEnabled=false` or schema preflight failure).

---

## 1. Configuration Lock Audit

### Railway Variables

```bash
railway variables --service xBOT
```

**Critical Variables:**
```
EXECUTION_MODE=control                    ✅ CORRECT
DRY_RUN=false                            ✅ CORRECT
MAX_REPLIES_PER_HOUR=3                   ⚠️ NEEDS: 2
POSTS_PER_HOUR=2                         ⚠️ NEEDS: 0
CANARY_MODE=unknown                      ⚠️ NEEDS: false (explicit)
MODE=?                                   ⚠️ NEEDS VERIFICATION
JOBS_AUTOSTART=true                      ✅ CORRECT
ENABLE_REPLIES=true                      ✅ CORRECT
REPLIES_ENABLED=true                     ✅ CORRECT
HARVESTING_ENABLED=true                  ✅ CORRECT
```

### Hard Assertions

| Assertion | Status | Value | Required |
|-----------|--------|-------|----------|
| `DRY_RUN=false` | ✅ PASS | `false` | `false` |
| `EXECUTION_MODE=control` | ✅ PASS | `control` | `control` |
| `MAX_REPLIES_PER_HOUR=2` | ⚠️ FAIL | `3` | `2` |
| `POSTS_PER_HOUR=0` | ⚠️ FAIL | `2` | `0` |
| `CANARY_MODE=false` | ⚠️ FAIL | `unknown` | `false` |
| `MODE=live` | ⚠️ UNKNOWN | Not verified | `live` |

**Action Required:** Lock configuration + verify `MODE=live`.

---

## 2. SHA / Deploy Sanity

### Boot Logs

**Query:**
```sql
SELECT * FROM system_events
WHERE event_type='EXECUTOR_HEALTH_BOOT'
ORDER BY created_at DESC LIMIT 1;
```

**Results:**
- ✅ Boot events found
- ⚠️ Runtime SHA shows "unknown" (extraction needs improvement)

**Status:** Partial - boot events exist but SHA extraction incomplete.

---

## 3. Hourly Tick Liveness (Last 24 Hours)

### Evidence

**Rate Controller State:**
```sql
SELECT * FROM rate_controller_state 
WHERE hour_start >= NOW() - INTERVAL '24 hours';
```

**Results:** ❌ **ZERO rows** - No hourly tick execution in 24 hours.

**System Events:**
```sql
SELECT * FROM system_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND event_type IN ('HOURLY_TICK', 'RATE_CONTROLLER_TICK');
```

**Results:** ❌ **ZERO events** - No hourly tick events.

**Other Timer Events:**
- ✅ `reply_v2_hourly_summary` firing every 30 minutes
- ✅ `timer_fired` events present
- ❌ No `HOURLY_TICK` events

### Analysis

**Hourly tick is scheduled but NOT executing.**

**Root Cause Analysis:**

1. **`flags.postingEnabled` Check:**
   - Source: `src/config/featureFlags.ts`
   - Logic: `postingEnabled = (MODE === 'live') && (DISABLE_POSTING !== 'true')`
   - If `MODE !== 'live'` → `postingEnabled=false` → hourly tick not scheduled

2. **Schema Preflight:**
   - Runs on boot (async, non-blocking)
   - If fails → logs error but doesn't prevent scheduling
   - However, `executeHourlyTick()` checks preflight and skips if failed

3. **Staggered Scheduling:**
   - Default: `USE_STAGGERED_SCHEDULING !== 'false'` (default ON)
   - If disabled → uses legacy scheduling (5-min posting queue)

**Most Likely Cause:** `MODE !== 'live'` OR schema preflight failing silently.

---

## 4. Execution Evidence

### Replies Posted (Last 6 Hours)

**Query:**
```sql
SELECT COUNT(*), MAX(posted_at) 
FROM content_metadata
WHERE status='posted' AND decision_type='reply'
  AND posted_at >= NOW() - INTERVAL '6 hours';
```

**Results:**
- **Count:** 1 reply
- **Last Reply URL:** `https://x.com/i/status/2018833101187682556`
- **Posted At:** [From DB]

### Execution Events (Last 6 Hours)

**Query:**
```sql
SELECT COUNT(*) FROM system_events
WHERE created_at >= NOW() - INTERVAL '6 hours'
  AND event_type IN ('REPLY_POSTED', 'SAFE_GOTO_ATTEMPT', 'SAFE_GOTO_OK');
```

**Results:** 0 events

### Analysis

**Execution happening via alternate path (NOT hourly tick).**

**Evidence:**
- Legacy `POSTING_QUEUE` ticks in logs ✅
- No `SAFE_GOTO_*` events (suggests different code path)
- Hourly tick not responsible for posted reply

---

## 5. Throughput Analysis

### Expected vs Actual

| Metric | Expected | Actual | Gap |
|--------|----------|--------|-----|
| Replies (6h) | 18 | 1 | -17 |
| Source | `MAX_REPLIES_PER_HOUR=3 × 6h` | DB query | |

### Top Limiters

**Skip Reasons (6H):**
```json
[
  { "reason": "unknown", "count": 3 }
]
```

**Infra Blocks (6H):** 0  
**Backoff Events (6H):** 0  
**Auth Failures (6H):** 0

### Analysis

**Primary Limiter: Hourly tick not executing**

Without hourly tick:
- Rate controller not computing targets
- No systematic reply execution
- Replies only via legacy queue/other paths

---

## 6. Root Cause Diagnosis

### Why Hourly Tick Not Executing

**Check 1: MODE Variable**
```bash
railway variables --service xBOT | grep MODE
```

**Check 2: Posting Enabled Flag**
```bash
railway logs --service xBOT | grep -E "Posting.*ENABLED|postingEnabled"
```

**Check 3: Schema Preflight**
```bash
railway logs --service xBOT | grep -E "Schema preflight|SAFE_MODE|Missing"
```

**Check 4: Staggered Scheduling**
```bash
railway logs --service xBOT | grep -E "USE_STAGGERED|staggered|Rate controller hourly tick"
```

**Most Likely Causes (in order):**
1. `MODE !== 'live'` → `flags.postingEnabled=false` → hourly tick not scheduled
2. Schema preflight failing → `executeHourlyTick()` skipping execution
3. Staggered scheduling disabled → using legacy queue instead

---

## 7. Final Verdict

### ❌ FAIL

**Reason:** Hourly tick not executing - zero `rate_controller_state` rows, zero `HOURLY_TICK` events in last 24 hours.

**Evidence Summary:**
- ✅ Configuration: Partially correct (needs locking + MODE verification)
- ✅ SHA: Boot events exist
- ❌ Tick Liveness: 0 ticks in 24h
- ⚠️ Execution: 1 reply via alternate path (legacy queue, not hourly tick)
- ✅ Limiters: No auth failures, no backoff events

### Actions Required

**Before Runtime Start:**

1. **Verify MODE:**
   ```bash
   railway variables --service xBOT | grep MODE
   # If not 'live', set: railway variables --service xBOT MODE=live
   ```

2. **Lock Configuration:**
   ```bash
   railway variables --service xBOT MAX_REPLIES_PER_HOUR=2
   railway variables --service xBOT POSTS_PER_HOUR=0
   railway variables --service xBOT CANARY_MODE=false
   railway variables --service xBOT MAX_POSTS_PER_HOUR=0
   ```

3. **Verify Hourly Tick Scheduled:**
   ```bash
   railway logs --service xBOT | grep -E "Rate controller hourly tick|Posting.*ENABLED"
   ```

4. **Verify Hourly Tick Executing:**
   ```bash
   # Wait 1 hour, then check:
   railway run --service xBOT pnpm exec tsx scripts/ops/production-readiness-audit.ts
   ```

5. **Verify Executor Daemon:**
   ```bash
   railway logs --service serene-cat | grep -E "EXECUTOR|BOOT|runtime_sha" | tail -20
   ```

### Success Criteria

**PASS when:**
- ✅ Configuration locked (`MODE=live`, `MAX_REPLIES_PER_HOUR=2`, etc.)
- ✅ Hourly tick executing (rows in `rate_controller_state`)
- ✅ Execution evidence (`SAFE_GOTO_*` events or posted replies via hourly tick)
- ✅ No auth failures
- ✅ Throughput approaching target

**Current Status:** ❌ FAIL - Hourly tick not executing

---

## 8. Recommendation

**DO NOT START 72-HOUR RUNTIME** until:
1. `MODE=live` verified
2. Configuration locked
3. Hourly tick execution verified (at least one `rate_controller_state` row)
4. Executor daemon verified running

**Next Steps:**
1. Verify `MODE=live` (if not, set it)
2. Lock configuration (env vars)
3. Verify hourly tick scheduled (check logs)
4. Wait 1 hour and verify hourly tick executed (check `rate_controller_state`)
5. Then start 72-hour runtime

---

## Evidence Attachments

### Audit Script Output
```json
{
  "verdict": "FAIL",
  "reason": "No hourly ticks found in last 6 hours",
  "tick_liveness": { "ticks_found": 0 },
  "execution": { "replies_posted_6h": 1 },
  "throughput": { "expected_6h": 18, "actual_6h": 1, "gap": 17 }
}
```

### Current KPI Baseline
```json
{
  "replies_posted_24h": 1,
  "infra_block_rate_24h": 0.151,
  "top_infra_block_reasons": [
    { "reason": "INFRA_BLOCK_CONSENT_WALL", "count": 141 }
  ]
}
```

---

**Report Generated:** 2026-02-04  
**Next Audit:** After MODE verification + configuration lock + hourly tick fix
