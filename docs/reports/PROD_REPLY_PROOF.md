# Production Reply Truth Verification Queries
**Purpose:** Database-only proof that reply posting is working correctly in production  
**No Railway CLI required:** Run these queries directly in Supabase SQL Editor

---

## 📊 **QUERY 1: Last 20 Reply Receipts (Last 2 Hours)**

**Purpose:** Show that receipts are being written for replies

```sql
SELECT 
  receipt_id,
  root_tweet_id,
  parent_tweet_id,
  decision_id,
  post_type,
  posted_at,
  EXTRACT(EPOCH FROM (NOW() - posted_at))/60 AS minutes_ago,
  metadata->>'target_username' AS target_username,
  metadata->>'content_preview' AS content_preview
FROM post_receipts
WHERE post_type = 'reply'
  AND posted_at > NOW() - INTERVAL '2 hours'
ORDER BY posted_at DESC
LIMIT 20;
```

**Expected Output:**
- Multiple rows (if replies have been posted in last 2 hours)
- All rows have `parent_tweet_id` NOT NULL
- All rows have `root_tweet_id` NOT NULL (the reply tweet ID)
- All rows have `decision_id` NOT NULL (link to content_metadata)

**If Empty:** No replies posted in last 2 hours (check scheduler/rate limiter)

---

## 📊 **QUERY 2: Posted Replies in Last 2 Hours**

**Purpose:** Show replies marked as posted in content_metadata

```sql
SELECT 
  decision_id,
  tweet_id,
  target_tweet_id,
  target_username,
  status,
  posted_at,
  EXTRACT(EPOCH FROM (NOW() - posted_at))/60 AS minutes_ago,
  LENGTH(content) AS content_length,
  LEFT(content, 100) AS content_preview
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'posted'
  AND posted_at > NOW() - INTERVAL '2 hours'
ORDER BY posted_at DESC
LIMIT 20;
```

**Expected Output:**
- Multiple rows (if replies have been posted)
- All rows have `tweet_id` NOT NULL
- All rows have `target_tweet_id` NOT NULL (parent tweet)
- All rows have `content` as STRING (not array)
- No `{`, `}`, `[`, `]` in content_preview

**If Empty:** No replies posted in last 2 hours

---

## 📊 **QUERY 3: Truth Gap Detection (CRITICAL)**

**Purpose:** Find posted replies that have NO receipt (indicates truth gap)

```sql
WITH posted_replies AS (
  SELECT 
    decision_id,
    tweet_id,
    target_tweet_id,
    posted_at,
    content
  FROM content_metadata
  WHERE decision_type = 'reply'
    AND status = 'posted'
    AND posted_at > NOW() - INTERVAL '2 hours'
),
reply_receipts AS (
  SELECT 
    decision_id,
    root_tweet_id,
    parent_tweet_id
  FROM post_receipts
  WHERE post_type = 'reply'
    AND posted_at > NOW() - INTERVAL '2 hours'
)
SELECT 
  pr.decision_id,
  pr.tweet_id,
  pr.target_tweet_id,
  pr.posted_at,
  EXTRACT(EPOCH FROM (NOW() - pr.posted_at))/60 AS minutes_ago,
  CASE 
    WHEN rr.decision_id IS NULL THEN '❌ NO RECEIPT'
    ELSE '✅ HAS RECEIPT'
  END AS receipt_status
FROM posted_replies pr
LEFT JOIN reply_receipts rr ON pr.decision_id = rr.decision_id
ORDER BY pr.posted_at DESC;
```

**Expected Output (Success):**
- All rows show `✅ HAS RECEIPT`
- No rows show `❌ NO RECEIPT`

**If ANY rows show `❌ NO RECEIPT`:**
- 🚨 **CRITICAL TRUTH GAP** - receipts are not being written
- Check logs for `[REPLY_TRUTH] step=RECEIPT_OK`
- Check if migration applied (`parent_tweet_id` column exists)
- Check if code is deployed

---

## 📊 **QUERY 4: Rate Limiter Compliance (4 Replies/Hour)**

**Purpose:** Verify that rate limiting is working correctly

```sql
WITH recent_replies AS (
  SELECT 
    receipt_id,
    posted_at,
    EXTRACT(EPOCH FROM (NOW() - posted_at))/60 AS minutes_ago
  FROM post_receipts
  WHERE post_type = 'reply'
    AND posted_at > NOW() - INTERVAL '1 hour'
  ORDER BY posted_at DESC
)
SELECT 
  COUNT(*) AS replies_in_last_hour,
  CASE 
    WHEN COUNT(*) <= 4 THEN '✅ COMPLIANT'
    WHEN COUNT(*) = 5 THEN '⚠️  WARNING (5/4)'
    ELSE '🚨 VIOLATION'
  END AS rate_limit_status,
  MIN(minutes_ago)::INTEGER AS oldest_reply_minutes_ago,
  MAX(minutes_ago)::INTEGER AS newest_reply_minutes_ago
FROM recent_replies;
```

**Expected Output:**
- `replies_in_last_hour` ≤ 4
- `rate_limit_status` = `✅ COMPLIANT`

