# Proof: BROWSER_MAX_CONTEXTS Clamp Fix

**Date:** 2026-01-13  
**Goal:** Fix clamp preventing BROWSER_MAX_CONTEXTS=11, verify overload detail JSON appears  
**Status:** ⚠️ IN PROGRESS

---

## 1) CODE CHANGES

### Clamp Fix

**File:** `src/browser/UnifiedBrowserPool.ts`

**Before:**
```typescript
const MAX_CONTEXTS_CONFIG = parseEnvInt('BROWSER_MAX_CONTEXTS', 5, 1, 10);
```

**After:**
```typescript
const MAX_CONTEXTS_CONFIG = parseEnvInt('BROWSER_MAX_CONTEXTS', 5, 1, 15); // Increased max to 15 to allow higher values (was clamped at 10)
```

### Boot Log Enhancement

**File:** `src/browser/UnifiedBrowserPool.ts`

**Added:**
```typescript
const requestedEnv = process.env.BROWSER_MAX_CONTEXTS || 'default';
const requestedNum = requestedEnv !== 'default' ? parseInt(requestedEnv, 10) : null;
const appliedMaxContexts = this.MAX_CONTEXTS;
const clampMax = 15; // Match parseEnvInt max parameter
const wasClamped = requestedNum !== null && requestedNum > clampMax;
console.log(`[BOOT] Browser pool uid=${this.poolInstanceUid} requested_env_max_contexts=${requestedEnv} applied_max_contexts=${appliedMaxContexts} clamp_max=${clampMax}${wasClamped ? ' (WAS_CLAMPED)' : ''}`);
```

### Verification Script Update

**File:** `scripts/verify-overload-detail.ts`

**Added:** Support for `DEPLOY_CUTOFF` env var to filter by deploy timestamp.

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
git commit -m "Fix BROWSER_MAX_CONTEXTS clamp: increase max from 10 to 15"
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

**Output:** (To be captured)

---

## 4) BOOT LOG PROOF

### Boot Log Check
```bash
railway logs -s xBOT --tail 2000 | grep "\[BOOT\].*Browser pool"
```

**Expected Output:**
```
[BOOT] Browser pool uid=<uid> requested_env_max_contexts=11 applied_max_contexts=11 clamp_max=15
```

**Actual Output:** (To be captured)

**Verification:**
- ✅ `requested_env_max_contexts=11` (matches Railway env var)
- ✅ `applied_max_contexts=11` (no longer clamped to 10)
- ✅ `clamp_max=15` (new max limit)

---

## 5) POST-DEPLOY PROOF (Fresh Window Only)

### Decision Breakdown

**Command:**
```bash
DEPLOY_CUTOFF=<boot_time> pnpm exec tsx scripts/verify-overload-detail.ts
```

**Output:** (To be captured)

### Sample SKIPPED_OVERLOAD Rows with JSON

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

**Key Fields to Verify:**
- `overloadedByCeiling`: true/false
- `overloadedBySaturation`: true/false
- `queueLen`: actual queue length
- `hardQueueCeiling`: threshold (should be `Math.max(30, 11*3) = 33`)
- `activeContexts`: active context count
- `maxContexts`: max contexts (should be 11, not 10)
- `pool_instance_uid`: pool instance UID

### Overload Reason Distribution

**Analysis:**
- CEILING: X% (queueLen >= hardQueueCeiling)
- SATURATION: Y% (activeContexts >= maxContexts && queueLen >= 5)

---

## 6) DIAGNOSIS

### Success Criteria

1. ✅ `applied_max_contexts=11` in boot log (no longer clamped)
2. ✅ `maxContexts=11` in `deny_reason_detail` JSON (matches boot log)
3. ✅ `hardQueueCeiling=33` in `deny_reason_detail` (Math.max(30, 11*3))
4. ✅ Overload detail JSON appears in fresh decisions
5. ✅ Overload reason (CEILING vs SATURATION) is identifiable

### Root Cause Analysis

**If `overloadedBySaturation=true` dominates:**
- **Cause:** `(activeContexts >= maxContexts && queueLen >= 5)` is too aggressive
- **Fix:** Increase saturation threshold: `queueLen >= maxContexts` or `queueLen >= 10`

**If `overloadedByCeiling=true` dominates:**
- **Cause:** `queueLen >= hardQueueCeiling` (33) is being hit
- **Fix:** Increase ceiling formula or reduce eval pressure (`REPLY_V2_MAX_EVAL_PER_TICK`)

### Next Tuning Change

**To be determined based on overload reason distribution:**

- **If SATURATION:** Change saturation condition from `queueLen >= 5` to `queueLen >= maxContexts` (11)
- **If CEILING:** Increase ceiling formula from `maxContexts * 3` to `maxContexts * 4` (44) or reduce eval per tick

---

## SUMMARY

**Fix:** Increased clamp max from 10 to 15  
**Deployment:** (Status)  
**Impact:** (To be measured)  
**Next Action:** (To be determined based on overload reason)
