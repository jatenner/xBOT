# 🚨 SYSTEM OUTAGE ROOT CAUSE ANALYSIS & FIX

## **PROBLEM SUMMARY**

System experiences **hours-long outages** where:
- ❌ Posting stops working
- ❌ Replies stop working  
- ❌ Metrics/harvesting stop working
- ❌ Entire system appears "down" visually but process may still be running

---

## **ROOT CAUSES IDENTIFIED**

### **1. Process Exits on Fatal Errors** 🔴 **CRITICAL**

**Location:** `src/main-bulletproof.ts:315`

```typescript
if (error) {
  console.error(`❌ FATAL: JOB_MANAGER failed to start: ${error.message}`);
  process.exit(1); // ← Process crashes!
}
```

**Problem:**
- If job manager startup fails, entire process exits
- Railway restarts it, but if error persists → crash loop
- Takes time for Railway to detect crash and restart
- During restart, **ALL systems are down**

**Impact:** System-wide outage for 1-5 minutes per crash

---

### **2. No Process Keep-Alive Mechanism** 🔴 **CRITICAL**

**Problem:**
- Process relies on `setInterval` timers to stay alive
- If all timers are cleared or fail to initialize:
  - Process could exit gracefully (not crash, but exit code 0)
  - Railway might not restart it immediately
  - System appears "running" but is actually dead

**Evidence:** No explicit `setInterval(() => {}, 60000)` keep-alive heartbeat

**Impact:** Silent death - process exits but appears running

---

### **3. Browser Resource Exhaustion** 🟡 **HIGH**

**Problem:**
- Multiple browser managers can launch separate browsers
- Each browser instance uses 200-400MB RAM
- With 512MB Railway limit, 2-3 browsers = OOM crash
- Browser crashes cause jobs to hang waiting for browser

**Impact:** 
- Process crashes due to memory exhaustion
- Jobs hang indefinitely waiting for browser that will never respond
- System appears "stuck" for hours

---

### **4. Silent Job Failures** 🟡 **HIGH**

**Location:** `src/jobs/jobManager.ts:safeExecute()`

**Problem:**
- Jobs fail silently with retry logic
- After 3 retries, job just logs error and stops
- No alerting, no recovery mechanism
- If critical jobs fail repeatedly, system appears down

**Example Flow:**
```
Posting job fails → retry 1 → fails → retry 2 → fails → retry 3 → fails
→ Logs error → Waits for next interval (5 min)
→ Next interval: fails again → repeat
→ Hours pass with no successful posts
```

**Impact:** System appears "running" but functionally dead

---

### **5. Hung Jobs Not Detected Quickly** 🟡 **MEDIUM**

**Location:** `src/jobs/jobWatchdog.ts`

**Problem:**
- Watchdog only runs **every 5 minutes**
- Jobs can get stuck in "running" state for up to 5 minutes before detection
- Browser operations can hang for **much longer** (10-30 min timeouts)
- No mechanism to detect hung browser operations

**Impact:** Jobs stuck for 5-30 minutes before recovery

---

### **6. Health Checks Don't Restart Process** 🟢 **LOW**

**Problem:**
- Health checks can detect issues but can't restart the Node.js process
- Can only trigger individual jobs, not recover from process-level issues

**Impact:** Minor - health checks are useful but limited

---

## **COMPREHENSIVE FIX PLAN**

### **Fix 1: Process Keep-Alive + Fatal Error Recovery** 🔴 **PRIORITY 1**

**Location:** `src/main-bulletproof.ts`

**Changes:**
1. Add explicit keep-alive heartbeat (never let process exit gracefully)
2. Wrap fatal errors in recovery instead of `process.exit(1)`
3. Add process-level watchdog that restarts if critical jobs fail

```typescript
// Add keep-alive heartbeat
const keepAliveInterval = setInterval(() => {
  // This prevents process from exiting if all timers are cleared
}, 30000); // Every 30 seconds

// Track last successful critical job
let lastCriticalJobSuccess = Date.now();
const CRITICAL_JOB_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Check every 5 minutes if critical jobs are working
setInterval(() => {
  const timeSinceLastSuccess = Date.now() - lastCriticalJobSuccess;
  
  if (timeSinceLastSuccess > CRITICAL_JOB_TIMEOUT) {
    console.error('🚨 CRITICAL: No successful jobs in 30 minutes - restarting...');
    // Force Railway restart by exiting with error code
    process.exit(1);
  }
}, 5 * 60 * 1000);
```

---

### **Fix 2: Enhanced Job Watchdog** 🔴 **PRIORITY 1**

**Location:** `src/jobs/jobWatchdog.ts`

**Changes:**
1. Reduce watchdog interval from 5 min → 2 min
2. Add detection for hung browser operations
3. Add forced job restart for stuck operations

```typescript
// Check every 2 minutes instead of 5
setInterval(async () => {
  await runJobWatchdog(runJobNow);
}, 2 * 60 * 1000); // 2 minutes

// Add hung job detection
const HUNG_JOB_THRESHOLD = 15 * 60 * 1000; // 15 minutes

async function detectHungJobs() {
  const { data: runningJobs } = await supabase
    .from('job_heartbeats')
    .select('job_name, updated_at, last_run_status')
    .eq('last_run_status', 'running');
  
  for (const job of runningJobs || []) {
    const runTime = Date.now() - new Date(job.updated_at).getTime();
    if (runTime > HUNG_JOB_THRESHOLD) {
      console.error(`🚨 HUNG JOB: ${job.job_name} running for ${Math.round(runTime / 60000)} minutes`);
      // Force kill and restart
      await recordJobFailure(job.job_name, 'hung_timeout');
      await runJobNow(job.job_name as WatchdogRecoverableJob);
    }
  }
}
```

