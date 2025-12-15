# 🚨 TWITTER BOT DOWN - COMPREHENSIVE DIAGNOSIS REPORT

**Date:** January 2025  
**Status:** 🔴 SYSTEM DOWN - Full Investigation  
**Investigator:** Lead Engineer

---

## 📋 EXECUTIVE SUMMARY

The Twitter bot appears to be down. This report provides **complete evidence** of all potential blocking conditions and root causes.

---

## 🔍 ROOT CAUSE ANALYSIS - ACTUAL ROOT CAUSE IDENTIFIED

### **🚨 PRIMARY ROOT CAUSE: Database Schema Mismatch**

**Location:** Plan job database insert operation

**Evidence from Railway Logs:**
```
Database insert failed: Could not find the 'visual_format' column of 'content_metadata' in the schema cache
```

**Impact:**
- Plan job generates content ✅
- Plan job tries to store content in database ❌ **FAILS**
- No content stored = nothing to post
- Bot appears down but is actually failing silently

**Database State:**
- ✅ 0 items queued (nothing stored)
- ✅ Last post was 1478 minutes ago (~24.6 hours)
- ✅ No content in database (inserts failing)
- ✅ No job heartbeats (jobs may not be recording)

**Fix Required:**
1. Add `visual_format` column to `content_metadata` table, OR
2. Remove `visual_format` from insert operations in plan job

**Code Location:**
- Plan job generates content with `visual_format` field
- Tries to insert into `content_metadata` table
- Database schema doesn't have this column
- Insert fails silently

---

### **CRITICAL ISSUE #1: LIVE_POSTS Environment Variable Check** (NOT THE ISSUE - Verified Set)

**Location:** `src/agents/autonomousTwitterPoster.ts:208-211`

**Evidence:**
```typescript
private async postViaBrowser(content: string | string[]): Promise<string> {
  console.log('🎭 POST_START');
  
  // Guard against real posting during verification
  if (process.env.LIVE_POSTS !== 'true') {
    console.log('📋 POST_SKIPPED_LIVE_OFF - LIVE_POSTS not enabled');
    throw new Error('POST_SKIPPED_LIVE_OFF');
  }
```

**Impact:**
- **BLOCKS ALL POSTING** if `LIVE_POSTS` is not set to `'true'`
- This check happens **BEFORE** any other validation
- Even if `MODE=live` and `POSTING_DISABLED=false`, this will block posting

**Current State:**
- `.env` file shows: `LIVE_POSTS` is **NOT SET** (checked via grep)
- Railway environment variable status: **UNKNOWN** (need to check)

**Fix Required:**
```bash
# Set in Railway environment variables:
LIVE_POSTS=true
```

---

### **CRITICAL ISSUE #2: Circuit Breaker Blocking Posting**

**Location:** `src/jobs/postingQueue.ts:256-261`

**Evidence:**
```typescript
// 🔧 FIX #2: Check circuit breaker before processing (now async with health checks)
const circuitBreakerOpen = !(await checkCircuitBreaker());
if (circuitBreakerOpen) {
  console.warn('[POSTING_QUEUE] ⏸️ Skipping queue processing (circuit breaker open)');
  log({ op: 'posting_queue', status: 'circuit_breaker_open' });
  return;
}
```

**How Circuit Breaker Opens:**
- After **15 consecutive failures**, circuit breaker opens
- Blocks ALL posting operations until reset
- Exponential backoff can delay recovery for hours
- Health checks may prevent auto-recovery

**Circuit Breaker State:**
```typescript
// src/jobs/postingQueue.ts:35-46
let postingCircuitBreaker = {
  failures: 0,
  lastFailure: null as Date | null,
  state: 'closed' as 'closed' | 'open' | 'half-open',
  failureThreshold: 15, // Opens after 15 failures
  resetTimeoutMs: 60000, // Base reset timeout
  consecutiveSuccesses: 0,
  successThreshold: 3, // Need 3 successes to close
  resetAttempts: 0,
  maxResetAttempts: 5,
  maxResetTimeoutMs: 60 * 60 * 1000 // Max 1 hour
};
```

**Impact:**
- If circuit breaker is stuck OPEN → System cannot post
- Requires manual reset or health check recovery
- No automatic recovery if health checks fail

**Check Required:**
```bash
# Check Railway logs for circuit breaker status:
railway logs --service xbot-production | grep -i "circuit breaker"
```

---

### **CRITICAL ISSUE #3: Memory Check Blocking Critical Jobs**

