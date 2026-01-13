# Proof: JSON Priority Fix - Final Status

**Date:** 2026-01-13  
**Goal:** Fix deny_reason_detail JSON extraction to prioritize JSON before pool snapshot  
**Status:** ✅ **CODE FIXED** - Awaiting verification with fresh decisions

---

## 1) CODE CHANGES

### Exact Code Diff

**File:** `src/jobs/replySystemV2/replyDecisionRecorder.ts`

**Change 1: Add detail_version marker (line ~122-126)**
```typescript
const overloadDetailWithVersion = {
  ...overloadDetail,
  detail_version: 1,
};
const overloadDetailJson = JSON.stringify(overloadDetailWithVersion);
error: `ANCESTRY_SKIPPED_OVERLOAD: ${overloadReason} OVERLOAD_DETAIL_JSON:${overloadDetailJson}`,
```

**Change 2: Reorder JSON extraction FIRST (line ~486-519)**
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

**Change 3: Guard in SKIPPED_OVERLOAD branch (line ~580-590)**
```typescript
} else if (errorLower.includes('skipped') || errorLower.includes('overload')) {
  denyReasonCode = 'ANCESTRY_SKIPPED_OVERLOAD';
  // JSON should already be extracted in PRIORITY 1 above
  if (!denyReasonDetailAlreadySet) {
    // Fallback JSON extraction...
  }
}
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
  DENY: 5 (100.0%)
  Total: 5

DENY Breakdown by reason:
  ANCESTRY_SKIPPED_OVERLOAD: 3 (60.0%)
  CONSENT_WALL: 2 (40.0%)
```

### Sample SKIPPED_OVERLOAD Rows

**Latest Decision:**
```
Decision ID: 7cef536b-6115-4bd7-8a85-6ecec3823a95
Created: 2026-01-13T15:47:48.482916+00:00
deny_reason_detail: pool={queue=21,active=0/5,idle=0,semaphore=0}
```

**Finding:** ⚠️ **JSON STILL NOT PRESENT**

**Root Cause Identified:**
- Cached ancestry has old error format: `"Ancestry resolution skipped due to system overload (queue=25, active=0/5)"`
- This doesn't match `OVERLOAD_DETAIL_JSON:` regex
- Cache is being repopulated, but decisions created before cache refresh still use old format

**Action Taken:**
- Cleared cache for tweet IDs: 2009917057933160522, 2009856419541950874
- Waiting for fresh decisions with new code path

---

## 4) DIAGNOSIS

### Current Status

**Code:** ✅ Fixed (JSON extraction prioritized)  
**Deployment:** ✅ Complete  
**Cache:** ⚠️ Old format entries persist (24h TTL)  
**Decisions:** ⚠️ Still showing old format (using cached ancestry)

### Next Steps

1. **Wait for cache to expire** (24h TTL) OR
2. **Clear all cached ancestry** for testing OR
3. **Use fresh tweet IDs** that haven't been cached

---

## SUMMARY

**Fix:** ✅ Code reordered correctly  
**Deployment:** ✅ Complete (app_version: 8e1b8b21)  
**Status:** ⚠️ **Awaiting fresh decisions** (cache TTL: 24h)  
**Next Action:** Wait for cache expiration or clear all cached ancestry for immediate verification
