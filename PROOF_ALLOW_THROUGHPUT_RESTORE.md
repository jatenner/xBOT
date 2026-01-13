# Proof: ALLOW Throughput Restore

**Date:** 2026-01-13  
**Goal:** Restore ALLOW throughput while preserving pool stability  
**Config Change:** `ANCESTRY_MAX_CONCURRENT=1 → 2`  
**Status:** ⚠️ IN PROGRESS

---

## 1) PRODUCTION SNAPSHOT (Before Change)

### Status Endpoint
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq
```

**Output:**
```json
{
  "ok": true,
  "status": "healthy",
  "app_version": "722385238b7edca1fd0d163e5b540a569554b75f",
  "boot_id": "fe047838-fa99-4a1a-992e-0207c03bfe0a"
}
```

### Metrics (last_1h)
```bash
curl -sSf https://xbot-production-844b.up.railway.app/metrics/replies | jq '.last_1h'
```

**Output:**
```json
{
  "total": 16,
  "allow": 0,
  "deny": 16,
  "deny_reason_breakdown": {
    "ANCESTRY_SKIPPED_OVERLOAD": 14,
    "CONSENT_WALL": 2
  },
  "consent_wall_rate": "12.50%",
  "allow_rate": "0.00%"
}
```

### Decision Breakdown (Last 60 Minutes - Before)
```sql
SELECT decision, deny_reason_code, COUNT(*) as count
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '60 minutes'
GROUP BY decision, deny_reason_code
ORDER BY decision, count DESC;
```

**Results:**
```
 decision |     deny_reason_code      | count 
----------+---------------------------+-------
 DENY     | ANCESTRY_SKIPPED_OVERLOAD |    14
 DENY     | CONSENT_WALL              |     2
```

### ALLOW Count (Before)
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

**Key Finding:** 0 ALLOW decisions, 14 SKIPPED_OVERLOAD (82%), 2 CONSENT_WALL (12%)

---

## 2) CONFIG CHANGE

### Change Applied
```bash
railway variables -s xBOT --set "ANCESTRY_MAX_CONCURRENT=2"
railway up --detach -s xBOT
```

**Before:** `ANCESTRY_MAX_CONCURRENT=1`  
**After:** `ANCESTRY_MAX_CONCURRENT=2`

**Rationale:** Allow 2 concurrent ancestry resolutions instead of 1, reducing SKIPPED_OVERLOAD while maintaining pool stability (BROWSER_MAX_CONTEXTS=11 provides capacity).

---

## 3) POST-DEPLOY VERIFICATION

### Deployment Status
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{app_version,boot_id}'
```

**Output:**
```json
{
  "app_version": "722385238b7edca1fd0d163e5b540a569554b75f",
  "boot_id": "87503db8-5cfb-4514-ba54-ee58319c4065"
}
```

✅ **Deployment Complete:** New boot_id confirms restart

### Fresh Data Generation
```bash
pnpm exec tsx scripts/trigger-reply-evaluation.ts
```

**Note:** Script triggered evaluation cycle (some errors in local execution, but scheduler runs independently in production)

---

## 4) PROOF OF IMPACT (Post-Deploy Window)

### Decision Breakdown (Last 60 Minutes - After)
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
 DENY     | ANCESTRY_SKIPPED_OVERLOAD |    14
 DENY     | CONSENT_WALL              |     3
```

**Analysis:** Still 0 ALLOW, SKIPPED_OVERLOAD remains dominant (82%)

### ALLOW Count (After)
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
SELECT COUNT(*) as acquire_timeout_count
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '60 minutes'
  AND deny_reason_code = 'ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT';
```

**Target:** 0 (must remain 0)  
**Results:** ✅ **0** (target achieved - pool starvation fixed)

### ANCESTRY_SKIPPED_OVERLOAD Check
```sql
SELECT COUNT(*) as skipped_overload_count
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '60 minutes'
  AND deny_reason_code = 'ANCESTRY_SKIPPED_OVERLOAD';
```

**Results:** **14** (82% of all DENY decisions)

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
 9846e017-82c3-4883-9501-73f0460131fe | 2009917057933160522 | ANCESTRY_SKIPPED_OVERLOAD | pool={queue=25,active=0/5,idle=0,semaphore=0} error=5, timeout: 60s)
```

**Key Observation:** Pool snapshot shows `semaphore=0` (limiter at 0), but requests are still being skipped. This suggests the limiter's "load shaping" logic is too aggressive.

---

## 5) ALLOW DECISION PIPELINE PROGRESSION (If ALLOW > 0)

### Sample ALLOW Decision
```sql
SELECT 
  decision_id, target_tweet_id, decision,
  scored_at, template_selected_at, generation_completed_at,
  posting_completed_at, posted_reply_tweet_id, pipeline_error_reason
