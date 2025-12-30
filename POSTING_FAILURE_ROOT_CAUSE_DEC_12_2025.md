# 🚨 POSTING FAILURE ROOT CAUSE - DEC 12, 2025

## **PROBLEM**
System has not posted in 12+ hours. Investigation revealed critical memory check bug blocking posting job.

---

## **ROOT CAUSE**

### **Memory Check Blocking Critical Jobs**

**Location:** `src/jobs/jobManager.ts` lines 1375-1381

**Issue:**
- Memory check `isMemorySafeForOperation(100, 400)` was running BEFORE checking if job is critical
- This caused ALL jobs (including critical `posting` and `plan` jobs) to be skipped when memory was 300-400MB
- Railway logs showed: `🧠 [JOB_POSTING] ⚠️ Low memory (301MB), skipping this run`

**Why This Happened:**
- Memory check threshold: 400MB
- Operation memory estimate: 100MB  
- Check: `currentMB + operationMB < thresholdMB`
- At 301MB: `301 + 100 = 401MB > 400MB` → **UNSAFE** → **SKIP**
- Even though `posting` is marked as `isCritical`, the skip happened before the critical check

**Impact:**
- Posting job skipped every 5 minutes due to "low memory"
- Plan job also skipped (would generate content)
- System appeared dead but was actually just blocked by memory check

---

## **FIX IMPLEMENTED**

### **Changes Made:**

1. **Restructured Memory Check Logic** (`src/jobs/jobManager.ts`)
   - Critical jobs (`plan`, `posting`, `peer_scraper`) now bypass initial memory skip
   - Critical jobs attempt emergency cleanup but proceed unless memory truly exhausted (>500MB)
   - Non-critical jobs still skip when memory is tight

2. **New Behavior:**
   - **Critical jobs:** Try cleanup → Proceed unless >500MB
   - **Non-critical jobs:** Skip if memory unsafe (existing behavior)

### **Code Changes:**

```typescript
// BEFORE (WRONG):
const memoryCheck = await isMemorySafeForOperation(100, 400);
if (!memoryCheck.safe) {
  // ❌ This skipped ALL jobs, including critical ones
  return;
}

// AFTER (FIXED):
if (isCritical) {
  // ✅ Critical jobs try cleanup but proceed
  if (memory.rssMB > 400) {
    await MemoryMonitor.emergencyCleanup();
    // Only skip if truly exhausted (>500MB)
    if (afterCleanup.rssMB > 500) return;
  }
  // Proceed with critical job
} else {
  // Non-critical jobs skip if memory unsafe
  if (!memoryCheck.safe) return;
}
```

---

## **VERIFICATION**

### **Check Logs:**
```bash
railway logs --service xBOT | grep -E "POSTING_QUEUE|JOB_POSTING|Low memory"
```

**Before Fix:**
```
🧠 [JOB_POSTING] ⚠️ Low memory (301MB), skipping this run
```

**After Fix (Expected):**
```
🧠 [JOB_POSTING] Memory pressure (301MB) - performing emergency cleanup for critical job
🧠 [JOB_POSTING] After cleanup: 280MB (freed 21MB)
🧠 [JOB_POSTING] ⚠️ Memory tight but proceeding (critical job must run)
🕒 JOB_POSTING: Starting...
```

### **Check Database:**
```sql
-- Check if posting job is running
SELECT * FROM job_heartbeats WHERE job_name = 'posting';

-- Check recent posts
SELECT * FROM content_metadata 
WHERE status = 'posted' 
  AND posted_at >= NOW() - INTERVAL '1 hour'
ORDER BY posted_at DESC;
```

---

## **PREVENTION**

### **Memory Management:**
1. ✅ Critical jobs now bypass memory skip (only skip if >500MB)
2. ✅ Emergency cleanup runs before critical jobs proceed
3. ✅ Non-critical jobs still skip to prevent memory spikes

### **Monitoring:**
- Monitor Railway logs for memory warnings
- Check `job_heartbeats` table for skipped jobs
- Alert if posting job hasn't succeeded in 2+ hours

### **Future Improvements:**
- Consider lowering memory threshold for critical jobs (e.g., 450MB instead of 400MB)
- Add memory pressure alerts when cleanup runs frequently
- Consider increasing Railway memory limit if this persists

---

## **DEPLOYMENT**

**Status:** ✅ Fix implemented, ready to deploy

**Files Changed:**
- `src/jobs/jobManager.ts` (memory check logic)

**Testing:**
- Verify posting job runs even with 300-400MB memory
- Verify emergency cleanup runs for critical jobs
- Verify non-critical jobs still skip appropriately

**Deploy Command:**
```bash
git add src/jobs/jobManager.ts
git commit -m "Fix: Critical jobs bypass memory skip, only skip if >500MB"
git push
```

---

## **SUMMARY**

**Root Cause:** Memory check was blocking critical `posting` job at 300-400MB memory usage.

**Fix:** Critical jobs now bypass memory skip, attempt cleanup, and proceed unless memory truly exhausted (>500MB).

**Impact:** System should resume posting immediately after deployment.


