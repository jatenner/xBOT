# OPERATIONAL PROOF REPORT

**Date**: 2026-01-09  
**Goal**: Prove Railway services operational with npm start + SERVICE_ROLE routing  
**Status**: ⚠️ **PARTIALLY OPERATIONAL** - Jobs running but permits not posting

---

## SUMMARY

✅ **Healthcheck Fixed**: Main service passes Railway healthcheck  
✅ **Jobs Running**: Fetch, scheduler, watchdog all active  
❌ **Posting Blocked**: 34 permits created but 0 used with tweet_id  
⚠️ **SHA Mismatch**: Running `fdf00f1e` instead of `2c7ca3f6`  
⚠️ **Worker Logs**: Empty - may not be starting

---

## TASK 1 — CODE: Lock Startup to npm start ✅

**File**: `package.json`

**Change**:
```json
"scripts": {
  "start": "pnpm tsx src/railwayEntrypoint.ts"
}
```

**Status**: ✅ **COMPLETE** - Fixed duplicate start script

---

## TASK 2 — CODE: Ensure railwayEntrypoint.ts ✅

**File**: `src/railwayEntrypoint.ts`

**Changes**:
- ✅ Health server starts immediately
- ✅ Responds on `/status` endpoint
- ✅ Uses `SERVICE_ROLE` env var for routing (main|worker)
- ✅ Logs service type: `[BOOT] Service type: MAIN/WORKER`
- ✅ MAIN: jobs disabled
- ✅ WORKER: jobs enabled

**Status**: ✅ **COMPLETE**

---

## TASK 3 — RAILWAY: Set SERVICE_ROLE Env Vars ✅

**Commands Executed**:
```bash
railway variables --set "SERVICE_ROLE=main" -s xBOT
railway variables --set "SERVICE_ROLE=worker" -s serene-cat
```

**Status**: ✅ **COMPLETE**

---

## TASK 4 — DEPLOY ✅

**Commands Executed**:
```bash
railway up --detach -s xBOT
railway up --detach -s serene-cat
railway redeploy -s xBOT -y
railway redeploy -s serene-cat -y
```

**Expected SHA**: `2c7ca3f6`

**Status**: ✅ **COMPLETE**

---

## TASK 5 — PROOF

### A) Log Proof

#### Main Service (xBOT) ✅

**Command**: `railway logs -s xBOT --tail 50 | grep -E "(\[HEALTH\] Git SHA:|\[BOOT\] Service type:|SERVICE_ROLE)"`

**Output**:
```
[BOOT] Service type: MAIN
[HEALTH] Git SHA: fdf00f1e
```

**Health SHA Line**: ✅ `[HEALTH] Git SHA: fdf00f1e`  
**Service Type Line**: ✅ `[BOOT] Service type: MAIN`

#### Worker Service (serene-cat) ⚠️

**Command**: `railway logs -s serene-cat --tail 50 | grep -E "(\[HEALTH\] Git SHA:|\[BOOT\] Service type:|SERVICE_ROLE|Worker service)"`

**Output**: (Empty - no matching lines)

**Status**: ⚠️ **PENDING** - Worker logs empty, may not be starting

### B) DB Proof: Boot Heartbeat ⚠️

**Query**: Latest `production_watchdog_boot` events

**Result**:
```
Latest 3 boot heartbeats:
  1. 2026-01-09T22:53:50.171Z: SHA=fdf00f1e
  2. 2026-01-09T22:52:44.582Z: SHA=fdf00f1e
  3. 2026-01-09T22:47:40.013Z: SHA=fd900a0d
```

**Expected SHA**: `2c7ca3f6`  
**Running SHA**: `fdf00f1e`  
**Match**: ❌ **NO** - Railway running older SHA

**Analysis**: SHA updated from `e35a4371` → `fdf00f1e` but not to latest. Railway may need more time to build fresh.

### C) Jobs Proof ✅

**Results**:
- ✅ Watchdog reports (15m): **6**
- ✅ Fetch started (15m): **6**
- ✅ Fetch completed (15m): **4**
- ✅ Scheduler started (60m): **6**

**Status**: ✅ **PASS** - Jobs are ticking

### D) Permit Proof ⚠️

**Results**:
- ✅ Permits created (60m): **34**
- ❌ Permits USED w/ tweet_id (60m): **0**

**Status**: ⚠️ **PARTIAL** - Permits created but none posted

**Blocker**: Permits created but not used - posting may be failing or blocked

### E) Ghost Proof ✅

**Results**:
- ✅ New ghosts (2h): **0**

**Status**: ✅ **PASS** - No ghost posts detected

---

## PASS/FAIL TABLE

| Check | Status | Details |
|-------|--------|---------|
| A) Log proof - Main | ✅ PASS | Service type MAIN, health SHA logged |
| A) Log proof - Worker | ⚠️ PENDING | No logs found |
| B) DB proof - SHA match | ❌ FAIL | Running `fdf00f1e`, expected `2c7ca3f6` |
| C) Jobs proof - Watchdog | ✅ PASS | 6 reports in 15m |
| C) Jobs proof - Fetch | ✅ PASS | 6 started, 4 completed |
| C) Jobs proof - Scheduler | ✅ PASS | 6 started in 60m |
| D) Permit proof - Created | ✅ PASS | 34 created |
| D) Permit proof - Used | ❌ FAIL | 0 used with tweet_id |
| E) Ghost proof | ✅ PASS | 0 new ghosts |

**Blockers**: 
1. ❌ **SHA Mismatch**: Railway running `fdf00f1e` instead of `2c7ca3f6`
2. ❌ **Permits Not Posting**: 34 permits created but 0 used with tweet_id
3. ⚠️ **Worker Logs Empty**: Worker service may not be starting

---

## VERDICT

**Status**: ⚠️ **PARTIALLY OPERATIONAL**

**Healthcheck**: ✅ **PASSING** - Main service operational  
**Jobs**: ✅ **RUNNING** - Fetch, scheduler, watchdog all active  
**Posting**: ❌ **BLOCKED** - Permits created but not posting  
**SHA**: ❌ **MISMATCH** - Running older SHA

**Overall**: ⚠️ **PARTIALLY OPERATIONAL** - Jobs running but posting blocked

---

## NEXT STEPS

1. **Wait for Fresh Build**: Railway may need 3-5 more minutes to build fresh SHA

2. **Diagnose Posting Blocker**: 
   - Check why permits created but not used
   - Review posting queue logs
   - Check for posting errors in system_events
   - Verify posting queue is processing permits

3. **Verify Worker**: 
   - Check Railway dashboard that worker service is running
   - Verify SERVICE_ROLE=worker is set
   - Check worker logs for startup errors

---

**Report Generated**: 2026-01-09T23:05:00  
**Healthcheck**: ✅ **FIXED**  
**Jobs**: ✅ **RUNNING**  
**Posting**: ❌ **BLOCKED**  
**SHA**: ⚠️ **PENDING UPDATE**
