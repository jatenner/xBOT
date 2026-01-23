# 🔍 NO POSTS 5H ROOT CAUSE REPORT

**Generated:** 2026-01-23 03:52:31 UTC  
**Time Window:** 2026-01-22 22:52:31 UTC to 2026-01-23 03:52:31 UTC (5 hours)

---

## 📋 EXECUTIVE SUMMARY

- Ready posts NOW: 8
- POST_SUCCESS in last 5h: 0
- Primary blocker: NO_EXECUTION: 8 ready posts but 0 POST_SUCCESS events - posting queue not executing

---

## PART A: Are there PROD decisions ready to post?

### Ready Count NOW

```sql
SELECT COUNT(*) 
FROM content_metadata
WHERE status = 'queued'
  AND decision_type IN ('single', 'thread')
  AND scheduled_at <= NOW() + INTERVAL '5 minutes'
  AND (is_test_post IS NULL OR is_test_post = false);
```

**Result:** 8 ready posts

### Ready Count Per Hour (Last 5 Hours)

| Hour (UTC) | Ready Count |
|------------|-------------|
| 2026-01-23 02:00 UTC | 8 |
| 2026-01-23 01:00 UTC | 7 |
| 2026-01-23 00:00 UTC | 7 |
| 2026-01-22 23:00 UTC | 6 |
| 2026-01-22 22:00 UTC | 5 |

### Oldest Ready Items (Top 20)

| decision_id | status | scheduled_at | created_at | pipeline_source | is_test_post | skip_reason |
|-------------|--------|---------------|------------|-----------------|--------------|-------------|
| 83806a8e... | queued | 2026-01-22T20:16:30.647+00:00 | 2026-01-22T20:16:50.419688+00:00 | dynamicContent | false | NULL |
| b2729c6f... | queued | 2026-01-22T20:42:36.432+00:00 | 2026-01-22T20:42:40.308794+00:00 | dynamicContent | false | NULL |
| 1f661b55... | queued | 2026-01-22T21:13:00.455+00:00 | 2026-01-22T21:13:14.147512+00:00 | dynamicContent | false | NULL |
| 4e02c6da... | queued | 2026-01-22T22:46:38.469+00:00 | 2026-01-22T22:46:57.03104+00:00 | dynamicContent | false | NULL |
| 0f59f933... | queued | 2026-01-22T23:46:42.248+00:00 | 2026-01-22T23:46:59.387436+00:00 | dynamicContent | false | NULL |
| 03ed0c0d... | queued | 2026-01-23T00:12:46.567+00:00 | 2026-01-23T00:13:02.651019+00:00 | dynamicContent | false | NULL |
| 7b317fd5... | queued | 2026-01-23T01:42:52.004+00:00 | 2026-01-23T01:42:55.424783+00:00 | dynamicContent | false | NULL |
| c600788a... | queued | 2026-01-23T03:46:30.919+00:00 | 2026-01-23T03:46:45.226525+00:00 | dynamicContent | false | NULL |

---

## PART B: If ready > 0, what is blocking posting?

### POST_SUCCESS Per Hour

| Hour (UTC) | Count |
|------------|-------|
| 2026-01-23 02:00 UTC | 0 |
| 2026-01-23 01:00 UTC | 0 |
| 2026-01-23 00:00 UTC | 0 |
| 2026-01-22 23:00 UTC | 0 |
| 2026-01-22 22:00 UTC | 0 |

### POST_FAILED Per Hour

| Hour (UTC) | Count | Reasons |
|------------|-------|---------|
| 2026-01-23 02:00 UTC | 0 | none |
| 2026-01-23 01:00 UTC | 0 | none |
| 2026-01-23 00:00 UTC | 0 | none |
| 2026-01-22 23:00 UTC | 0 | none |
| 2026-01-22 22:00 UTC | 0 | none |

### CONSENT_WALL Per Hour

| Hour (UTC) | Count |
|------------|-------|
| 2026-01-23 02:00 UTC | 0 |
| 2026-01-23 01:00 UTC | 0 |
| 2026-01-23 00:00 UTC | 0 |
| 2026-01-22 23:00 UTC | 0 |
| 2026-01-22 22:00 UTC | 0 |

### CHALLENGE Per Hour