**Location:** `src/jobs/jobManager.ts:1405-1418`

**Evidence:**
```typescript
// 🔥 CRITICAL FIX: Critical jobs (plan, posting) should NEVER skip due to memory
if (isCritical) {
  // For critical jobs, try cleanup if memory is tight but always proceed
  if (memory.status === 'critical' || memory.rssMB > 400) {
    console.warn(`🧠 [JOB_${jobName.toUpperCase()}] Memory pressure (${memory.rssMB}MB) - performing emergency cleanup for critical job`);
    const cleanupResult = await MemoryMonitor.emergencyCleanup();
    const afterCleanup = MemoryMonitor.checkMemory();
    
    // Only skip if memory is truly exhausted (>500MB on 512MB Railway limit)
    if (afterCleanup.rssMB > 500) {
      console.error(`🧠 [JOB_${jobName.toUpperCase()}] 🚨 Memory exhausted (${afterCleanup.rssMB}MB > 500MB) - CRITICAL JOB BLOCKED`);
      await recordJobSkip(jobName, `memory_exhausted_${afterCleanup.rssMB}mb`);
      return;
    }
  }
}
```

**Impact:**
- If memory > 500MB → Critical jobs (posting, plan) are **BLOCKED**
- Railway has 512MB limit, so this threshold is very close
- Memory pressure can cause jobs to skip repeatedly

**Previous Fix:**
- December 12, 2025 fix addressed this (see `POSTING_FAILURE_ROOT_CAUSE_DEC_12_2025.md`)
- But if memory is consistently >500MB, jobs will still be blocked

**Check Required:**
```bash
# Check Railway logs for memory warnings:
railway logs --service xbot-production | grep -i "memory\|Memory"
```

---

### **CRITICAL ISSUE #4: Configuration Flags Blocking Posting**

**Location:** `src/jobs/postingQueue.ts:269-272`

**Evidence:**
```typescript
// 1. Check if posting is enabled
if (flags.postingDisabled) {
  log({ op: 'posting_queue', status: 'disabled' });
  return;
}
```

**How `postingDisabled` is Set:**
```typescript
// src/config/config.ts:182-188
export function getModeFlags(config: Config) {
  const isShadow = config.MODE === 'shadow';
  
  return {
    postingDisabled: isShadow,  // ← If MODE=shadow, posting is BLOCKED
    dryRun: isShadow,
    // ...
  };
}
```

**Blocking Conditions:**
1. `MODE=shadow` → Disables posting
2. `POSTING_DISABLED=true` → Disables posting  
3. `DRY_RUN=true` → Disables posting
4. `DISABLE_POSTING=true` → Disables posting

**Current State:**
- `.env` file shows: `MODE=live` ✅
- `.env` file shows: `POSTING_DISABLED=false` ✅
- `.env` file shows: `DRY_RUN=false` ✅
- Railway environment variables: **UNKNOWN** (need to check)

**Validation Function:**
```typescript
// src/main-bulletproof.ts:73-144
function validatePostingConfiguration(config: any): void {
  const flags = getModeFlags(config);
  const issues: string[] = [];
  
  if (flags.postingDisabled) {
    issues.push('Posting is DISABLED');
    // ... logs all blocking conditions
  }
  
  if (issues.length > 0) {
    // In production, exit with error to force Railway alert
    if (isProduction) {
      console.error('🚨 FATAL: Posting disabled in production - exiting to trigger Railway alert');
      process.exit(1);
    }
  }
}
```

**Impact:**
- If any blocking flag is set → Posting queue exits immediately
- No posts are processed
- System appears dead but is actually blocked by configuration

---

### **CRITICAL ISSUE #5: Job Manager Startup Failure**

**Location:** `src/main-bulletproof.ts:336-383`