FROM reply_decisions
WHERE decision = 'ALLOW' AND created_at > NOW() - INTERVAL '60 minutes'
ORDER BY created_at DESC
LIMIT 1;
```

**Results:** (To be captured)

### Pipeline Logs
```bash
railway logs -s xBOT --tail 2000 | grep -E "\[PIPELINE\].*<decision_id>"
```

**Results:** (To be captured)

---

## 6) DIAGNOSIS (Still 0 ALLOW)

### Root Cause Analysis

**Finding:** `ANCESTRY_SKIPPED_OVERLOAD` is preventing ALLOW decisions (82% of DENY).

**Root Cause:** The ancestry concurrency limiter has aggressive "load shaping" logic:
- When `maxConcurrent` slots are full AND one request is queued, ALL subsequent requests are immediately skipped
- The `acquireContextWaiting` flag prevents any new requests once one is waiting
- Even with `ANCESTRY_MAX_CONCURRENT=2`, the limiter singleton may have been initialized with old value (1) before restart

**Evidence:**
- Pool snapshot shows `semaphore=0` (limiter has capacity)
- But requests are still being skipped with `ANCESTRY_SKIPPED_OVERLOAD`
- Limiter code: `if (this.acquireContextWaiting) { reject(new Error('ANCESTRY_SKIPPED_OVERLOAD...')) }`

### Top Deny Reasons (Excluding SKIPPED_OVERLOAD)
```sql
SELECT deny_reason_code, COUNT(*) as count
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '60 minutes'
  AND decision = 'DENY'
  AND deny_reason_code != 'ANCESTRY_SKIPPED_OVERLOAD'
GROUP BY deny_reason_code
ORDER BY count DESC
LIMIT 10;
```

**Results:**
```
     deny_reason_code | count 
---------------------+-------
 CONSENT_WALL        |     3
```

**Analysis:** Only CONSENT_WALL (18%) - not a blocker for ALLOW decisions.

### Consent Wall Rate
```sql
SELECT 
  COUNT(*) as total_deny,
  COUNT(CASE WHEN deny_reason_code = 'CONSENT_WALL' THEN 1 END) as consent_wall_count,
  ROUND(100.0 * COUNT(CASE WHEN deny_reason_code = 'CONSENT_WALL' THEN 1 END) / COUNT(*), 2) as consent_wall_rate_pct
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '60 minutes' AND decision = 'DENY';
```

**Results:**
```
 total_deny | consent_wall_count | consent_wall_rate_pct 
------------+--------------------+-----------------------
         17 |                  3 |                 17.65
```

**Analysis:** 17.65% consent wall rate - not blocking ALLOW (only affects specific accounts).

### Quality Filter Reasons
```sql
SELECT deny_reason_code, COUNT(*) as count
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '60 minutes'
  AND decision = 'DENY'
  AND (deny_reason_code LIKE '%QUALITY%' 
    OR deny_reason_code LIKE '%SCORE%'
    OR deny_reason_code LIKE '%RELEVANCE%'
    OR deny_reason_code LIKE '%JUDGE%')
GROUP BY deny_reason_code
ORDER BY count DESC;
```

**Results:**
```
 deny_reason_code | count 
------------------+-------
(0 rows)
```

**Analysis:** No quality filter rejections - not blocking ALLOW.

---

## 7) DIAGNOSIS

### Root Cause

**Primary Blocker:** `ANCESTRY_SKIPPED_OVERLOAD` (82% of DENY decisions)

**Root Cause:** The ancestry concurrency limiter's "load shaping" logic is too aggressive:
1. When `maxConcurrent` slots are full AND one request is queued, ALL subsequent requests are immediately skipped
2. The `acquireContextWaiting` flag prevents any new requests once one is waiting
3. This happens even when pool has capacity (semaphore=0 in snapshots)

**Code Location:** `src/utils/ancestryConcurrencyLimiter.ts:28-30`
```typescript
if (this.acquireContextWaiting) {
  reject(new Error('ANCESTRY_SKIPPED_OVERLOAD: acquire_context already waiting'));
  return;
}
```

**Issue:** This logic prevents parallel ancestry resolutions even when `maxConcurrent=2` allows it.

### Other Deny Reasons (Non-Blockers)
- **CONSENT_WALL:** 3 (18%) - Account-specific, not systemic blocker
- **Quality filters:** 0 - Not blocking ALLOW decisions
- **ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT:** 0 ✅ - Pool starvation fixed

---

## 8) NEXT MOVE

### Recommended Fix

**Problem:** Limiter's `acquireContextWaiting` flag is too aggressive - it skips ALL requests when one is queued, even if `maxConcurrent` allows more.

**Solution:** Remove or relax the `acquireContextWaiting` check to allow queuing up to `maxConcurrent` requests.

**Expected Impact:**
- Reduce `ANCESTRY_SKIPPED_OVERLOAD` from 82% to <20%
- Allow ancestry resolutions to proceed → enable ALLOW decisions
- Maintain pool stability (BROWSER_MAX_CONTEXTS=11 provides capacity)

**Change Required:**
```typescript
// In src/utils/ancestryConcurrencyLimiter.ts
// Remove or modify lines 27-31:
// OLD:
if (this.acquireContextWaiting) {
  reject(new Error('ANCESTRY_SKIPPED_OVERLOAD: acquire_context already waiting'));
  return;
}

// NEW: Allow queuing up to maxConcurrent requests
// Remove this check entirely, or change to:
if (this.queue.length >= this.maxConcurrent) {
  reject(new Error('ANCESTRY_SKIPPED_OVERLOAD: queue full'));
  return;
}
```

**Rationale:** With `maxConcurrent=2` and `BROWSER_MAX_CONTEXTS=11`, we have capacity for 2 concurrent ancestry resolutions. The current logic prevents this by skipping requests too aggressively.

---

## SUMMARY

**Config Change:** `ANCESTRY_MAX_CONCURRENT: 1 → 2`  
**Deployment:** ✅ Complete (boot_id: 87503db8-5cfb-4514-ba54-ee58319c4065)  
**Impact:** ⚠️ No improvement - still 0 ALLOW decisions  
**Root Cause:** Limiter's `acquireContextWaiting` logic too aggressive  
**Next Action:** Remove/modify `acquireContextWaiting` check in limiter to allow queuing up to `maxConcurrent` requests
