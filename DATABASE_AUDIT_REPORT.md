# 🔍 DATABASE AUDIT REPORT
**Date:** November 5, 2025  
**Purpose:** Full audit of how posts, singles, threads, and replies are saved to database

---

## 🎯 AUDIT SCOPE

Based on your dashboard showing:
- **All items labeled "REPLY"** (should show singles/threads too)
- **Missing dates** (posted_at not showing)
- **All metrics showing 0** (actual_impressions, actual_likes, etc.)

---

## 📋 QUERIES TO RUN

**File:** `DATABASE_AUDIT_QUERIES.sql`

Run these queries in **Supabase SQL Editor** to check:

### **1. Count by Type and Status**
Shows breakdown of singles/threads/replies and their statuses

### **2. Data Corruption Checks**
- Invalid `decision_type` values
- Replies without `target_tweet_id`
- Singles/threads with `target_tweet_id` (shouldn't have)
- Empty content

### **3. Date Field Audit**
- Posted items without `posted_at`
- Posted items without `tweet_id` (CRITICAL!)
- Items with `posted_at` but wrong status

### **4. Dashboard Query Simulation**
Shows exactly what dashboard query returns

### **5. Recent Activity**
Last 24 hours and 7 days breakdown

### **6. Save Pattern Analysis**
How `markDecisionPosted` is saving data

### **7. Specific Issue Check**
Are replies showing where posts should be?

### **8. Metrics Data Check**
Are metrics being scraped and saved?

---

## 🔍 KEY FINDINGS FROM CODE ANALYSIS

### **How Data Should Be Saved:**

1. **planJob.ts** (Content Generation):
   ```typescript
   decision_type: content.format === 'thread' ? 'thread' : 'single'
   ```
   ✅ Should save as `'single'` or `'thread'`

2. **replyJob.ts** (Reply Generation):
   ```typescript
   decision_type: 'reply'
   ```
   ✅ Should save as `'reply'`

3. **markDecisionPosted** (After Posting):
   ```typescript
   .update({
     status: 'posted',
     tweet_id: tweetId,
     posted_at: new Date().toISOString(),
     updated_at: new Date().toISOString()
   })
   ```
   ✅ Should set `posted_at` and `tweet_id`

### **Dashboard Query:**
```typescript
.from('content_metadata')
.select('decision_type, tweet_id, content, ...')
.in('decision_type', ['single', 'thread', 'reply'])
.eq('status', 'posted')
.order('posted_at', { ascending: false })
.limit(50)
```

**This query should show:**
- Singles, threads, AND replies
- Ordered by `posted_at` (most recent first)
- Only items with `status='posted'`

---

## 🚨 POTENTIAL ISSUES

### **Issue 1: All Items Are Replies**
**Symptom:** Dashboard shows all "REPLY" labels

**Possible Causes:**
1. ✅ **Content generation saving as 'reply'** - Check if `planJob.ts` is incorrectly setting `decision_type='reply'`
2. ✅ **Database constraint issue** - Check if `decision_type` column has wrong constraint
3. ✅ **Data migration issue** - Old data might have wrong types

**Check:** Run Query #1 and #7 from audit SQL

### **Issue 2: Missing Dates**
**Symptom:** No dates showing in dashboard

**Possible Causes:**
1. ✅ **posted_at not being set** - Check if `markDecisionPosted` is running
2. ✅ **posted_at is NULL** - Check Query #3 from audit SQL
3. ✅ **Dashboard query ordering by NULL** - If all `posted_at` are NULL, ordering fails

**Check:** Run Query #3 from audit SQL

### **Issue 3: All Metrics Zero**
**Symptom:** All showing 0 views, 0 likes

**Possible Causes:**
1. ✅ **Metrics not scraped yet** - Scraper runs every 10 min
2. ✅ **Metrics not saved to content_metadata** - Check if scraper updates `actual_*` columns
3. ✅ **Dashboard reading wrong columns** - Verify dashboard reads `actual_impressions`, not `impressions`

**Check:** Run Query #8 from audit SQL

---

## 🔧 HOW TO FIX

### **Step 1: Run Audit Queries**
1. Open Supabase SQL Editor
2. Copy queries from `DATABASE_AUDIT_QUERIES.sql`
3. Run each query section
4. Note the results

### **Step 2: Identify Root Cause**
Based on query results:
- If all items are `decision_type='reply'` → Content generation bug
- If `posted_at` is NULL → `markDecisionPosted` not running
- If `actual_*` columns are NULL → Metrics scraper not updating

### **Step 3: Fix Based on Findings**

**If decision_type is wrong:**
- Check `src/jobs/planJob.ts` line 773
- Check `src/jobs/replyJob.ts` where replies are created
- Verify database constraint allows 'single', 'thread', 'reply'

**If posted_at is NULL:**
- Check `src/jobs/postingQueue.ts` line 1808
- Verify `markDecisionPosted` is being called
- Check for errors in posting queue logs

**If metrics are zero:**
- Check `src/jobs/metricsScraperJob.ts`
- Verify scraper updates `content_metadata.actual_*` columns
- Check scraper is running (every 10 min)

---

## 📊 EXPECTED RESULTS

### **Healthy Database Should Show:**

**Query #1 (Count by Type):**
```
decision_type | status  | count
--------------|---------|-------
single        | posted  | 50+
single        | queued  | 5-10
thread        | posted  | 5-10
thread        | queued  | 1-3
reply         | posted  | 100+
reply         | queued  | 5-10
```

**Query #4 (Dashboard Simulation):**
```
Should show mix of:
- Singles (most recent)
- Threads (some)
- Replies (many)
All with posted_at dates
```

**Query #3 (Date Audit):**
```
Posted items:
- With posted_at: 95%+
- Without posted_at: <5%
- With tweet_id: 95%+
```

---

## 🎯 NEXT STEPS

1. **Run the SQL queries** in Supabase
2. **Share the results** - I'll help identify the exact issue
3. **Fix the root cause** based on findings
4. **Verify dashboard** shows correct data

---

**The database might not be "fucked" - it could be:**
- Dashboard query issue
- Data display issue
- Missing timestamps
- Or actual data corruption

**Let's find out with the audit!**
