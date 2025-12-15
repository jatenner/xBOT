# ✅ PRE-DEPLOYMENT CHECKLIST

**Date:** January 14, 2025  
**Issue:** Twitter bot down - Database schema mismatch  
**Status:** 🔴 **NOT READY** - Migration must be applied first

---

## 🎯 ROOT CAUSE CONFIRMED

**Single Issue:** Missing `visual_format` column in `content_metadata` table

**Evidence:**
- ✅ Plan job generates content successfully
- ❌ Database insert fails: `Could not find the 'visual_format' column`
- ❌ No content stored → Nothing to post → Bot appears down

**Impact:** 100% blocking - No content can be stored without this column

---

## ✅ WHAT'S FIXED

1. **Migration file created:** `supabase/migrations/add_visual_format_to_content_metadata.sql`
   - Adds `visual_format TEXT` column to underlying table
   - Recreates `content_metadata` VIEW to include column
   - Adds index for performance
   - Migration is idempotent (safe to run multiple times)

2. **Code is correct:** `src/jobs/planJob.ts` line 1017 tries to insert `visual_format`
   - Code expects this column to exist
   - Migration will add it

---

## ⚠️ BLOCKER: Migration Not Applied

**Current State:**
- Migration file exists ✅
- Migration NOT applied to database ❌
- `MIGRATIONS_RUNTIME_ENABLED=false` in Railway ❌

**Why This Blocks Deployment:**
- If you deploy now, plan job will still fail
- Migration won't run automatically (disabled)
- Bot will still be down

---

## 🔧 REQUIRED ACTIONS BEFORE DEPLOYMENT

### **Step 1: Apply Migration** (REQUIRED)

**Option A: Enable Runtime Migrations (Easiest)**
```bash
railway variables --set MIGRATIONS_RUNTIME_ENABLED=true
```
Then deploy - migration runs automatically.

**Option B: Apply Manually via Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Copy/paste SQL from `supabase/migrations/add_visual_format_to_content_metadata.sql`
3. Run it
4. Verify column exists

**Option C: Use Supabase CLI**
```bash
supabase db push --file supabase/migrations/add_visual_format_to_content_metadata.sql
```

### **Step 2: Verify Migration Applied**

Run this SQL in Supabase Dashboard:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'content_metadata' 
AND column_name = 'visual_format';
```

Should return: `visual_format | text`

### **Step 3: Deploy to Railway**

```bash
git add supabase/migrations/add_visual_format_to_content_metadata.sql
git commit -m "Fix: Add visual_format column to content_metadata"
git push
```

### **Step 4: Monitor After Deployment**

```bash
railway logs --lines 100 | grep -E "PLAN_JOB|visual_format|Database insert"
```

**Look for:**
- ✅ No more "Could not find the 'visual_format' column" errors
- ✅ `[PLAN_JOB] 💾 Content queued in database` messages
- ✅ Content appearing in database with `status='queued'`

---

## 🔍 OTHER POTENTIAL ISSUES CHECKED

### ✅ **Non-Critical Issues Found:**

1. **Trending Topic Extractor Errors** (Non-blocking)
   - Logs show: `[TRENDING_EXTRACTOR] ❌ Error fetching opportunities`
   - Impact: Falls back to regular topic generation
   - Status: Non-critical, system continues working

2. **Content Generation Retries** (Normal behavior)
   - Logs show: `[PLAN_JOB] 🔁 Retrying post 2 after length_violation`
   - Impact: Normal retry logic working correctly
   - Status: Expected behavior

### ✅ **No Other Blocking Issues:**

- ✅ Configuration correct (`LIVE_POSTS=true`, `MODE=live`, `POSTING_DISABLED=false`)
- ✅ Job Manager running
- ✅ Plan job executing (just failing on insert)
- ✅ No circuit breaker issues
- ✅ No memory exhaustion
- ✅ No session issues

---

## 📋 FINAL CHECKLIST

Before deploying, ensure:

- [ ] **Migration applied to database** (REQUIRED)
- [ ] **Verified `visual_format` column exists** (REQUIRED)
- [ ] Migration file committed to git
- [ ] Ready to monitor logs after deployment

---

## 🚨 CRITICAL REMINDER

**DO NOT DEPLOY until migration is applied!**

If you deploy now:
- Plan job will still fail
- No content will be stored
- Bot will remain down
- You'll need to apply migration anyway

**Apply migration FIRST, then deploy.**

---

## ✅ AFTER MIGRATION APPLIED

Once migration is applied and verified:

1. **Deploy to Railway** (git push)
2. **Monitor logs** for successful content storage
3. **Check database** for queued content
4. **Verify posting** resumes within 5-10 minutes

**Expected Timeline:**
- Migration: 1-2 minutes
- Deployment: 2-3 minutes  
- First content generated: 5-10 minutes
- First post: 10-15 minutes

---

**Status:** ⚠️ **NOT READY** - Apply migration first!

