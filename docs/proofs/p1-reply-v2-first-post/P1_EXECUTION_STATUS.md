# P1 Execution Status - Current State

**Date:** January 29, 2026  
**Objective:** Achieve first successful Reply V2 post using public-only discovery lane

## Current Status

### ✅ Completed

1. **Code Implementation:**
   - Public-only discovery lane implemented (`tierPublicQueries`)
   - Author-level accessibility memory (`forbidden_authors` table)
   - Filtering logic integrated
   - All code changes staged and ready

2. **Database Migrations:**
   - `accessibility_status` columns added ✅
   - `forbidden_authors` table created ✅

3. **Scheduler Execution:**
   - P1 mode enabled
   - Collected 9 candidates (limited by queue availability)
   - Attempted all 9 candidates
   - Fast probe working correctly

### ❌ Blockers

1. **Harvester Authentication:**
   - Local harvester failing auth check (`reason=no_timeline`)
   - Cannot run fresh harvest cycle locally
   - Need Railway worker service to run harvest

2. **No Public Candidates:**
   - Current opportunities: `discovery_source=unknown` (created before public lane)
   - Need fresh harvest with `P1_MODE=true` to populate `public_search_*` candidates
   - All 9 attempted candidates failed as `forbidden` (protected accounts)

## Scheduler Results

**Last Run:**
```
[SCHEDULER] 📊 Collected 9 candidates to try (P1 mode: true, max attempts: 20)
[SCHEDULER] 🎯 P1_PROBE_SUMMARY: attempted=9 ok=0 forbidden=9 login_wall=0 deleted=0 timeout=0
[SCHEDULER] ⚠️ No candidate passed preflight: attempted=9 ok=0 timeout=0 deleted=0
```

**Analysis:**
- ✅ Scheduler attempting up to 20 candidates (limited by queue size: 9 available)
- ✅ Fast probe working (all 9 checked in ~1-2s each)
- ❌ All candidates `forbidden` (protected accounts from seed harvester)
- ❌ No `public_search_*` candidates available yet

## Next Steps to Complete P1

### 1. Run Harvest on Railway

The harvester needs to run on Railway where authentication is properly configured:

```bash
# Option A: Railway daemon (automatic)
# Harvester daemon should run automatically on Railway worker service

# Option B: Manual trigger
railway run --service xBOT pnpm tsx scripts/ops/run-harvester-single-cycle.ts
```

**Required Env Vars on Railway:**
- `P1_MODE=true`
- `REPLY_V2_ROOT_ONLY=true`
- `P1_TARGET_MAX_AGE_HOURS=1`

### 2. Verify Public Candidates Created

After harvest, verify opportunities with `public_search_*` discovery_source:

```bash
psql $DATABASE_URL -c "
SELECT discovery_source, COUNT(*) 
FROM reply_opportunities 
WHERE discovery_source LIKE 'public_search_%' 
AND replied_to = false 
GROUP BY discovery_source;
"
```

### 3. Run Scheduler

Once public candidates exist, scheduler should find accessible tweets:

```bash
REPLY_V2_ROOT_ONLY=true P1_MODE=true P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20 REPLY_V2_PLAN_ONLY=true \
pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
```

**Expected Result:**
```
[SCHEDULER] 🎯 P1_PROBE_SUMMARY: attempted=20 ok>=1 forbidden=X login_wall=Y deleted=Z timeout=0
```

### 4. Monitor Executor

Once decision is created and queued, executor should:
1. Claim decision
2. Run runtime preflight (should pass for public candidates)
3. Generate reply
4. Post tweet

**Monitor logs for:**
- `[EXECUTOR] Claimed decision: ...`
- `[EXECUTOR] Runtime preflight: ok`
- `[EXECUTOR] Posted tweet: https://x.com/...`

## Success Criteria

- ✅ At least 1 opportunity with `discovery_source LIKE 'public_search_%'`
- ✅ Scheduler `P1_PROBE_SUMMARY` shows `ok >= 1`
- ✅ Decision created with `status='queued'` and `pipeline_source='reply_v2_planner'`
- ✅ Executor claims decision and posts successfully
- ✅ `posted_tweet_id` captured and documented

## Current Blocker Summary

**Primary Blocker:** Local harvester authentication failure prevents fresh harvest cycle.

**Solution:** Run harvest on Railway worker service where `TWITTER_SESSION_B64` is properly configured.

**Code Status:** ✅ Complete and ready - public-only discovery lane will work once harvest runs.
