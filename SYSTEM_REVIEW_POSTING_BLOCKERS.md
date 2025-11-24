# 🔍 COMPREHENSIVE SYSTEM REVIEW - Posting & Reply Blockers

**Generated:** December 2025  
**Purpose:** Identify all blockers preventing hourly posting and replies

---

## 🚨 CRITICAL BLOCKERS IDENTIFIED

### 1. **RATE LIMIT CONFIGURATION** ⚠️ HIGH PRIORITY

**Issue:** `MAX_POSTS_PER_HOUR` defaults to `1` instead of `2`

**Location:** `src/config/config.ts:54-56`
```typescript
MAX_POSTS_PER_HOUR: z.number().default(
  process.env.MAX_POSTS_PER_HOUR ? parseFloat(process.env.MAX_POSTS_PER_HOUR) : 1
), // Defaults to 1 post/hour
```

**Impact:**
- System only allows 1 post per hour (24/day max)
- User wants 2 posts/hour (48/day)
- If env var not set, defaults to restrictive limit

**Fix Required:**
```bash
# Set in Railway:
railway variables --set MAX_POSTS_PER_HOUR=2
```

**Verification:**
- Check logs for: `[POSTING_QUEUE] 📊 Content posts attempted this hour: X/1`
- Should show: `X/2` after fix

---

### 2. **CIRCUIT BREAKER** ⚠️ MEDIUM PRIORITY

**Issue:** Circuit breaker can block ALL posting if 5+ failures occur

**Location:** `src/jobs/postingQueue.ts:34-60`

**How It Works:**
- Tracks failures in `postingCircuitBreaker.failures`
- Opens circuit after 5 failures
- Blocks posting for 60 seconds
- Auto-resets after timeout

**Potential Blockers:**
- If posting fails 5 times, circuit opens
- All subsequent posts blocked for 60 seconds
- Could create cascading blocks if failures persist

**Check Status:**
```typescript
// Look for in logs:
[POSTING_QUEUE] ⚠️ Circuit breaker OPEN (Xs remaining)
[POSTING_QUEUE] ⏸️ Skipping queue processing (circuit breaker open)
```

**Fix:**
- Circuit breaker auto-resets after 60 seconds
- If stuck, check for underlying posting failures
- Review `recordCircuitBreakerFailure()` calls

---

### 3. **POSTING DISABLED FLAG** ⚠️ HIGH PRIORITY

**Issue:** `flags.postingDisabled` can block all posting

**Location:** `src/jobs/postingQueue.ts:101-104`
```typescript
if (flags.postingDisabled) {
  log({ op: 'posting_queue', status: 'disabled' });
  return; // BLOCKS ALL POSTING
}
```

**How It's Set:**
- `MODE=shadow` → `postingDisabled = true`
- `POSTING_DISABLED=true` → `postingDisabled = true`
- `DRY_RUN=true` → `postingDisabled = true`

**Check:**
```bash
railway variables | grep -E "MODE|POSTING_DISABLED|DRY_RUN"
```

**Required Values:**
- `MODE=live` (or unset)
- `POSTING_DISABLED` not set or `false`
- `DRY_RUN` not set or `false`

---

### 4. **REPLY RATE LIMITS** ⚠️ MEDIUM PRIORITY

**Issue:** Multiple rate limit checks can block replies

**Location:** `src/jobs/replyJob.ts:313-350`

**Three Checks:**
1. **Hourly Quota:** `checkReplyHourlyQuota()`
   - Default: `REPLIES_PER_HOUR=4`
   - Blocks if 4+ replies in last hour

2. **Daily Quota:** `checkReplyDailyQuota()`
   - Default: `REPLY_MAX_PER_DAY=100`
   - Blocks if 100+ replies today

3. **Time Between:** `checkTimeBetweenReplies()`
   - Default: `REPLY_MINUTES_BETWEEN=15`
   - Blocks if <15 minutes since last reply

**Potential Issues:**
- If any check fails, replies blocked
- Degraded mode allows replies but logs warnings
- Database errors can trigger degraded mode

**Check Logs:**
```
[REPLY_JOB] ⚠️ Hourly quota exceeded
[REPLY_JOB] ⚠️ Daily quota exceeded
[REPLY_JOB] ⚠️ Too soon since last reply
```

---

### 5. **CONTENT GENERATION RATE** ⚠️ MEDIUM PRIORITY

**Issue:** Plan job might not generate enough content

**Location:** `src/jobs/jobManager.ts:206-217`

**Current Config:**
- `JOBS_PLAN_INTERVAL_MIN` defaults to `60` minutes
- Generates content every hour
- But rate limit might prevent posting

**Potential Issue:**
- If `JOBS_PLAN_INTERVAL_MIN=720` (12 hours), content generation is sparse
- Queue might be empty when posting job runs
- Posting job runs every 5 minutes but finds nothing

**Check:**
```bash
railway variables | grep JOBS_PLAN_INTERVAL_MIN
```

**Recommended:**
- `JOBS_PLAN_INTERVAL_MIN=60` (1 hour)
- Generates content more frequently
- Rate limiter prevents over-posting

---

### 6. **STUCK POSTS RECOVERY** ✅ WORKING

**Status:** Auto-recovery implemented

**Location:** `src/jobs/postingQueue.ts:106-127`

