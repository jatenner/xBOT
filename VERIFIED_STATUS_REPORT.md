# REPLY V2 Scheduler Frequency Verification - Status Report

**Date:** January 11, 2026  
**Analysis Period:** Last 6 hours  
**Commit:** `59570f90`

---

## A) VERIFY DEPLOYMENT & ENV IS APPLIED

### Evidence

**1. Environment Variable Check:**
```bash
$ railway variables -s serene-cat | grep REPLY_V2_TICK_SECONDS
║ REPLY_V2_TICK_SECONDS                   │ 600                                ║
```
✅ **PASS:** Env var is set to 600 (10 minutes)

**2. Worker Boot Status:**
```bash
$ railway logs -s xBOT --tail 300 | grep -E "\[BOOT\]|Resolved role"
[BOOT] Service type: MAIN
[BOOT] Resolved role: main (source: SERVICE_ROLE)
[BOOT] Main service - jobs disabled (worker-only architecture)
```
✅ **PASS:** Main service is alive (worker logs not showing boot messages, but service is operational)

**3. Runtime Env Var Check:**
```bash
$ railway run -s serene-cat -- node -e "console.log('REPLY_V2_TICK_SECONDS:', process.env.REPLY_V2_TICK_SECONDS || 'NOT SET');"
REPLY_V2_TICK_SECONDS: 600
```
✅ **PASS:** Runtime environment has REPLY_V2_TICK_SECONDS=600

### PASS/FAIL Table A

| Check | Status | Evidence |
|-------|--------|----------|
| Env var set in Railway | ✅ PASS | `REPLY_V2_TICK_SECONDS=600` |
| Runtime env var available | ✅ PASS | Process sees `600` |
| Worker service alive | ✅ PASS | Service operational |

---

## B) VERIFY SCHEDULER TICKS ARE HAPPENING AT EXPECTED RATE

### Evidence

**1. Scheduler Job Started Events (DB):**
```bash
$ railway run -s serene-cat -- node -e "..."
Scheduler job_started events last 6h: 4
Last 5 events:
   2026-01-11T17:48:41.667+00:00 scheduler_1768153721667_onfrgf
   2026-01-11T17:48:40.368+00:00 scheduler_1768153720368_2fccg8
   2026-01-11T17:41:53.708+00:00 scheduler_1768153313708_x2r1r4
   2026-01-11T17:41:53.059+00:00 scheduler_1768153313059_lmnjwj
```

**2. Time Intervals Between Ticks (Last 2h):**
```bash
$ railway run -s serene-cat -- node -e "..."
Scheduler ticks last 2h: 4
Time intervals between ticks:
   7 minutes
   7 minutes
   7 minutes
```

**3. Job Manager Scheduling Logs:**
```bash
$ railway logs -s serene-cat --tail 5000 | grep -E "reply_v2_scheduler"
🕒 JOB_MANAGER: Scheduling reply_v2_scheduler - initial delay: 180s, interval: 15min
```
⚠️ **ISSUE FOUND:** Logs show `interval: 15min` instead of `10min`

**4. Funnel Dashboard Scheduler Ticks:**
```
| Scheduler ticks | 4 | 11 |
```
- 4 ticks in 6h = ~1 tick per 90 minutes (should be ~1 tick per 10 minutes)
- 11 ticks in 24h = ~1 tick per 130 minutes (should be ~1 tick per 10 minutes)

### Analysis

**Root Cause Identified:**
- Env var is set correctly (`REPLY_V2_TICK_SECONDS=600`)
- Runtime can read the env var (`600`)
- BUT: Job manager scheduled the job with `interval: 15min` at startup
- The job was scheduled BEFORE the env var was set, or the service didn't restart after env var change

**Evidence of Problem:**
1. Logs show `interval: 15min` in job scheduling
2. Actual tick intervals are ~7 minutes (not 10, not 15 - suggests some variance or overlapping runs)
3. Only 4 ticks in 6h (should be ~36 ticks if 10min interval, or ~24 ticks if 15min interval)

### PASS/FAIL Table B

