# Runtime 72-Hour Start - Configuration Lock Required

**Date:** 2026-02-04  
**Status:** ⚠️ CONFIGURATION LOCK REQUIRED BEFORE START

## Current Configuration Status

### Railway Environment Variables (Current)

**Found:**
- `DRY_RUN=false` ✅ (correct)
- `MAX_REPLIES_PER_HOUR=3` ⚠️ (needs to be locked to 2)
- `POSTS_PER_HOUR=2` ⚠️ (needs to be locked to 0)
- `MAX_POSTS_PER_HOUR=2` ⚠️ (should be 0)
- `CANARY_MODE` ❓ (not found, needs to be set to false)

### Required Lock Configuration

**Set these exactly:**
```bash
MAX_REPLIES_PER_HOUR=2
POSTS_PER_HOUR=0
CANARY_MODE=false
DRY_RUN=false
```

**Remove/Override:**
- `MAX_POSTS_PER_HOUR` (if exists, set to 0)
- `TARGET_POSTS_PER_HOUR_MAX` (if exists, set to 0)
- `TARGET_POSTS_PER_HOUR_MIN` (if exists, set to 0)

## Production Readiness

### ✅ Railway Control-Plane
- **Status:** Deployed
- **SHA:** `1736c5e7`
- **Service:** xBOT

### ⚠️ Database Verification
- **Status:** PARTIAL PASS
- **Issue:** Ramp columns missing (non-blocking for fixed rate execution)
- **Impact:** None - ramp columns only needed for dynamic ramp scheduling

### ✅ Hourly Tick Scheduled
- **Location:** `src/jobs/jobManager.ts` (line 279-291)
- **Schedule:** Every 60 minutes, starts immediately
- **Job:** `hourlyTickJob()` → `executeHourlyTick()`

### ⏳ Executor Daemon
- **Status:** TO BE VERIFIED
- **Service:** serene-cat
- **Check:** `railway logs --service serene-cat | grep -E "EXECUTOR|BOOT"`

## Configuration Lock Commands

**Set Railway Variables:**
```bash
railway variables --service xBOT MAX_REPLIES_PER_HOUR=2
railway variables --service xBOT POSTS_PER_HOUR=0
railway variables --service xBOT CANARY_MODE=false
railway variables --service xBOT DRY_RUN=false
railway variables --service xBOT MAX_POSTS_PER_HOUR=0
```

**Verify Lock:**
```bash
railway variables --service xBOT | grep -E "MAX_REPLIES_PER_HOUR|POSTS_PER_HOUR|CANARY_MODE|DRY_RUN|MAX_POSTS_PER_HOUR"
```

**Expected Output:**
```
MAX_REPLIES_PER_HOUR=2
POSTS_PER_HOUR=0
CANARY_MODE=false
DRY_RUN=false
MAX_POSTS_PER_HOUR=0
```

## Runtime Start Verification

### 1. Verify Configuration Locked
```bash
railway variables --service xBOT | grep -E "MAX_REPLIES_PER_HOUR|POSTS_PER_HOUR|CANARY_MODE|DRY_RUN"
```

### 2. Verify Hourly Tick Active
```bash
railway logs --service xBOT | grep -E "HOURLY_TICK|hourlyTick" | tail -20
```

**Expected:** Logs show hourly tick executing with `target_replies_this_hour=2`.

### 3. Verify Executor Daemon Running
```bash
railway logs --service serene-cat | grep -E "EXECUTOR|BOOT|runtime_sha" | tail -20
```

**Expected:** Executor daemon boot logs, runtime SHA, no errors.

### 4. Verify Autonomous Execution Started
```bash
railway logs --service xBOT | grep -E "Reply.*posted|attemptScheduledReply.*posted" | tail -10
```

**Expected:** Reply execution logs showing successful posts.

## Daily Verification (Read-Only)

**Run once every 24 hours:**
```bash
pnpm exec tsx scripts/ops/dump-24h-kpis.ts
```

**Log results but make NO changes.**

## Success Criteria (After 72 Hours)

1. ✅ Replies posted ≥ 40 total
2. ✅ Zero auth failures
3. ✅ ≤ 1 backoff event
4. ✅ `infra_block_rate_24h` trending downward
5. ✅ Any non-zero follower increase OR profile engagement

## Runtime Summary Template

After 72 hours:

```
RUNTIME SUMMARY (72H)
=====================
Start time: [ISO timestamp]
End time: [ISO timestamp]
replies_posted: [N]
follower_delta: [N] (if available)
infra_block_rate_24h: [0.XX]
backoff_events: [N]
recommendation: HOLD / RAMP / CONTENT PIVOT
```

## Phase Rules

**RUN ONLY:**
- ✅ Allow autonomous execution
- ✅ Monitor logs (read-only)
- ✅ Run daily KPI dump (read-only)
- ❌ NO code changes
- ❌ NO config changes (after lock)
- ❌ NO tuning
- ❌ NO rate increases
- ❌ NO prompt modifications

**Exception:** Only make changes if hard failure blocks execution.

## Pre-Start Checklist

- [ ] Configuration locked (env vars set correctly)
- [ ] Railway control-plane deployed ✅
- [ ] Database verification (partial pass - non-blocking) ⚠️
- [ ] Hourly tick scheduled ✅
- [ ] Executor daemon running (TO BE VERIFIED) ⏳
- [ ] Autonomous execution started (TO BE VERIFIED) ⏳

## Start Confirmation

**Runtime start time:** [TO BE SET AFTER CONFIG LOCK]  
**Configuration locked:** [TO BE CONFIRMED]  
**Executor daemon:** [TO BE VERIFIED]  
**Hourly tick active:** ✅ (scheduled)

## Next Actions

1. ⚠️ **LOCK CONFIGURATION** - Set env vars to required values
2. ⏳ Verify executor daemon running
3. ⏳ Confirm hourly tick executing
4. ⏳ Confirm runtime started
5. ⏳ Monitor for 72 hours (read-only)
6. ⏳ Run daily KPI dump
7. ⏳ After 72h: Provide runtime summary + recommendation