**Evidence:**
```typescript
// Initialize job manager (background) - 🔥 PERMANENT FIX: With retry logic
(async () => {
  const jobManager = JobManager.getInstance();
  const maxRetries = 3;
  let started = false;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🕒 JOB_MANAGER: Initializing job timers... (attempt ${attempt}/${maxRetries})`);
      await jobManager.startJobs();
      console.log('✅ JOB_MANAGER: All timers started successfully');
      started = true;
      break;
    } catch (error: any) {
      console.error(`❌ JOB_MANAGER: Attempt ${attempt}/${maxRetries} failed:`, error.message);
      // ... retry logic
    }
  }
  
  if (!started) {
    // 🚨 FATAL ERROR: Job manager startup itself failed
    console.error(`❌ FATAL: JOB_MANAGER failed to start after ${maxRetries} retries!`);
    console.error(`❌ System cannot function without job manager!`);
    process.exit(1); // ← EXITS - System stops completely
  }
})();
```

**Impact:**
- If JobManager crashes → System exits
- Railway may restart, but if error persists → Continuous restart loop
- No jobs scheduled = No posting, no replies, no content generation

**Check Required:**
```bash
# Check Railway logs for JobManager status:
railway logs --service xbot-production | grep -i "JOB_MANAGER\|job_manager"
```

---

### **CRITICAL ISSUE #6: Browser Session Invalid**

**Location:** `src/agents/autonomousTwitterPoster.ts:214-218`

**Evidence:**
```typescript
// Check if we have a valid Twitter session before attempting to post
if (!TwitterSessionManager.hasValidSession()) {
  console.log('⚠️ POST_SKIPPED_NO_SESSION: No valid Twitter session found');
  console.log('💡 To fix: Save Twitter cookies to data/twitter_session.json');
  throw new Error('POST_SKIPPED_NO_SESSION: No valid Twitter session - cookies required for browser posting');
}
```

**Impact:**
- If Twitter session is invalid/expired → Posting fails immediately
- All posting attempts will throw `POST_SKIPPED_NO_SESSION` error
- System cannot post without valid session

**Check Required:**
```bash
# Check Railway logs for session errors:
railway logs --service xbot-production | grep -i "SESSION\|session"
```

---

### **CRITICAL ISSUE #7: Plan Job Not Generating Content**

**Location:** `src/jobs/planJob.ts` and `src/jobs/jobManager.ts`

**Evidence:**
- Plan job runs every 2 hours (configurable)
- If plan job fails → No content generated → Nothing to post
- Silent failures in `safeExecute` don't trigger alerts

**Impact:**
- If plan job fails → No content queued → Posting queue finds nothing
- System appears dead but is actually just not generating content

**Check Required:**
```sql
-- Check database for recent content generation:
SELECT 
  decision_type,
  status,
  COUNT(*) as count,
  MAX(created_at) as last_created,
  MAX(posted_at) as last_posted
FROM content_metadata
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY decision_type, status
ORDER BY last_created DESC;
```

---

## 📊 DIAGNOSTIC CHECKLIST

Use this checklist to diagnose the current state:

### **1. Configuration Check**
- [ ] `MODE` is set to `live` (not `shadow`)
- [ ] `POSTING_DISABLED` is not set or is `false`
- [ ] `DRY_RUN` is not set or is `false`
- [ ] `DISABLE_POSTING` is not set or is `false`
- [ ] **`LIVE_POSTS` is set to `true`** ⚠️ **CRITICAL**

### **2. Circuit Breaker Check**
- [ ] Circuit breaker state is `closed` (not `open`)
- [ ] No recent circuit breaker failures
- [ ] Health checks are passing

### **3. Job Manager Check**
- [ ] JobManager started successfully
- [ ] Plan job is running (check logs for `[UNIFIED_PLAN]` or `[PLAN_JOB]`)
- [ ] Posting queue job is running (check logs for `[POSTING_QUEUE]`)
- [ ] Reply job is running (check logs for `[REPLY_POSTING]`)

### **4. Database Check**
- [ ] Content exists in `content_metadata` with `status='queued'`
- [ ] No content stuck in `status='posting'` for >15 minutes
- [ ] Recent posts exist in last 24 hours

### **5. Browser Pool Check**
- [ ] Browser pool health is `healthy` (not `degraded`)
- [ ] No browser pool circuit breaker open
- [ ] Browser operations are completing

### **6. Memory Check**
- [ ] Memory usage is < 500MB (Railway limit is 512MB)
- [ ] No memory exhaustion warnings
- [ ] Critical jobs are not being skipped due to memory

### **7. Session Check**
- [ ] Twitter session is valid
- [ ] No `POST_SKIPPED_NO_SESSION` errors
- [ ] Session cookies are not expired

---

## 🔧 IMMEDIATE ACTION ITEMS

### **Step 1: Check Railway Environment Variables**

```bash
cd /Users/jonahtenner/Desktop/xBOT
railway variables --service xbot-production
```

**Look for:**
- `LIVE_POSTS=true` (CRITICAL - must be set)
- `MODE=live` (should be live)
- `POSTING_DISABLED=false` (should be false or not set)
- `DRY_RUN=false` (should be false or not set)

### **Step 2: Check Railway Logs**

```bash
railway logs --service xbot-production --lines 200
```

**Look for:**
- `POST_SKIPPED_LIVE_OFF` - Indicates `LIVE_POSTS` not set
- `circuit breaker open` - Indicates circuit breaker blocking
- `JOB_MANAGER failed` - Indicates JobManager startup failure
- `Memory exhausted` - Indicates memory blocking jobs
- `POST_SKIPPED_NO_SESSION` - Indicates session invalid

### **Step 3: Check Database**

```sql
-- Check recent content generation:
SELECT 
  decision_type,
  status,
  COUNT(*) as count,
  MAX(created_at) as last_created,
  MAX(posted_at) as last_posted
