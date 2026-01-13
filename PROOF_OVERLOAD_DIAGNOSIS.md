# Proof: Overload Diagnosis with Explicit Reasons

**Date:** 2026-01-13  
**Goal:** Identify exact skip source and fix so ancestry runs again  
**Status:** ⚠️ IN PROGRESS

---

## 1) IMPLEMENTATION

### Code Changes

**File:** `src/jobs/replySystemV2/replyDecisionRecorder.ts`

**Change:** Split overload check into explicit conditions and add detailed JSON to `deny_reason_detail`.

```typescript
const hardQueueCeiling = Math.max(30, maxContexts * 3);
const overloadedByCeiling = queueLen >= hardQueueCeiling;
const overloadedBySaturation = (activeContexts >= maxContexts && queueLen >= 5);
const isOverloaded = overloadedByCeiling || overloadedBySaturation;

// Include overload detail JSON in error message
const overloadDetail = {
  overloadedByCeiling,
  overloadedBySaturation,
  queueLen,
  hardQueueCeiling,
  activeContexts,
  maxContexts,
  pool_id: poolId,
  pool_instance_uid: poolId,
};
```

**File:** `src/browser/UnifiedBrowserPool.ts`

**Change:** Added pool instance UID and boot log.

```typescript
public readonly poolInstanceUid: string;

private constructor() {
  this.poolInstanceUid = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[BOOT] Browser pool uid=${this.poolInstanceUid} maxContexts=${this.MAX_CONTEXTS} source_env=${process.env.BROWSER_MAX_CONTEXTS || 'default'}`);
  // ...
}
```

**File:** `scripts/verify-overload-detail.ts` (NEW)

**Purpose:** Verification script to analyze overload detail in SKIPPED_OVERLOAD decisions.

---

## 2) POOL INSTANTIATION CHECK

### Grep Results

```bash
grep -R "new UnifiedBrowserPool" -n src
```

**Results:**
```
src/browser/UnifiedBrowserPool.ts:153:      UnifiedBrowserPool.instance = new UnifiedBrowserPool();
```

**Conclusion:** ✅ Only one instantiation found (in `getInstance()`). UnifiedBrowserPool uses singleton pattern, so only one instance exists.

---

## 3) BUILD VERIFICATION

```bash
pnpm run build
```

**Output:** (To be captured)

---

## 4) DEPLOYMENT

### Commit
```bash
git commit -m "Add explicit overload reasons + pool instance tracking"
```

**Commit:** (To be captured)

### Deploy
```bash
railway variables -s xBOT --set "APP_VERSION=$(git rev-parse HEAD)"
railway up --detach -s xBOT
```

**Output:** (To be captured)

### Verification
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{app_version,boot_id}'
```

**Output:** (To be captured)

### Boot Log Check
```bash
railway logs -s xBOT --tail 1000 | grep "\[BOOT\].*Browser pool"
```

**Output:** (To be captured)

---

## 5) POST-DEPLOY PROOF (30-60 minutes)

### Decision Breakdown
```bash
pnpm exec tsx scripts/verify-overload-detail.ts
```

**Output:** (To be captured)

### Sample SKIPPED_OVERLOAD Rows

**Query:**
```sql
SELECT decision_id, target_tweet_id, deny_reason_code, deny_reason_detail, created_at
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '30 minutes'
AND deny_reason_code = 'ANCESTRY_SKIPPED_OVERLOAD'
ORDER BY created_at DESC
LIMIT 5;
```

**Results:** (To be captured)

**Key Fields to Verify:**
- `overload_reason`: CEILING or SATURATION
- `overloadedByCeiling`: true/false
- `overloadedBySaturation`: true/false
- `queueLen`: actual queue length
- `hardQueueCeiling`: threshold (should be 33 with maxContexts=11)
- `activeContexts`: active context count
- `maxContexts`: max contexts (should match /metrics)
- `pool_id`: pool instance UID
- `pool_instance_uid`: same as pool_id

### Metrics Snapshot

```bash
curl -sSf https://xbot-production-844b.up.railway.app/metrics/replies | jq '.pool_health'
```

**Output:** (To be captured)

**Verification:**
- `max_contexts` in `deny_reason_detail` should match `pool_health.max_contexts`
- `pool_instance_uid` should be consistent across decisions

### ALLOW Count

```sql
SELECT COUNT(*) as total_allow
FROM reply_decisions
WHERE decision = 'ALLOW'
AND created_at > NOW() - INTERVAL '30 minutes';
```

**Results:** (To be captured)

---

## 6) DIAGNOSIS

### Success Criteria

1. ✅ `deny_reason_detail` shows which condition is firing (CEILING vs SATURATION)
2. ✅ `maxContexts` in `deny_reason_detail` matches `/metrics` pool_health.max_contexts
3. ✅ `pool_instance_uid` is consistent (only one pool instance)
4. ✅ SKIPPED_OVERLOAD rate drops OR becomes explainable
5. ✅ At least 1 ancestry attempt occurs (not skipped), enabling potential ALLOW decisions

### Findings

**To be filled after proof window:**

1. **Overload Reason Distribution:**
   - CEILING: X%
   - SATURATION: Y%

2. **Pool Stats Consistency:**
   - `maxContexts` in DB vs `/metrics`: (match/mismatch)
   - `pool_instance_uid` consistency: (single/multiple)

3. **Root Cause:**
   - (To be determined)

4. **Next Patch:**
   - (To be determined)

---

## SUMMARY

**Fix:** Explicit overload reasons + pool instance tracking  
**Deployment:** (Status)  
**Impact:** (To be measured)  
**Next Action:** (To be determined)