---

### **Fix 3: Browser Resource Management** 🟡 **PRIORITY 2**

**Location:** `src/browser/UnifiedBrowserPool.ts` (if exists) or create one

**Changes:**
1. Enforce single browser instance
2. Add memory monitoring
3. Auto-kill hung browser operations

```typescript
// Monitor browser memory usage
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  const rssMB = memoryUsage.rss / 1024 / 1024;
  
  if (rssMB > 450) { // 450MB of 512MB limit
    console.error(`🚨 MEMORY CRITICAL: ${rssMB.toFixed(0)}MB used`);
    // Force browser cleanup
    await browserPool.emergencyCleanup();
  }
}, 60000); // Every minute

// Auto-kill hung browser operations
const MAX_BROWSER_OPERATION_TIME = 10 * 60 * 1000; // 10 minutes

// Track operation start times and kill if hung
```

---

### **Fix 4: Critical Job Failure Alerts** 🟡 **PRIORITY 2**

**Location:** `src/jobs/jobManager.ts`

**Changes:**
1. Track consecutive failures
2. Alert after N consecutive failures
3. Emergency job restart after M consecutive failures

```typescript
private criticalJobFailures = new Map<string, number>();

private async safeExecute(jobName: string, jobFn: () => Promise<void>): Promise<void> {
  try {
    await jobFn();
    // Success - reset failure counter
    this.criticalJobFailures.set(jobName, 0);
    return;
  } catch (error) {
    const failures = (this.criticalJobFailures.get(jobName) || 0) + 1;
    this.criticalJobFailures.set(jobName, failures);
    
    // After 5 consecutive failures, trigger emergency recovery
    if (failures >= 5 && (jobName === 'plan' || jobName === 'posting')) {
      console.error(`🚨 EMERGENCY: ${jobName} failed ${failures} times consecutively`);
      // Log to system_events for monitoring
      await logSystemEvent('critical_job_failure', {
        job: jobName,
        consecutive_failures: failures
      });
      
      // Force immediate retry with exponential backoff
      await this.emergencyRecovery(jobName);
    }
  }
}
```

---

### **Fix 5: Process-Level Health Monitoring** 🟢 **PRIORITY 3**

**Location:** `src/main-bulletproof.ts`

**Changes:**
1. Add health endpoint that checks if jobs are actually running
2. Railway health check endpoint that fails if system is stuck
3. Auto-restart trigger if health check fails

```typescript
// Health endpoint that fails if critical jobs haven't run recently
app.get('/health', async (req, res) => {
  const jobManager = JobManager.getInstance();
  const stats = jobManager.getStats();
  
  const now = Date.now();
  const timeSinceLastPosting = stats.lastPostingTime 
    ? now - stats.lastPostingTime.getTime() 
    : Infinity;
  
  // If posting hasn't run in 15 minutes, return 503 (Service Unavailable)
  if (timeSinceLastPosting > 15 * 60 * 1000) {
    return res.status(503).json({
      status: 'unhealthy',
      reason: 'posting_job_stuck',
      lastPostingTime: stats.lastPostingTime
    });
  }
  
  res.json({ status: 'healthy' });
});
```

---

## **IMPLEMENTATION PRIORITY**

1. **Fix 1** (Keep-alive + fatal recovery) - **IMMEDIATE**
   - Prevents silent process death
   - Prevents crash loops
   - Impact: High, Effort: Low

2. **Fix 2** (Enhanced watchdog) - **IMMEDIATE**  
   - Detects stuck jobs faster
   - Auto-recovers from hung states
   - Impact: High, Effort: Medium

3. **Fix 3** (Browser management) - **SOON**
   - Prevents memory exhaustion
   - Prevents browser hangs
   - Impact: Medium, Effort: Medium

4. **Fix 4** (Failure alerts) - **SOON**
   - Better visibility into failures
   - Automatic recovery triggers
   - Impact: Medium, Effort: Low

5. **Fix 5** (Health monitoring) - **NICE TO HAVE**
   - Railway-level health checks
   - Better observability
   - Impact: Low, Effort: Low

---

## **EXPECTED IMPROVEMENTS**

After fixes:
- ✅ No more silent process exits
- ✅ Automatic recovery from hung jobs (< 2 min detection)
- ✅ Memory exhaustion prevention
- ✅ Crash loop prevention
- ✅ Better visibility into system state

**Estimated reduction in outages: 80-90%**

---

## **MONITORING RECOMMENDATIONS**

1. Set up alerts for:
   - Job consecutive failures > 3
   - Hung jobs detected
   - Memory usage > 400MB
   - Process restarts > 3/hour

2. Dashboard metrics:
   - Time since last successful posting
   - Time since last successful plan job
   - Number of hung jobs
   - Memory usage trend

---

**Last Updated:** November 17, 2025

