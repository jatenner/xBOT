# 🔧 Memory Crash Fix - November 22, 2025

## Problem

**Railway service crashed due to memory exhaustion**
- Memory stuck at 461MB (critical threshold: 450MB)
- Emergency cleanup was freeing 0MB (not working)
- Jobs kept getting skipped: "Memory still critical after cleanup"
- Service eventually crashed

## Root Cause

Emergency cleanup was **too conservative**:
- Only closed contexts idle for 30+ seconds
- Didn't close contexts actively in use
- Didn't close browser when memory was critical
- Result: Memory never freed, service crashed

## Fix Applied

### 1. **Aggressive Emergency Cleanup**

**File:** `src/browser/UnifiedBrowserPool.ts`

**Changes:**
- Added `aggressive` parameter to `emergencyCleanup()` method
- **Aggressive mode** (when memory > 450MB):
  - Closes **ALL** contexts (even if in use)
  - Clears all queued operations
  - Closes browser entirely if needed
  - Forces memory release

**Standard mode** (memory < 450MB):
- Only closes idle contexts (original behavior)
- Less disruptive for normal operations

### 2. **Memory Monitor Integration**

**File:** `src/utils/memoryMonitor.ts`

**Changes:**
- Calls `emergencyCleanup()` with `aggressive=true` when memory is critical
- Ensures browser pool closes everything when memory is stuck

### 3. **Job Manager Updates**

**File:** `src/jobs/jobManager.ts`

**Changes:**
- Better handling of critical jobs (plan, posting)
- Even if memory still shows critical after cleanup, allows critical jobs to proceed
- RSS memory may lag behind actual freed memory

## Expected Results

1. **Memory will actually free up** when cleanup runs
2. **Service won't crash** from memory exhaustion
3. **Critical jobs can still run** even during memory pressure

## Next Steps

1. **Restart Railway service** - The fix needs to be deployed
2. **Monitor memory usage** - Should stay under 450MB with aggressive cleanup
3. **Watch logs** - Should see "AGGRESSIVE mode" messages during cleanup

## How to Deploy

```bash
# Commit the changes
git add src/browser/UnifiedBrowserPool.ts src/utils/memoryMonitor.ts src/jobs/jobManager.ts
git commit -m "Fix: Aggressive memory cleanup to prevent crashes"

# Push to trigger Railway deployment
git push origin main
```

## Monitoring

Watch for these log messages:
- `[BROWSER_POOL] 🚨 EMERGENCY CLEANUP: AGGRESSIVE mode` - Cleanup is working
- `[MEMORY_MONITOR] Emergency cleanup: XMB → YMB (freed ZMB)` - Memory is freeing
- If memory still shows critical after cleanup but freed > 0MB, that's OK (RSS lags)

