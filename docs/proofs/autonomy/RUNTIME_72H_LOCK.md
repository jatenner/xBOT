# Runtime 72-Hour Lock - Autonomous Execution

**Date:** 2026-02-04  
**Status:** 🔒 CONFIGURATION LOCKED

## Objective

Transition xBOT from build mode to runtime data collection. Run autonomously for 72 hours with no tuning, no new features, no refactoring.

## Production Readiness Verification

### 1. Executor Daemon Status

**Command:**
```bash
# Check executor daemon logs
railway logs --service serene-cat | grep -E "EXECUTOR|BOOT|runtime_sha" | tail -20
```

**Expected:** Executor daemon running, boot logs show runtime SHA, no errors.

### 2. Railway Control-Plane Status

**Command:**
```bash
railway status
git log --oneline -1
```

**Expected:** 
- Railway service `xBOT` deployed
- Latest commit SHA matches local

### 3. Database Verification

**Command:**
```bash
pnpm run db:verify
```

**Expected:** All verifications PASS (tables, columns, functions, migrations)

## Runtime Configuration Lock

**Locked Environment Variables:**

```bash
MAX_REPLIES_PER_HOUR=2
POSTS_PER_HOUR=0
CANARY_MODE=false
DRY_RUN=false
```

**Do NOT modify:**
- Rate parameters
- Ramp schedules
- Safety thresholds
- Prompts
- Reply styles
- Learning logic

## Autonomous Execution Status

### Hourly Tick Verification

**Command:**
```bash
railway logs --service xBOT | grep -E "hourlyTick|RATE_CONTROLLER" | tail -20
```

**Expected:** Hourly tick executing, targets computed, replies attempted.

### Execution Mode

- ✅ Replies: Automatic (via hourly tick)
- ✅ Posts: Disabled (`POSTS_PER_HOUR=0`)
- ✅ Canary Mode: Disabled (`CANARY_MODE=false`)
- ✅ Dry Run: Disabled (`DRY_RUN=false`)

## Daily Verification (Read-Only)

**Command (run once every 24 hours):**
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

## Verification Checklist

- [ ] Executor daemon running and healthy
- [ ] Railway control-plane deployed with latest SHA
- [ ] `db:verify` PASS
- [ ] Configuration locked (env vars set)
- [ ] Hourly tick active
- [ ] Autonomous execution started
- [ ] 72-hour timer started

## Next Steps

1. Verify all checklist items ✅
2. Confirm runtime started
3. Monitor for 72 hours (read-only)
4. Run daily KPI dump
5. After 72h: Provide runtime summary + recommendation
