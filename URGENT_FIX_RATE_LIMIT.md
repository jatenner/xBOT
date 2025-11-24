# 🚨 URGENT: FIX RATE LIMIT NOW

## The Problem

- **Last real post:** 10 hours ago (on Twitter)
- **Rate limit shows:** 6 posts in last hour
- **Result:** System blocked, can't post

**These 6 posts are PHANTOM - they're not on Twitter!**

---

## 🔧 IMMEDIATE FIX (Do This Now)

### Step 1: Run SQL Fix

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
UPDATE content_metadata
SET 
  status = 'failed',
  error_message = 'Cleared - blocking rate limit',
  updated_at = NOW()
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
  AND posted_at > NOW() - INTERVAL '1 hour';
```

**OR** copy the entire file: `FIX_RATE_LIMIT_NOW.sql`

---

### Step 2: Verify It Worked

Run this to check:

```sql
SELECT COUNT(*) 
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
  AND posted_at > NOW() - INTERVAL '1 hour';
```

**Should show: 0** ✅

---

### Step 3: Wait 5 Minutes

The posting queue runs every 5 minutes. After clearing the rate limit, it should pick up the 3 queued posts.

---

## ✅ Expected Result

- **0-5 min:** Rate limit cleared
- **5-10 min:** 3 queued posts should go out
- **10-15 min:** Check Twitter - you should see new posts!

---

## 📊 Monitor

Watch Railway logs:
```bash
railway logs --lines 200 | grep -E "POSTING_QUEUE|Tweet posted"
```

**Success indicators:**
- `[POSTING_QUEUE] 📝 Found 3 decisions ready`
- `[POSTING_QUEUE] ✅ Tweet posted successfully`

---

## 🎯 Why This Happened

The rate limit check counts ALL posts with `status='posted'` in the last hour, even if they don't have real tweet_ids. Those 6 posts are database entries that never actually posted to Twitter.

**Fix:** Clear them so the rate limit resets.