| Hour (UTC) | Count |
|------------|-------|
| 2026-01-23 02:00 UTC | 0 |
| 2026-01-23 01:00 UTC | 0 |
| 2026-01-23 00:00 UTC | 0 |
| 2026-01-22 23:00 UTC | 0 |
| 2026-01-22 22:00 UTC | 0 |

### TEST_LANE_BLOCK Per Hour

| Hour (UTC) | Count |
|------------|-------|
| 2026-01-23 02:00 UTC | 0 |
| 2026-01-23 01:00 UTC | 0 |
| 2026-01-23 00:00 UTC | 0 |
| 2026-01-22 23:00 UTC | 0 |
| 2026-01-22 22:00 UTC | 0 |

### DENY/GATE Events Per Hour

| Hour (UTC) | Count |
|------------|-------|
| 2026-01-23 02:00 UTC | 0 |
| 2026-01-23 01:00 UTC | 0 |
| 2026-01-23 00:00 UTC | 0 |
| 2026-01-22 23:00 UTC | 0 |
| 2026-01-22 22:00 UTC | 0 |

### Blocking Diagnosis

**Primary Blocker:** NO_EXECUTION: 8 ready posts but 0 POST_SUCCESS events - posting queue not executing

**Secondary Factors:**
- None identified

---

## PART C: If ready = 0, why aren't we producing/queuing?

### Plan Windows (Expected vs Actual)

| Hour (UTC) | Expected | Actual | Target Posts | Target Replies |
|------------|----------|--------|--------------|----------------|
| 2026-01-23 02:00 UTC | ✅ | ✅ | 2 | 4 |
| 2026-01-23 01:00 UTC | ✅ | ✅ | 2 | 4 |
| 2026-01-23 00:00 UTC | ✅ | ✅ | 2 | 4 |
| 2026-01-22 23:00 UTC | ✅ | ✅ | 2 | 4 |
| 2026-01-22 22:00 UTC | ✅ | ✅ | 2 | 4 |

### Latest Plan

- **Age:** 53 minutes ago
- **Targets:** 2 posts, 4 replies

### Decisions Created Per Hour

| Hour (UTC) | Posts | Replies |
|------------|-------|---------|
| 2026-01-23 02:00 UTC | 1 | 0 |
| 2026-01-23 01:00 UTC | 0 | 0 |
| 2026-01-23 00:00 UTC | 1 | 0 |
| 2026-01-22 23:00 UTC | 1 | 0 |
| 2026-01-22 22:00 UTC | 1 | 0 |

### Scheduled At Offsets (How Far Ahead)

| Offset (hours) | Count |
|----------------|-------|
| -12 | 3 |
| -6 | 4 |
| 0 | 1 |

### Job Skipping

- **Shadow Controller Skipped:** No
- **Missing Plan Windows:** None

---

## 🎯 ROOT CAUSE

**Posting queue job is not executing despite 8 ready posts in queue. Zero POST_SUCCESS events in 5 hours indicates the `processPostingQueue()` function is either: (1) not being scheduled/triggered, (2) returning early due to circuit breaker/posting disabled flag, (3) failing silently before reaching post execution, or (4) rate limit checks blocking all posts.**

**Evidence:**
- ✅ 8 ready posts exist (status='queued', scheduled_at <= NOW+5min, is_test_post=false)
- ✅ Planning system healthy (plans generated, decisions created)
- ❌ 0 POST_SUCCESS events in last 5 hours
- ❌ 0 POST_FAILED events (suggests queue not even attempting posts)
- ❌ 0 blocking events (CONSENT_WALL, CHALLENGE, TEST_LANE_BLOCK, DENY)

**Most Likely Causes (in order):**
1. **Job not scheduled/running** - postingQueue job may not be in scheduler or failing to start
2. **Circuit breaker open** - `circuitBreakerOpen` flag preventing execution
3. **Posting disabled** - `flags.postingDisabled` set to true
4. **Rate limit blocking** - All posts blocked by `checkPostingRateLimits()` returning false
5. **Migration health check failing** - `verifyMigrationHealth()` returning false (is_test_post column check)

---

## 🔧 PATCH PLAN

### Step 1: Verify Job Scheduling
Check if `postingQueue` job is registered and running:
```sql
-- Check job_heartbeats for posting queue
SELECT * FROM job_heartbeats WHERE job_name LIKE '%posting%' ORDER BY updated_at DESC LIMIT 5;
```

