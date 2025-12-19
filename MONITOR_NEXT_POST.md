# Monitor Next Post - Verification Guide

**Deployment:** Commit `a560a4da` (95% confidence fix)  
**Status:** Pushed to Railway, waiting for build

---

## 🎯 WHAT WAS FIXED

### The Problem
**Thread 2002088710452781083:**
- ✅ Posted to X successfully
- ❌ NOT saved to `content_metadata`
- ❌ NOT saved to `post_receipts`
- **Result:** Truth gap (tweet exists but system doesn't know)

### The Root Cause
1. Receipt write only happens if `postContent()` succeeds (not fail-closed)
2. DB save failures not detected (return value not checked)
3. No startup verification (broken systems start anyway)

### The Fix (3-Part)
1. **Receipt write now fail-closed** - Throws if fails, triggers retry
2. **DB save return checked** - Only marks success if `ok=true`
3. **Startup verification** - Exits if `post_receipts` table missing

**Confidence: 95%** - All tweets will be saved correctly

---

## 📊 HOW TO MONITOR

### Step 1: Verify Deployment Restarted (5 min)

**Command:**
```bash
railway logs --service xBOT --lines 200 | grep -E "BOOT commit|STARTUP"
```

**Expected:**
```
[BOOT] commit=a560a4da node=v22.x.x
[STARTUP] 🔍 Verifying database connection and receipt system...
[STARTUP] ✅ Database connection verified
[STARTUP] ✅ post_receipts table verified
[STARTUP] ✅ system_events table verified
[STARTUP] ✅ All critical database checks passed
```

**If missing:** Deployment still building or failed. Wait 2 more minutes and re-check.

**If you see `[STARTUP] 🚨 CRITICAL`:**
```bash
# Table missing - run migration
railway run --service xBOT pnpm db:migrate

# Then restart service
railway restart --service xBOT
```

---

### Step 2: Watch for Next Post (10-30 min)

**Command (Live):**
```bash
railway logs --service xBOT --follow | grep -E "Processing decision|RECEIPT|LIFECYCLE|SUCCESS"
```

**Expected sequence:**
```
[POSTING_QUEUE] 📝 Processing decision: <uuid> (type: single)
[POSTING_QUEUE] 🔍 DEBUG: Calling postContent for single
[POSTING_QUEUE] 🔍 DEBUG: postContent returned successfully
[LIFECYCLE] decision_id=<uuid> step=POST_CLICKED tweet_id=<id>
[RECEIPT] 📝 Writing receipt for single (1 tweet)
[RECEIPT]    decision_id=<uuid>
[RECEIPT]    tweet_ids=<id>
[RECEIPT] ✅ Receipt written: <receipt_id>
[LIFECYCLE] decision_id=<uuid> step=RECEIPT_SAVED receipt_id=<receipt_id>
[POSTING_QUEUE] 💾 Database save attempt 1/5 for tweet <id>...
[POSTING_QUEUE] ✅ Database save SUCCESS (verified: ok=true)
[POSTING_QUEUE][SUCCESS] decision_id=<uuid> type=single tweet_id=<id> url=...
```

**If you see:**
```
[RECEIPT] 🚨 CRITICAL: Receipt write FAILED
```
→ Good! Fail-closed is working. Post will be retried.

**If you see:**
```
[POSTING_QUEUE][DB_SAVE_FAIL] attempt=5/5
```
→ DB save failed after retries. Check if receipt was written (should exist).

---

### Step 3: Verify Receipt in Database (After post)

**Command:**
```bash
railway run --service xBOT pnpm debug:posts:last5
```

**Expected:**
```
📝 POST_RECEIPTS (durable "posted to X" receipts)

Found 1 receipts:

1. posted_at: 2025-12-19T19:XX:XX
   receipt_id: <uuid>
   decision_id: <uuid>
   root_tweet_id: <tweet_id>
   tweet_ids_length: 1
   post_type: single

🔍 DIFF: Unreconciled receipts (last 2 hours)

✅ All receipts in last 2 hours are reconciled

📊 Summary: 0/1 receipts unreconciled
```

**If still empty:**
```
⚠️  No receipts found in post_receipts
```
→ Receipt write is still failing. Check logs for `[RECEIPT] 🚨 CRITICAL` errors.

---

### Step 4: Compare Tweet on X vs Database

**Get latest tweet from X:**
1. Go to: https://x.com/Signal_Synapse
2. Find latest tweet
3. Copy tweet ID from URL

**Check if saved:**
```bash
railway run --service xBOT -- node -e "
const { createClient } = require('@supabase/supabase-js');
const tweetId = 'PASTE_TWEET_ID_HERE';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('content_metadata').select('*').eq('tweet_id', tweetId).single()
  .then(({data}) => console.log(data ? '✅ FOUND' : '❌ NOT FOUND'));
"
```

---

## 🔧 TROUBLESHOOTING

### Issue: No STARTUP logs after 10 minutes
**Cause:** Deployment failed or stuck  
**Fix:**
```bash
# Check Railway dashboard for build errors
# Or manually restart:
railway restart --service xBOT
```

### Issue: STARTUP shows table missing
**Cause:** Migration not applied  
**Fix:**
```bash
railway run --service xBOT pnpm db:migrate
railway restart --service xBOT
```

### Issue: Receipt write still failing
**Cause:** Supabase client issue or permissions  
**Fix:**
```bash
# Verify env vars
railway variables | grep SUPABASE

# Test connection
railway run --service xBOT pnpm db:doctor
```

### Issue: Posts still not saving
**Cause:** Different issue (not receipt system)  
**Fix:**
```bash
# Check logs for specific error
railway logs --service xBOT --lines 500 | grep "ERROR\|CRITICAL\|FAIL"

# Run diagnostic
railway run --service xBOT pnpm debug:posts:last5
```

---

## ✅ SUCCESS METRICS

**Within 1 hour, you should see:**
- ✅ Startup verification logs (all passed)
- ✅ At least 1 receipt written
- ✅ `pnpm debug:posts:last5` shows receipts (not empty)
- ✅ No unreconciled receipts
- ✅ Latest tweet on X matches latest in DB

**If all ✅:** Fix is working, 95% confidence achieved

**If any ❌:** Check troubleshooting section above

---

**Current Time:** ~2:30 PM PST  
**Next Post ETA:** ~3:00-3:30 PM PST (based on 30min cadence)  
**Monitoring:** Use commands above to track progress