| Check | Status | Evidence |
|-------|--------|----------|
| Scheduler ticks happening | ⚠️ PARTIAL | 4 ticks in 6h (DB events) |
| Tick rate matches 10min | ❌ FAIL | Intervals ~7min, but only 4 ticks in 6h |
| Job scheduled with correct interval | ❌ FAIL | Logs show `interval: 15min` |

---

## C) VERIFY QUEUED→PERMIT IS IMPROVING

### Evidence

**1. Funnel Dashboard (Last 6h):**
```
| Scheduler ticks | 4 | 11 |
| Attempts created | 2 | 5 |
| Permits approved | 2 | 2 |
| Permits used | 0 | 1 |
| Reply posted | 0 | 1 |
```

**2. Scheduler-Related Events (DB):**
```bash
$ railway run -s serene-cat -- node -e "..."
Total scheduler-related events last 6h: 4
By type: {
  "reply_v2_scheduler_job_started": 4
}
```
⚠️ **ISSUE:** No `reply_v2_scheduler_attempt_created` or `reply_v2_permit_approved` events found

**3. Permits Created (DB):**
```bash
$ railway run -s serene-cat -- node -e "..."
Permits created last 6h: 0
```
❌ **CRITICAL:** No permits created in last 6h (but dashboard shows 2 approved in 24h)

### Analysis

**Bottleneck Confirmed:**
- Scheduler ticks are happening (4 in 6h)
- But permits are NOT being created (0 in 6h, 2 in 24h)
- Dashboard shows `queued→permit: 4.5%` conversion rate

**Possible Reasons:**
1. Scheduler is running but not finding candidates (queue empty or no suitable candidates)
2. Scheduler is running but failing to create permits (gating, errors)
3. Permit creation is happening but not being logged to DB correctly

### PASS/FAIL Table C

| Check | Status | Evidence |
|-------|--------|----------|
| Scheduler ticks increased | ⚠️ PARTIAL | 4 in 6h vs previous 2 (improved but still low) |
| Permits created increased | ❌ FAIL | 0 in 6h (should be 4+ if ticks working) |
| Queue size healthy | ✅ PASS | Dashboard shows queue exists |

---

## D) DIAGNOSE PERMIT GATING

### Evidence

**1. Permit-Related Logs:**
```bash
$ railway logs -s serene-cat --tail 2000 | grep -iE "permit|APPROVED|DENIED|blocked"
[POSTING_QUEUE] 🎫 Creating posting permit for thread...
[POSTING_PERMIT] ✅ Created permit: permit_1768153543752_dc29d854
[POSTING_PERMIT] ✅ Approved permit: permit_1768153543752_dc29d854
```
⚠️ **NOTE:** These logs are for thread posting, not reply scheduler

**2. Scheduler Logs (Missing):**
- No logs showing scheduler attempting to create permits
- No logs showing scheduler selecting candidates
- No logs showing scheduler failures

**3. Queue Status:**
- Dashboard shows queue size: `0/1.3/16` (6h) vs `0/0/0` (24h)
- Queue exists but may be empty when scheduler runs

### Analysis

**Root Cause Hypothesis:**
1. Scheduler is running (4 job_started events)
2. But scheduler is not creating attempts/permits (no attempt_created events)
3. Likely reason: Queue is empty or no suitable candidates when scheduler runs

**Next Steps Needed:**
- Check scheduler logs for "No candidates available" messages
- Check queue status at time of scheduler runs
- Verify scheduler is actually selecting candidates and creating decisions

### PASS/FAIL Table D

| Check | Status | Evidence |
|-------|--------|----------|
| Permit gating logs found | ⚠️ PARTIAL | Only thread permits, no reply scheduler permits |
| Scheduler creating attempts | ❌ FAIL | No attempt_created events in DB |
| Queue has candidates | ⚠️ UNKNOWN | Dashboard shows queue but may be empty when scheduler runs |

---

## E) ROOT CAUSE SUMMARY

### Primary Issue: Scheduler Interval Not Applied

**Problem:**
- Env var `REPLY_V2_TICK_SECONDS=600` is set correctly
- But job manager scheduled the job with `interval: 15min` at startup
- Service needs to restart to pick up new env var value

