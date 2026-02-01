# Railway Public Discovery Fix - Implementation & Proof

**Date:** January 29, 2026  
**Status:** ✅ Code Complete, ⏳ Awaiting Railway Harvest Verification

## Root Cause Analysis

### Issue Identified
Public discovery queries were executing but returning 0 tweets. Analysis showed:
1. **Query Issue:** Used literal `verified` keyword (not a valid Twitter search operator)
2. **Threshold Too High:** `min_faves:2000` and `min_faves:5000` too restrictive
3. **No Fallback:** No seed list strategy if search fails

### Evidence from Logs
```
[HARVEST_TIER] tier=PUBLIC query="PUBLIC_VERIFIED_HEALTH" scraped=0
[REAL_DISCOVERY] 📊 Page extraction complete: Found 0 tweets
[HARVEST_DEBUG] 🔢 DOM tweet cards found: 0
```

## Fixes Implemented

### 1. Empty Result Classifier ✅

**File:** `src/ai/realTwitterDiscovery.ts`

**Classification Types:**
- `ok_has_tweets`: Page has tweets, extraction should work
- `query_empty`: No tweets but authenticated, query too restrictive
- `login_wall`: Login required, auth invalid
- `interstitial_error`: Rate limit, captcha, or other error
- `selector_drift`: Page suggests tweets exist but selectors found 0

**Implementation:**
- Classifies page state BEFORE extraction
- Checks for login walls, rate limits, captcha, error messages
- Detects selector drift (tweet markers present but 0 cards found)
- Persists classification to `system_events` table
- **FAIL-CLOSED:** Returns empty array if `login_wall` or `interstitial_error`

**Code Location:** Lines 639-696 (classification), Lines 904-950 (post-extraction classification)

### 2. Query Fixes ✅

**File:** `src/jobs/replyOpportunityHarvester.ts`

**Changes:**
1. **Removed `verified` keyword** (not valid operator)
2. **Lowered thresholds:**
   - `PUBLIC_HEALTH_LOW`: `min_faves:300` (was 2000)
   - `PUBLIC_FITNESS_LOW`: `min_faves:300` (was 2000)
   - `PUBLIC_HEALTH_MED`: `min_faves:1000` (was 5000)
3. **Updated discovery_source:**
   - `public_search_health_low`
   - `public_search_fitness_low`
   - `public_search_health_med`

**Code Location:** Lines 440-449

### 3. Seed List Fallback ✅

**File:** `src/jobs/replyOpportunityHarvester.ts`

**Implementation:**
- Curated list of 10 public health accounts
- Added as fallback queries (run if pool is low)
- Uses `from:account` queries (more reliable than keyword search)
- Discovery source: `public_search_seed_{account}`

**Code Location:** Lines 437-456

**Seed Accounts:**
- peterattiamd, foundmyfitness, drhyman, drjasonfung, drgundry
- drstevenlin, drbrianboxer, drbengreenfield, drjamesdinic, hubermanlab

## Auth Hardening ✅

### 1. Auth Freshness Check

**File:** `src/utils/authFreshnessCheck.ts` (new)

**Features:**
- Lightweight check using `checkWhoami`
- Persists results to `system_events`
- `isAuthBlocked()` function checks recent failures
- Returns `{ blocked: boolean, reason?: string }`

### 2. Fail-Closed Integration

**Harvester:** `src/jobs/replyOpportunityHarvester.ts`
- In P1 mode, exits with code 1 if auth fails
- Emits `harvester_auth_blocked_p1` event

**Scheduler:** `src/jobs/replySystemV2/tieredScheduler.ts`
- Checks `isAuthBlocked()` at start
- Returns early with `auth_blocked` reason if blocked

### 3. Session Sync Script

**File:** `scripts/ops/push-twitter-session-to-railway.ts` (new)

**Features:**
- Reads session from local file
- Base64 encodes and pushes to Railway
- Verifies session on Railway after update

## Status Tracker ✅

### Files Created

1. **`docs/TRACKER.md`**
   - Task tracking with PLANNED/BUILT/PROVEN/BROKEN status
   - Proof links for PROVEN items

2. **`docs/SYSTEM_STATUS.md`**
   - Dashboard template (auto-updated by status-report.ts)

