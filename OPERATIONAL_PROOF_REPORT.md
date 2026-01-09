# OPERATIONAL PROOF REPORT

**Date**: 2026-01-09  
**Goal**: Prove Railway services operational with npm start + SERVICE_ROLE routing  
**Status**: 🔄 **VERIFYING**

---

## TASK 1 — CODE: Lock Startup to npm start ✅

**File**: `package.json`

**Change**:
```json
"scripts": {
  "start": "pnpm tsx src/railwayEntrypoint.ts"
}
```

**Status**: ✅ **COMPLETE**

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
railway variables set SERVICE_ROLE=main -s xBOT
railway variables set SERVICE_ROLE=worker -s serene-cat
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

**Expected SHA**: [Will be populated]

**Status**: ✅ **COMPLETE**

---

## TASK 5 — PROOF

### A) Log Proof

#### Main Service (xBOT)

**Command**: `railway logs -s xBOT --tail 200 | grep -E "(\[HEALTH\] Git SHA:|\[BOOT\] Service type:)"`

**Output**: [Will be populated]

**Health SHA Line**: [Will be populated]  
**Service Type Line**: [Will be populated]

#### Worker Service (serene-cat)

**Command**: `railway logs -s serene-cat --tail 200 | grep -E "(\[HEALTH\] Git SHA:|\[BOOT\] Service type:)"`

**Output**: [Will be populated]

**Health SHA Line**: [Will be populated]  
**Service Type Line**: [Will be populated]

### B) DB Proof: Boot Heartbeat

**Query**: Latest `production_watchdog_boot` events

**Result**: [Will be populated]

**Expected SHA**: [Will be populated]  
**Running SHA**: [Will be populated]  
**Match**: [Will be populated]

### C) Jobs Proof

**Results**: [Will be populated]

- Watchdog reports (15m): [Will be populated]
- Fetch started (15m): [Will be populated]
- Fetch completed (15m): [Will be populated]
- Scheduler started (60m): [Will be populated]

### D) Permit Proof

**Results**: [Will be populated]

- Permits created (60m): [Will be populated]
- Permits USED w/ tweet_id (60m): [Will be populated]

### E) Ghost Proof

**Results**: [Will be populated]

- New ghosts (2h): [Will be populated]

---

## PASS/FAIL TABLE

| Check | Status | Details |
|-------|--------|---------|
| A) Log proof - Main | [ ] | [Will be populated] |
| A) Log proof - Worker | [ ] | [Will be populated] |
| B) DB proof - SHA match | [ ] | [Will be populated] |
| C) Jobs proof - Watchdog | [ ] | [Will be populated] |
| C) Jobs proof - Fetch | [ ] | [Will be populated] |
| C) Jobs proof - Scheduler | [ ] | [Will be populated] |
| D) Permit proof - Created | [ ] | [Will be populated] |
| D) Permit proof - Used | [ ] | [Will be populated] |
| E) Ghost proof | [ ] | [Will be populated] |

**Blockers**: [Will be populated]

---

## VERDICT

**Status**: 🔄 **VERIFYING**

**Expected SHA**: [Will be populated]  
**Running SHA**: [Will be populated]  
**SHA Match**: [Will be populated]

**Overall**: [Will be populated]

---

**Report Generated**: 2026-01-09T21:20:00

