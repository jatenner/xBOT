# Runtime 72-Hour Status - Autonomous Execution

**Date:** 2026-02-04  
**Status:** 🔒 CONFIGURATION LOCKED | ⏳ AWAITING START CONFIRMATION

## Production Readiness Verification

### ✅ Railway Control-Plane

**Status:** Deployed
```bash
railway status
# Project: XBOT
# Environment: production
# Service: xBOT
```

**Latest SHA:** `1736c5e7` (docs: Add GO_LIVE summary with commands and verdict)

### ⚠️ Database Verification

**Status:** PARTIAL PASS (non-blocking)

**Command:**
```bash
pnpm run db:verify
```

**Results:**
- ✅ All tables exist
- ✅ All required columns exist
- ✅ RPC functions exist
- ⚠️ Ramp columns missing (non-blocking for runtime)

**Ramp Columns Status:**
- `ramp_reason` - Missing (not required for fixed rate execution)
- `hours_since_start` - Missing (not required for fixed rate execution)
- `has_24h_stability` - Missing (not required for fixed rate execution)
- `success_rate_6h` - Missing (not required for fixed rate execution)

**Impact:** Ramp columns are only needed for dynamic ramp scheduling. Since we're locking at `MAX_REPLIES_PER_HOUR=2` (no ramp), these columns are not required for execution.

### ✅ Hourly Tick Scheduled

**Status:** Active

**Location:** `src/jobs/jobManager.ts` (line 279-291)

**Schedule:**
- Runs every 60 minutes
- Starts immediately (offset: 0)
- Job name: `hourly_tick`

**Verification:**
```bash
railway logs --service xBOT | grep -E "hourlyTick|HOURLY_TICK" | tail -20
```

**Expected:** Logs show hourly tick executing with targets computed.

### ⏳ Executor Daemon Status

**Status:** TO BE VERIFIED

**Verification Commands:**
```bash
# Check executor logs
railway logs --service serene-cat | grep -E "EXECUTOR|BOOT|runtime_sha" | tail -20

# Or check local executor (if running)
tail -f ./.runner-profile/executor.log | grep -E "EXECUTOR|BOOT"
```

**Expected:** Executor daemon running, boot logs show runtime SHA, no errors.

## Runtime Configuration Lock

### 🔒 Locked Environment Variables

**Required Settings:**
```bash
MAX_REPLIES_PER_HOUR=2
POSTS_PER_HOUR=0
CANARY_MODE=false
DRY_RUN=false
```

**Verification:**
```bash
railway variables --service xBOT | grep -E "MAX_REPLIES_PER_HOUR|POSTS_PER_HOUR|CANARY_MODE|DRY_RUN"
```

**Do NOT modify:**
- Rate parameters
- Ramp schedules
- Safety thresholds
- Prompts
- Reply styles
- Learning logic

### Execution Mode

- ✅ Replies: Automatic (via hourly tick, `MAX_REPLIES_PER_HOUR=2`)
- ✅ Posts: Disabled (`POSTS_PER_HOUR=0`)
- ✅ Canary Mode: Disabled (`CANARY_MODE=false`)
- ✅ Dry Run: Disabled (`DRY_RUN=false`)

## Autonomous Execution Status

### Hourly Tick Flow

1. **Every hour:** `hourlyTickJob()` executes
2. **Compute targets:** `computeRateTargets()` returns `target_replies_this_hour=2`
3. **Execute replies:** Retry loop attempts up to 6 candidates (3x target) until 2 posted
4. **Log state:** Updates `rate_controller_state` with executed counts

### Verification Commands

```bash
# Check hourly tick execution
railway logs --service xBOT | grep -E "HOURLY_TICK|hourlyTick" | tail -30

# Check reply execution
railway logs --service xBOT | grep -E "Reply.*posted|attemptScheduledReply" | tail -20

# Check rate controller state
railway run --service xBOT pnpm exec tsx -e "
import('dotenv/config').then(async () => {
  const { getSupabaseClient } = await import('./src/db/index.js');
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('rate_controller_state')
    .select('*')
    .order('hour_start', { ascending: false })
    .limit(5);
  console.log(JSON.stringify(data, null, 2));
}).catch(console.error);
"
```

## Daily Verification (Read-Only)

**Command (run once every 24 hours):**
```bash
pnpm exec tsx scripts/ops/dump-24h-kpis.ts
```

**Log results but make NO changes.**

## Success Criteria (After 72 Hours)

1. ✅ Replies posted ≥ 40 total (2/hour × 20 active hours = 40 minimum)
2. ✅ Zero auth failures
3. ✅ ≤ 1 backoff event
4. ✅ `infra_block_rate_24h` trending downward
5. ✅ Any non-zero follower increase OR profile engagement

## Runtime Summary Template

After 72 hours, provide:

```
RUNTIME SUMMARY (72H)
=====================
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
- ❌ NO config changes
- ❌ NO tuning
- ❌ NO rate increases
- ❌ NO prompt modifications

**Exception:** Only make changes if hard failure blocks execution.

## Pre-Start Checklist

- [ ] Railway control-plane deployed ✅
- [ ] Latest SHA verified ✅
- [ ] Database verification (partial pass - ramp columns non-blocking) ⚠️
- [ ] Hourly tick scheduled ✅
- [ ] Executor daemon running (TO BE VERIFIED) ⏳
- [ ] Configuration locked (TO BE VERIFIED) ⏳
- [ ] Autonomous execution started (TO BE VERIFIED) ⏳

## Next Steps

1. ✅ Verify Railway deployment
2. ✅ Verify hourly tick scheduled
3. ⏳ Verify executor daemon running
4. ⏳ Verify configuration locked (env vars)
5. ⏳ Confirm runtime started
6. ⏳ Monitor for 72 hours (read-only)
7. ⏳ Run daily KPI dump
8. ⏳ After 72h: Provide runtime summary + recommendation

## Start Confirmation

**Runtime start time:** [TO BE SET]  
**Configuration locked:** [TO BE CONFIRMED]  
**Executor daemon:** [TO BE VERIFIED]  
**Hourly tick active:** ✅ (scheduled in jobManager)
