# ✅ Next Steps Checklist

## Immediate Actions (Do Now)

### 1. Check Investigation Dashboard (5 minutes)
**URL:** `/dashboard/system-investigation?token=xbot-admin-2025`

**What to look for:**
- ✅ Posting attempts are showing up (not empty)
- ✅ Success rate is calculated (not "N/A")
- ✅ Recent failures show error messages
- ✅ Metrics scraper shows last run time

**If dashboard shows "No posting attempts found":**
- The table might have wrong schema
- See Step 2 below

### 2. Verify Database Schema (2 minutes)
**Check if `posting_attempts` table has correct columns:**

Run this SQL query in Supabase SQL Editor:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'posting_attempts';
```

**Expected columns:**
- `decision_id` (UUID or TEXT)
- `decision_type` (TEXT)
- `content_text` (TEXT)
- `status` (TEXT) ← **CRITICAL: Must be 'status', not 'was_successful'**
- `tweet_id` (TEXT, nullable)
- `error_message` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)

**If schema is wrong:**
- See "Fix Database Schema" section below

### 3. Monitor Live Activity (10 minutes)
**Watch the dashboard auto-refresh:**
- New posting attempts should appear every 5 minutes (posting job runs every 5 min)
- Success/failure status should update
- Error messages should populate for failures

**If nothing appears:**
- Posting job might not be running
- See "Troubleshooting" section below

## Verification Steps

### Step 1: Check if Posting Job is Running
**Look at:** `/dashboard/system-health?token=xbot-admin-2025`

**Check:**
- ✅ "Posting" job shows "Running" or "Success" status
- ✅ Last success time is recent (< 10 minutes ago)
- ✅ No consecutive failures

**If posting job shows "Failure" or "Stale":**
- Job might be crashing
- Check Railway logs for errors

### Step 2: Check Circuit Breaker
**Look at:** Investigation dashboard → Circuit Breaker section

**Check:**
- ✅ State is "Closed" (not "Open")
- ✅ Failures < Threshold

**If circuit breaker is "Open":**
- All posting is blocked
- Wait for auto-reset (60 seconds) OR manually reset
- See "Reset Circuit Breaker" section below

### Step 3: Check Metrics Scraper
**Look at:** Investigation dashboard → Metrics Scraper section

**Check:**
- ✅ Last success < 30 minutes ago
- ✅ Status is "Success" (not "Failure")
- ✅ No error messages

**If metrics scraper is stale:**
- Browser session might be expired
- Check Railway logs for scraper errors

## If Things Still Don't Work

### Fix Database Schema (If Needed)

If `posting_attempts` table has wrong schema, run this migration:

```sql
-- Check current schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'posting_attempts';

-- If 'was_successful' exists instead of 'status', run:
ALTER TABLE posting_attempts 
DROP COLUMN IF EXISTS was_successful,
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS decision_id UUID,
ADD COLUMN IF NOT EXISTS decision_type TEXT,
ADD COLUMN IF NOT EXISTS content_text TEXT,
ADD COLUMN IF NOT EXISTS tweet_id TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT;
```

### Reset Circuit Breaker (If Needed)

If circuit breaker is blocking posts, you can manually reset it:

**Option 1: Wait for auto-reset** (60 seconds)
- Circuit breaker auto-resets after 60 seconds

**Option 2: Restart Railway service**
- This resets the in-memory circuit breaker state

**Option 3: Add manual reset endpoint** (if needed)
- Can add API endpoint to reset circuit breaker

### Check Railway Logs

**If dashboard shows issues but you're not sure why:**

1. Go to Railway dashboard
2. Click on your service
3. Click "Logs" tab
4. Look for:
   - `[POSTING_QUEUE]` errors
   - `[METRICS_JOB]` errors
   - Database connection errors
   - Browser session errors

## Success Criteria

**You'll know everything is working when:**

1. ✅ Investigation dashboard shows posting attempts
2. ✅ Success rate is > 70% (or shows actual percentage)
3. ✅ Recent posts appear in "Recent Activity"
4. ✅ Metrics scraper shows last run < 30 min ago
5. ✅ Circuit breaker is "Closed"
6. ✅ No critical errors in dashboard

## Timeline

- **0-5 min:** Check investigation dashboard
- **5-10 min:** Verify database schema (if needed)
- **10-20 min:** Monitor live activity
- **20+ min:** System should be fully operational

## What to Report Back

If issues persist, report:
1. What the investigation dashboard shows
2. Database schema check results
3. Any error messages from Railway logs
4. Circuit breaker state

This will help diagnose remaining issues.