**If `replies_in_last_hour` > 4:**
- 🚨 **RATE LIMIT VIOLATION** - distributed lock not working
- Check if advisory lock functions exist (pg_try_advisory_lock)
- Check if code is using `withReplyLock()` wrapper
- Check for concurrent workers bypassing lock

---

## 📊 **QUERY 5: Historical NULL tweet_id Cleanup**

**Purpose:** Verify that old bad rows have been repaired

```sql
SELECT 
  COUNT(*) AS null_tweet_id_count,
  MIN(created_at) AS oldest_null_row,
  MAX(created_at) AS newest_null_row
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'posted'
  AND (tweet_id IS NULL OR tweet_id = '');
```

**Expected Output (After Repair):**
- `null_tweet_id_count` = 0
- (No rows with NULL tweet_id)

**Before Repair:**
- `null_tweet_id_count` = 7 (old bad rows from 3-44 days ago)

**If Still > 0:**
- Run repair script: `pnpm repair:reply-null-ids`

---

## 📊 **QUERY 6: End-to-End Reply Health (Last Hour)**

**Purpose:** Complete health check for reply system

```sql
WITH reply_stats AS (
  SELECT 
    COUNT(*) FILTER (WHERE status = 'posted') AS posted_count,
    COUNT(*) FILTER (WHERE status = 'posted' AND tweet_id IS NOT NULL) AS posted_with_id_count,
    COUNT(*) FILTER (WHERE status = 'posted' AND tweet_id IS NULL) AS posted_without_id_count,
    COUNT(*) FILTER (WHERE status = 'queued') AS queued_count,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
  FROM content_metadata
  WHERE decision_type = 'reply'
    AND created_at > NOW() - INTERVAL '1 hour'
),
receipt_stats AS (
  SELECT 
    COUNT(*) AS receipt_count
  FROM post_receipts
  WHERE post_type = 'reply'
    AND posted_at > NOW() - INTERVAL '1 hour'
)
SELECT 
  rs.posted_count,
  rs.posted_with_id_count,
  rs.posted_without_id_count,
  rs.queued_count,
  rs.failed_count,
  rcs.receipt_count,
  CASE 
    WHEN rs.posted_with_id_count = rcs.receipt_count 
      AND rs.posted_without_id_count = 0 
    THEN '✅ HEALTHY'
    WHEN rs.posted_with_id_count = rcs.receipt_count 
      AND rs.posted_without_id_count > 0
    THEN '⚠️  OLD NULL ROWS (historical data)'
    WHEN rs.posted_with_id_count != rcs.receipt_count
    THEN '🚨 TRUTH GAP'
    ELSE '⚠️  UNKNOWN'
  END AS health_status
FROM reply_stats rs, receipt_stats rcs;
```

**Expected Output (Healthy):**
- `posted_count` = `posted_with_id_count`
- `posted_without_id_count` = 0
- `posted_with_id_count` = `receipt_count`
- `health_status` = `✅ HEALTHY`

**If `health_status` = `🚨 TRUTH GAP`:**
- Receipts are not being written correctly
- Check migration status
- Check logs for `[REPLY_TRUTH]` signals

---

## 🔧 **TROUBLESHOOTING GUIDE**

### **Symptom: No receipts in last 2 hours**
**Possible Causes:**
1. Migration not applied (`parent_tweet_id` column missing)
   - **Fix:** Run `railway run --service xBOT pnpm db:migrate`
2. Code not deployed (old version running)
   - **Fix:** Check Railway deployment status
3. Rate limiter blocking all replies (already at 4/hour)
   - **Check:** Query 4 (rate limiter compliance)

### **Symptom: Truth gap (posted replies without receipts)**
**Possible Causes:**
1. Receipt write failing silently
   - **Check:** Logs for `[REPLY_TRUTH] step=FAIL reason=RECEIPT_WRITE_FAILED`
2. Migration incomplete
   - **Check:** `parent_tweet_id` column exists in `post_receipts`
3. Code path bypassing receipt writer
   - **Check:** Code review of `postReply()` function

### **Symptom: Rate limit violations (>4/hour)**
**Possible Causes:**
1. Advisory lock functions not accessible
   - **Check:** Run `SELECT pg_try_advisory_lock(123456789);` (should return true)
2. Multiple workers not using lock
   - **Check:** Code uses `withReplyLock()` wrapper
3. Lock timeout too short (workers timeout before acquiring)
   - **Check:** Logs for `[REPLY_LOCK] ⏰ Lock timeout`

---

## 📈 **SUCCESS CRITERIA**

Run all 6 queries. System is **HEALTHY** if:
- ✅ Query 1: Receipts exist for recent replies
- ✅ Query 2: Posted replies exist with valid tweet_ids
- ✅ Query 3: All posted replies have receipts (no truth gaps)
- ✅ Query 4: ≤4 replies in last hour (rate limit compliant)
- ✅ Query 5: 0 NULL tweet_ids (historical cleanup complete)
- ✅ Query 6: `health_status` = `✅ HEALTHY`

---

**These queries provide complete visibility into reply posting health without requiring Railway CLI or log access.**

