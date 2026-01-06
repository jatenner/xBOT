# 🔍 LATEST POSTS AUDIT - COMPLETE

## 📋 WHAT I'VE DONE

1. ✅ **Created SQL queries** (`FIND_LATEST_2_POSTS.sql`) to check database directly
2. ✅ **Analyzed code** - Content generation looks correct
3. ✅ **Created audit report** (`DATABASE_AUDIT_FINDINGS.md`)
4. ✅ **Checked Railway logs** - No recent activity found

---

## 🎯 TO FIND YOUR LATEST 2 POSTS

### **Option 1: Run SQL in Supabase (RECOMMENDED)**

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and run this query:

```sql
-- Latest 2 POSTS (singles/threads, NOT replies)
SELECT 
  decision_id,
  decision_type,
  status,
  LEFT(content, 100) as content_preview,
  posted_at,
  created_at,
  tweet_id,
  actual_impressions,
  actual_likes,
  target_tweet_id
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
ORDER BY COALESCE(posted_at, created_at) DESC
LIMIT 2;
```

**This will show:**
- Your latest 2 posts (if they exist)
- Their content preview
- When they were posted
- Their metrics

### **Option 2: Check Dashboard Directly**

The dashboard at `/dashboard/posts` should show:
- All items with `status='posted'`
- Filtered by `decision_type IN ('single', 'thread', 'reply')`
- Ordered by `posted_at DESC`

**If dashboard shows all replies:**
- Either all recent items ARE replies (not a bug)
- Or posts aren't being generated/posted

---

## 🔍 CODE ANALYSIS RESULTS

### **✅ Content Generation Code is CORRECT**

**Files checked:**
- `src/jobs/planJob.ts` - Sets `decision_type: 'single'` or `'thread'` ✅
- `src/jobs/planJobUnified.ts` - Sets `decision_type: 'single'` or `'thread'` ✅
- `src/dashboard/postsOverview.ts` - Queries all types correctly ✅

**Conclusion:** Code is not the problem. Issue is likely:
1. **No posts being generated** (planJob not running)
2. **All recent items are replies** (only reply system active)
3. **Posts failing to save** (database constraint or error)

---

## 🚨 MOST LIKELY SCENARIOS

### **Scenario 1: No Posts Generated**
**Symptom:** Query returns 0 rows

**Possible causes:**
- `planJob` not running (check Railway logs)
- Content generation failing silently
- Database constraint blocking saves

**Check:**
```bash
railway logs | grep -E "UNIFIED_PLAN|QUEUE_CONTENT|decision_type"
```

### **Scenario 2: All Recent Items Are Replies**
**Symptom:** Query returns 0 rows, but replies exist

**Possible causes:**
- Only reply system is active
- Content generation disabled or failing
- Posts queued but not posted

**Check:**
- Railway logs for `[UNIFIED_PLAN]` activity
- Database for `status='queued'` items with `decision_type='single'`

### **Scenario 3: Posts Exist But Dashboard Shows Replies**
**Symptom:** Query returns posts, but dashboard shows replies

**Possible causes:**
- Dashboard query ordering issue
- `posted_at` is NULL (ordering breaks)
- Dashboard filtering incorrectly

**Check:**
- Run Query #3 from `FIND_LATEST_2_POSTS.sql`
- Check if `posted_at` is NULL for posts

---

## 📊 WHAT TO CHECK

### **1. Count by Type**
```sql
SELECT 
  decision_type,
  status,
  COUNT(*) as count
FROM content_metadata
WHERE status = 'posted'
GROUP BY decision_type, status;
```

**Expected:**
- `single | posted | 50+`
- `thread | posted | 5-10`
- `reply | posted | 100+`

**If all are replies:** Content generation not working

### **2. Latest 10 Items**
```sql
SELECT 
  decision_type,
  status,
  LEFT(content, 80) as preview,
  posted_at,
  created_at
FROM content_metadata
ORDER BY created_at DESC
LIMIT 10;
```

**This shows:** What's actually in the database

### **3. Queued Items**
```sql
SELECT 
  decision_type,
  status,
  COUNT(*) as count
FROM content_metadata
WHERE status = 'queued'
GROUP BY decision_type, status;
```

**If you see queued singles/threads:** They're waiting to be posted

---

## 🎯 NEXT STEPS

1. **Run the SQL query** (Option 1 above)
2. **Share the results** with me
3. **I'll tell you:**
   - What your latest 2 posts are
   - Why dashboard shows replies
   - How to fix it

---

## 📝 FILES CREATED

1. `FIND_LATEST_2_POSTS.sql` - SQL queries to run
2. `DATABASE_AUDIT_FINDINGS.md` - Detailed analysis
3. `DATABASE_AUDIT_QUERIES.sql` - Comprehensive audit queries
4. `DATABASE_AUDIT_REPORT.md` - Full audit report
5. `DATABASE_AUDIT_SUMMARY.md` - Quick reference

**All files are ready. Run the SQL query and share results!**