**How It Works:**
- Checks for posts with `status='posting'` >15 minutes old
- Auto-resets to `status='queued'`
- Allows retry on next cycle

**This is working correctly** - no fix needed.

---

### 7. **POSTING JOB SCHEDULING** ✅ WORKING

**Status:** Job is scheduled correctly

**Location:** `src/jobs/jobManager.ts:180-193`

**Configuration:**
- Runs every `JOBS_POSTING_INTERVAL_MIN` (default: 5 minutes)
- No initial delay (starts immediately)
- Only runs if `flags.postingEnabled = true`

**This is working correctly** - no fix needed.

---

## 📊 DIAGNOSTIC CHECKLIST

### Immediate Checks:

1. **Check Rate Limit Config:**
   ```bash
   railway variables | grep MAX_POSTS_PER_HOUR
   # Should be: MAX_POSTS_PER_HOUR=2
   ```

2. **Check Posting Enabled:**
   ```bash
   railway variables | grep -E "MODE|POSTING_DISABLED|DRY_RUN"
   # Should be: MODE=live (or unset)
   # POSTING_DISABLED should not be set or =false
   ```

3. **Check Reply Config:**
   ```bash
   railway variables | grep -E "REPLIES_PER_HOUR|REPLY_MAX_PER_DAY|JOBS_REPLY_INTERVAL_MIN"
   # Should be: REPLIES_PER_HOUR=4, REPLY_MAX_PER_DAY=100, JOBS_REPLY_INTERVAL_MIN=30
   ```

4. **Check Plan Job Interval:**
   ```bash
   railway variables | grep JOBS_PLAN_INTERVAL_MIN
   # Should be: JOBS_PLAN_INTERVAL_MIN=60 (or lower)
   ```

### Log Checks:

1. **Posting Queue Logs:**
   ```
   [POSTING_QUEUE] ⛔ HOURLY LIMIT REACHED
   [POSTING_QUEUE] ⏸️ Skipping queue processing (circuit breaker open)
   [POSTING_QUEUE] ⚠️ Posting disabled, skipping queue processing
   ```

2. **Reply Job Logs:**
   ```
   [REPLY_JOB] ⚠️ Hourly quota exceeded
   [REPLY_JOB] ⚠️ Daily quota exceeded
   [REPLY_JOB] ⚠️ Too soon since last reply
   ```

3. **Plan Job Logs:**
   ```
   [UNIFIED_PLAN] ✅ Generated X posts
   [UNIFIED_PLAN] ❌ Generation failed
   ```

---

## 🔧 RECOMMENDED FIXES

### Priority 1: Set Rate Limits

```bash
railway variables --set MAX_POSTS_PER_HOUR=2
railway variables --set REPLIES_PER_HOUR=4
railway variables --set REPLY_MAX_PER_DAY=100
```

### Priority 2: Verify Posting Enabled

```bash
# Remove or set to false:
railway variables --set POSTING_DISABLED=false
railway variables --set DRY_RUN=false
railway variables --set MODE=live
```

### Priority 3: Optimize Plan Job

```bash
railway variables --set JOBS_PLAN_INTERVAL_MIN=60
```

### Priority 4: Verify Reply Job Interval

```bash
railway variables --set JOBS_REPLY_INTERVAL_MIN=30
```

---

## 📈 EXPECTED BEHAVIOR AFTER FIXES

### Posting:
- **2 posts/hour** (48/day max)
- Posting queue runs every 5 minutes
- Rate limiter enforces 2/hour limit
- Circuit breaker only blocks if 5+ failures

### Replies:
- **4 replies/hour** (96/day max)
- Reply job runs every 30 minutes
- Generates 2 replies per cycle
- Multiple rate limit checks prevent over-posting

### Content Generation:
- Plan job runs every 60 minutes
- Generates content continuously
- Queue always has ready content
- Posting job processes ready items

---

## 🧪 VERIFICATION COMMANDS

### Check Current Config:
```bash
railway run printenv | grep -E "(MAX_POSTS_PER_HOUR|REPLIES_PER_HOUR|JOBS_PLAN_INTERVAL_MIN|JOBS_REPLY_INTERVAL_MIN|MODE|POSTING_DISABLED)"
```

### Check Recent Posts:
```sql
SELECT 
  decision_type,
  status,
  COUNT(*) as count,
  MAX(posted_at) as last_post
FROM content_metadata
WHERE posted_at >= NOW() - INTERVAL '24 hours'
GROUP BY decision_type, status;
```

### Check Queue Status:
```sql
SELECT 
  decision_type,
  status,
  COUNT(*) as count
FROM content_metadata
WHERE status IN ('queued', 'posting')
GROUP BY decision_type, status;
```

---

## 🎯 SUMMARY

**Most Likely Blockers:**
1. ❌ `MAX_POSTS_PER_HOUR=1` (too restrictive)
2. ❌ `POSTING_DISABLED=true` or `MODE=shadow`
3. ❌ Circuit breaker open (check for failures)
4. ❌ Reply rate limits too restrictive
5. ❌ Plan job interval too high (empty queue)

**Quick Fix:**
```bash
railway variables --set MAX_POSTS_PER_HOUR=2
railway variables --set POSTING_DISABLED=false
railway variables --set MODE=live
railway variables --set JOBS_PLAN_INTERVAL_MIN=60
```

**Then restart service:**
```bash
railway up --detach
```

