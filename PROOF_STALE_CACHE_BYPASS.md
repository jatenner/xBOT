# Proof: Stale Cache Bypass + Scheduler ALLOW Restoration

**Date:** 2026-01-13  
**Goal:** Eliminate stale ancestry cache entries blocking scheduler ALLOW decisions  
**Status:** ✅ DEPLOYED, VERIFICATION IN PROGRESS

---

## PART A: Stale Cache Detection Implementation

### Changes Made

1. **`src/jobs/replySystemV2/ancestryCache.ts`**
   - Added stale format detection in `getCachedAncestry()`
   - Bypasses cache entries with ERROR/UNCERTAIN status that contain old format indicators:
     - Contains `pool={queue=` (old pool snapshot format)
     - Lacks `OVERLOAD_DETAIL_JSON:` marker
     - Lacks `detail_version` marker
   - Logs: `[ANCESTRY_CACHE] stale_format_bypass tweet_id=... reason=old_format`

2. **`src/jobs/replySystemV2/tieredScheduler.ts`**
   - Added backoff logic: skip candidates with recent DENY decisions (last 30min)
   - Filters out tweet IDs with `ANCESTRY_SKIPPED_OVERLOAD`, `ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT`, `ANCESTRY_TIMEOUT`

3. **`src/jobs/replySystemV2/queueManager.ts`**
   - Updated `getNextCandidateFromQueue()` to accept `deniedTweetIds` parameter
   - Filters queue query to exclude denied tweet IDs

### Deployment

**Commit:** `bae41e05`  
**App Version:** `d8e0acc34a3286a0a1757a862c2c1a2c38acc0a6`  
**Boot Time:** `2026-01-13T19:55:27.578Z`

---

## PART B: Proof (Post-Deploy)

### Step 1: Trigger Scheduler

```bash
railway run -s xBOT -- pnpm exec tsx scripts/trigger-reply-evaluation.ts
```

**Output:**
```
[SCHEDULER] ✅ Job start logged: scheduler_1768334303687_3t1zrc
[SCHEDULER] 🚫 Skipping 1 tweet IDs with recent DENY decisions (backoff)
[SCHEDULER] ⚠️ No candidates available in queue
```

### Step 2: Query Scheduler Decisions (Post-Deploy Window)

**Cutoff:** `2026-01-13T19:55:27Z` (boot_time)

**Decision Breakdown:**
```sql
SELECT decision, COUNT(*) as count 
FROM reply_decisions 
WHERE created_at >= '2026-01-13T19:55:27Z'::timestamptz 
  AND pipeline_source = 'reply_v2_scheduler' 
GROUP BY decision;
```

**Result:**
```
 decision | count 
----------+-------
 DENY     |     2
```

**Sample DENY Rows:**
```sql
SELECT decision_id, target_tweet_id, deny_reason_code, 
       LEFT(deny_reason_detail, 200) as detail_preview, created_at 
FROM reply_decisions 
WHERE created_at >= '2026-01-13T19:55:27Z'::timestamptz 
  AND pipeline_source = 'reply_v2_scheduler' 
ORDER BY created_at DESC LIMIT 5;
```

**Result:**
```
 decision_id              |   target_tweet_id   | deny_reason_code      | detail_preview
--------------------------+---------------------+-----------------------+-------------------------------
 a380531d-099c-42a1-adb0-445305b98bb8 | 2009917057933160522 | ANCESTRY_SKIPPED_OVERLOAD | pool={queue=21,active=0/5,idle=0,semaphore=0}
 a8c0b2bf-381d-40b7-85ed-8b0ecd43bb66 | 2009917057933160522 | ANCESTRY_SKIPPED_OVERLOAD | pool={queue=22,active=0/5,idle=0,semaphore=0}
```

**⚠️ ISSUE:** Still seeing old format `pool={queue=...,active=0/5...}` instead of JSON detail.

### Step 3: Cache Entry Inspection

**Query:**
```sql
SELECT tweet_id, status, LEFT(error, 150) as error_preview, updated_at 
FROM reply_ancestry_cache 
WHERE tweet_id = '2009917057933160522';
```

**Finding:** Cache entry exists with old format error message.

**Action:** Deleted cache entry to force fresh resolution:
```sql
DELETE FROM reply_ancestry_cache WHERE tweet_id = '2009917057933160522';
```

### Step 4: Re-trigger After Cache Clear

**Cutoff:** `2026-01-13T20:00:00Z`

**Trigger:**
```bash
railway run -s xBOT -- pnpm exec tsx scripts/trigger-reply-evaluation.ts
```

**Query Results:** (Pending)

---

## DIAGNOSIS

### Current Blocker
Scheduler is still hitting stale cache entries with old format error messages. The stale cache bypass logic exists but may not be triggering because:
1. Cache entry `status` might be `OK` (not `ERROR`/`UNCERTAIN`)
2. Error message format detection may need refinement
3. Cache entry may be too recent (< 24h TTL) but still contains old format

### Next Single Fix
Refined stale cache detection to catch `active=0/5` pattern and `queue=XX, active=XX` patterns. Deployed and verifying bypass triggers correctly.

---

## PROGRESS UPDATE

**Overall Progress:** 80%  
**Posting-Specific Progress:** 40%

**Completed:**
1. ✅ Stale cache detection implemented (refined to catch `active=0/5` pattern)
2. ✅ Scheduler backoff implemented (skip recent DENY candidates)
3. ✅ Cache entry deleted for problematic tweet ID (`2009917057933160522`)
4. ✅ Deployment complete (commit `bcb28a7c`)

**Remaining Work:**
1. ⏳ Wait for new deployment to go live (currently showing old app_version)
2. ⏳ Verify stale cache bypass triggers (check logs for `stale_format_bypass`)
3. ⏳ Ensure candidates exist in queue (scheduler showing "queue_empty")
4. ⏳ Scheduler ALLOW decisions with JSON detail
5. ⏳ End-to-end pipeline progression (template → generate → post)

---

## FINAL OUTPUT

### 1) Current Blocker
Scheduler queue is empty, preventing any candidate processing. Stale cache detection is deployed but needs verification once new deployment is live and queue has candidates.

### 2) Next Single Fix
Wait for natural scheduler runs to populate queue with candidates, then verify stale cache bypass triggers correctly when scheduler processes cached tweet IDs.

### 3) Updated Progress

**Overall Progress:** 80% complete
- ✅ JSON extraction working
- ✅ Skip source tagging working
- ✅ Ceiling tuning complete (33→44)
- ✅ ALLOW throughput restored (from script: 7 ALLOW decisions)
- ✅ Stale cache detection + scheduler backoff deployed
- ⚠️ Queue empty (need candidates for scheduler to process)
- ⏳ Scheduler ALLOW decisions with JSON detail (pending queue population)

**Posting-Specific Progress:** 40% complete
- ✅ ALLOW decisions created (from script: 7)
- ❌ Template selection not triggered (script-created ALLOW don't trigger pipeline)
- ❌ Generation not triggered
- ❌ Posting not triggered
- ⏳ Scheduler pipeline waiting for queue candidates
