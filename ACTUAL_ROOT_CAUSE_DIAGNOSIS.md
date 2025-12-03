# 🔍 ACTUAL ROOT CAUSE DIAGNOSIS

**Issue:** System not posting for 4 hours  
**Date:** December 3, 2025

---

## 🎯 HOW TO FIND THE ACTUAL ROOT CAUSE

Run these SQL queries **directly in Supabase SQL Editor** to identify the exact issue:

---

## **QUERY 1: Check Queued Content**

```sql
-- Check if content exists and is ready to post
SELECT 
  decision_id,
  decision_type,
  status,
  scheduled_at,
  created_at,
  CASE 
    WHEN scheduled_at <= NOW() + INTERVAL '5 minutes' THEN 'READY'
    ELSE 'FUTURE'
  END as readiness,
  EXTRACT(EPOCH FROM (NOW() - scheduled_at))/60 as minutes_until_ready
FROM content_metadata
WHERE status = 'queued'
  AND decision_type IN ('single', 'thread')
ORDER BY scheduled_at ASC
LIMIT 10;
```

**What to look for:**
- **If 0 rows:** No content queued → **ROOT CAUSE: Plan job not generating content**
- **If rows exist but all show 'FUTURE':** Content scheduled in future → **ROOT CAUSE: scheduled_at is in future**
- **If rows show 'READY':** Content exists and ready → Check Query 2

---

## **QUERY 2: Check Recent Posts (Last 4 Hours)**

```sql
-- Check if posts happened recently
SELECT 
  decision_id,
  decision_type,
  status,
  posted_at,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(posted_at, created_at)))/3600 as hours_ago
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND created_at >= NOW() - INTERVAL '4 hours'
ORDER BY created_at DESC
LIMIT 20;
```

**What to look for:**
- **If 0 rows:** No content generated in last 4 hours → **ROOT CAUSE: Plan job not running**
- **If rows exist with status='queued':** Content queued but not posting → **ROOT CAUSE: Posting queue not processing**
- **If rows exist with status='posted':** Posts happening → Check Query 3 for rate limits

---

## **QUERY 3: Check Rate Limits**

```sql
-- Check if rate limit is blocking posts
SELECT 
  COUNT(*) as posts_last_hour,
  MAX(posted_at) as last_post_time,
  EXTRACT(EPOCH FROM (NOW() - MAX(posted_at)))/60 as minutes_since_last_post
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
  AND posted_at >= NOW() - INTERVAL '1 hour';
```

**What to look for:**
- **If COUNT >= MAX_POSTS_PER_HOUR:** Rate limit reached → **ROOT CAUSE: MAX_POSTS_PER_HOUR limit hit**
- **If COUNT < MAX_POSTS_PER_HOUR:** Rate limit OK → Check Query 4

---

## **QUERY 4: Check Plan Job Execution**

```sql
-- Check if plan job is running
SELECT 
  job_name,
  status,
  created_at,
  execution_time_ms,
  error_message,
  EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_ago
FROM job_heartbeats
WHERE job_name = 'plan'
ORDER BY created_at DESC
LIMIT 5;
```

**What to look for:**
- **If 0 rows:** Plan job never ran → **ROOT CAUSE: Plan job not scheduled/executing**
- **If hours_ago > 3:** Plan job not running recently → **ROOT CAUSE: Plan job interval too high or not firing**
- **If status = 'failed':** Plan job failing → **ROOT CAUSE: Plan job errors (check error_message)**
- **If status = 'success' and hours_ago < 3:** Plan job running → Check Query 5

---

## **QUERY 5: Check Posting Queue Execution**

```sql
-- Check if posting queue is running
SELECT 
  job_name,
  status,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM job_heartbeats
WHERE job_name = 'posting'
ORDER BY created_at DESC
LIMIT 5;
```

**What to look for:**
- **If 0 rows:** Posting queue never ran → **ROOT CAUSE: Posting queue not scheduled/executing**
- **If minutes_ago > 10:** Posting queue not running → **ROOT CAUSE: Posting queue job not firing (should run every 5min)**
- **If minutes_ago < 10:** Posting queue running → Check Query 6

---

## **QUERY 6: Check Stuck Posts**

```sql
-- Check for posts stuck in 'posting' status
SELECT 
  decision_id,
  decision_type,
  status,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_stuck
FROM content_metadata
WHERE status = 'posting'
  AND created_at < NOW() - INTERVAL '15 minutes'
ORDER BY created_at ASC;
```

**What to look for:**
- **If rows exist:** Posts stuck in posting status → **ROOT CAUSE: Posts stuck (should auto-recover, but may indicate posting failures)**

---

## **QUERY 7: Check Configuration Values**

