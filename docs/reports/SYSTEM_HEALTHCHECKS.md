# 🏥 SYSTEM HEALTHCHECKS
## xBOT Automated Health Monitoring
### Date: December 20, 2025

---

## 🎯 OVERVIEW

This document contains **DB-only health checks** that can be run locally or in production without requiring Railway CLI access. All checks use the Supabase service role key.

---

## ✅ AUTOMATED HEALTH AUDIT

### **Command:**
```bash
pnpm audit:health
```

### **What it checks:**
1. ✅ DB Connectivity
2. ✅ Required Tables Exist
3. ✅ Posting Truth (last 2h)
4. ✅ Reply Truth (last 2h)
5. ✅ Rate Compliance (last hour)
6. ✅ Metrics Coverage (last 24h)
7. ✅ Harvester Health (last 24h)
8. ✅ Account Discovery
9. ✅ Queue Backlog
10. ✅ Orphan Receipts (last 24h)

### **Exit codes:**
- `0` = All checks PASS
- `1` = One or more checks FAIL

### **Example output:**
```
✅ DB Connectivity: Connected successfully
✅ Required Tables: All 5 tables exist
✅ Posting Truth (2h): Perfect match: 0 receipts = 0 DB entries
❌ Orphan Receipts (24h): 13 orphan receipts (posted but not in DB)

🎯 SUMMARY
✅ PASS: 8
❌ FAIL: 2
```

---

## 📋 MANUAL SQL CHECKS

### **CHECK 1: DB Connectivity**
```sql
-- Simple ping
SELECT 1 as ping;
-- Expected: 1 row with ping=1
```

### **CHECK 2: Required Tables**
```sql
-- Check all critical tables exist
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'content_metadata',
    'post_receipts',
    'system_events',
    'reply_opportunities',
    'discovered_accounts'
  )
ORDER BY tablename;
-- Expected: 5 rows
```

### **CHECK 3: Posting Truth Gap**
```sql
-- Find orphan receipts (posted to X but not in DB)
SELECT 
  r.receipt_id,
  r.decision_id,
  r.root_tweet_id,
  r.post_type,
  r.posted_at,
  EXTRACT(EPOCH FROM (NOW() - r.posted_at))/3600 as hours_ago
FROM post_receipts r
LEFT JOIN content_metadata cm 
  ON r.decision_id = cm.decision_id AND cm.status = 'posted'
WHERE r.post_type IN ('single', 'thread')
  AND r.posted_at > NOW() - INTERVAL '24 hours'
  AND cm.decision_id IS NULL
ORDER BY r.posted_at DESC;
-- Expected: 0 rows
-- Current: 13 rows (⚠️ truth gap)
```

### **CHECK 4: Null Tweet IDs in Posted Rows**
```sql
-- Find posted content without tweet_id (CRITICAL violation)
SELECT 
  decision_id,
  decision_type,
  status,
  posted_at,
  EXTRACT(EPOCH FROM (NOW() - posted_at))/3600 as hours_ago
FROM content_metadata
WHERE status = 'posted'
  AND (tweet_id IS NULL OR tweet_id = '')
  AND posted_at > NOW() - INTERVAL '24 hours'
ORDER BY posted_at DESC;
-- Expected: 0 rows
-- Current: 0 rows ✅
```

### **CHECK 5: Reply Truth**
```sql
-- Find posted replies missing parent_tweet_id
SELECT 
  decision_id,
  decision_type,
  status,
  tweet_id,
  target_tweet_id,
  posted_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'posted'
  AND (target_tweet_id IS NULL OR target_tweet_id = '')
  AND posted_at > NOW() - INTERVAL '24 hours'
ORDER BY posted_at DESC;
-- Expected: 0 rows
-- Current: 0 rows ✅
```

