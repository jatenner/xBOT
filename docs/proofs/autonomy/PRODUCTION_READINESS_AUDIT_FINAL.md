# Production Readiness Audit - Final Report

**Date:** 2026-02-04  
**Auditor:** Operator  
**Verdict:** ❌ FAIL

---

## Executive Summary

xBOT is **NOT** running autonomously via hourly tick. Configuration needs locking, and hourly tick execution must be verified before 72-hour runtime can begin.

---

## 1. Configuration Lock Audit

### Railway Variables

```bash
railway variables --service xBOT
```

**Results:**
```
EXECUTION_MODE=control                    ✅ CORRECT
DRY_RUN=false                            ✅ CORRECT
MAX_REPLIES_PER_HOUR=3                   ⚠️ NEEDS: 2
POSTS_PER_HOUR=2                         ⚠️ NEEDS: 0
CANARY_MODE=unknown                      ⚠️ NEEDS: false (explicit)
REPLIES_ENABLED=true                     ✅ CORRECT
HARVESTING_ENABLED=true                  ✅ CORRECT
JOBS_AUTOSTART=true                      ✅ CORRECT
ENABLE_REPLIES=true                      ✅ CORRECT
DATABASE_URL=set                         ✅ CORRECT
TWITTER_SESSION_B64=set                  ✅ CORRECT
```

### Hard Assertions

| Assertion | Status | Value |
|-----------|--------|-------|
| `DRY_RUN=false` | ✅ PASS | `false` |
| `EXECUTION_MODE=control` | ✅ PASS | `control` |
| `MAX_REPLIES_PER_HOUR=2` | ⚠️ FAIL | `3` (needs lock to 2) |
| `POSTS_PER_HOUR=0` | ⚠️ FAIL | `2` (needs lock to 0) |
| `CANARY_MODE=false` | ⚠️ FAIL | `unknown` (needs explicit false) |

**Action Required:** Lock configuration before runtime start.

---

## 2. SHA / Deploy Sanity

### Boot Logs Analysis

**Command:**
```bash
railway logs --service xBOT --lines 80 | grep -E "BOOT|sha=|runtime_sha|MIGRATIONS|jobManager|hourly"
```

**Results:**
- ⚠️ No boot logs found in recent logs (may be in older logs)
- ✅ Boot events exist in `system_events` (`EXECUTOR_HEALTH_BOOT`)
- ⚠️ Runtime SHA extraction shows "unknown" (needs verification)

**Status:** Partial - boot events exist but SHA verification incomplete.

---

## 3. Hourly Tick Liveness (Last 6 Hours)

### Evidence Queries

**Rate Controller State:**
```sql
SELECT * FROM rate_controller_state 
WHERE hour_start >= NOW() - INTERVAL '6 hours'
ORDER BY hour_start DESC;
```

**Results:** ❌ **ZERO rows** - No hourly tick execution in last 6 hours.

**System Events:**
```sql
SELECT * FROM system_events
WHERE created_at >= NOW() - INTERVAL '6 hours'
  AND event_type IN ('HOURLY_TICK', 'RATE_CONTROLLER_TICK');
```

**Results:** ❌ **ZERO events** - No hourly tick events logged.

**Other Timer Events:**
- ✅ `reply_v2_hourly_summary` firing every 30 minutes
- ✅ `timer_fired` events present
- ❌ No `HOURLY_TICK` or `RATE_CONTROLLER_TICK` events

### Analysis

**Hourly tick is scheduled but NOT executing.**

**Possible Root Causes:**
1. `flags.postingEnabled=false` (posting jobs disabled)
2. Schema preflight failing (safe mode activated)
3. Hourly tick job failing silently (no error logs)
4. Staggered scheduling disabled (`USE_STAGGERED_SCHEDULING=false`)

**Evidence:**
- `JOBS_AUTOSTART=true` ✅
- `ENABLE_REPLIES=true` ✅
- No `rate_controller_state` rows ❌
- No hourly tick logs ❌
- Legacy `POSTING_QUEUE` ticks present ✅ (suggests alternate path)

---

## 4. Execution Evidence

### Replies Posted (Last 6 Hours)

**Query:**
```sql
SELECT COUNT(*) FROM content_metadata
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
  AND event_type IN ('REPLY_POSTED', 'SAFE_GOTO_ATTEMPT', 'SAFE_GOTO_OK', 
                     'CONSENT_WALL_DISMISSED', 'EXECUTOR_REPLY_POSTED');
```

**Results:**
- **Count:** 0 events

### Analysis

**Execution is happening but NOT via hourly tick.**

The single reply was likely posted via:
- Legacy posting queue (5-minute interval)
- Reply V2 job (independent scheduling)
- Manual execution

