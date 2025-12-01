# 🔧 System Fix Plan

## Root Cause Analysis

Based on investigation, here are the actual issues and fixes needed:

### Issue 1: Posting Success Rate (40% claim)

**Problem:**
- `logPostAttempt()` only writes to log file, NOT database
- Investigation API queries `posting_attempts` table but it may be empty or have wrong schema
- Posting failures may not be properly recorded

**Fix:**
1. Update `logPostAttempt()` to write to `posting_attempts` table
2. Ensure `posting_attempts` table has correct schema with `status` field
3. Record ALL posting attempts (success/failed) in database

### Issue 2: Metrics Scraper Stale (23 min claim)

**Problem:**
- Metrics scraper job may not be recording heartbeats correctly
- Job may be failing silently
- Browser session may be expired

**Fix:**
1. Verify metrics scraper is scheduled correctly in JobManager
2. Ensure heartbeats are recorded on success AND failure
3. Add better error handling and retry logic

### Issue 3: Metrics Coverage (72% claim)

**Problem:**
- New posts (< 10 min old) won't have metrics yet (normal)
- Some posts may have invalid tweet_ids
- Scraper may be skipping posts with errors

**Fix:**
1. This is likely NORMAL - new posts need time to accumulate metrics
2. Verify scraper is processing posts correctly
3. Check for posts with NULL or invalid tweet_ids

## Implementation Steps

### Step 1: Fix Posting Attempts Recording

**File:** `src/jobs/postingQueue.ts`

Update `logPostAttempt()` to write to database:

```typescript
async function logPostAttempt(decision: QueuedDecision, action: 'attempting' | 'success' | 'failed', tweetId?: string, errorMessage?: string): Promise<void> {
  try {
    // Write to log file (existing)
    const logsDir = path.join(process.cwd(), 'logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    
    const logFile = path.join(logsDir, 'post_attempts.log');
    const logEntry = {
      decisionId: decision.id,
      decisionType: decision.decision_type,
      content: decision.content.substring(0, 100),
      action,
      tweetId: tweetId || null,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    
    appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    
    // NEW: Write to database
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    await supabase.from('posting_attempts').insert({
      decision_id: decision.id,
      decision_type: decision.decision_type,
      content_text: decision.content.substring(0, 500),
      status: action === 'success' ? 'success' : action === 'failed' ? 'failed' : 'attempting',
      tweet_id: tweetId || null,
      error_message: errorMessage || null,
      created_at: new Date().toISOString()
    });
  } catch (error: any) {
    // Non-critical - don't fail posting if logging fails
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to log post attempt: ${error.message}`);
  }
}
```

### Step 2: Ensure posting_attempts Table Schema

**File:** Create migration or verify schema

The table needs:
- `decision_id` UUID
- `decision_type` TEXT
- `content_text` TEXT
- `status` TEXT ('attempting', 'success', 'failed')
- `tweet_id` TEXT (nullable)
- `error_message` TEXT (nullable)
- `created_at` TIMESTAMPTZ

### Step 3: Fix Metrics Scraper Heartbeat

**File:** `src/jobs/metricsScraperJob.ts`

Ensure heartbeat is recorded:
- On job start
- On success (even if no posts to scrape)
- On failure (with error message)

### Step 4: Add Circuit Breaker Reset

**File:** `src/jobs/postingQueue.ts`

If circuit breaker is OPEN, provide manual reset endpoint or auto-reset logic.

## Quick Wins

1. **Fix posting attempts recording** - This will give accurate success rate
2. **Verify metrics scraper heartbeat** - This will show if scraper is actually running
3. **Check circuit breaker state** - If open, that's blocking all posts

## Testing

After fixes:
1. Check `/dashboard/system-investigation` for accurate data
2. Verify posting attempts are recorded in database
3. Check metrics scraper heartbeat is updating
4. Monitor posting success rate improves

