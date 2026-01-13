# Proof: Force Fresh Ancestry Sample

**Date:** 2026-01-13  
**Goal:** Force fresh ancestry resolution with new tweet IDs to prove JSON marker appears  
**Status:** ⚠️ PARTIAL - Script created but execution timing out

---

## 1) NEW SCRIPT

### scripts/force-fresh-ancestry-sample.ts

**Purpose:** Force fresh ancestry resolution using tweet IDs that haven't been seen before.

**Key Features:**
- Fetches candidates from feeds
- Filters out IDs already in `reply_decisions` (last 24h)
- Filters out IDs in `reply_ancestry_cache`
- Chooses first N "never seen" IDs
- Runs ancestry resolution and records decisions with `pipeline_source='force_fresh_sample'`
- Tracks how many have `OVERLOAD_DETAIL_JSON` marker

**Key Code:**
```typescript
// Filter fresh IDs
const freshIds = candidateIds.filter(id => 
  !existingIds.has(id) && !cachedIds.has(id)
).slice(0, count);

// Resolve ancestry (uses new code path)
const ancestry = await resolveTweetAncestry(tweetId);
const allowCheck = await shouldAllowReply(ancestry);

// Record with force_fresh_sample source
await recordReplyDecision({
  // ... fields ...
  pipeline_source: 'force_fresh_sample',
});
```

---

## 2) UPDATED VERIFICATION SCRIPT

### scripts/verify-overload-detail.ts

**Changes:**
- Fetches `boot_time` from `/status` endpoint
- Queries `reply_decisions` with `pipeline_source='force_fresh_sample'`
- Checks for `detail_version` and `OVERLOAD_DETAIL_JSON` markers
- Parses JSON and shows overload condition breakdown (CEILING vs SATURATION)

---

## 3) EXECUTION

### Command 1: Force Fresh Ancestry Sample
```bash
railway run -s xBOT -- pnpm exec tsx scripts/force-fresh-ancestry-sample.ts --count=25
```

**Status:** ⚠️ TIMING OUT - Script requires browser operations which are slow

**Alternative:** Run locally with smaller count:
```bash
pnpm exec tsx scripts/force-fresh-ancestry-sample.ts --count=5
```

### Command 2: Verify Overload Detail
```bash
pnpm exec tsx scripts/verify-overload-detail.ts
```

**Output:**
```
=== Overload Detail Verification ===
Fetched boot_time from /status: 2026-01-13T16:33:10.816Z

Decision Breakdown (since 2026-01-13T16:33:10.816Z):
  ALLOW: 0 (0.0%)
  DENY: 2 (100.0%)
  Total: 2

DENY Breakdown by reason:
  ANCESTRY_UNCERTAIN: 1 (50.0%)
  ANCESTRY_SKIPPED_OVERLOAD: 1 (50.0%)

=== Force Fresh Sample Rows (newest 1) ===
1. Decision ID: null
   Target Tweet: 2009851949156315263
   Created: 2026-01-13T16:33:16.380329+00:00
   Detail: (null)
   Contains detail_version: false
   Contains OVERLOAD_DETAIL_JSON: false

=== Sample SKIPPED_OVERLOAD Rows (newest 5) ===
1. Decision ID: bc3bbea7-904b-47dc-a15c-14889d2192b2
   Target Tweet: 2009856419541950874
   Created: 2026-01-13T16:36:47.97039+00:00
   Detail: pool={queue=22,active=0/5,idle=0,semaphore=0}
   ⚠️ No JSON found - may be old format
```

---

## 4) POST-BOOT ROWS WITH JSON MARKER

### Query
```sql
SELECT decision_id, target_tweet_id, deny_reason_code, 
       LEFT(deny_reason_detail, 300) as deny_reason_detail_preview, created_at
FROM reply_decisions
WHERE created_at >= '<boot_time>'::timestamptz
AND pipeline_source = 'force_fresh_sample'
AND deny_reason_code = 'ANCESTRY_SKIPPED_OVERLOAD'
ORDER BY created_at DESC
LIMIT 5;
```

**Results:** (To be captured)

**Expected:**
- `deny_reason_detail` contains `detail_version:1` or `OVERLOAD_DETAIL_JSON:` marker
- JSON can be parsed to show `overloadedByCeiling` vs `overloadedBySaturation`

---

## 5) OVERLOAD CONDITION BREAKDOWN

### Conclusion

**To be determined after JSON appears:**

- **CEILING:** X% (queueLen >= hardQueueCeiling)
- **SATURATION:** Y% (activeContexts >= maxContexts && queueLen >= 5)

### Next Patch Recommendation

**If SATURATION dominates:**
- **Current:** `(activeContexts >= maxContexts && queueLen >= 5)`
- **Proposed:** `(activeContexts >= maxContexts && queueLen >= maxContexts)` or `queueLen >= 10`
- **Expected:** Reduce false positives, allow more ancestry attempts

**If CEILING dominates:**
- **Current:** `Math.max(30, maxContexts * 3)` = 33
- **Proposed:** Increase to `Math.max(40, maxContexts * 4)` = 44 or reduce `REPLY_V2_MAX_EVAL_PER_TICK`
- **Expected:** Allow more concurrent ancestry resolutions

---

## FINDINGS

### Current State
1. **Script Created:** ✅ `scripts/force-fresh-ancestry-sample.ts` created and committed
2. **Verification Script Updated:** ✅ `scripts/verify-overload-detail.ts` updated to check for `force_fresh_sample` rows
3. **Deployment:** ⚠️ New deployment triggered (boot_time: 2026-01-13T16:33:10.816Z)
4. **Execution:** ⚠️ Script timing out due to browser operations (ancestry resolution requires Playwright)

### Post-Deploy Evidence
- **Boot Time:** 2026-01-13T16:33:10.816Z
- **Rows Created:** 2 decisions since boot_time
  - 1 `force_fresh_sample` row (ANCESTRY_UNCERTAIN, deny_reason_detail: null)
  - 1 `reply_v2_scheduler` row (ANCESTRY_SKIPPED_OVERLOAD, old format: `pool={queue=22,active=0/5}`)

### Issue: JSON Still Not Appearing
Even after deployment, `ANCESTRY_SKIPPED_OVERLOAD` rows still show old format:
- `pool={queue=22,active=0/5,idle=0,semaphore=0}` instead of JSON with `detail_version:1`

**Possible Causes:**
1. **Cache Repopulation:** `reply_ancestry_cache` entries are being repopulated with old error format
2. **Code Path Not Hit:** The new code path (with `OVERLOAD_DETAIL_JSON:` marker) isn't being executed
3. **Deployment Lag:** Code changes not fully propagated

### Next Steps
1. **Clear All Ancestry Cache:** Delete all entries from `reply_ancestry_cache` to force fresh resolution
2. **Run Script in Smaller Batches:** Use `--count=3` to avoid timeouts
3. **Check Logs:** Look for `[ANCESTRY_OVERLOAD]` log messages to confirm new code path is executing
4. **Verify Deployment:** Confirm `app_version` matches HEAD commit

## SUMMARY

**Scripts:** ✅ Created  
**Execution:** ⚠️ Timing out (browser operations slow)  
**JSON Marker:** ❌ Not appearing in post-deploy rows  
**Overload Condition:** ❓ Cannot determine (JSON not present)  
**Root Cause:** Likely cache repopulation or code path not executing
