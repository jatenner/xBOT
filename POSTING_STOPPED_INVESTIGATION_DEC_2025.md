# 🚨 POSTING STOPPED INVESTIGATION - December 2025

## Problem
System hasn't posted to Twitter in a few hours despite having queued content.

## Root Causes Identified

### 1. ✅ FIXED: Grace Window Query Issue
**Problem:** Queued post scheduled exactly at current time wasn't being picked up
- Query used `lte('scheduled_at', graceWindow)` but didn't handle edge case
- Post scheduled at exact current time was excluded

**Fix Applied:**
- Added `gte('scheduled_at', oneSecondAgo)` to include posts scheduled up to 1 second ago
- This ensures posts scheduled exactly at current time are included

**Location:** `src/jobs/postingQueue.ts:498-534`

### 2. ⚠️ Plan Job Not Running
**Problem:** Plan job hasn't executed (0 recent executions in job_heartbeats)
- No new content being generated
- System relies on plan job to create posts

**Possible Causes:**
- Job manager not running
- Plan job disabled (`flags.plannerEnabled = false`)
- Job scheduling issue
- Service restart needed

**Action Required:**
- Check Railway logs for plan job execution
- Verify `JOBS_PLAN_INTERVAL_MIN` configuration
- Check if job manager is running

### 3. ⚠️ Multiple Posting Failures
**Problem:** 4 failed posts in last 6 hours, all with Playwright errors:
- Thread posting failures
- Single post timeouts
- Browser/Playwright issues

**Impact:**
- Circuit breaker may be open (5 failures = open)
- System may be blocking posting due to failures

**Action Required:**
- Check circuit breaker state
- Investigate Playwright/browser issues
- Review posting error logs

## Current Status

### Database State:
- **Queued posts:** 1 (ready to post)
- **Posted (last 6h):** 0
- **Failed (last 6h):** 4
- **Stuck posts:** 0
- **Rate limit:** OK (0/1 posts in last hour)

### Issues:
1. ✅ Grace window query fixed
2. ⚠️ Plan job not running - no new content
3. ⚠️ Multiple posting failures - may have triggered circuit breaker

## Immediate Actions

### 1. Test Grace Window Fix
The queued post should now be picked up by the posting queue. Monitor next posting cycle.

### 2. Check Plan Job
```bash
# Check Railway logs for plan job
railway logs --lines 200 | grep -E "\[UNIFIED_PLAN\]|plan_job|planContent"
```

### 3. Check Circuit Breaker
```bash
# Check for circuit breaker status
railway logs --lines 200 | grep -E "Circuit breaker|circuit_breaker"
```

### 4. Check Posting Queue Execution
```bash
# Verify posting queue is running
railway logs --lines 200 | grep -E "\[POSTING_QUEUE\]|posting_queue_start"
```

## Recommendations

### Short-term:
1. ✅ Grace window fix deployed
2. Manually trigger plan job if needed
3. Check circuit breaker state
4. Monitor next posting cycle

### Long-term:
1. Add health check endpoint for plan job status
2. Improve circuit breaker visibility
3. Add alerting for posting failures
4. Investigate Playwright timeout issues

## Files Modified

- `src/jobs/postingQueue.ts` - Fixed grace window query to include posts scheduled at current time

