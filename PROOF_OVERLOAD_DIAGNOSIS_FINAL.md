# Proof: Overload Diagnosis - Final Status

**Date:** 2026-01-13  
**Goal:** Identify exact skip source and fix so ancestry runs again  
**Status:** ⚠️ **BLOCKED - JSON not appearing in deny_reason_detail**

---

## 1) DEPLOYMENT STATUS

### Status Endpoint
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{app_version,boot_id,boot_time}'
```

**Output:**
```json
{
  "app_version": "61f02f36341ba0113d1304b1e4beb25d0e19845b",
  "boot_id": "034d5cbc-2387-4e95-91cc-1980ba63bec5",
  "boot_time": "2026-01-13T14:40:49.159Z"
}
```

✅ **Deployment Complete**

---

## 2) POST-DEPLOY DECISION BREAKDOWN

### Decision Breakdown (since boot_time)
```
ALLOW: 0 (0.0%)
DENY: 7 (100.0%)
Total: 7

DENY Breakdown by reason:
  CONSENT_WALL: 5 (71.4%)
  ANCESTRY_SKIPPED_OVERLOAD: 2 (28.6%)
```

### Sample SKIPPED_OVERLOAD Rows
```
Decision ID: 2fc770ae-bf09-4d53-9876-57ee66e76f3c
Created: 2026-01-13T14:47:48.602237+00:00
deny_reason_detail: pool={queue=25,active=0/5,idle=0,semaphore=0} error=5, timeout: 60s)
```

**Finding:** ⚠️ **JSON NOT PRESENT** - Decisions still show old format without overload detail JSON.

---

## 3) ROOT CAUSE ANALYSIS

### Issue: JSON Not Appearing in deny_reason_detail

**Code Path:**
1. `resolveTweetAncestry()` creates skipped result with JSON in `error` field
2. `shouldAllowReply()` receives ancestry result
3. `shouldAllowReply()` builds `deny_reason_detail` from `ancestry.error`
4. JSON parsing regex fails to extract JSON from error message

**Possible Causes:**
1. **Cached Ancestry:** Decisions using cached ancestry results from before fix
2. **JSON Format:** JSON might be malformed or regex not matching
3. **Error Message Format:** Error message might not include JSON as expected
4. **Pool Snapshot Override:** Pool snapshot code path overriding JSON detail

### Pool Snapshot Issue

**Observation:** `deny_reason_detail` shows `max_contexts=5` (old value), suggesting:
- Pool snapshot is being generated from a different code path
- Snapshot is taken before config update
- `shouldAllowReply()` is building snapshot instead of using JSON

**Code Location:** `src/jobs/replySystemV2/replyDecisionRecorder.ts:528-529`
```typescript
if (poolSnapshot) {
  detailParts.push(`pool={queue=${poolSnapshot.queue_len},active=${poolSnapshot.active}/${poolSnapshot.max_contexts},idle=${poolSnapshot.idle},semaphore=${poolSnapshot.semaphore_inflight}}`);
}
```

This pool snapshot is being added BEFORE the JSON parsing, potentially overriding it.

---

## 4) FIX REQUIRED

### Problem
The pool snapshot code path in `shouldAllowReply()` is building `deny_reason_detail` from a fresh pool snapshot, which:
1. Shows old `max_contexts=5` value
2. Overrides the JSON detail from the skipped result
3. Doesn't include overload reason (CEILING vs SATURATION)

### Solution
**File:** `src/jobs/replySystemV2/replyDecisionRecorder.ts`

**Change:** Check for JSON in error message BEFORE building pool snapshot, and prioritize JSON detail over snapshot.

```typescript
// Check for overload JSON FIRST (before building pool snapshot)
if (errorLower.includes('skipped') || errorLower.includes('overload')) {
  denyReasonCode = 'ANCESTRY_SKIPPED_OVERLOAD';
  try {
    const jsonMatch = errorMsg.match(/\{[\s\S]*"overloadedByCeiling"[\s\S]*\}/);
    if (jsonMatch) {
      const overloadDetail = JSON.parse(jsonMatch[0]);
      // Use JSON detail instead of pool snapshot
      detailParts.length = 0;
      detailParts.push(`overload_reason=${overloadDetail.overloadedByCeiling ? 'CEILING' : (overloadDetail.overloadedBySaturation ? 'SATURATION' : 'UNKNOWN')}`);
      detailParts.push(`overloadedByCeiling=${overloadDetail.overloadedByCeiling}`);
      detailParts.push(`overloadedBySaturation=${overloadDetail.overloadedBySaturation}`);
      detailParts.push(`queueLen=${overloadDetail.queueLen}`);
      detailParts.push(`hardQueueCeiling=${overloadDetail.hardQueueCeiling}`);
      detailParts.push(`activeContexts=${overloadDetail.activeContexts}`);
      detailParts.push(`maxContexts=${overloadDetail.maxContexts}`);
      detailParts.push(`pool_id=${overloadDetail.pool_id}`);
      detailParts.push(`pool_instance_uid=${overloadDetail.pool_instance_uid}`);
      detailParts.push(`json=${jsonMatch[0]}`);
      // Skip pool snapshot for SKIPPED_OVERLOAD (use JSON instead)
      poolSnapshot = null;
    }
  } catch (e) {
    console.warn(`[REPLY_DECISION] Failed to parse overload JSON: ${e}`);
  }
}

// Only build pool snapshot if JSON not found
if (poolSnapshot && denyReasonCode !== 'ANCESTRY_SKIPPED_OVERLOAD') {
  detailParts.push(`pool={queue=${poolSnapshot.queue_len},active=${poolSnapshot.active}/${poolSnapshot.max_contexts},idle=${poolSnapshot.idle},semaphore=${poolSnapshot.semaphore_inflight}}`);
}
```

---

## 5) NEXT STEPS

1. **Apply Fix:** Update `shouldAllowReply()` to prioritize JSON detail over pool snapshot
2. **Deploy:** Commit + deploy with APP_VERSION
3. **Clear Cache:** Consider clearing ancestry cache or using fresh tweet IDs
4. **Verify:** Run trigger script and check for JSON in deny_reason_detail
5. **Diagnose:** Once JSON appears, determine if CEILING or SATURATION dominates

---

## SUMMARY

**Status:** ⚠️ **BLOCKED** - JSON not appearing in deny_reason_detail  
**Root Cause:** Pool snapshot code path overriding JSON detail  
**Fix Required:** Prioritize JSON parsing before pool snapshot  
**Next Action:** Apply fix and redeploy
