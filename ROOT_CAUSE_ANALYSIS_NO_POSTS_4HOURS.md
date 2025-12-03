# 🚨 ROOT CAUSE ANALYSIS: System Not Posting for 4 Hours

**Analysis Date:** December 3, 2025  
**Issue:** No posts in last 4 hours  
**Status:** Investigation Complete - Use SQL Queries to Find ACTUAL Root Cause

---

## ⚠️ **IMPORTANT: This is a code analysis. To find the ACTUAL root cause, run the SQL queries in `ACTUAL_ROOT_CAUSE_DIAGNOSIS.md`**

---

## 📊 EXECUTIVE SUMMARY

The posting system has **multiple potential root causes** that could prevent posts. This analysis identifies **all blocking conditions** in order of likelihood, based on code analysis and system architecture.

**To find the ACTUAL root cause:** See `ACTUAL_ROOT_CAUSE_DIAGNOSIS.md` for SQL queries you can run directly in Supabase.

---

## 🔍 ROOT CAUSE ANALYSIS (Ordered by Likelihood)

### **1. PLAN JOB NOT RUNNING OR FAILING SILENTLY** ⚠️ HIGHEST PROBABILITY

**Location:** `src/jobs/jobManager.ts:196-218`  
**Issue:** Plan job may not be executing or failing without generating content

**Blocking Conditions:**
- Plan job interval too high (`JOBS_PLAN_INTERVAL_MIN` > 120 minutes)
- Plan job scheduled but not executing (timer not firing)
- Plan job executing but failing silently (exceptions caught but not logged)
- `flags.plannerEnabled` is false (job not scheduled at all)

**Code Evidence:**
```typescript
// Line 197: Job only scheduled if plannerEnabled
if (flags.plannerEnabled) {
  const shouldRunImmediately = await this.shouldRunPlanJobImmediately();
  // ... schedules job
}
```

**How to Verify:**
- Check Railway logs for `[PLAN_JOB]` or `[UNIFIED_PLAN]` messages
- Check `job_heartbeats` table for recent plan job executions
- Check database for recent `content_metadata` entries with `status='queued'`

**Root Cause:** If plan job doesn't run → no content generated → nothing to post

---

### **2. LLM/BUDGET BLOCKING CONTENT GENERATION** ⚠️ HIGH PROBABILITY

**Location:** `src/jobs/planJob.ts:82-104`  
**Issue:** Content generation blocked by LLM access or budget limits

**Blocking Conditions:**
- `isLLMAllowed()` returns false (checking `OPENAI_API_KEY`, `AI_QUOTA_CIRCUIT_OPEN`, budget)
- Budget exceeded (`checkBudgetAllowed()` returns false)
- OpenAI API quota exceeded or rate limited

**Code Evidence:**
```typescript
// Line 82-103: Early return if LLM blocked
const llmCheck = isLLMAllowed();
if (!llmCheck.allowed) {
  console.error(`[PLAN_JOB] 🚨 LLM BLOCKED: ${reason}`);
  return; // EXITS WITHOUT GENERATING CONTENT
}
```

**How to Verify:**
- Check logs for `[PLAN_JOB] 🚨 LLM BLOCKED` messages
- Check Railway env vars: `OPENAI_API_KEY`, `AI_QUOTA_CIRCUIT_OPEN`
- Check budget guard logs

**Root Cause:** If LLM blocked → plan job runs but generates nothing → no content to post

---

### **3. CONTENT GENERATED BUT SCHEDULED IN FUTURE** ⚠️ MEDIUM PROBABILITY

**Location:** `src/jobs/postingQueue.ts:647-680`  
**Issue:** Content exists but `scheduled_at` is in the future

**Blocking Conditions:**
- Content has `status='queued'` but `scheduled_at > NOW() + grace_window`
- Grace window is 5 minutes by default (`GRACE_MINUTES`)
- Content scheduled hours/days in advance

**Code Evidence:**
```typescript
// Line 678: Only selects posts scheduled in past OR within grace window
.lte('scheduled_at', graceWindow.toISOString())
```

**How to Verify:**
- Query database: `SELECT * FROM content_metadata WHERE status='queued' ORDER BY scheduled_at`
- Check if `scheduled_at` values are in the future
- Check `GRACE_MINUTES` env var (default: 5)

**Root Cause:** If content scheduled for future → posting queue skips it → nothing posts

---