3. **`scripts/ops/status-report.ts`**
   - Computes % complete from TRACKER.md
   - Pulls live DB metrics
   - Writes daily snapshot to `docs/status/daily/YYYY-MM-DD.md`

4. **`scripts/ops/check-p1-ready.ts`**
   - Deterministic P1 readiness check
   - Fails if any blocker detected
   - Checks: auth, public candidates, accessibility, decisions, executor

**NPM Script:** `pnpm status:report`

## Code Changes Summary

### Files Modified

1. **`src/ai/realTwitterDiscovery.ts`**
   - Added empty result classifier (lines 639-696, 904-950)
   - Fail-closed on login_wall/interstitial_error
   - Persists classification to system_events

2. **`src/jobs/replyOpportunityHarvester.ts`**
   - Fixed public queries (removed `verified`, lowered thresholds)
   - Added seed list fallback
   - Fail-closed auth check in P1 mode

3. **`src/jobs/replySystemV2/tieredScheduler.ts`**
   - Added auth block check at start
   - Returns early if auth blocked

### Files Created

1. **`src/utils/authFreshnessCheck.ts`** - Auth freshness utilities
2. **`scripts/ops/push-twitter-session-to-railway.ts`** - Session sync script
3. **`scripts/ops/status-report.ts`** - Status report generator
4. **`scripts/ops/check-p1-ready.ts`** - P1 readiness check
5. **`docs/TRACKER.md`** - Task tracker
6. **`docs/SYSTEM_STATUS.md`** - Status dashboard template

## Verification Commands

### 1. Check Query Strings
```bash
# Verify queries don't include "verified"
grep -r "verified min_faves" src/jobs/replyOpportunityHarvester.ts
# Should show no matches (or only in comments)
```

### 2. Run Harvest on Railway
```bash
railway run --service serene-cat pnpm tsx scripts/ops/run-harvester-single-cycle.ts
```

**Expected Logs:**
```
[HARVEST_TIER] tier=PUBLIC query="PUBLIC_HEALTH_LOW" min_likes=300
[REAL_DISCOVERY] 📊 Page extraction complete: Found X tweets
[HARVEST_STORE] discovery_source=public_search_health_low
```

### 3. Verify Public Candidates
```bash
pnpm tsx scripts/ops/verify-public-candidates.ts
```

**Expected:**
```
1. Public search opportunities by discovery_source:
   ✅ public_search_health_low: X opportunities
   ✅ public_search_fitness_low: Y opportunities
```

### 4. Run Scheduler
```bash
railway run --service serene-cat REPLY_V2_ROOT_ONLY=true P1_MODE=true P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20 REPLY_V2_PLAN_ONLY=true pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
```

**Expected:**
```
[SCHEDULER] 📊 Collected 20 candidates to try (P1 mode: true, max attempts: 20)
[SCHEDULER] 🎯 P1_PROBE_SUMMARY: attempted=20 ok>=1 forbidden=X login_wall=Y deleted=Z timeout=0
```

### 5. Check P1 Readiness
```bash
pnpm tsx scripts/ops/check-p1-ready.ts
```

**Expected:** Exit code 0 if ready, 1 if blocked

## Next Steps

1. ✅ **Code Complete:** All fixes implemented
2. ⏳ **Railway Harvest:** Run harvest cycle and verify public_search_* candidates created
3. ⏳ **Scheduler Test:** Verify scheduler finds accessible candidates (ok >= 1)
4. ⏳ **P1 Completion:** Achieve first successful Reply V2 post

## Evidence Queries

```sql
-- Check for public_search_* opportunities
SELECT discovery_source, COUNT(*) as count, 
       MIN(created_at) as first_seen, MAX(created_at) as last_seen
FROM reply_opportunities
WHERE discovery_source LIKE 'public_search_%'
AND replied_to = false
GROUP BY discovery_source
ORDER BY discovery_source;

-- Check empty result classifications
SELECT event_type, event_data->>'classification' as classification, 
       event_data->>'search_label' as search_label, created_at
FROM system_events
WHERE event_type = 'harvest_empty_result'
ORDER BY created_at DESC
LIMIT 10;

-- Check auth freshness
SELECT event_type, message, created_at
FROM system_events
WHERE event_type IN ('auth_freshness_ok', 'auth_freshness_failed')
ORDER BY created_at DESC
LIMIT 5;
```
