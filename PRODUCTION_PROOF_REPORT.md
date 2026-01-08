# 📊 PRODUCTION PROOF REPORT

**Date:** January 8, 2026  
**Time:** After Next Fetch Completion  
**Fetch Completed:** 2026-01-08 22:07:36 UTC

---

## 1) FETCH JOB EVENTS

| Event Type | Fetched | Evaluated | Created At | Duration |
|------------|---------|-----------|------------|----------|
| `reply_v2_fetch_job_completed` | **10** | **10** | 2026-01-08 22:07:36 | 664s (~11 min) |
| `reply_v2_fetch_job_started` | - | - | 2026-01-08 21:56:32 | - |

**Status:** ✅ **FETCH COMPLETED SUCCESSFULLY**

---

## 2) CANDIDATE EVALUATIONS (Last 15 Minutes)

- **Total Evaluated:** 10
- **Passed Hard Filters:** 0 ❌
- **Blocked:** 10

**Status:** ⚠️ **ALL CANDIDATES BLOCKED BY HARD FILTERS**

---

## 3) QUEUE SIZE

- **Queued:** 0
- **Tier 1:** 0
- **Tier 2:** 0
- **Tier 3:** 0

**Status:** ❌ **QUEUE EMPTY**

---

## 4) SLO EVENTS (Last 30 Minutes)

- **Total Slots:** 3
- **Posted:** 0
- **Missed:** 3
- **Last Slot:** 2026-01-08 21:45:00

**Status:** ❌ **ALL SLOTS MISSED (queue_empty)**

---

## 5) FEED ERRORS

- **Error Count:** 1
- **Affected Account:** @DrAndyGalpin

**Status:** ⚠️ **1 FEED ERROR**

---

## COUNTS SUMMARY

| Metric | Count |
|--------|-------|
| **Extracted** | 14 tweets |
| **Returned** | 10 tweets |
| **Inserted** | 10 candidates |
| **Queued** | 0 |

---

## ROOT CAUSE: ALL CANDIDATES BLOCKED BY HARD FILTERS

**Issue:** `Inserted > 0` but `Queued = 0`

**Analysis:**
- ✅ Feeds extract tweets successfully (14 extracted)
- ✅ Orchestrator receives tweets (10 returned)
- ✅ Candidates evaluated and inserted (10 inserted)
- ❌ **ALL candidates fail hard filters** (0 passed)
- ❌ Queue remains empty (nothing to queue)

**Hard Filters (from `candidateScorer.ts`):**
1. **Root Tweet Check:** `isRootTweet` must be `true`
2. **Parody Check:** Account/content must not be parody
3. **Topic Relevance:** Must be >= 0.6
4. **Spam Score:** Must be <= 0.7

**Next Steps:**
1. Query `filter_reason` column to see which filter is blocking all candidates
2. Debug `checkIsRootTweet` - likely failing for all tweets
3. Check if `resolveRootTweetId` is working correctly
4. Adjust filters if too strict

---

**Status:** 🔍 **DEBUGGING HARD FILTER BLOCKERS**

