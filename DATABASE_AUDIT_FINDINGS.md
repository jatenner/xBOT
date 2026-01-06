# 🔍 DATABASE AUDIT FINDINGS

## 🎯 YOUR REQUEST
- Find latest 2 POSTS (singles/threads, NOT replies)
- Check why posts are showing as replies in dashboard
- Verify database integrity

---

## 📋 SQL QUERIES TO RUN

**File:** `FIND_LATEST_2_POSTS.sql`

Run these in **Supabase SQL Editor**:

### **Query 1: Latest 2 Posts**
```sql
SELECT 
  decision_id,
  decision_type,
  status,
  LEFT(content, 100) as content_preview,
  posted_at,
  created_at,
  tweet_id,
  actual_impressions,
  actual_likes
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
ORDER BY COALESCE(posted_at, created_at) DESC
LIMIT 2;
```

### **Query 2: Count by Type**
```sql
SELECT 
  decision_type,
  status,
  COUNT(*) as count,
  MAX(COALESCE(posted_at, created_at)) as latest_post
FROM content_metadata
WHERE status = 'posted'
GROUP BY decision_type, status
ORDER BY decision_type, status;
```

### **Query 3: Latest 10 Items Overall**
```sql
SELECT 
  decision_id,
  decision_type,
  status,
  LEFT(content, 80) as content_preview,
  posted_at,
  created_at,
  tweet_id
FROM content_metadata
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔍 CODE ANALYSIS FINDINGS

### **✅ Content Generation Code Looks Correct**

**planJob.ts (line 773):**
```typescript
decision_type: content.format === 'thread' ? 'thread' : 'single'
```
✅ Correctly sets `'single'` or `'thread'`

**planJobUnified.ts (line 354):**
```typescript
const decisionType: 'single' | 'thread' = generated.format;
decision_type: decisionType
```
✅ Correctly sets `'single'` or `'thread'`

### **✅ Dashboard Query Looks Correct**

**postsOverview.ts (line 207):**
```typescript
.in('decision_type', ['single', 'thread', 'reply'])
.eq('status', 'posted')
.order('posted_at', { ascending: false })
```
✅ Should show all types, ordered by `posted_at`

---

## 🚨 POSSIBLE ISSUES

### **Issue 1: All Recent Items Are Actually Replies**
**If Query #2 shows all `decision_type='reply'`:**
- Content generation might not be running
- Only reply system is posting
- **Check:** Railway logs for `[UNIFIED_PLAN]` or `[QUEUE_CONTENT]`

### **Issue 2: Posts Not Being Generated**
**If Query #1 returns 0 rows:**
- `planJob` might not be running
- Content generation might be failing
- **Check:** Railway logs for planJob errors

### **Issue 3: Data Corruption**
**If Query #3 shows singles/threads with `target_tweet_id`:**
- Data was saved incorrectly
- Need to fix existing data
- **Check:** Run corruption queries in `FIND_LATEST_2_POSTS.sql`

### **Issue 4: Missing posted_at Dates**
**If Query #1 shows `posted_at IS NULL`:**
- `markDecisionPosted` not running
- Posting succeeded but database update failed
- **Check:** Railway logs for `[POSTING_QUEUE]` errors

---

## 📊 EXPECTED RESULTS

### **Healthy Database Should Show:**

**Query #2 (Count by Type):**
```
decision_type | status  | count
--------------|---------|-------
single        | posted  | 50+
thread        | posted  | 5-10
reply         | posted  | 100+
```

**Query #1 (Latest 2 Posts):**
```
Should return 2 rows with:
- decision_type: 'single' or 'thread'
- posted_at: recent timestamp
- tweet_id: not null
- content: actual post content
```

---

## 🎯 NEXT STEPS

1. **Run SQL queries** in Supabase SQL Editor
2. **Share results** - I'll identify exact issue
3. **Check Railway logs** for:
   - `[UNIFIED_PLAN]` - Content generation
   - `[POSTING_QUEUE]` - Posting status
   - `[QUEUE_CONTENT]` - Queue operations
4. **Fix based on findings**

---

## 🔧 IF NO POSTS FOUND

If Query #1 returns 0 rows, check:

1. **Is planJob running?**
   - Check Railway logs for `[UNIFIED_PLAN]` or `[QUEUE_CONTENT]`
   - Should see: `✅ Generated X decisions`

2. **Are posts being queued?**
   - Check Railway logs for: `✅ Successfully stored decision`
   - Should see database inserts

3. **Are posts being posted?**
   - Check Railway logs for: `[POSTING_QUEUE] ✅ Posted`
   - Should see posting activity

4. **Database constraint issue?**
   - Check Railway logs for: `violates check constraint`
   - Might be blocking saves

---

**Run the SQL queries and share results!**