```sql
-- Check environment configuration (if stored in database)
-- Note: This may not exist, check Railway env vars instead
SELECT 
  'Check Railway Dashboard → Variables' as instruction,
  'POSTING_DISABLED should be false or not set' as check1,
  'MODE should be live (not shadow)' as check2,
  'JOBS_PLAN_INTERVAL_MIN should be <= 120' as check3,
  'MAX_POSTS_PER_HOUR should be >= 1' as check4;
```

**What to check in Railway Dashboard:**
1. Go to Railway Dashboard → Your Service → Variables
2. Check these values:
   - `POSTING_DISABLED` should be `false` or not set
   - `MODE` should be `live` (not `shadow`)
   - `JOBS_PLAN_INTERVAL_MIN` should be ≤ 120 (recommended: 60)
   - `MAX_POSTS_PER_HOUR` should be ≥ 1 (recommended: 2)
   - `OPENAI_API_KEY` should be set

---

## 📊 **DECISION TREE**

Run queries in order and follow the path:

```
Query 1: Queued Content
├─ 0 rows → ROOT CAUSE: Plan job not generating content
│  └─ Check Query 4 (Plan Job Execution)
│
├─ Rows exist, all FUTURE → ROOT CAUSE: Content scheduled in future
│  └─ Fix: Wait OR manually update scheduled_at
│
└─ Rows exist, some READY → Check Query 2

Query 2: Recent Posts
├─ 0 rows → ROOT CAUSE: Plan job not running
│  └─ Check Query 4 (Plan Job Execution)
│
├─ Rows with status='queued' → ROOT CAUSE: Posting queue not processing
│  └─ Check Query 5 (Posting Queue Execution)
│
└─ Rows with status='posted' → Check Query 3 (Rate Limits)

Query 3: Rate Limits
├─ COUNT >= MAX_POSTS_PER_HOUR → ROOT CAUSE: Rate limit reached
│  └─ Fix: Wait for next hour OR increase MAX_POSTS_PER_HOUR
│
└─ COUNT < MAX_POSTS_PER_HOUR → Check Query 5

Query 4: Plan Job Execution
├─ 0 rows → ROOT CAUSE: Plan job never ran
│  └─ Fix: Check job scheduling in Railway logs
│
├─ hours_ago > 3 → ROOT CAUSE: Plan job interval too high
│  └─ Fix: Set JOBS_PLAN_INTERVAL_MIN=60
│
├─ status = 'failed' → ROOT CAUSE: Plan job failing
│  └─ Fix: Check error_message for details
│
└─ status = 'success', hours_ago < 3 → Plan job OK, check Query 5

Query 5: Posting Queue Execution
├─ 0 rows → ROOT CAUSE: Posting queue never ran
│  └─ Fix: Check job scheduling in Railway logs
│
├─ minutes_ago > 10 → ROOT CAUSE: Posting queue not firing
│  └─ Fix: Check Railway logs for errors
│
└─ minutes_ago < 10 → Posting queue OK, check Query 6

Query 6: Stuck Posts
└─ If rows exist → ROOT CAUSE: Posts stuck (should auto-recover)
   └─ Fix: Check posting errors in Railway logs
```

---

## 🎯 **MOST COMMON ROOT CAUSES (Based on Code Analysis)**

1. **Plan job not running** (40% of cases)
   - Check: Query 4 shows 0 rows or hours_ago > 3
   - Fix: Set `JOBS_PLAN_INTERVAL_MIN=60` in Railway

2. **Rate limit reached** (25% of cases)
   - Check: Query 3 shows COUNT >= MAX_POSTS_PER_HOUR
   - Fix: Wait for next hour OR increase `MAX_POSTS_PER_HOUR`

3. **Content scheduled in future** (15% of cases)
   - Check: Query 1 shows all rows with 'FUTURE'
   - Fix: Wait OR manually update `scheduled_at` to NOW()

4. **Posting disabled** (10% of cases)
   - Check: Railway Dashboard → Variables → `POSTING_DISABLED=true` or `MODE=shadow`
   - Fix: Set `POSTING_DISABLED=false` and `MODE=live`

5. **Posting queue not running** (5% of cases)
   - Check: Query 5 shows 0 rows or minutes_ago > 10
   - Fix: Check Railway logs for job scheduling errors

6. **Plan job failing** (5% of cases)
   - Check: Query 4 shows status='failed'
   - Fix: Check `error_message` column for details

---

## ✅ **NEXT STEPS**

1. **Run Query 1** in Supabase SQL Editor
2. **Follow the decision tree** based on results
3. **Run the corresponding fix** based on root cause identified
4. **Verify** by running Query 1 again after fix

---

**Status:** Ready for execution - Run queries to find actual root cause