### **CHECK 6: Rate Compliance**
```sql
-- Check posting rate (last hour, rolling window)
SELECT 
  COUNT(*) FILTER (WHERE post_type IN ('single', 'thread')) as posts_last_hour,
  COUNT(*) FILTER (WHERE post_type = 'reply') as replies_last_hour,
  2 as posts_limit,
  4 as replies_limit,
  CASE 
    WHEN COUNT(*) FILTER (WHERE post_type IN ('single', 'thread')) > 2 THEN '❌ OVER'
    WHEN COUNT(*) FILTER (WHERE post_type = 'reply') > 4 THEN '❌ OVER'
    ELSE '✅ OK'
  END as status
FROM post_receipts
WHERE posted_at > NOW() - INTERVAL '1 hour';
-- Expected: status = '✅ OK'
```

### **CHECK 7: Hourly Rate Distribution (Last 24h)**
```sql
-- Check if any hour exceeded rate limits
SELECT 
  DATE_TRUNC('hour', posted_at AT TIME ZONE 'America/New_York') as hour_et,
  COUNT(*) FILTER (WHERE post_type IN ('single', 'thread')) as posts,
  COUNT(*) FILTER (WHERE post_type = 'reply') as replies,
  CASE 
    WHEN COUNT(*) FILTER (WHERE post_type IN ('single', 'thread')) > 2 THEN '❌ Posts over limit'
    WHEN COUNT(*) FILTER (WHERE post_type = 'reply') > 4 THEN '❌ Replies over limit'
    ELSE '✅ OK'
  END as status
FROM post_receipts
WHERE posted_at > NOW() - INTERVAL '24 hours'
GROUP BY hour_et
ORDER BY hour_et DESC;
-- Expected: All rows status = '✅ OK'
```

### **CHECK 8: Metrics Coverage**
```sql
-- Check what % of posts have metrics
SELECT 
  COUNT(*) as total_posted,
  SUM(CASE WHEN actual_likes IS NOT NULL THEN 1 ELSE 0 END) as with_metrics,
  ROUND(100.0 * SUM(CASE WHEN actual_likes IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as coverage_pct,
  CASE 
    WHEN ROUND(100.0 * SUM(CASE WHEN actual_likes IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) >= 80 THEN '✅ Good'
    WHEN ROUND(100.0 * SUM(CASE WHEN actual_likes IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) >= 50 THEN '⚠️ Low'
    ELSE '❌ Critical'
  END as status
FROM content_metadata
WHERE status = 'posted'
  AND posted_at > NOW() - INTERVAL '24 hours'
  AND posted_at < NOW() - INTERVAL '2 hours'; -- Allow 2h for first scrape
-- Expected: coverage_pct > 80%, status = '✅ Good'
-- Current: 95.1% ✅
```

### **CHECK 9: Harvester Health**
```sql
-- Check opportunity discovery rate
SELECT 
  COUNT(*) as opportunities_last_24h,
  20 as target_minimum,
  CASE 
    WHEN COUNT(*) >= 20 THEN '✅ Healthy'
    WHEN COUNT(*) >= 10 THEN '⚠️ Low'
    ELSE '❌ Critical'
  END as status
FROM reply_opportunities
WHERE created_at > NOW() - INTERVAL '24 hours';
-- Expected: opportunities_last_24h >= 20, status = '✅ Healthy'
-- Current: 99 ✅
```

### **CHECK 10: Account Discovery**
```sql
-- Check discovered accounts
SELECT 
  COUNT(*) as total_accounts,
  COUNT(*) FILTER (WHERE discovery_date > NOW() - INTERVAL '24 hours') as added_last_24h,
  CASE 
    WHEN COUNT(*) >= 100 THEN '✅ Healthy'
    WHEN COUNT(*) >= 10 THEN '⚠️ Low'
    ELSE '❌ Critical'
  END as status
FROM discovered_accounts;
-- Expected: total_accounts >= 100, status = '✅ Healthy'
-- Current: 1000 total, 65 added/24h ✅
```

