# Adaptive Timeout Strategy Implementation

**Date:** December 16, 2025  
**Status:** ✅ **DEPLOYED**

---

## Summary

Implemented adaptive, self-healing Playwright posting strategy to resolve timeout failures under slow network/browser conditions.

---

## Changes Implemented

### 1. Adaptive Timeout Strategy ✅

**Location:** `src/jobs/postingQueue.ts`

**Implementation:**
- **Single posts:** Progressive timeout per retry attempt
  - Attempt 1: 120s (2 minutes)
  - Attempt 2: 180s (3 minutes)
  - Attempt 3: 240s (4 minutes)

- **Thread posts:** Progressive timeout per retry attempt
  - Attempt 1: 180s (3 minutes)
  - Attempt 2: 240s (4 minutes)
  - Attempt 3: 300s (5 minutes)

**Code:**
```typescript
const retryCount = Number((decision.features as any)?.retry_count || 0);
const adaptiveTimeouts = [120000, 180000, 240000]; // Progressive: 120s, 180s, 240s
const SINGLE_POST_TIMEOUT_MS = adaptiveTimeouts[Math.min(retryCount, adaptiveTimeouts.length - 1)];

console.log(`[POSTING_QUEUE] ⏱️ Using adaptive timeout: ${SINGLE_POST_TIMEOUT_MS}ms (attempt ${retryCount + 1}, retry_count=${retryCount})`);
```

**Benefits:**
- Gives slow operations more time on retries
- Reduces false timeout failures
- Maintains reasonable initial timeout (120s)

---

### 2. Browser Health Check ✅

**Location:** `src/jobs/postingQueue.ts` (before posting)

**Implementation:**
- Checks browser pool health status before posting
- Auto-resets browser pool if degraded or circuit breaker open
- Non-blocking (logs warning if check fails)

**Code:**
```typescript
// 🔍 BROWSER HEALTH CHECK: Verify browser/page responsiveness before posting
try {
  const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
  const pool = UnifiedBrowserPool.getInstance();
  const health = pool.getHealth();
  
  if (health.status === 'degraded' || health.circuitBreaker?.isOpen) {
    console.warn(`[POSTING_QUEUE] ⚠️ Browser pool health check failed: status=${health.status}, circuitBreaker=${health.circuitBreaker?.isOpen}`);
    console.log(`[POSTING_QUEUE] 🔄 Resetting browser pool before posting...`);
    await pool.resetPool();
    console.log(`[POSTING_QUEUE] ✅ Browser pool reset complete`);
  } else {
    console.log(`[POSTING_QUEUE] ✅ Browser pool health check passed: status=${health.status}`);
  }
} catch (healthError: any) {
  console.warn(`[POSTING_QUEUE] ⚠️ Browser health check failed (non-blocking): ${healthError.message}`);
}
```

**Benefits:**
- Prevents posting with stuck browser instances
- Auto-recovers from degraded browser state
- Reduces timeout failures from browser issues

---

### 3. Stage-Level Timeout Logging ✅

**Location:** `src/posting/UltimateTwitterPoster.ts`

**Implementation:**
- Logs start/completion/duration for each posting stage:
  - **navigation:** Page load, UI ready, authentication check
  - **typing:** Composer interaction, content insertion
  - **submit:** Post button click, network verification

**Code:**
```typescript
const stageStartTimes: Record<string, number> = {};
const logStage = (stage: string, action: () => Promise<void>): Promise<void> => {
  stageStartTimes[stage] = Date.now();
  console.log(`[ULTIMATE_POSTER] 🎯 Stage: ${stage} - Starting`);
  return action().then(
    () => {
      const duration = Date.now() - stageStartTimes[stage];
      console.log(`[ULTIMATE_POSTER] ✅ Stage: ${stage} - Completed in ${duration}ms`);
    },
    (error) => {
      const duration = Date.now() - stageStartTimes[stage];
      console.error(`[ULTIMATE_POSTER] ❌ Stage: ${stage} - Failed after ${duration}ms: ${error.message}`);
      throw error;
    }
  );
};
```

**Benefits:**
- Identifies which stage times out (navigation vs typing vs submit)
- Provides duration metrics for performance analysis
- Enables targeted optimization

---

### 4. Safety Requirements ✅

**Backward Compatibility:**
- ✅ No breaking changes
- ✅ Defaults to 120s timeout if retry_count not set
- ✅ Graceful degradation if health check fails

**Failure Handling:**
- ✅ Marks decisions as `failed_permanent` after max retries (if `ENABLE_DEAD_LETTER_HANDLING=true`)
- ✅ Existing retry logic unchanged
- ✅ Error logging enhanced with stage information

---

## Example Log Output

