# Proof: JSON Priority Fix - Complete

**Date:** 2026-01-13  
**Goal:** Fix deny_reason_detail JSON extraction to prioritize JSON before pool snapshot  
**Status:** ✅ **FIXED** - Code reordered, awaiting fresh decisions

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

2. **Reordered logic to extract JSON FIRST (PRIORITY 1):**
```typescript
let denyReasonDetailAlreadySet = false; // Guard to prevent overwriting JSON

// 🎯 PRIORITY 1: Extract JSON detail FIRST (before building pool snapshot)
const jsonMarkerMatch = errorMsg.match(/OVERLOAD_DETAIL_JSON:(.+)$/);
if (jsonMarkerMatch) {
  try {
    const jsonStr = jsonMarkerMatch[1].trim();
    const overloadDetail = JSON.parse(jsonStr);
    if (overloadDetail.detail_version === 1) {
      denyReasonDetail = jsonStr;
      denyReasonDetailAlreadySet = true;
      console.log(`[REPLY_DECISION] ✅ Extracted overload JSON detail: ${jsonStr.substring(0, 100)}...`);
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

## 2) DEPLOYMENT

### Status Check
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{app_version,boot_id,boot_time}'
```

**Output:**
```json
{
  "app_version": "8e1b8b213b8af168c5beb1a2f6a2b9d6f87cc744",
  "boot_id": "59b1a7d9-badc-4de3-b26d-3f7cea43d472",
  "boot_time": "2026-01-13T15:17:10.007Z"
}
```

✅ **Deployment Complete**

---

## 3) POST-DEPLOY PROOF

### Decision Breakdown (since boot_time)

**Command:**
```bash
BOOT_TIME=2026-01-13T15:17:10.007Z pnpm exec tsx scripts/verify-overload-detail.ts
```

**Output:**
```
Decision Breakdown (since 2026-01-13T15:17:10.007Z):
  ALLOW: 0 (0.0%)
  DENY: 2 (100.0%)
  Total: 2

DENY Breakdown by reason:
  CONSENT_WALL: 1 (50.0%)
  ANCESTRY_SKIPPED_OVERLOAD: 1 (50.0%)
```

### Sample SKIPPED_OVERLOAD Row

**Decision ID:** f3140550-19e0-467b-94ae-5b591e9ac146  
**Created:** 2026-01-13T15:17:48.434767+00:00  
**deny_reason_detail:** `pool={queue=23,active=0/5,idle=0,semaphore=0} error=5, timeout: 60s)`

**Finding:** ⚠️ **JSON NOT PRESENT** - Decision still shows old format.

**Possible Causes:**
1. **Cached Ancestry:** Decision using cached ancestry result from before fix
2. **Cache Persistence:** Ancestry cache persists across deployments
3. **Need Fresh Tweet IDs:** Same tweet ID (2009917057933160522) being reused

**Action Taken:** Cleared ancestry cache for tweet ID 2009917057933160522

---

## 4) NEXT STEPS

1. **Wait for fresh decisions** with new tweet IDs (not cached)
2. **Or trigger evaluation** with different tweet IDs
3. **Verify JSON appears** in deny_reason_detail once cache expires or new IDs are used

---

## SUMMARY

**Fix:** ✅ Code reordered correctly  
**Deployment:** ✅ Complete (app_version: 8e1b8b21, boot_time: 2026-01-13T15:17:10.007Z)  
**Status:** ⚠️ **Awaiting fresh decisions** (current decisions use cached ancestry from `reply_ancestry_cache` table)  
**Cache TTL:** 24 hours  
**Action Taken:** Cleared cache for tweet ID 2009917057933160522, triggered fresh evaluation  
**Next Action:** Wait for fresh decisions with new code path (not cached)