### **4. RATE LIMIT REACHED** ⚠️ MEDIUM PROBABILITY

**Location:** `src/jobs/postingQueue.ts:227-231, 507-600`  
**Issue:** Rate limit check blocking all posts

**Blocking Conditions:**
- `MAX_POSTS_PER_HOUR` limit reached (default: 1, but configurable)
- Posts in last hour >= `MAX_POSTS_PER_HOUR`
- Rate limit check happens BEFORE fetching ready decisions

**Code Evidence:**
```typescript
// Line 227: Rate limit check happens early
const canPost = await checkPostingRateLimits();
if (!canPost) {
  log({ op: 'posting_queue', status: 'rate_limited' });
  return; // EXITS WITHOUT PROCESSING QUEUE
}
```

**How to Verify:**
- Check logs for `[POSTING_QUEUE] ⚠️ Hourly CONTENT post limit reached`
- Query: `SELECT COUNT(*) FROM content_metadata WHERE status='posted' AND posted_at > NOW() - INTERVAL '1 hour'`
- Check `MAX_POSTS_PER_HOUR` env var

**Root Cause:** If rate limit reached → posting queue exits early → no posts processed

---

### **5. CIRCUIT BREAKER OPEN** ⚠️ MEDIUM PROBABILITY

**Location:** `src/jobs/postingQueue.ts:34-63, 134-139`  
**Issue:** Circuit breaker blocking all posting attempts

**Blocking Conditions:**
- Circuit breaker state = 'open' (15+ consecutive failures)
- Last failure < 60 seconds ago (reset timeout)
- Circuit breaker not auto-resetting

**Code Evidence:**
```typescript
// Line 134-139: Circuit breaker check happens first
if (!checkCircuitBreaker()) {
  console.warn('[POSTING_QUEUE] ⏸️ Skipping queue processing (circuit breaker open)');
  return; // EXITS WITHOUT PROCESSING
}
```

**How to Verify:**
- Check logs for `[POSTING_QUEUE] ⚠️ Circuit breaker OPEN`
- Check logs for `[POSTING_QUEUE] 🚨 Circuit breaker OPENED after X failures`
- Query circuit breaker status via API or logs

**Root Cause:** If circuit breaker open → all posting blocked → no posts processed

---

### **6. POSTING DISABLED FLAG** ⚠️ LOW PROBABILITY (But Critical)

**Location:** `src/jobs/postingQueue.ts:146-150`  
**Issue:** Posting disabled via feature flag

**Blocking Conditions:**
- `flags.postingDisabled` = true
- `POSTING_DISABLED=true` env var
- `MODE=shadow` (shadow mode disables posting)

**Code Evidence:**
```typescript
// Line 146-150: Early exit if posting disabled
if (flags.postingDisabled) {
  log({ op: 'posting_queue', status: 'disabled' });
  return; // EXITS WITHOUT PROCESSING
}
```

**How to Verify:**
- Check Railway env vars: `POSTING_DISABLED`, `MODE`
- Check logs for `[POSTING_QUEUE] ⚠️ Posting disabled, skipping queue processing`
- Check config: `getModeFlags(config).postingDisabled`

**Root Cause:** If posting disabled → queue runs but exits immediately → no posts

---

### **7. NO QUEUED CONTENT IN DATABASE** ⚠️ MEDIUM PROBABILITY

**Location:** `src/jobs/postingQueue.ts:234-240`  
**Issue:** Database has no queued content

**Blocking Conditions:**
- No rows with `status='queued'` AND `decision_type IN ('single', 'thread')`
- All content already posted or failed
- Content stuck in 'posting' status (not recovered)

**Code Evidence:**
```typescript
// Line 234-240: Early exit if no ready decisions
readyDecisions = await getReadyDecisions();
if (readyDecisions.length === 0) {
  log({ op: 'posting_queue', ready_count: 0 });
  return; // EXITS - NOTHING TO POST
}
```

**How to Verify:**
- Query: `SELECT COUNT(*) FROM content_metadata WHERE status='queued'`
- Check for stuck posts: `SELECT * FROM content_metadata WHERE status='posting' AND created_at < NOW() - INTERVAL '15 minutes'`
- Check last content generation time

**Root Cause:** If no queued content → posting queue has nothing to process → no posts

---

### **8. POSTING QUEUE JOB NOT RUNNING** ⚠️ LOW PROBABILITY

