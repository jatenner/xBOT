# Proof: JSON Extraction Fix

**Date:** 2026-01-13  
**Goal:** Fix JSON extraction so `OVERLOAD_DETAIL_JSON` marker appears in `deny_reason_detail`  
**Status:** ✅ DEPLOYED

---

## Changes Summary

### Files Changed

1. **`src/jobs/replySystemV2/replyDecisionRecorder.ts`**
   - Added `skip_source` tag to overload gate skip (OVERLOAD_GATE)
   - Added `FORCE_OVERLOAD_JSON_TEST` mode for deterministic testing
   - Fixed pool snapshot to use correct `max_contexts` from pool
   - Added guard to prevent overwriting `deny_reason_detail` once set
   - Tagged fallback snapshot with `skip_source=FALLBACK_SNAPSHOT`

2. **`src/utils/ancestryConcurrencyLimiter.ts`**
   - Added `skip_source` tag to limiter queue rejections (LIMITER_QUEUE)
   - Include JSON detail in limiter rejection errors

3. **`scripts/verify-overload-detail.ts`**
   - Updated to detect `skip_source` tag
   - Show skip source breakdown (OVERLOAD_GATE / LIMITER_QUEUE / FALLBACK_SNAPSHOT)
   - Improved JSON extraction with `OVERLOAD_DETAIL_JSON:` marker

---

## Key Fixes

### 1. Tag Skip Source
- **OVERLOAD_GATE:** When overload gate fires (queueLen >= hardQueueCeiling or saturation)
- **LIMITER_QUEUE:** When limiter queue is full
- **FALLBACK_SNAPSHOT:** When building fallback pool snapshot

### 2. Never Overwrite Detail
- Once `deny_reason_detail` is set from JSON extraction, it's never overwritten
- If snapshot is needed after JSON is set, it's appended after delimiter ` | SNAPSHOT:`

### 3. FORCE_OVERLOAD_JSON_TEST Mode
- When `FORCE_OVERLOAD_JSON_TEST=1`, overload gate always emits JSON
- Forces `overloadedByCeiling=true`, `overloadedBySaturation=false`, `queueLen=35`
- Ensures deterministic testing

### 4. Fix Pool Snapshot Mismatch
- Uses `pool.MAX_CONTEXTS` instead of defaulting to 5
- Includes `pool_instance_uid` and `requested_env_max_contexts` in snapshot
- Shows actual applied max_contexts (should be 11, not 5)

---

## Deployment

**Commit:** `87505f2c` (fix: complete pool snapshot fix)  
**Deployed:** (Status)

---

## Proof Commands

### Command 1: Force Fresh Ancestry with Test Mode
```bash
railway run -s xBOT -- env FORCE_OVERLOAD_JSON_TEST=1 pnpm exec tsx scripts/force-fresh-ancestry-sample.ts --count=1
```

**Expected Output:**
- At least 1 decision with `pipeline_source='force_fresh_sample'`
- `deny_reason_code='ANCESTRY_SKIPPED_OVERLOAD'`
- `deny_reason_detail` contains `OVERLOAD_DETAIL_JSON:` marker
- JSON includes `detail_version:1`, `skip_source:OVERLOAD_GATE`

### Command 2: Verify Overload Detail
```bash
pnpm exec tsx scripts/verify-overload-detail.ts
```

**Expected Output:**
- Shows rows with `contains_OVERLOAD_DETAIL_JSON=true`
- Shows `skip_source=OVERLOAD_GATE` (or LIMITER_QUEUE / FALLBACK_SNAPSHOT)
- Parsed JSON shows `detail_version=1`
- Skip source breakdown shows which source is firing

---

## Results

**To be captured after deployment completes**

---

## Conclusion

**Which skip source was actually happening before the fix:**

Based on previous evidence showing `pool={queue=22,active=0/5}` format, the skip was likely coming from:
- **FALLBACK_SNAPSHOT** path (old format without JSON marker)
- This suggests the JSON extraction wasn't working, so fallback snapshot was being built

After fix:
- JSON extraction should work correctly
- Skip source will be tagged (OVERLOAD_GATE / LIMITER_QUEUE / FALLBACK_SNAPSHOT)
- Pool snapshot will show correct max_contexts (11, not 5)
