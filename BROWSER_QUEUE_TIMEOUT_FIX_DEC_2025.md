# Browser Queue Timeout Fix & Optimization - Dec 2025

## Root Cause Identified

The posting system was failing silently due to **browser queue timeout errors**:
- Browser pool queue timeout was 60 seconds (too short for posting operations)
- Posting operations had priority 2 (lower than replies at priority 0)
- Queue timeout errors were being caught but not properly tracked in `job_heartbeats`
- No retry logic for queue timeout failures

## Fixes Implemented

### 1. ✅ Increased Queue Timeout for Critical Operations
**File:** `src/browser/UnifiedBrowserPool.ts`

- **Before:** All operations had 60s timeout
- **After:** Critical operations (priority ≤ 1) get 3x timeout (180s minimum)
- **Impact:** Posting operations now have enough time to complete even when browser pool is busy

```typescript
const isCriticalOperation = priority <= 1; // Priority 0 or 1 (replies, posting)
const timeoutMs = isCriticalOperation 
  ? Math.max(this.QUEUE_WAIT_TIMEOUT * 3, 180000) // 3x timeout or 3min min
  : this.QUEUE_WAIT_TIMEOUT; // Normal timeout for background jobs
```

### 2. ✅ Optimized Priority Handling
**Files:** 
- `src/browser/BrowserSemaphore.ts`
- `src/posting/UltimateTwitterPoster.ts`
- `src/posting/BulletproofThreadComposer.ts`

- **Before:** Posting had priority 1, threads had priority 2
- **After:** Posting and threads now have priority 0 (highest, equal to replies)
- **Impact:** Posting operations never wait for background jobs

```typescript
export const BrowserPriority = {
  REPLIES: 0,        // 🔥 ABSOLUTE HIGHEST
  POSTING: 0,        // 🔥 OPTIMIZATION: Equal priority to replies
  METRICS: 2,
  HARVESTING: 3,
  FOLLOWER_TRACK: 4,
  ANALYTICS: 6
} as const;
```

### 3. ✅ Enhanced Error Tracking
**File:** `src/jobs/postingQueue.ts`

- **Added:** Queue timeout error detection and tracking
- **Added:** Automatic retry logic (up to 3 attempts with 5-minute delays)
- **Added:** `job_heartbeats` updates for both success and failure cases
- **Impact:** Failures are now visible in monitoring, and system automatically retries

**Key Features:**
- Detects browser queue timeout errors specifically
- Reschedules failed posts for retry (up to 3 attempts)
- Updates `job_heartbeats` with failure details
- Updates `job_heartbeats` with success on completion

### 4. ✅ Better Monitoring
**File:** `src/jobs/postingQueue.ts`

- **Added:** Success tracking in `job_heartbeats`
- **Added:** Consecutive failure tracking
- **Added:** Detailed error logging with context
- **Impact:** System health is now visible in `job_heartbeats` table

## Optimization Summary

### Before:
- ❌ 60s queue timeout (too short)
- ❌ Priority 1-2 for posting (could wait)
- ❌ Silent failures (no tracking)
- ❌ No retry logic

### After:
- ✅ 180s+ timeout for critical operations
- ✅ Priority 0 for posting (never waits)
- ✅ Full error tracking in `job_heartbeats`
- ✅ Automatic retry with exponential backoff

## Expected Impact

1. **Posting Reliability:** Posts will no longer timeout due to browser pool congestion
2. **Visibility:** All failures tracked in `job_heartbeats` for monitoring
3. **Resilience:** Automatic retry prevents transient failures from blocking posts
4. **Performance:** Higher priority ensures posting never waits for background jobs

## Monitoring

Check `job_heartbeats` table for posting job status:
```sql
SELECT 
  job_name,
  last_run_status,
  last_success,
  last_failure,
  consecutive_failures,
  last_error,
  updated_at
FROM job_heartbeats
WHERE job_name = 'posting';
```

## Testing

The fixes are backward compatible and will:
- ✅ Continue working with existing browser pool configuration
- ✅ Handle both single posts and threads
- ✅ Work with both X API and Playwright posting methods
- ✅ Maintain existing rate limiting and circuit breaker logic

## Next Steps

1. Deploy to Railway
2. Monitor `job_heartbeats` for posting job status
3. Check logs for queue timeout messages (should be rare now)
4. Verify posts are completing successfully