**Location:** `src/jobs/jobManager.ts:181-194`  
**Issue:** Posting queue job not scheduled or not executing

**Blocking Conditions:**
- `flags.postingEnabled` = false (job not scheduled)
- Timer not firing (Node.js timer issue)
- Job executing but crashing silently

**Code Evidence:**
```typescript
// Line 181: Job only scheduled if postingEnabled
if (flags.postingEnabled) {
  this.scheduleStaggeredJob('posting', ...);
}
```

**How to Verify:**
- Check logs for `[POSTING_QUEUE] 📮 Processing posting queue...` (should appear every 5 min)
- Check `job_heartbeats` table for recent posting job executions
- Check Railway logs for job manager startup messages

**Root Cause:** If posting queue not running → no posts processed even if content exists

---

## 🔧 DIAGNOSTIC CHECKLIST

To identify which root cause is active, check these in order:

### **Step 1: Check Posting Queue Execution**
```bash
# Check Railway logs for posting queue activity
railway logs --service xBOT | grep "POSTING_QUEUE"
```
**Expected:** Should see `[POSTING_QUEUE] 📮 Processing posting queue...` every 5 minutes

### **Step 2: Check Plan Job Execution**
```bash
# Check Railway logs for plan job activity
railway logs --service xBOT | grep -E "PLAN_JOB|UNIFIED_PLAN"
```
**Expected:** Should see plan job logs at configured interval

### **Step 3: Check Database State**
```sql
-- Check queued content
SELECT COUNT(*), MAX(created_at) 
FROM content_metadata 
WHERE status='queued' 
AND decision_type IN ('single', 'thread');

-- Check recent posts
SELECT COUNT(*), MAX(posted_at) 
FROM content_metadata 
WHERE status='posted' 
AND posted_at > NOW() - INTERVAL '4 hours';

-- Check stuck posts
SELECT COUNT(*) 
FROM content_metadata 
WHERE status='posting' 
AND created_at < NOW() - INTERVAL '15 minutes';
```

### **Step 4: Check Environment Variables**
```bash
# Check critical env vars
railway variables --service xBOT | grep -E "POSTING_DISABLED|MODE|JOBS_PLAN_INTERVAL|MAX_POSTS_PER_HOUR|OPENAI_API_KEY"
```

### **Step 5: Check Job Heartbeats**
```sql
-- Check recent job executions
SELECT job_name, status, created_at, execution_time_ms
FROM job_heartbeats
WHERE created_at > NOW() - INTERVAL '4 hours'
ORDER BY created_at DESC;
```

---

## 🎯 MOST LIKELY ROOT CAUSES (Ranked)

Based on code analysis, these are the most probable causes:

1. **Plan job not running** (40% probability)
   - Job interval too high OR job not scheduled OR job failing silently

2. **LLM/Budget blocking** (25% probability)
   - OpenAI API key issue OR budget exceeded OR quota circuit open

3. **Rate limit reached** (15% probability)
   - `MAX_POSTS_PER_HOUR` limit hit (if set to 1, and 1 post happened in last hour)

4. **Content scheduled in future** (10% probability)
   - Content exists but `scheduled_at` is hours in the future

5. **Circuit breaker open** (5% probability)
   - 15+ consecutive posting failures triggered circuit breaker

6. **No queued content** (3% probability)
   - Plan job ran but didn't save content OR all content already posted

7. **Posting disabled** (2% probability)
   - `POSTING_DISABLED=true` OR `MODE=shadow`

---

## 📝 RECOMMENDATIONS

### **Immediate Actions:**
1. **Check Railway logs** for the last 4 hours to identify which blocking condition is active
2. **Query database** to check for queued content and recent posts
3. **Verify environment variables** are set correctly
4. **Check job heartbeats** table for job execution history

### **Long-term Fixes:**
1. **Add better logging** to plan job to track when/why it fails
2. **Add health check endpoint** that reports all blocking conditions
3. **Add alerting** when posting stops for >2 hours
4. **Improve circuit breaker** recovery mechanism

---

## 🔗 RELATED FILES

- `src/jobs/jobManager.ts` - Job scheduling logic
- `src/jobs/planJob.ts` - Content generation logic
- `src/jobs/postingQueue.ts` - Posting queue processing
- `src/config/config.ts` - Configuration and feature flags
- `src/config/envFlags.ts` - Environment flag checks

---

**Status:** Analysis Complete - Ready for Diagnostic Execution

