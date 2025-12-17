# Recovery Signal Clarity Report

**Date:** December 17, 2025  
**Purpose:** Document observable signals for browser disconnect recovery and posting success

---

## Overview

This document explains what logs prove recovery is working and what logs prove posting success. These signals are designed to be easily grep-able in Railway logs for verification.

---

## 1. Browser Pool Recovery Signals

### What Logs Prove Recovery is Working

**Primary Signal:** `[BROWSER_POOL][RECOVER]`

This log appears when:
- A disconnected error is detected during a browser operation
- The pool automatically resets and retries the operation
- Recovery is successful

**Log Format:**
```
[BROWSER_POOL][RECOVER] reason=browser_disconnected action=reset op=<operationId> label=<label> retry=1
```

**Example:**
```
[BROWSER_POOL][RECOVER] reason=browser_disconnected action=reset op=thread_posting-1765997151909-dt15gt1xi label=thread_posting retry=1
```

### Debug Logs (Before Recovery)

**Signal:** `[BROWSER_POOL][DEBUG]`

These logs appear before recovery to help diagnose why recovery triggers:

```
[BROWSER_POOL][DEBUG] caught_error op=<operationId> label=<label> name=<err.name> msg=<err.message>
[BROWSER_POOL][DEBUG] disconnected_match=<true|false> op=<operationId> label=<label>
```

**Example:**
```
[BROWSER_POOL][DEBUG] caught_error op=thread_posting-1765997151909-dt15gt1xi label=thread_posting name=Error msg=browserContext.newPage: Target page, context or browser has been closed
[BROWSER_POOL][DEBUG] disconnected_match=true op=thread_posting-1765997151909-dt15gt1xi label=thread_posting
```

### Error Patterns That Trigger Recovery

The following error patterns are detected as disconnected errors:
- `"Target page, context or browser has been closed"`
- `"Browser has been closed"`
- `"Protocol error"`
- `"Execution context was destroyed"`
- `"browserContext.newPage"` (any error containing this)
- `"has been closed"` (any error containing this)

**Note:** Pattern matching is case-insensitive and checks:
- Error message
- Error cause (if present)
- Error stack trace (if present)

---

## 2. Posting Success Signals

### What Logs Prove Posting Success

**Primary Signal:** `[POSTING_QUEUE][SUCCESS]`

This log appears when:
- A tweet/thread/reply is successfully posted to Twitter
- The tweet ID is captured
- The database save succeeds (tweet_id and status='posted' are saved)

**Log Format:**
```
[POSTING_QUEUE][SUCCESS] decision_id=<id> type=<single|thread|reply> tweet_id=<id> url=<url>
```

**Example:**
```
[POSTING_QUEUE][SUCCESS] decision_id=ac795ce8-cade-469d-b0b6-f3406404d4e5 type=thread tweet_id=1234567890123456789 url=https://x.com/SignalAndSynapse/status/1234567890123456789
```

### When Success is Logged

Success is logged **only after**:
1. ✅ Tweet is posted to Twitter (tweet_id exists)
2. ✅ Database save succeeds (`markDecisionPosted()` completes without error)
3. ✅ Database verification confirms tweet_id and status='posted' are saved

**Important:** The summary line `✅ Posted X/Y decisions` only increments when `[POSTING_QUEUE][SUCCESS]` would be logged. If database save fails, success is NOT logged and the count does NOT increment.

### Success Log Locations

Success logs appear in two places:

1. **After `markDecisionPosted()` succeeds** (primary location in `postingQueue.ts`)
   - This is the main success signal
   - Includes decision_id, type, tweet_id, and URL

2. **Inside `markDecisionPosted()` function** (fallback location)
   - Logs if called directly (not through postingQueue)
   - Type may be "unknown" if decision_type is not available

---

## 3. Verification Commands

### Railway CLI Verification

**Command:** `pnpm verify:posting:signals`

This command:
1. Fetches last 5000 lines of Railway logs
2. Filters for recovery and success signals
3. Shows last 150 matching lines

**Manual Verification:**

