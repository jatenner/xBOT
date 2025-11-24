# ✅ COMPLETE SYSTEM VERIFICATION GUIDE

## Overview
This guide helps verify that all permanent fixes are working and the system is functioning properly.

---

## 🔧 PERMANENT FIXES VERIFICATION

### 1. Code Changes (Already Applied ✅)

**Files Modified:**
- ✅ `src/config/config.ts` - MAX_POSTS_PER_HOUR default changed from 1 to 2
- ✅ `src/jobs/postingQueue.ts` - Circuit breaker more resilient, error handling improved

**Verification:**
```bash
# Check the code changes
grep -A 2 "MAX_POSTS_PER_HOUR.*default" src/config/config.ts
# Should show: default value is 2

grep -A 2 "failureThreshold" src/jobs/postingQueue.ts
# Should show: failureThreshold: 10 (was 5)
```

---

## 📊 DATABASE VERIFICATION

### Run SQL Queries in Supabase

1. **Open Supabase Dashboard** → SQL Editor
2. **Run queries from:** `VERIFY_SYSTEM_STATUS.sql`

**Key Checks:**
- ✅ Recent posting activity (should show 2 posts/hour for content)
- ✅ Queue status (should have queued items)
- ✅ No stuck posts (status='posting' >15min)
- ✅ No NULL tweet_ids (posted but ID not saved)
- ✅ Rate limits respected (≤2 content/hour, ≤4 replies/hour)

---

## 🚂 RAILWAY CONFIGURATION

### Check Environment Variables

**Option 1: Railway CLI** (requires login)
```bash
railway login
railway variables
```

**Option 2: Railway Dashboard**
1. Go to Railway → Your Project → Variables
2. Check values match expected configuration

**Expected Values:**
```
MAX_POSTS_PER_HOUR=2          (or unset - defaults to 2 now ✅)
REPLIES_PER_HOUR=4            (or unset - defaults to 4)
JOBS_PLAN_INTERVAL_MIN=60     (or unset - defaults to 60)
JOBS_REPLY_INTERVAL_MIN=30    (or unset - defaults to 30)
MODE=live                      (REQUIRED)
POSTING_DISABLED=false         (or unset - must not be true)
```

---

## 📈 MONITORING POSTING ACTIVITY

### Check Recent Posts (Last Hour)

**Via SQL:**
```sql
SELECT 
  decision_type,
  COUNT(*) as count,
  MAX(posted_at) as last_post
FROM content_metadata
WHERE posted_at >= NOW() - INTERVAL '1 hour'
  AND status = 'posted'
  AND decision_type IN ('single', 'thread', 'reply')
GROUP BY decision_type;
```

**Expected:**
- Content: 0-2 posts (rate limit: 2/hour)
- Replies: 0-4 replies (rate limit: 4/hour)

### Check Queue Status

**Via SQL:**
```sql
SELECT 
  decision_type,
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN scheduled_at <= NOW() THEN 1 END) as ready
FROM content_metadata
WHERE status IN ('queued', 'posting')
GROUP BY decision_type, status;
```

**Expected:**
- Should have queued items ready to post
- No stuck posts (status='posting' >15min)

---

## 🔍 TROUBLESHOOTING

### Issue: No Posts in Last Hour

**Check:**
1. ✅ Queue has items: `SELECT COUNT(*) FROM content_metadata WHERE status='queued'`
2. ✅ Rate limit not reached: Check last hour's posts
3. ✅ Posting enabled: Check `MODE=live` and `POSTING_DISABLED=false`
4. ✅ Plan job running: Check logs for `[UNIFIED_PLAN]` messages

### Issue: Rate Limit Too Restrictive

**Check:**
1. ✅ Code default: `grep "MAX_POSTS_PER_HOUR.*default" src/config/config.ts` (should be 2)
2. ✅ Railway variable: `railway variables | grep MAX_POSTS_PER_HOUR` (should be 2 or unset)

### Issue: Circuit Breaker Blocking

**Check:**
1. ✅ Failure threshold: Should be 10 (not 5)
2. ✅ Recovery time: Should be 30s (not 60s)
3. ✅ Check logs: `[POSTING_QUEUE] ⚠️ Circuit breaker OPEN`

### Issue: Database Errors Blocking Posts

**Check:**
1. ✅ Error handling: Should allow posting on errors (graceful degradation)
2. ✅ Check logs: `[POSTING_QUEUE] ⚠️ Rate limit check error - allowing posting`

---

## ✅ VERIFICATION CHECKLIST

### Code Level (Permanent Fixes)
- [x] MAX_POSTS_PER_HOUR default = 2 (not 1)
- [x] Circuit breaker threshold = 10 (not 5)
- [x] Circuit breaker recovery = 30s (not 60s)
- [x] Error handling allows posting (graceful degradation)

### Configuration Level
- [ ] MODE=live (or unset, not shadow)
- [ ] POSTING_DISABLED=false (or unset, not true)
- [ ] MAX_POSTS_PER_HOUR=2 (or unset, will use default 2)
- [ ] REPLIES_PER_HOUR=4 (or unset, will use default 4)

### Database Level
- [ ] Recent posts showing (2/hour content, 4/hour replies)
- [ ] Queue has items ready to post
- [ ] No stuck posts (status='posting' >15min)
- [ ] No NULL tweet_ids (posted but ID not saved)

### System Health
- [ ] Plan job generating content (check logs)
- [ ] Posting queue processing (check logs)
- [ ] Reply job generating replies (check logs)
- [ ] No circuit breaker blocking

---

## 🚀 QUICK FIX COMMANDS

If something is wrong, run these:

```bash
# Set correct configuration
railway variables --set MAX_POSTS_PER_HOUR=2
railway variables --set MODE=live
railway variables --set POSTING_DISABLED=false

# Restart service
railway up --detach
```

---

## 📝 NOTES

1. **Permanent Fixes:** Code changes are permanent and work on every deployment
2. **Configuration:** Environment variables are optional now (good defaults)
3. **Monitoring:** Use SQL queries to verify system is working
4. **Troubleshooting:** Check logs and database for issues

---

## 🎯 EXPECTED BEHAVIOR

After all fixes:
- ✅ 2 posts/hour for content (48/day max)
- ✅ 4 replies/hour (96/day max)
- ✅ Resilient to errors (doesn't block unnecessarily)
- ✅ Fast recovery from failures (30s vs 60s)
- ✅ Works correctly by default (no config needed)
