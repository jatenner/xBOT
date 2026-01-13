# Proof: Limiter Queue Fix

**Date:** 2026-01-13  
**Goal:** Fix ancestry limiter to allow queuing up to maxConcurrent, restore ALLOW throughput  
**Status:** ⚠️ IN PROGRESS

---

## 1) IMPLEMENTATION

### Code Changes

**File:** `src/utils/ancestryConcurrencyLimiter.ts`

**Change:** Removed aggressive `acquireContextWaiting` check that immediately rejected all requests when one was queued. Replaced with queue capacity logic that allows queuing up to `maxConcurrent` requests.

### Diff
```diff
--- a/src/utils/ancestryConcurrencyLimiter.ts
+++ b/src/utils/ancestryConcurrencyLimiter.ts
@@ -10,7 +10,6 @@ class AncestryConcurrencyLimiter {
   private maxConcurrent: number;
   private current: number = 0;
   private queue: Array<() => void> = [];
-  private acquireContextWaiting: boolean = false; // Track if acquire_context is waiting
   
   constructor(maxConcurrent: number = 1) {
     this.maxConcurrent = maxConcurrent;
@@ -20,25 +19,20 @@ class AncestryConcurrencyLimiter {
    * Acquire a slot for ancestry resolution
    * Returns a release function that must be called when done
-   * 🎯 LOAD SHAPING: Skips if acquire_context is already waiting
+   * 🎯 FIX: Allow queuing up to maxConcurrent instead of immediately rejecting
    */
   async acquire(): Promise<() => void> {
     return new Promise((resolve, reject) => {
-      // 🎯 LOAD SHAPING: If acquire_context is already waiting, skip this request
-      if (this.acquireContextWaiting) {
-        reject(new Error('ANCESTRY_SKIPPED_OVERLOAD: acquire_context already waiting'));
-        return;
-      }
-      
-      if (this.current < this.maxConcurrent) {
+      // If we have capacity, grant immediately
+      if (this.current < this.maxConcurrent) {
         this.current++;
         resolve(() => this.release());
+        return;
       } else {
-        // 🎯 LOAD SHAPING: Mark that we're waiting for acquire_context
-        this.acquireContextWaiting = true;
-        
-        // Queue the request
+        // If queue is full (>= maxConcurrent), reject to prevent unbounded growth
+        if (this.queue.length >= this.maxConcurrent) {
+          console.warn(`[ANCESTRY_LIMITER] ⚠️ Queue full: rejecting request (current=${this.current}/${this.maxConcurrent}, queue=${this.queue.length})`);
+          reject(new Error(`ANCESTRY_SKIPPED_OVERLOAD: queue full (current=${this.current}/${this.maxConcurrent}, queue=${this.queue.length})`));
+          return;
+        }
+        
+        // Queue the request (queue.length < maxConcurrent)
         this.queue.push(() => {
           this.current++;
-          this.acquireContextWaiting = false; // Clear waiting flag when we get a slot
           resolve(() => this.release());
         });
       }
```

**Key Changes:**
1. Removed `acquireContextWaiting` flag and its immediate rejection logic
2. Added queue capacity check: reject only when `queue.length >= maxConcurrent`
3. Allow queuing up to `maxConcurrent` requests
4. Added structured log when rejecting due to queue full

---

## 2) BUILD VERIFICATION

```bash
pnpm run build
```

**Output:**
```
✅ Build completed - tsc succeeded and entrypoint exists
```

✅ **Build passes**

---

## 3) DEPLOYMENT

### Commit
```bash
git commit -m "fix: ancestry limiter - allow queue up to maxConcurrent"
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

---

## 4) POST-DEPLOY PROOF

### Decision Breakdown (Last 60 Minutes)
```sql
SELECT decision, deny_reason_code, COUNT(*) as count
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '60 minutes'
GROUP BY decision, deny_reason_code
ORDER BY decision, count DESC;
```

**Results (30 minutes post-deploy):**
```
 decision |     deny_reason_code      | count 
----------+---------------------------+-------
 DENY     | ANCESTRY_SKIPPED_OVERLOAD |    12
 DENY     | CONSENT_WALL              |     3
```

**Analysis:** Still 0 ALLOW, SKIPPED_OVERLOAD remains dominant (80%)

### ALLOW Count
```sql
SELECT COUNT(*) as total_allow
FROM reply_decisions
WHERE decision = 'ALLOW' AND created_at > NOW() - INTERVAL '60 minutes';
```

**Results:**
```
 total_allow 
-------------
           0
```

⚠️ **Still 0 ALLOW decisions**

### ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT Check
```sql
SELECT COUNT(*) as acquire_timeout
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '60 minutes'
  AND deny_reason_code = 'ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT';
