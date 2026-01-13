# Proof: Overload Detail JSON Fix

**Date:** 2026-01-13  
**Goal:** Ensure SKIPPED_OVERLOAD decisions include deny_reason_detail JSON  
**Status:** ⚠️ IN PROGRESS

---

## 1) CODE CHANGES

### JSON Parsing Fix

**File:** `src/jobs/replySystemV2/replyDecisionRecorder.ts`

**Change:** Improved JSON extraction regex and added error logging.

**Before:**
```typescript
const jsonMatch = errorMsg.match(/\{.*"overloadedByCeiling".*\}/);
```

**After:**
```typescript
// Look for JSON object in error message (may be at end after other text)
const jsonMatch = errorMsg.match(/\{[\s\S]*"overloadedByCeiling"[\s\S]*\}/);
if (jsonMatch) {
  const overloadDetail = JSON.parse(jsonMatch[0]);
  // ... parse and add to detailParts
  detailParts.push(`json=${jsonMatch[0]}`); // Include full JSON for parsing
}
```

---

## 2) DEPLOYMENT

### Status Check
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{app_version,boot_id,boot_time}'
```

**Output:** (To be captured)

---

## 3) POST-DEPLOY PROOF

### Decision Breakdown

**Command:**
```bash
BOOT_TIME=<boot_time> pnpm exec tsx scripts/verify-overload-detail.ts
```

**Output:** (To be captured)

### Sample SKIPPED_OVERLOAD Rows with JSON

**Expected Fields:**
- `overload_reason`: CEILING or SATURATION
- `overloadedByCeiling`: true/false
- `overloadedBySaturation`: true/false
- `queueLen`: actual queue length
- `hardQueueCeiling`: threshold (should be 33 with maxContexts=11)
- `activeContexts`: active context count
- `maxContexts`: max contexts (should be 11)
- `pool_instance_uid`: pool instance UID
- `json`: full JSON object

---

## 4) DIAGNOSIS

### Overload Reason Distribution

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

## SUMMARY

**Fix:** Improved JSON parsing for overload detail  
**Deployment:** (Status)  
**Impact:** (To be measured)  
**Next Action:** (To be determined based on overload reason)