### Successful Post (First Attempt):
```
[POSTING_QUEUE] ⏱️ Using adaptive timeout: 120000ms (attempt 1, retry_count=0)
[POSTING_QUEUE] ✅ Browser pool health check passed: status=healthy
[ULTIMATE_POSTER] ✅ Browser health check passed
[ULTIMATE_POSTER] 🎯 Stage: navigation - Starting
[ULTIMATE_POSTER] ✅ Stage: navigation - Completed in 12500ms
[ULTIMATE_POSTER] 🎯 Stage: typing - Starting
[ULTIMATE_POSTER] ✅ Stage: typing - Completed in 3200ms
[ULTIMATE_POSTER] 🎯 Stage: submit - Starting
[ULTIMATE_POSTER] ✅ Stage: submit - Completed in 8500ms
[POSTING_QUEUE] ✅ Tweet ID extracted: 2001234567890123456
```

### Retry After Timeout (Second Attempt):
```
[POSTING_QUEUE] ⏱️ Using adaptive timeout: 180000ms (attempt 2, retry_count=1)
[POSTING_QUEUE] ⚠️ Browser pool health check failed: status=degraded, circuitBreaker=false
[POSTING_QUEUE] 🔄 Resetting browser pool before posting...
[POSTING_QUEUE] ✅ Browser pool reset complete
[ULTIMATE_POSTER] ✅ Browser health check passed
[ULTIMATE_POSTER] 🎯 Stage: navigation - Starting
[ULTIMATE_POSTER] ✅ Stage: navigation - Completed in 18500ms
[ULTIMATE_POSTER] 🎯 Stage: typing - Starting
[ULTIMATE_POSTER] ✅ Stage: typing - Completed in 4100ms
[ULTIMATE_POSTER] 🎯 Stage: submit - Starting
[ULTIMATE_POSTER] ✅ Stage: submit - Completed in 9200ms
[POSTING_QUEUE] ✅ Tweet ID extracted: 2001234567890123457
```

### Timeout Failure (Stage Identified):
```
[POSTING_QUEUE] ⏱️ Using adaptive timeout: 120000ms (attempt 1, retry_count=0)
[POSTING_QUEUE] ✅ Browser pool health check passed: status=healthy
[ULTIMATE_POSTER] ✅ Browser health check passed
[ULTIMATE_POSTER] 🎯 Stage: navigation - Starting
[ULTIMATE_POSTER] ✅ Stage: navigation - Completed in 12500ms
[ULTIMATE_POSTER] 🎯 Stage: typing - Starting
[ULTIMATE_POSTER] ❌ Stage: typing - Failed after 118000ms: Content fill verification failed
[POSTING_QUEUE] ⏱️ Single post timeout after 120000ms (attempt 1) - cleaning up
[POSTING_QUEUE] 🔄 single will retry (attempt 1/3) in 3min
```

---

## Files Modified

1. **src/jobs/postingQueue.ts**
   - Added adaptive timeout calculation (single & thread posts)
   - Added browser health check before posting
   - Enhanced timeout logging with attempt number

2. **src/posting/UltimateTwitterPoster.ts**
   - Added stage-level timeout logging (navigation, typing, submit)
   - Added browser health check before posting
   - Enhanced error messages with stage information

---

## Deployment

**Status:** ✅ **DEPLOYED**

**Commands:**
```bash
pnpm build  # ✅ Success
git commit -m "feat: adaptive timeout strategy + browser health checks"
git push origin main  # ✅ Pushed
```

**Railway:** Auto-deploying on push to main

---

## Expected Impact

1. **Reduced Timeout Failures:**
   - Progressive timeouts give slow operations more time
   - Browser health checks prevent stuck browser issues

2. **Better Diagnostics:**
   - Stage-level logging identifies bottlenecks
   - Duration metrics enable performance optimization

3. **Self-Healing:**
   - Auto-reset browser pool if degraded
   - Graceful recovery from browser issues

4. **Improved Success Rate:**
   - More time for slow network conditions
   - Better handling of Twitter/X delays

---

## Monitoring

**Key Log Patterns to Watch:**
- `[POSTING_QUEUE] ⏱️ Using adaptive timeout:` - Shows timeout per attempt
- `[POSTING_QUEUE] ✅ Browser pool health check passed` - Health check success
- `[ULTIMATE_POSTER] 🎯 Stage:` - Stage start/completion
- `[ULTIMATE_POSTER] ❌ Stage:` - Stage failure with duration

**Metrics to Track:**
- Posting success rate by attempt number
- Average stage durations
- Browser health check failures
- Timeout failures by stage

---

**Report Generated:** 2025-12-16T04:30:00Z  
**Status:** ✅ **IMPLEMENTED & DEPLOYED**

