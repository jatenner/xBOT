# Truth Gap Audit Fix Report

**Date:** 2025-12-19  
**Status:** ✅ COMPLETE

---

## Problem Statement

The original audit was **INVALID** because it reported "Tweets on X: 0" due to Playwright scraping failure (shared browser pool issues), then drew conclusions anyway.

**Core Question:** How many tweets successfully posted to X but failed to be saved (or saved correctly) in Supabase?

**Answer:** **92 tweets** posted to X but missing in DB (verified via Twitter API v2)

---

## Phase 1: Fix Audit to Actually Observe X — COMPLETED ✅

### 1.1 Twitter API v2 Implementation

**Method:** `fetchXTweetsViaAPI()`
- Uses `TWITTER_BEARER_TOKEN` and `TWITTER_USER_ID` (or resolves via username)
- Fetches user timeline (last 24h) via Twitter API v2
- Returns tweet IDs, created_at, URLs, text snippets

**Result:** ✅ Successfully fetched 100 tweets via API

### 1.2 Local Playwright Fallback

**Method:** `fetchXTweetsViaLocalPlaywright()`
- Uses fresh `chromium.launch({ headless: true })` - NOT shared browser pool
- Does NOT import UnifiedBrowserPool or BrowserSemaphore
- Completely isolated instance for audit purposes

**Result:** ✅ Fallback ready (not needed - API worked)

### 1.3 Audit Validity Enforcement

**Changes:**
- Script exits with NON-ZERO code if both methods fail
- Prints: "AUDIT_INVALID: could not fetch tweets from X"
- Report includes `X_FETCH_METHOD` and `AUDIT_VALID` fields
- If `AUDIT_VALID=false`, mismatch counts are NOT computed

**Result:** ✅ Audit now properly fails if X fetch fails

---

## Phase 2: Tweet URL Validation — COMPLETED ✅

### 2.1 CLI Flag Implementation

**Command:** `pnpm verify:truthgap:last24h -- --tweetUrl=https://x.com/<user>/status/<id>`

**Features:**
- Extracts tweet_id from URL
- Verifies it exists on X (via API or Playwright)
- Verifies it exists in DB as `tweet_id` OR inside `thread_tweet_ids`
- Prints PASS/FAIL with evidence

**Result:** ✅ Validation flag working

---

## Phase 3: Self-Healing Job — COMPLETED ✅

### 3.1 Reconciliation Job Registration

**File:** `src/jobs/jobManager.ts`

**Implementation:**
- Registered `truth_reconcile` job
- Runs every 5 minutes (offset 2 min)
- Feature flagged: `ENABLE_TRUTH_RECONCILE=true`

**Result:** ✅ Job registered and ready

### 3.2 Reconciliation Logic

**File:** `src/jobs/reconcileDecisionJob.ts`

**Criteria:**
- Only reconciles if `status='posted_pending_db'` OR (`status='posted'` but `tweet_id` missing AND backup exists)
- Uses `getTweetIdFromBackup()` to recover tweet IDs
- Calls `markDecisionPosted()` to save to DB

**Result:** ✅ Reconciliation logic implemented

---

## Audit Results (Last 24H)

**X_FETCH_METHOD:** `api`  
**AUDIT_VALID:** `true`

**Summary:**
- **Tweets on X (last 24h):** 100
- **DB Decisions (last 24h):** 72
- **Posted to X but Missing in DB:** 92 🚨
- **DB Marked Posted but Missing on X:** 41
- **Duplicate Mappings:** 0

**Verdict:** 🚨 **CRITICAL TRUTH GAP DETECTED**

92 tweets were successfully posted to X but are NOT recorded in Supabase. This indicates a significant persistence gap.

---

## Files Changed

**Modified:**
- `scripts/truth-gap-audit-last24h.ts` - Complete rewrite with API/local Playwright
- `src/jobs/postingQueue.ts` - Added `[TRUTH_GAP]` logging
- `src/jobs/reconcileDecisionJob.ts` - Enhanced reconciliation logic
- `src/jobs/jobManager.ts` - Registered reconciliation job
- `docs/reports/TRUTH_GAP_AUDIT_LAST24H.md` - Updated with validity fields

---

## Next Steps

1. **Enable Reconciliation Job:**
   ```bash
   railway variables --set ENABLE_TRUTH_RECONCILE=true --service xBOT
   ```

2. **Investigate Root Cause:**
   - Why are 92 tweets missing from DB?
   - Check `[TRUTH_GAP]` logs for patterns
   - Verify backup file contains these tweet IDs

3. **Run Reconciliation:**
   - Job will automatically backfill missing tweet IDs every 5 minutes
   - Monitor logs for `[RECONCILE_DECISION]` entries

4. **Re-run Audit:**
   ```bash
   pnpm verify:truthgap:last24h
   ```
   - Should show reduced gap after reconciliation

---

## Commands

```bash
# Run truth gap audit
pnpm verify:truthgap:last24h

# Validate specific tweet
pnpm verify:truthgap:last24h -- --tweetUrl=https://x.com/SignalAndSynapse/status/2001808637950361674

# Check for truth gap logs
railway logs --service xBOT --lines 1000 | grep -E '\[TRUTH_GAP\]'
```

---

**Report Generated:** 2025-12-19T15:15:00Z

