# Production Re-enablement Summary

**Date:** 2026-01-08  
**Target:** 2 posts/hour + 4 replies/hour with full persistence + metrics + learning

---

## Changes Made

### 1. Configurable Harvest Interval

**Files Changed:**
- `src/config/config.ts`
  - Added `JOBS_HARVEST_INTERVAL_MIN` config (default: 15 min)
  - Added to env var parsing and config export

- `src/jobs/jobManager.ts`
  - Replaced hardcoded `120 * MINUTE` with `config.JOBS_HARVEST_INTERVAL_MIN * MINUTE`
  - Updated log message to show configurable interval

**Impact:** Harvest interval is now configurable via `JOBS_HARVEST_INTERVAL_MIN` env var (default: 15 min for production)

---

### 2. Quota Enforcement (Ramp Mode Level 3)

**Current Implementation:**
- Ramp Mode Level 3 already enforces:
  - 2 posts/hour (`src/utils/rampMode.ts:44`)
  - 4 replies/hour (`src/utils/rampMode.ts:44`)
- Quotas applied in:
  - `src/jobs/postingQueue.ts:1321` (via `getEffectiveQuotas()`)
  - `src/jobs/replyJob.ts:44` (via ramp mode check)

**No changes needed** - Ramp Mode Level 3 already enforces quotas correctly.

---

### 3. Relevance Score Guardrail

**Files Changed:**
- `src/ai/seedAccountHarvester.ts`
  - Added guardrail log after harvest summary
  - Checks percentage of stored opportunities with `relevance_score=0`
  - Warns if > 50% have zero relevance
  - Logs: `[SEED_HARVEST] ⚠️ GUARDRAIL: X/Y (Z%) stored opportunities have relevance_score=0`

**Impact:** Early detection of scoring issues during harvest runs

---

### 4. Production Verification Checklist

**Files Created:**
- `docs/GO_LIVE_CHECKLIST.md`
  - Phase A: Harvest only (validate storage + scoring)
  - Phase B: Replies enabled (validate DB records + metrics)
  - Phase C: Full production (validate quotas + no ghost posts)
  - Includes verification commands and success criteria

---

## Railway Environment Variables (Final)

Copy-paste this entire block into Railway Variables:

```bash
# Core Mode
MODE=live
JOBS_AUTOSTART=true

# Harvesting (set to false on Railway, true locally)
HARVESTING_ENABLED=false
JOBS_HARVEST_INTERVAL_MIN=15

# Posting + Replies
POSTING_ENABLED=true
REPLIES_ENABLED=true
JOBS_POSTING_INTERVAL_MIN=5
JOBS_REPLY_INTERVAL_MIN=15

# Ramp Mode (2 posts/hr + 4 replies/hr)
RAMP_MODE=true
RAMP_LEVEL=3

# Quotas (backup enforcement)
MAX_POSTS_PER_HOUR=2
REPLIES_PER_HOUR=4

# Reply Configuration
REPLY_BATCH_SIZE=2
REPLY_MINUTES_BETWEEN=15
REPLY_MAX_PER_DAY=100
REPLY_STAGGER_BASE_MIN=5
REPLY_STAGGER_INCREMENT_MIN=10

# Learning + Metrics (keep enabled)
JOBS_LEARN_INTERVAL_MIN=60
JOBS_PLAN_INTERVAL_MIN=60
```

---

## Local Verification Commands

```bash
# 1. Sync Railway env vars
pnpm env:pull

# 2. Verify session
pnpm whoami:live

# 3. Test harvest (local only)
pnpm harvest:once

# 4. Check opportunities (should show relevance > 0)
pnpm exec tsx scripts/opportunity-top.ts 60

# 5. Test reply selection (dry run)
OPP_LOOKBACK_MINUTES=180 pnpm reply:dry

# 6. Verify no ghost posts (if posting enabled)
pnpm exec tsx scripts/verify-not-in-db.ts --since-hours=1
```

---

## Expected Behavior

### Harvest Job
- Runs every 15 minutes (configurable via `JOBS_HARVEST_INTERVAL_MIN`)
- Stores opportunities with `relevance_score` and `replyability_score` computed
- Logs guardrail warning if > 50% have `relevance_score=0`

### Reply Job
- Runs every 15 minutes (`JOBS_REPLY_INTERVAL_MIN=15`)
- Generates up to 4 replies/hour (Ramp Mode Level 3 quota)
- Creates decision records in DB before posting

### Posting Queue
- Runs every 5 minutes (`JOBS_POSTING_INTERVAL_MIN=5`)
- Posts up to 2 posts/hour (Ramp Mode Level 3 quota)
- Logs `[RAMP_MODE]` summary with `posts_last_hour` and `replies_last_hour`

---

## File List

**Modified:**
1. `src/config/config.ts` - Added `JOBS_HARVEST_INTERVAL_MIN`
2. `src/jobs/jobManager.ts` - Made harvest interval configurable
3. `src/ai/seedAccountHarvester.ts` - Added relevance_score guardrail log

**Created:**
4. `docs/GO_LIVE_CHECKLIST.md` - Production verification checklist
5. `docs/PRODUCTION_REENABLEMENT_SUMMARY.md` - This file

---

## Testing Notes

- Relevance/replyability scores are computed during `storeOpportunity()` and persisted to DB
- Guardrail log appears after each harvest run in `harvestSeedAccounts()`
- Ramp Mode quotas are enforced in both `postingQueue.ts` and `replyJob.ts`
- Preflight checks already exist in `reply-once.ts` and `seedAccountHarvester.ts`

---

## Next Steps

1. Deploy changes to Railway
2. Follow `docs/GO_LIVE_CHECKLIST.md` Phase A → B → C
3. Monitor logs for guardrail warnings and quota compliance
4. Verify no ghost posts using `verify-not-in-db.ts`