### **CHECK 11: Queue Backlog**
```sql
-- Check for stale queued items
SELECT 
  COUNT(*) as total_queued,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '6 hours') as stale_items,
  CASE 
    WHEN COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '6 hours') = 0 THEN '✅ Fresh'
    WHEN COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '6 hours') <= 3 THEN '⚠️ Some stale'
    ELSE '❌ Many stale'
  END as status
FROM content_metadata
WHERE status IN ('pending', 'ready', 'queued');
-- Expected: stale_items = 0, status = '✅ Fresh'
-- Current: 3/5 stale ⚠️
```

### **CHECK 12: Job Heartbeats**
```sql
-- Check when each job last ran
SELECT 
  component as job_name,
  MAX(timestamp) as last_run,
  EXTRACT(EPOCH FROM (NOW() - MAX(timestamp)))/60 as minutes_ago,
  CASE 
    WHEN MAX(timestamp) > NOW() - INTERVAL '2 hours' THEN '✅ Recent'
    WHEN MAX(timestamp) > NOW() - INTERVAL '6 hours' THEN '⚠️ Stale'
    ELSE '❌ Dead'
  END as status
FROM system_events
WHERE event_type IN ('job_success', 'job_started')
GROUP BY component
ORDER BY last_run DESC;
-- Expected: All critical jobs status = '✅ Recent'
```

---

## 🔍 DIAGNOSTIC QUERIES

### **Find Recent Posts**
```sql
SELECT 
  cm.decision_id,
  cm.decision_type,
  cm.tweet_id,
  cm.posted_at,
  r.receipt_id,
  r.root_tweet_id,
  CASE 
    WHEN cm.decision_id IS NOT NULL AND r.receipt_id IS NOT NULL THEN '✅ Complete'
    WHEN cm.decision_id IS NULL AND r.receipt_id IS NOT NULL THEN '❌ Orphan receipt'
    WHEN cm.decision_id IS NOT NULL AND r.receipt_id IS NULL THEN '⚠️ Missing receipt'
    ELSE '❓ Unknown'
  END as truth_status
FROM content_metadata cm
FULL OUTER JOIN post_receipts r ON cm.decision_id = r.decision_id
WHERE COALESCE(cm.posted_at, r.posted_at) > NOW() - INTERVAL '2 hours'
ORDER BY COALESCE(cm.posted_at, r.posted_at) DESC;
```

### **Find Decision by Tweet ID**
```sql
SELECT 
  decision_id,
  decision_type,
  status,
  tweet_id,
  posted_at,
  'https://x.com/SignalAndSynapse/status/' || tweet_id as url
FROM content_metadata
WHERE tweet_id = '...' -- Replace with actual tweet ID
  OR thread_tweet_ids::text LIKE '%...'||'%'; -- Search in thread IDs too
```

### **Recent Errors in System Events**
```sql
SELECT 
  timestamp AT TIME ZONE 'America/New_York' as time_et,
  component,
  event_type,
  severity,
  message,
  metadata
FROM system_events
WHERE severity IN ('error', 'critical')
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC
LIMIT 50;
```

### **Posting Velocity (Posts per Hour)**
```sql
SELECT 
  DATE_TRUNC('hour', posted_at AT TIME ZONE 'America/New_York') as hour_et,
  COUNT(*) as total_posts,
  COUNT(*) FILTER (WHERE post_type = 'single') as singles,
  COUNT(*) FILTER (WHERE post_type = 'thread') as threads,
  COUNT(*) FILTER (WHERE post_type = 'reply') as replies
FROM post_receipts
WHERE posted_at > NOW() - INTERVAL '24 hours'
GROUP BY hour_et
ORDER BY hour_et DESC;
```

---

## 🚨 ALERT THRESHOLDS

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| **Orphan receipts** | 0 | 1-5 | >5 |
| **Null tweet_ids** | 0 | 0 | >0 (FAIL) |
| **Metrics coverage** | >80% | 50-80% | <50% |
| **Harvester yield** | >20/day | 10-20/day | <10/day |
| **Account pool** | >100 | 10-100 | <10 |
| **Queue backlog** | <10 items | 10-50 items | >50 items |
| **Stale items** | 0 | 1-3 | >3 |
| **Posting rate** | 1.5-2.5/hr | 1-1.5 or 2.5-3/hr | <1 or >3/hr |
| **Job heartbeats** | <2h ago | 2-6h ago | >6h ago |

