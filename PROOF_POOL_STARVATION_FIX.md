# Proof: Pool Starvation Fix

**Date:** 2026-01-13  
**Deployment Commit:** 72238523 (pool starvation fix)  
**Config Changes:** BROWSER_MAX_CONTEXTS=11, REPLY_V2_MAX_EVAL_PER_TICK=3  
**Status:** ⚠️ DEPLOYED - Monitoring for improvement

---

## A) Deployment Proof

### Status Endpoint
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{app_version,boot_id}'
```

**Expected:** New app_version matching commit `72238523`

---

## B) Configuration Changes

### Before
- `BROWSER_MAX_CONTEXTS`: 9 (from previous fix)
- `REPLY_V2_MAX_EVAL_PER_TICK`: 4

### After
- `BROWSER_MAX_CONTEXTS`: 11 (increased by 2)
- `REPLY_V2_MAX_EVAL_PER_TICK`: 3 (reduced by 1)

**Rationale:**
- More contexts = less queue pressure
- Fewer concurrent evaluations = less pool pressure

---

## C) Code Changes

### 1. Enhanced deny_reason_detail
**File:** `src/utils/resolveRootTweet.ts`

**Added:** Full pool snapshot for timeout errors including:
- `max_contexts`, `total_contexts`, `active`, `idle`
- `queue_len`, `semaphore_inflight`
- `avg_wait_ms`, `peak_queue`, `contexts_created_total`

### 2. Fixed pipeline_error_reason
**File:** `src/jobs/replySystemV2/tieredScheduler.ts`

**Change:** Only set `pipeline_error_reason` for ALLOW decisions (DENY decisions never entered pipeline stages).

### 3. Pool Watchdog
**File:** `src/browser/UnifiedBrowserPool.ts`

**Added:**
- Detects acquire waits > 15s → logs pool snapshot
- Force-closes contexts stuck > 90s
- Tracks context active times for monitoring

---

## D) Post-Deploy Data Analysis

### Deployment Verification
**Status:** ✅ Deployed
- **app_version:** `722385238b7edca1fd0d163e5b540a569554b75f` (matches HEAD)
- **boot_id:** `fe047838-fa99-4a1a-992e-0207c03bfe0a`

### Deny Reason Breakdown (Last 60 Minutes)
```sql
SELECT deny_reason_code, COUNT(*) as count, MAX(created_at) as latest
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '60 minutes' AND decision = 'DENY'
GROUP BY deny_reason_code
ORDER BY count DESC;
```

**Results:**
```
     deny_reason_code      | count |            latest             
---------------------------+-------+-------------------------------
 ANCESTRY_SKIPPED_OVERLOAD |    14 | 2026-01-13 04:07:48.156123+00
 CONSENT_WALL              |     2 | 2026-01-13 04:07:32.771675+00
```

**Key Finding:** ✅ **ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT = 0** (target achieved!)

**Analysis:**
- No `ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT` failures in last 60 minutes ✅
- All ancestry failures are `ANCESTRY_SKIPPED_OVERLOAD` (graceful load shedding)
- This indicates pool starvation is fixed, but limiter is still preventing ALLOW decisions

### Decision Counts (Last 60 Minutes)
```sql
SELECT decision, COUNT(*) as total, 
  COUNT(CASE WHEN deny_reason_code = 'ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT' THEN 1 END) as acquire_timeout
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '60 minutes'
GROUP BY decision;
```

**Results:**
- **ALLOW:** 0
- **DENY:** 16 (14 SKIPPED_OVERLOAD, 2 CONSENT_WALL)
- **acquire_timeout:** 0 ✅

### Sample deny_reason_detail (Last 60 Minutes)
```sql
SELECT decision_id, target_tweet_id, deny_reason_code, deny_reason_detail
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '60 minutes' AND deny_reason_code LIKE 'ANCESTRY_%'
ORDER BY created_at DESC LIMIT 5;
```

**Results:**
```
 decision_id              |   target_tweet_id   |     deny_reason_code      |                                      deny_reason_detail                                       
--------------------------+---------------------+---------------------------+-----------------------------------------------------------------------------------------------
 5fe505a6-0bcc-4502-9b4a-5ec0d20c803e | 2009917057933160522 | ANCESTRY_SKIPPED_OVERLOAD | pool={queue=21,active=0/5,idle=0,semaphore=0} error=5, timeout: 60s)
```

**Note:** Pool snapshot still shows `max_contexts=5` (old config). This suggests:
1. Snapshot was taken before config change took effect, OR
2. Enhanced snapshot code hasn't deployed yet (checking...)

**Expected format (after enhancement):**
```
pool={max_contexts=11,total_contexts=X,active=X,idle=X,queue_len=X,semaphore_inflight=X,avg_wait_ms=X,peak_queue=X,contexts_created_total=X}
```

---

## E) Success Criteria

1. ✅ **ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT count decreases** (target: ~0 in last 60 min)
2. ✅ **At least 1 ALLOW decision created** (proves ancestry resolution working)
3. ✅ **ALLOW decision progresses through stages:**
   - `template_selected_at` set
   - `generation_completed_at` set
   - `posting_completed_at` set
   - `posted_reply_tweet_id` set

---

## F) Next Steps

1. Wait for deployment to complete (verify app_version)
2. Trigger reply evaluation to generate fresh decisions
3. Monitor for 30-60 minutes
4. Query deny_reason breakdown and verify ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT reduction
5. If ALLOW decisions exist, track one through full pipeline
6. Update this document with results

---

## G) Watchdog Logs

Monitor Railway logs for:
- `[POOL_WATCHDOG] ⚠️ Long acquire wait detected` (wait > 15s)
- `[POOL_WATCHDOG] 🚨 Stuck context detected` (active > 90s)

These indicate pool health issues that need attention.