```bash
# Recovery signals
railway logs --service xBOT --lines 5000 | grep -E '\[BROWSER_POOL\]\[RECOVER\]' | tail -n 50

# Success signals
railway logs --service xBOT --lines 5000 | grep -E '\[POSTING_QUEUE\]\[SUCCESS\]' | tail -n 50

# Disconnect errors (should decline over time)
railway logs --service xBOT --lines 5000 | grep -E 'Target page, context or browser has been closed|browserContext.newPage.*closed' | tail -n 50
```

### What to Look For

**✅ Healthy State:**
- `[BROWSER_POOL][RECOVER]` logs appear when disconnect errors occur
- `[POSTING_QUEUE][SUCCESS]` logs appear after successful posts
- Disconnect errors decline over time (recovery is working)

**⚠️ Warning State:**
- `[BROWSER_POOL][RECOVER]` logs appear but `[POSTING_QUEUE][SUCCESS]` logs are rare
- Disconnect errors persist but recovery is triggering

**❌ Critical State:**
- No `[BROWSER_POOL][RECOVER]` logs despite disconnect errors
- No `[POSTING_QUEUE][SUCCESS]` logs
- Disconnect errors dominate logs

---

## 4. Implementation Details

### Browser Pool Recovery

**File:** `src/browser/UnifiedBrowserPool.ts`

**Changes:**
- Enhanced `isDisconnectedError()` to check error message, cause, and stack
- Added debug logging before recovery check
- Added explicit recovery logging with operation ID and label
- Recovery retries operation once after pool reset

**Recovery Flow:**
1. Operation fails with disconnected error
2. `[BROWSER_POOL][DEBUG]` logs error details
3. `isDisconnectedError()` checks if error matches patterns
4. `[BROWSER_POOL][DEBUG]` logs match result
5. If matched: `[BROWSER_POOL][RECOVER]` logs recovery action
6. Pool resets and operation retries once

### Posting Success Logging

**File:** `src/jobs/postingQueue.ts`

**Changes:**
- Added `[POSTING_QUEUE][SUCCESS]` log after `markDecisionPosted()` succeeds
- Success log includes decision_id, type, tweet_id, and URL
- Summary count only increments on true success (after DB save)

**Success Flow:**
1. Tweet posted to Twitter (tweet_id captured)
2. `markDecisionPosted()` called with tweet_id
3. Database save succeeds (tweet_id and status='posted' saved)
4. Database verification confirms save
5. `[POSTING_QUEUE][SUCCESS]` log emitted
6. Summary count increments

---

## 5. Troubleshooting

### No Recovery Logs Despite Disconnect Errors

**Possible Causes:**
1. Error pattern not matching (check `[BROWSER_POOL][DEBUG]` logs)
2. Recovery code not deployed (check commit SHA in logs)
3. Error occurring before recovery can trigger

**Fix:** Check `[BROWSER_POOL][DEBUG] disconnected_match=` logs to see if patterns are matching.

### No Success Logs Despite "Posted X/Y" Summary

**Possible Causes:**
1. Database save failing (check for `Database save SUCCESS` logs)
2. Success log not being emitted (check code deployment)
3. Summary counting before DB save completes

**Fix:** Check for `✅ Database save SUCCESS` logs. If missing, database save is failing.

### Recovery Logs But No Success Logs

**Possible Causes:**
1. Recovery retry also failing
2. Posting failing after recovery
3. Database save failing after successful post

**Fix:** Check for retry errors and database save errors in logs.

---

## 6. Summary

**Recovery Signals:**
- `[BROWSER_POOL][RECOVER]` = Recovery triggered and pool reset
- `[BROWSER_POOL][DEBUG] disconnected_match=true` = Error matched recovery pattern

**Success Signals:**
- `[POSTING_QUEUE][SUCCESS]` = Post completed successfully (Twitter + DB)

**Verification:**
- Run `pnpm verify:posting:signals` to see all signals
- Check recovery logs appear when disconnect errors occur
- Check success logs appear after successful posts
- Monitor disconnect errors decline over time

---

**Last Updated:** December 17, 2025