---

## 📊 MONITORING DASHBOARD (SQL)

### **System Health at a Glance**
```sql
WITH health_metrics AS (
  -- Posting truth
  SELECT 
    'orphan_receipts' as metric,
    COUNT(*) as value,
    '0' as target,
    CASE WHEN COUNT(*) = 0 THEN '✅' WHEN COUNT(*) <= 5 THEN '⚠️' ELSE '❌' END as status
  FROM post_receipts r
  LEFT JOIN content_metadata cm ON r.decision_id = cm.decision_id AND cm.status = 'posted'
  WHERE r.posted_at > NOW() - INTERVAL '24 hours' AND cm.decision_id IS NULL
  
  UNION ALL
  
  -- Metrics coverage
  SELECT 
    'metrics_coverage_pct',
    ROUND(100.0 * SUM(CASE WHEN actual_likes IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1),
    '80',
    CASE 
      WHEN ROUND(100.0 * SUM(CASE WHEN actual_likes IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) >= 80 THEN '✅'
      WHEN ROUND(100.0 * SUM(CASE WHEN actual_likes IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) >= 50 THEN '⚠️'
      ELSE '❌'
    END
  FROM content_metadata
  WHERE status = 'posted' AND posted_at > NOW() - INTERVAL '24 hours'
  
  UNION ALL
  
  -- Harvester yield
  SELECT 
    'harvester_opportunities_24h',
    COUNT(*),
    '20',
    CASE WHEN COUNT(*) >= 20 THEN '✅' WHEN COUNT(*) >= 10 THEN '⚠️' ELSE '❌' END
  FROM reply_opportunities
  WHERE created_at > NOW() - INTERVAL '24 hours'
  
  UNION ALL
  
  -- Account discovery
  SELECT 
    'total_accounts',
    COUNT(*),
    '100',
    CASE WHEN COUNT(*) >= 100 THEN '✅' WHEN COUNT(*) >= 10 THEN '⚠️' ELSE '❌' END
  FROM discovered_accounts
  
  UNION ALL
  
  -- Stale queue items
  SELECT 
    'stale_queue_items',
    COUNT(*),
    '0',
    CASE WHEN COUNT(*) = 0 THEN '✅' WHEN COUNT(*) <= 3 THEN '⚠️' ELSE '❌' END
  FROM content_metadata
  WHERE status IN ('pending', 'ready', 'queued') AND created_at < NOW() - INTERVAL '6 hours'
)
SELECT * FROM health_metrics ORDER BY metric;
```

---

## 🔧 QUICK FIXES

### **Fix Orphan Receipts:**
```bash
pnpm truth:reconcile:last24h
```

### **Clear Stale Queue Items:**
```sql
-- Mark old pending items as expired
UPDATE content_metadata
SET status = 'expired'
WHERE status IN ('pending', 'ready')
  AND created_at < NOW() - INTERVAL '24 hours';
```

### **Verify Specific Tweet:**
```bash
# By tweet ID
pnpm find:content:metadata:base <tweet_id>

# By decision ID
pnpm verify:thread <decision_id>
```

---

## 📋 DAILY CHECKLIST

```bash
# Morning check (run locally or in Railway)
pnpm audit:health

# If any FAIL:
# 1. Run reconciliation
pnpm truth:reconcile:last24h

# 2. Check logs for errors
railway logs --service xBOT | grep -i error | tail -n 50

# 3. Verify posting is happening
railway logs --service xBOT | grep "\[POSTING_QUEUE\]\[SUCCESS\]" | tail -n 10

# 4. Re-run audit
pnpm audit:health
```

---

**These health checks are the operational heartbeat of xBOT. Run daily, act on failures immediately.**

