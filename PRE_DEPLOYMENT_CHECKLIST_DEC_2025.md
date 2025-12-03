# ✅ PRE-DEPLOYMENT CHECKLIST - December 2, 2025

## 🎯 **BEFORE RAILWAY DEPLOYMENT**

### ✅ **1. CODE CHANGES** - READY
- [x] All fixes implemented
- [x] Build successful
- [x] No linter errors
- [ ] **COMMIT CHANGES** ← DO THIS NOW

### ✅ **2. DATABASE** - VERIFY
- [ ] **Verify `reply_opportunities` table exists** in Supabase
  - Check: Supabase Dashboard → Table Editor → `reply_opportunities`
  - If missing: Run migration `supabase/migrations/20251020000000_reply_opportunities_table.sql`
  
### ✅ **3. ENVIRONMENT VARIABLES** - CHECK
**No new variables needed** - All fixes use existing env vars or runtime detection.

**Verify these are set in Railway:**
- [x] `ENABLE_REPLIES=true` (should already be set)
- [x] `POSTING_DISABLED=false` (should already be set)
- [x] `OPENAI_API_KEY` (required)
- [x] `DATABASE_URL` (required)
- [x] `SUPABASE_URL` (required)
- [x] `SUPABASE_SERVICE_ROLE_KEY` (required)

**Optional (for degraded mode):**
- `HARVESTER_MAX_SEARCHES_PER_RUN` (default: 3)
- `HARVESTER_MAX_CRITICAL_SEARCHES_PER_RUN` (default: 6)

**Note:** `HARVESTER_DEGRADED_MODE` is set automatically at runtime (not a Railway env var).

---

## 🚀 **DEPLOYMENT STEPS**

### **Step 1: Commit Changes**
```bash
git add src/jobs/jobManager.ts src/jobs/postingQueue.ts src/jobs/replyOpportunityHarvester.ts
git commit -m "Fix: Permanent fixes for reply harvester, posting failures, and queued posts"
git push origin main
```

### **Step 2: Verify Database**
```sql
-- Run in Supabase SQL Editor to verify table exists:
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'reply_opportunities'
);
```

**If table doesn't exist:**
```sql
-- Run this migration:
-- File: supabase/migrations/20251020000000_reply_opportunities_table.sql
```

### **Step 3: Railway Auto-Deploy**
- Railway will automatically detect the git push
- Watch deployment logs for:
  - ✅ Build successful
  - ✅ No startup errors
  - ✅ Jobs scheduled successfully

### **Step 4: Monitor First Hour**
Watch Railway logs for:
- ✅ `[JOB_MANAGER] ✅ mega_viral_harvester scheduled successfully`
- ✅ `[HARVESTER] 🔍 Starting TWEET-FIRST viral search harvesting...`
- ✅ `[POSTING_QUEUE] ✅ Posted X/Y decisions`
- ✅ No errors about missing tables

---

## 🔍 **VERIFICATION AFTER DEPLOYMENT**

### **1. Check System Status**
```bash
# Via Railway logs or status endpoint
railway logs --service xBOT | grep -E "HARVESTER|POSTING_QUEUE|ERROR"
```

**Expected:**
- ✅ Harvester running (even if degraded mode)
- ✅ Posting queue processing
- ✅ No table errors

### **2. Check Database**
```sql
-- Check opportunities are being created:
SELECT COUNT(*) FROM reply_opportunities WHERE created_at > NOW() - INTERVAL '2 hours';

-- Check posts are being queued:
SELECT COUNT(*) FROM content_metadata WHERE status = 'queued';

-- Check posts are being posted:
SELECT COUNT(*) FROM content_metadata 
WHERE status = 'posted' 
AND posted_at > NOW() - INTERVAL '1 hour';
```

### **3. Check System Events**
```sql
-- Check for critical alerts:
SELECT * FROM system_events 
WHERE severity = 'critical' 
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## ⚠️ **IF SOMETHING GOES WRONG**

### **Harvester Still Not Running:**
1. Check Railway logs for `[JOB_MANAGER] 🔥 HARVESTER:`
2. Check browser health: Look for `browser_degraded` messages
3. Verify `ENABLE_REPLIES=true` in Railway variables

### **Posts Still Failing:**
1. Check Railway logs for posting errors
2. Verify `POSTING_DISABLED=false` in Railway variables
3. Check rate limits: Look for `HOURLY LIMIT REACHED` messages

### **Database Errors:**
1. Verify `reply_opportunities` table exists
2. Check `DATABASE_URL` is correct in Railway
3. Verify Supabase connection is working

---

## 📝 **SUMMARY**

**Ready to Deploy:**
- ✅ Code: All fixes implemented and tested
- ✅ Build: Successful
- ⏳ **Git:** Need to commit and push
- ⏳ **Database:** Verify `reply_opportunities` table exists
- ✅ **Environment:** No new variables needed

**Next Actions:**
1. **Commit changes** (git add + commit + push)
2. **Verify database** (check `reply_opportunities` table)
3. **Deploy** (Railway auto-deploys on push)
4. **Monitor** (watch logs for first hour)

**Estimated Time:** 5 minutes

---

## ✅ **READY TO PROCEED**

All fixes are permanent and ready. Just need to:
1. Commit the code changes
2. Verify database table exists
3. Push to trigger Railway deployment

**Status:** Ready for finalization 🚀