**Evidence:**
- No `SAFE_GOTO_*` events suggests execution via different code path
- Legacy `POSTING_QUEUE` ticks in logs confirm alternate execution path
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

**Infra Blocks (6H):**
```json
[]
```

**Backoff Events (6H):** 0  
**Auth Failures (6H):** 0

### Analysis

**Primary Limiter: Hourly tick not executing**

Without hourly tick:
- Rate controller not computing targets
- No systematic reply execution via rate controller
- Replies only via legacy queue/other paths

**Secondary Limiters:**
- Unknown skip reasons (3 occurrences) - needs investigation
- No infra blocks in last 6h (good sign)

---

## 6. Root Cause Diagnosis

### Why Hourly Tick Not Executing

**Check 1: Job Manager Flags**
```bash
railway logs --service xBOT | grep -E "Posting.*ENABLED|postingEnabled"
```

**Check 2: Schema Preflight**
```bash
railway logs --service xBOT | grep -E "Schema preflight|SAFE_MODE|Missing"
```

**Check 3: Staggered Scheduling**
```bash
railway logs --service xBOT | grep -E "USE_STAGGERED|staggered|Rate controller hourly tick"
```

**Most Likely Cause:** 
- `flags.postingEnabled=false` OR
- Schema preflight failing (safe mode) OR
- Staggered scheduling disabled

**Evidence:**
- `JOBS_AUTOSTART=true` ✅
- Legacy posting queue running ✅
- Hourly tick scheduled but not executing ❌

---

## 7. Final Verdict

### ❌ FAIL

**Reason:** Hourly tick not executing - no `rate_controller_state` rows, no `HOURLY_TICK` events in last 24 hours.

**Evidence Summary:**
- ✅ Configuration: Partially correct (needs locking)
- ✅ SHA: Boot events exist (SHA extraction needs verification)
- ❌ Tick Liveness: 0 ticks in 24h
- ⚠️ Execution: 1 reply via alternate path (not hourly tick)
- ✅ Limiters: No auth failures, no backoff events

### Actions Required

**Before Runtime Start:**

1. **Lock Configuration:**
   ```bash
   railway variables --service xBOT MAX_REPLIES_PER_HOUR=2
   railway variables --service xBOT POSTS_PER_HOUR=0
   railway variables --service xBOT CANARY_MODE=false
   railway variables --service xBOT MAX_POSTS_PER_HOUR=0
   ```

2. **Diagnose Hourly Tick Issue:**
   ```bash
   # Check job manager startup logs
   railway logs --service xBOT | grep -E "JOB_MANAGER.*startJobs|Posting.*ENABLED|Rate controller hourly tick|Schema preflight"
   
   # Check for safe mode
   railway logs --service xBOT | grep -E "SAFE_MODE|Schema preflight failed"
   ```

3. **Verify Hourly Tick Executing:**
   ```bash
   # Wait 1 hour, then check:
   railway run --service xBOT pnpm exec tsx scripts/ops/production-readiness-audit.ts
   ```

4. **Verify Executor Daemon:**
   ```bash
   railway logs --service serene-cat | grep -E "EXECUTOR|BOOT|runtime_sha" | tail -20
   ```

### Success Criteria

**PASS when:**
- ✅ Configuration locked
- ✅ Hourly tick executing (rows in `rate_controller_state`)
- ✅ Execution evidence (`SAFE_GOTO_*` events or posted replies via hourly tick)
- ✅ No auth failures
- ✅ Throughput approaching target

**Current Status:** ❌ FAIL - Hourly tick not executing

---

## 8. Recommendation

**DO NOT START 72-HOUR RUNTIME** until:
1. Configuration is locked
2. Hourly tick execution is verified
3. At least one successful hourly tick cycle completes with `rate_controller_state` row

**Next Steps:**
1. Diagnose why hourly tick not executing
2. Fix root cause (likely `flags.postingEnabled` or schema preflight)
3. Lock configuration
4. Verify one full hourly tick cycle
5. Then start 72-hour runtime

---

## Evidence Attachments

### Current KPI Baseline
```json
{
  "replies_posted_24h": 1,
  "infra_block_rate_24h": 0.151,
  "infra_blocks_24h": 141,
  "top_infra_block_reasons": [
    { "reason": "INFRA_BLOCK_CONSENT_WALL", "count": 141 }
  ]
}
```

### Last Reply Posted
- **URL:** `https://x.com/i/status/2018833101187682556`
- **Posted At:** [From DB query]
- **Source:** Likely legacy posting queue (not hourly tick)

---

**Report Generated:** 2026-02-04  
**Next Audit:** After configuration lock + hourly tick fix
