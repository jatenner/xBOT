# postContent Throw Stack Trace Report

**Date:** December 18, 2025  
**Commit Verified:** `59f79fc2` (log postContent exceptions with stack trace)  
**Purpose:** Extract and analyze postContent() exception stack traces from production

---

## BOOT Deploy Evidence

**Status:** ✅ DEPLOYED

**Evidence:**
```
[BOOT] commit=59f79fc21dc32859bde653e9dccd03b8437c71ef node=v20.18.0
2025-12-18T05:17:43.902952804Z [INFO]  app="xbot" commit_sha="59f79fc21dc32859bde653e9dccd03b8437c71ef" node_version="v20.18.0" op="boot_start" ts="2025-12-18T05:17:43.897Z"
```

**Analysis:** Commit `59f79fc2` is deployed and running in production.

---

## POSTCONTENT_THROW Blocks (verbatim)

**Status:** ✅ FOUND

**Throw Log 1:**
```
[BROWSER_SEM] ⏱️ TIMEOUT: posting exceeded 180s - force releasing lock
[BROWSER_SEM] ❌ Operation failed for posting: Browser operation timeout after 180s
[BROWSER_SEM] 🔐 posting released browser (queue: 1)
[POSTING_QUEUE][POSTCONTENT_THROW] decision_id=10a70fb0-bca4-49a9-809b-8403d42cd03f decision_type=thread error_name=Error error_message=Browser operation timeout after 180s
[POSTING_QUEUE][POSTCONTENT_THROW] decision_id=10a70fb0-bca4-49a9-809b-8403d42cd03f stack=Error: Browser operation timeout after 180s
    at Timeout._onTimeout (/app/dist/src/browser/BrowserSemaphore.js:118:24)
    at listOnTimeout (node:internal/timers:581:17)
    at process.processTimers (node:internal/timers:519:7)
[POSTING_QUEUE] ❌ POSTING FAILED: Browser operation timeout after 180s
```

**Analysis:**
- **Decision ID:** `10a70fb0-bca4-49a9-809b-8403d42cd03f`
- **Decision Type:** `thread`
- **Error Name:** `Error`
- **Error Message:** `Browser operation timeout after 180s`
- **Stack Trace:** Complete stack trace showing:
  - Error originates from `BrowserSemaphore.js:118:24`
  - Triggered by `Timeout._onTimeout` callback
  - Node.js timer system (`listOnTimeout`, `processTimers`)

**Context:**
- Preceded by: `[BROWSER_SEM] ⏱️ TIMEOUT: posting exceeded 180s - force releasing lock`
- Followed by: `[POSTING_QUEUE] ❌ POSTING FAILED: Browser operation timeout after 180s`

---

## Quick Interpretation

- **Error Type:** Browser operation timeout (180 seconds)
- **Root Cause:** `BrowserSemaphore` is enforcing a 180s timeout on the `posting` operation
- **Affected Path:** Thread posting (`decision_type=thread`)
- **Stack Trace Location:** `src/browser/BrowserSemaphore.ts` line ~118 (compiled to `/app/dist/src/browser/BrowserSemaphore.js:118:24`)

**Analysis:**
The exception is being thrown from `BrowserSemaphore.ts` timeout mechanism. The stack trace shows:
1. `postContent()` calls browser operations wrapped by `BrowserSemaphore`
2. `BrowserSemaphore` enforces a 180s timeout (default `BROWSER_LOCK_TIMEOUT_MS`)
3. Thread posting operations exceed 180s, triggering timeout
4. Timeout callback (`Timeout._onTimeout`) throws the error
5. Error propagates up to `postContent()` and is caught by our new logging

**Key Finding:** The UnifiedBrowserPool timeout fix (360s for thread_posting) is NOT being applied because `BrowserSemaphore` wraps the operations and enforces its own 180s timeout first.

---

## Next Action Recommendation

**Fix should target:** `src/browser/BrowserSemaphore.ts`

**Specific Fix:**
1. **File:** `src/browser/BrowserSemaphore.ts`
2. **Location:** Around line 128-144 (where `BROWSER_OP_TIMEOUT` is set)
3. **Current Code:**
   ```typescript
   const BROWSER_OP_TIMEOUT = Number(process.env.BROWSER_LOCK_TIMEOUT_MS ?? 180000); // default 3 minutes
   ```

4. **Fix:** Make `BrowserSemaphore` respect per-operation timeouts:
   - Option A: Increase `BROWSER_LOCK_TIMEOUT_MS` env var to 360000 (6 minutes) for posting operations
   - Option B: Make `BrowserSemaphore.withBrowserLock()` accept an optional `timeoutMs` parameter and use it instead of the default
   - Option C: Detect posting operations (by `jobName` parameter) and use higher timeout (360s) for them

5. **Recommended Approach:** Option B - Add `timeoutMs` parameter to `withBrowserLock()` and pass it from posting operations:
   ```typescript
   // In postingQueue.ts or BulletproofThreadComposer.ts
   await withBrowserLock('posting', async () => { ... }, { timeoutMs: 360000 });
   ```

**Why:** `BrowserSemaphore` wraps all browser operations and enforces its own timeout before UnifiedBrowserPool's per-label timeouts can take effect. The 180s timeout in BrowserSemaphore is killing thread posts that need 360s.

---

**Last Updated:** December 18, 2025