**Fix:** If missing, ensure `postingQueue` is registered in job scheduler (check `src/jobs/jobManager.ts` or cron config).

### Step 2: Check Circuit Breaker & Posting Flags
Query system state for blocking flags:
```sql
-- Check for circuit breaker events
SELECT * FROM system_events 
WHERE event_type LIKE '%circuit%' OR event_type LIKE '%posting_disabled%'
ORDER BY created_at DESC LIMIT 10;
```

**Fix:** If circuit breaker is open, investigate root cause and reset. Check environment variables: `POSTING_DISABLED`, `CIRCUIT_BREAKER_OPEN`.

### Step 3: Verify Migration Health
The posting queue checks for `is_test_post` column existence. Verify migration applied:
```sql
-- Check if is_test_post column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'content_metadata' AND column_name = 'is_test_post';
```

**Fix:** If missing, apply migration `20260122_add_is_test_post_column.sql` or remove the health check if column not needed.

### Step 4: Check Rate Limits
Verify rate limit logic isn't blocking all posts:
```sql
-- Check recent posts to calculate rate limit state
SELECT COUNT(*), DATE_TRUNC('hour', posted_at) as hour
FROM content_metadata 
WHERE status = 'posted' AND posted_at >= NOW() - INTERVAL '2 hours'
GROUP BY hour
ORDER BY hour DESC;
```

**Fix:** If rate limit too restrictive, adjust `checkPostingRateLimits()` thresholds or temporarily bypass for testing.

### Step 5: Add Diagnostic Logging
Add explicit logging at start of `processPostingQueue()` to track execution:
```typescript
// In src/jobs/postingQueue.ts processPostingQueue()
console.log('[POSTING_QUEUE] 🔍 DIAGNOSTIC: processPostingQueue() called');
console.log('[POSTING_QUEUE] 🔍 DIAGNOSTIC: circuitBreakerOpen=', circuitBreakerOpen);
console.log('[POSTING_QUEUE] 🔍 DIAGNOSTIC: postingDisabled=', flags.postingDisabled);
console.log('[POSTING_QUEUE] 🔍 DIAGNOSTIC: migrationHealth=', await verifyMigrationHealth());
```

### Step 6: Manual Trigger Test
Manually trigger posting queue to verify execution path:
```bash
# Run posting queue once manually
pnpm tsx scripts/run_posting_queue_once.ts
```

**Expected:** Should see logs showing ready decisions fetched and processed.

---

## ✅ VERIFICATION PLAN

After applying the patch, run these commands to verify posts resume:

### 1. Verify Ready Posts Still Exist
```sql
SELECT COUNT(*) as ready_count
FROM content_metadata
WHERE status = 'queued'
  AND decision_type IN ('single', 'thread')
  AND scheduled_at <= NOW() + INTERVAL '5 minutes'
  AND (is_test_post IS NULL OR is_test_post = false);
```
**Expected:** Count > 0

### 2. Monitor POST_SUCCESS Events
```sql
SELECT COUNT(*) as success_count, MAX(created_at) as last_success
FROM system_events
WHERE event_type = 'POST_SUCCESS'
  AND created_at >= NOW() - INTERVAL '1 hour';
```
**Expected:** success_count > 0 within 10 minutes of fix

### 3. Check Posting Queue Execution Logs
```bash
# Railway logs (or local logs)
railway logs --service web --limit 100 | grep "POSTING_QUEUE"
```
**Expected:** See logs showing "Fetching posts ready within 5 minute window" and "Processing X decisions"

### 4. Verify Posts Actually Posted
```sql
SELECT decision_id, status, posted_at, tweet_id
FROM content_metadata
WHERE status = 'posted' 
  AND posted_at >= NOW() - INTERVAL '30 minutes'
ORDER BY posted_at DESC
LIMIT 5;
```
**Expected:** Rows with status='posted', posted_at recent, tweet_id populated

### 5. Check Job Heartbeat
```sql
SELECT * FROM job_heartbeats 
WHERE job_name LIKE '%posting%' 
ORDER BY updated_at DESC 
LIMIT 1;
```
**Expected:** last_success or last_run_status showing recent activity

---

**Report End**