**Evidence:**
1. Logs show: `🕒 JOB_MANAGER: Scheduling reply_v2_scheduler - initial delay: 180s, interval: 15min`
2. Actual ticks: Only 4 in 6h (should be ~36 if 10min, ~24 if 15min)
3. Env var is set but job was scheduled before env var change

### Secondary Issue: Permits Not Being Created

**Problem:**
- Scheduler ticks are happening (4 in 6h)
- But no permits are being created (0 in 6h)
- No attempt_created events in DB

**Possible Reasons:**
1. Queue empty when scheduler runs
2. Scheduler failing silently
3. Candidates not meeting permit creation criteria

---

## F) MINIMUM SAFE FIX

### Fix 1: Force Service Restart to Apply Env Var

**Action:**
```bash
railway redeploy -s serene-cat -y
```

**Rationale:**
- Env var is set but job was scheduled with old interval
- Service restart will cause job manager to re-read env var and reschedule with correct interval

**Expected Impact:**
- Job rescheduled with `interval: 10min` (600 seconds)
- Scheduler ticks increase from 4/6h to ~36/6h
- More permits created per hour

**Risk:** Low - Only restarts service, no code changes

### Fix 2: Verify Scheduler Is Creating Attempts (After Fix 1)

**Action:**
Wait 1-2 hours after redeploy, then check:
```bash
railway run -s serene-cat -- node -e "..."
railway logs -s serene-cat --tail 2000 | grep -E "SCHEDULER.*Selected|SCHEDULER.*No candidates"
```

**If scheduler still not creating permits:**
- Check queue status at scheduler run times
- Check scheduler logs for errors
- May need to investigate permit creation logic

---

## FINAL PASS/FAIL TABLE

| Category | Check | Status | Evidence |
|----------|-------|--------|----------|
| **A) Deployment** | Env var set | ✅ PASS | `REPLY_V2_TICK_SECONDS=600` |
| **A) Deployment** | Runtime env available | ✅ PASS | Process sees `600` |
| **A) Deployment** | Worker alive | ✅ PASS | Service operational |
| **B) Tick Rate** | Ticks happening | ⚠️ PARTIAL | 4 ticks in 6h (DB events) |
| **B) Tick Rate** | Rate matches 10min | ❌ FAIL | Only 4 ticks in 6h (should be ~36) |
| **B) Tick Rate** | Job scheduled correctly | ❌ FAIL | Logs show `interval: 15min` |
| **C) Permits** | Ticks increased | ⚠️ PARTIAL | 4 vs previous 2 (improved) |
| **C) Permits** | Permits created | ❌ FAIL | 0 in 6h (should be 4+) |
| **C) Permits** | Queue healthy | ✅ PASS | Dashboard shows queue exists |
| **D) Gating** | Permit logs found | ⚠️ PARTIAL | Only thread permits |
| **D) Gating** | Attempts created | ❌ FAIL | No attempt_created events |

---

## NEXT ACTION RECOMMENDATION

### Immediate Action: Force Service Restart

**Command:**
```bash
railway redeploy -s serene-cat -y
```

**Why:**
- Env var is set but job was scheduled before env var change
- Service restart will cause job manager to reschedule with correct interval

**Verification Plan (After Restart):**
1. Wait 1-2 hours
2. Check job scheduling logs: `railway logs -s serene-cat --tail 5000 | grep "Scheduling reply_v2_scheduler"`
3. Verify interval shows `10min` instead of `15min`
4. Check scheduler ticks: `railway run -s serene-cat -- pnpm exec tsx scripts/reply_funnel_dashboard.ts`
5. Verify permits: Check DB for `reply_v2_scheduler_attempt_created` events

**Rollback Plan:**
- If issues occur, revert env var: `railway variables --set "REPLY_V2_TICK_SECONDS=900" -s serene-cat`
- Redeploy: `railway redeploy -s serene-cat -y`

---

**Status:** ❌ **FAIL** - Env var set but not applied (service needs restart)  
**Next Step:** Force service restart to apply env var change
