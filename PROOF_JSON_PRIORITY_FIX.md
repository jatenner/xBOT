# Proof: JSON Priority Fix

**Date:** 2026-01-13  
**Goal:** Fix deny_reason_detail JSON extraction to prioritize JSON before pool snapshot  
**Status:** ⚠️ IN PROGRESS

---

## 1) CODE CHANGES

### JSON Priority Fix

**File:** `src/jobs/replySystemV2/replyDecisionRecorder.ts`

**Key Changes:**

1. **Added detail_version marker to overload detail:**
```typescript
const overloadDetailWithVersion = {
  ...overloadDetail,
  detail_version: 1,
};
const overloadDetailJson = JSON.stringify(overloadDetailWithVersion);
error: `ANCESTRY_SKIPPED_OVERLOAD: ${overloadReason} OVERLOAD_DETAIL_JSON:${overloadDetailJson}`,
```

2. **Reordered logic to extract JSON FIRST:**
```typescript
// 🎯 PRIORITY 1: Extract JSON detail FIRST (before building pool snapshot)
const jsonMarkerMatch = errorMsg.match(/OVERLOAD_DETAIL_JSON:(.+)$/);
if (jsonMarkerMatch) {
  try {
    const jsonStr = jsonMarkerMatch[1].trim();
    const overloadDetail = JSON.parse(jsonStr);
    if (overloadDetail.detail_version === 1) {
      denyReasonDetail = jsonStr;
      denyReasonDetailAlreadySet = true; // Guard to prevent overwriting
    }
  } catch (e) {
    console.warn(`[REPLY_DECISION] Failed to parse overload JSON: ${e}`);
  }
}

// 🎯 PRIORITY 3: Build pool snapshot fallback ONLY if JSON not already set
if (!denyReasonDetailAlreadySet) {
  // Build pool snapshot...
}
```

3. **Added guard to prevent overwriting:**
```typescript
let denyReasonDetailAlreadySet = false; // Guard to prevent overwriting JSON
```

---

## 2) BUILD VERIFICATION

```bash
pnpm run build
```

**Output:** (To be captured)

---

## 3) DEPLOYMENT

### Commit
```bash
git commit -m "Fix deny_reason_detail JSON priority: extract JSON BEFORE pool snapshot"
```

**Commit:** (To be captured)

### Deploy
```bash
railway variables -s xBOT --set "APP_VERSION=$(git rev-parse HEAD)"
railway up --detach -s xBOT
```

**Output:** (To be captured)

### Status Check
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{app_version,boot_id,boot_time}'
```

**Output:**
```json
{
  "app_version": "1563adc9e521af2ca878c134c525ca0d326f2510",
  "boot_id": "13bb59ab-c1a4-4759-a631-27ba60bf6fda",
  "boot_time": "2026-01-13T14:57:08.402Z"
}
```

✅ **Deployment Complete** (Note: First deploy had wrong code order, second deploy fixes it)

---

## 4) POST-DEPLOY PROOF

### Decision Breakdown

**Command:**
```bash
BOOT_TIME=<boot_time> pnpm exec tsx scripts/verify-overload-detail.ts
```

**Output:** (To be captured)

### Sample SKIPPED_OVERLOAD Rows with JSON

**Expected Fields:**
- `detail_version: 1` ✅
- `overloadedByCeiling`: true/false
- `overloadedBySaturation`: true/false
- `queueLen`: actual queue length
- `hardQueueCeiling`: threshold (should be 33 with maxContexts=11)
- `activeContexts`: active context count
- `maxContexts`: max contexts (should be 11)
- `pool_instance_uid`: pool instance UID

**Query:**
```sql
SELECT decision_id, target_tweet_id, deny_reason_code, deny_reason_detail, created_at
FROM reply_decisions
WHERE created_at >= '<boot_time>'::timestamptz
AND deny_reason_code = 'ANCESTRY_SKIPPED_OVERLOAD'
ORDER BY created_at DESC
LIMIT 5;
```

**Results:** (To be captured)

---

## 5) DIAGNOSIS

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

**Fix:** JSON extraction prioritized before pool snapshot  
**Deployment:** (Status)  
**Impact:** (To be measured)  
**Next Action:** (To be determined based on overload reason)