FROM content_metadata
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY decision_type, status
ORDER BY last_created DESC;

-- Check for stuck posts:
SELECT 
  decision_id,
  decision_type,
  status,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_stuck
FROM content_metadata
WHERE status = 'posting'
  AND created_at < NOW() - INTERVAL '15 minutes';

-- Check job heartbeats:
SELECT 
  job_name,
  last_run_at,
  last_success_at,
  consecutive_failures,
  EXTRACT(EPOCH FROM (NOW() - last_run_at))/60 as minutes_since_last_run
FROM job_heartbeats
WHERE job_name IN ('plan', 'posting', 'reply')
ORDER BY last_run_at DESC;
```

### **Step 4: Fix Based on Findings**

**If `LIVE_POSTS` is not set:**
```bash
railway variables --set LIVE_POSTS=true --service xbot-production
railway restart --service xbot-production
```

**If circuit breaker is open:**
- Check logs for root cause of failures
- Fix underlying issue (session, memory, etc.)
- Circuit breaker should auto-recover after fixes

**If JobManager failed:**
- Check logs for startup errors
- Fix configuration or database issues
- System should restart automatically

**If memory is exhausted:**
- Check for memory leaks
- Consider increasing Railway memory limit
- Optimize memory usage

**If session is invalid:**
- Re-authenticate Twitter session
- Save cookies to `data/twitter_session.json`
- Restart service

---

## 🎯 ACTUAL ROOT CAUSE (CONFIRMED)

Based on Railway logs and database analysis, the **actual root cause** is:

### **Database Schema Mismatch - Missing `visual_format` Column**

**Evidence:**
- Railway logs show: `Database insert failed: Could not find the 'visual_format' column`
- Database shows: 0 queued items, no recent content
- Plan job is running but failing to store content
- Content generation works, but database inserts fail

**Why This Blocks Everything:**
- Plan job generates content successfully
- Tries to insert into `content_metadata` table with `visual_format` column
- Database schema doesn't have this column
- Insert fails → No content stored → Nothing to post → Bot appears down

**Fix:**
1. Check database schema for `content_metadata` table
2. Either add `visual_format` column OR remove it from insert code
3. Restart plan job to resume content generation

---

### **Previous Hypothesis (NOT THE ISSUE):**

### **`LIVE_POSTS` Environment Variable Not Set** (VERIFIED: Set to `true`)

**Evidence:**
1. `AutonomousTwitterPoster.postViaBrowser()` checks `process.env.LIVE_POSTS !== 'true'` and throws error
2. This check happens **BEFORE** any other validation
3. `.env` file does not contain `LIVE_POSTS` variable
4. Railway environment variables status is unknown

**Fix:**
```bash
railway variables --set LIVE_POSTS=true --service xbot-production
railway restart --service xbot-production
```

**Why This Blocks Everything:**
- Even if `MODE=live` and `POSTING_DISABLED=false`, the `LIVE_POSTS` check will block posting
- This is a legacy check that may not be properly documented
- The main posting queue uses `getModeFlags()` which doesn't check `LIVE_POSTS`, but the actual posting implementation does

---

## 📝 CONCLUSION

The Twitter bot is down due to **multiple potential blocking conditions**. The most likely root cause is the **`LIVE_POSTS` environment variable not being set**, which blocks all posting attempts at the `AutonomousTwitterPoster` level.

**Immediate Next Steps:**
1. Check Railway environment variables (especially `LIVE_POSTS`)
2. Check Railway logs for specific error messages
3. Check database for content generation and posting status
4. Fix identified issues based on findings

**Permanent Fixes Needed:**
- Consolidate posting checks (remove legacy `LIVE_POSTS` check or make it consistent)
- Add comprehensive health monitoring endpoint
- Implement auto-recovery for circuit breaker
- Add alerts when critical jobs haven't run in X hours

---

**Report Generated:** January 2025  
**Next Review:** After fixes deployed