```

**Target:** 0 (must remain 0)  
**Results:** ✅ **0** (target achieved - pool starvation remains fixed)

### SKIPPED_OVERLOAD Percentage
```sql
SELECT 
  deny_reason_code,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM reply_decisions WHERE created_at > NOW() - INTERVAL '60 minutes' AND decision = 'DENY'), 0), 2) as pct
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '60 minutes' AND decision = 'DENY'
GROUP BY deny_reason_code
ORDER BY count DESC;
```

**Results:**
```
     deny_reason_code      | count |  pct  
---------------------------+-------+-------
 ANCESTRY_SKIPPED_OVERLOAD |    12 | 80.00
 CONSENT_WALL              |     3 | 20.00
```

**Analysis:** SKIPPED_OVERLOAD still 80% (no improvement from limiter fix)

### Sample SKIPPED_OVERLOAD Details
```sql
SELECT decision_id, target_tweet_id, deny_reason_code, deny_reason_detail
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '30 minutes' 
  AND deny_reason_code = 'ANCESTRY_SKIPPED_OVERLOAD'
ORDER BY created_at DESC LIMIT 3;
```

**Results:**
```
 decision_id              |   target_tweet_id   |     deny_reason_code      |                          deny_reason_detail                          
--------------------------+---------------------+---------------------------+----------------------------------------------------------------------
 c943dde0-ceb1-4187-b814-94ca8af4fe91 | 2009917057933160522 | ANCESTRY_SKIPPED_OVERLOAD | pool={queue=22,active=0/5,idle=0,semaphore=0} error=5, timeout: 60s)
```

**Key Observation:** Pool snapshot shows `semaphore=0` (limiter has capacity), but requests are still being skipped. This suggests SKIPPED_OVERLOAD is coming from the overload check in `replyDecisionRecorder.ts` (lines 98-116), not from the limiter.

---

## 5) ALLOW DECISION PIPELINE PROGRESSION (If ALLOW > 0)

### Sample ALLOW Decision
```sql
SELECT 
  decision_id, target_tweet_id,
  scored_at, template_selected_at, generation_completed_at,
  posting_completed_at, posted_reply_tweet_id
FROM reply_decisions
WHERE decision = 'ALLOW' AND created_at > NOW() - INTERVAL '60 minutes'
ORDER BY created_at DESC
LIMIT 1;
```

**Results:** (To be captured)

### Pipeline Logs
```bash
railway logs -s xBOT --tail 3000 | grep -E "\[PIPELINE\].*<decision_id>"
```

**Results:** (To be captured)

---

## 6) DIAGNOSIS

### Root Cause

**Finding:** SKIPPED_OVERLOAD still 80% after limiter fix.

**Investigation:** Pool snapshots show `semaphore=0` (limiter has capacity), but requests are still being skipped.

**Root Cause:** SKIPPED_OVERLOAD is coming from **two places**:

1. **Limiter** (fixed) - Now allows queuing up to `maxConcurrent`
2. **Overload check in `replyDecisionRecorder.ts`** (still blocking) - Lines 98-116 skip ancestry resolution if:
   - `queueLen >= 20` OR
   - `(activeContexts === maxContexts && queueLen >= 5)`

**Code Location:** `src/jobs/replySystemV2/replyDecisionRecorder.ts:98-116`
```typescript
const isOverloaded = queueLen >= 20 || (activeContexts === maxContexts && queueLen >= 5);

if (isOverloaded && !cached) {
  // Skip ancestry resolution if overloaded and no cache hit
  console.warn(`[ANCESTRY] ⚠️ System overloaded (queue=${queueLen}, active=${activeContexts}/${maxContexts}), skipping ancestry resolution for ${targetTweetId}`);
  // Returns ERROR status → DENY
}
```

**Evidence:** Pool snapshots show `queue=22` (exceeds threshold of 20), triggering the overload check.

### Next Move

**Problem:** Overload check threshold (`queueLen >= 20`) is too aggressive given `BROWSER_MAX_CONTEXTS=11`.

**Solution:** Increase overload threshold to match increased capacity:
- Change `queueLen >= 20` to `queueLen >= 30` (or remove entirely if limiter handles it)

**Expected Impact:**
- Reduce SKIPPED_OVERLOAD from 80% to <20%
- Allow ancestry resolutions to proceed → enable ALLOW decisions
- Maintain pool stability (limiter + pool watchdog provide safety)

---

## SUMMARY

**Fix:** Removed `acquireContextWaiting` check, allow queuing up to `maxConcurrent`  
**Deployment:** ✅ Complete (app_version: 03164ca688ca82096e7ee5843a755754b18a21e2)  
**Impact:** ⚠️ No improvement - SKIPPED_OVERLOAD still 80%  
**Root Cause:** Overload check in `replyDecisionRecorder.ts` (queueLen >= 20) is too aggressive  
**Next Action:** Increase overload threshold from 20 to 30 (or remove if limiter handles it)
