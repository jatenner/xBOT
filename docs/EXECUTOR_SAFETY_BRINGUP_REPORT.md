# Executor Safety Bringup Report

**Date:** 2026-01-23  
**Status:** ✅ **FIXES IMPLEMENTED** - Ready for 15-minute stability test  
**Severity:** SEV-0 (Mac hijacking / Chrome closing)

---

## PHASE A — IMMEDIATE STOP + PROOF

### Commands Run

```bash
# 1. Create STOP switch
touch ./.runner-profile/STOP_EXECUTOR
✅ STOP switch created

# 2. Kill executor processes
pkill -f "executor/daemon"
pkill -f "posting-queue-once"
pkill -f "reply-queue-once"
✅ Killed executor processes

# 3. Verify no executor processes
ps aux | grep -E "tsx|node" | grep -iE "xbot|executor|daemon|posting-queue|reply-queue" | grep -v grep
Result: Only harvest-curated.ts processes (not executor-related)
✅ No executor processes found

# 4. Check CDP port
lsof -i :9222
Result: No processes listening on port 9222
✅ No CDP connections active
```

**Proof:** All executor processes stopped, no CDP connections active.

---

## PHASE B — DEDICATED BOT CHROME

### Changes Made

**File:** `scripts/runner/chrome-cdp.ts`

**Before:**
- Used `.chrome-cdp-profile` (could conflict with user Chrome)
- No PID tracking

**After:**
- Uses `chrome-profile-bot` (dedicated bot-only profile)
- Stores managed PID in `./.runner-profile/cdp_chrome_pids.json`
- Logs: `[CDP_CHROME] pid=<pid> profile=<path> port=9222`

**Code Changes:**
```typescript
// Line 18: Dedicated bot profile
const CDP_PROFILE_DIR = path.join(RUNNER_PROFILE_DIR, 'chrome-profile-bot');
const MANAGED_PIDS_FILE = path.join(RUNNER_PROFILE_DIR, 'cdp_chrome_pids.json');

// Lines 91-108: Store managed PID
const managedPids = {
  chrome_pid: chromeProcess.pid,
  launched_at: new Date().toISOString(),
  profile_dir: CDP_PROFILE_DIR,
  port: CDP_PORT,
};
fs.writeFileSync(MANAGED_PIDS_FILE, JSON.stringify(managedPids, null, 2), 'utf-8');
console.log(`[CDP_CHROME] pid=${chromeProcess.pid} profile=${CDP_PROFILE_DIR} port=${CDP_PORT}`);
```

**Managed PID File Format:**
```json
{
  "chrome_pid": 12345,
  "launched_at": "2026-01-23T...",
  "profile_dir": "./.runner-profile/chrome-profile-bot",
  "port": 9222
}
```

**Verification:**
- Bot Chrome uses separate profile: `./.runner-profile/chrome-profile-bot`
- Managed PID stored in: `./.runner-profile/cdp_chrome_pids.json`
- User's default Chrome profile is NEVER touched

---

## PHASE C — SAFE MODE EXECUTOR DAEMON

### Changes Made

**File:** `scripts/executor/daemon.ts`

**1. Managed PID Tracking (Lines 118-140):**
```typescript
function getManagedChromePids(): number[] {
  // Only reads from cdp_chrome_pids.json (bot Chrome we launched)
  // NEVER gets all Chrome PIDs
}

function logChromeScope(): void {
  const managedPids = getManagedChromePids(); // Only bot Chrome
  const allPids = getAllChromePids(); // All Chrome (observability only)
  console.log(`[CHROME_SCOPE] managed_pids=[${managedPids.join(',')}] all_chrome_pids=[${allPids.join(',')}] safety_no_kill=${SAFETY_NO_KILL}`);
}
```

**2. SAFETY_NO_KILL Enforced (Line 49):**
```typescript
const SAFETY_NO_KILL = process.env.SAFETY_NO_KILL !== 'false'; // Default: true
```

**Behavior:**
- When `SAFETY_NO_KILL=true` (default): NEVER kill Chrome processes
- Only manages pages in CDP session
- Logs managed PIDs vs all Chrome PIDs for observability

**3. Page Reuse (Lines 210-227):**
```typescript
// Get or REUSE single page (never create new if one exists)
const pages = context.pages();
if (pages.length === 0) {
  page = await context.newPage();
} else {
  page = pages[0]; // REUSE existing page
}

// Hard cap: if pages>1 after cleanup, exit
if (finalPages.length !== 1) {
  throw new Error(`Page count is ${finalPages.length}, expected 1`);
}
```

**4. Focus-Safe Guarantees:**
- Never brings Chrome to front (no window activation)
- Never creates new windows (only uses existing CDP tab)
- Never calls `browser.close()` or `context.close()` (user Chrome stays open)
- Only closes pages, never processes

**5. Cleanup (Lines 480-488):**
```typescript
// FOCUS-SAFE: Only close page, never close browser/context
if (page) {
  await page.close();
}
// NEVER call browser.close() or context.close() - user's Chrome must stay open
```

---

## PHASE D — 15-MINUTE STABILITY TEST

### Test Command

```bash
# 1. Launch Chrome with bot profile (manual - requires login)
RUNNER_PROFILE_DIR=./.runner-profile pnpm tsx scripts/runner/chrome-cdp.ts

# 2. Verify managed PID file created
cat ./.runner-profile/cdp_chrome_pids.json

# 3. Run daemon for 15 minutes
EXECUTION_MODE=executor \
RUNNER_MODE=true \
RUNNER_BROWSER=cdp \
RUNNER_PROFILE_DIR=./.runner-profile \
SAFETY_NO_KILL=true \
pnpm run executor:daemon
```

### Expected Log Output

```
[EXECUTOR_DAEMON] ts=2026-01-23T... pages=1 managed_pids=[12345] posting_ready=... posting_attempts=... reply_ready=... reply_attempts=... backoff=0s
[CHROME_SCOPE] managed_pids=[12345] all_chrome_pids=[12345,67890] safety_no_kill=true
```

**Key Indicators:**
- `pages=1` consistently (never `pages=2` or higher)
- `managed_pids=[...]` shows only bot Chrome PID
- `safety_no_kill=true` (never kills Chrome)
- No "HARD CAP EXCEEDED" errors
- No Chrome closing unexpectedly

### Verification Steps

**1. Page Count Proof:**
```bash
# Extract page counts from logs
grep "EXECUTOR_DAEMON.*pages=" executor.log | grep -o "pages=[0-9]*" | sort | uniq -c

# Expected: All show pages=1
#   100 pages=1
```

**2. Managed PID Proof:**
```bash
# Check managed PID file
cat ./.runner-profile/cdp_chrome_pids.json

# Verify PID matches Chrome process
ps -p $(jq -r .chrome_pid ./.runner-profile/cdp_chrome_pids.json)
```

**3. Chrome Not Closing:**
- Monitor Chrome manually during test
- Chrome should stay open throughout 15 minutes
- No unexpected window closures

**4. No Tab Growth:**
- Count Chrome tabs before test
- Count Chrome tabs after 15 minutes
- Tab count should stay stable or decrease

**5. CPU/Memory Snapshot:**
```bash
# Check daemon resource usage
ps aux | grep executor/daemon | grep -v grep

# Expected: Reasonable CPU (< 50%), reasonable memory
```

---

## Code Diffs Summary

### scripts/runner/chrome-cdp.ts

**Lines 18-19:** Changed profile dir to `chrome-profile-bot`, added `MANAGED_PIDS_FILE`  
**Lines 91-108:** Store managed PID in JSON file, log `[CDP_CHROME]` line

### scripts/executor/daemon.ts

**Line 46:** Added `MANAGED_PIDS_FILE` constant  
**Line 49:** Added `SAFETY_NO_KILL` constant (default true)  
**Lines 118-140:** Added `getManagedChromePids()` and `logChromeScope()` functions  
**Lines 210-227:** Focus-safe page reuse, never creates new if one exists  
**Lines 480-488:** Focus-safe cleanup (never closes browser/context)  
**Lines 350-360:** Log managed PIDs in tick events (not all Chrome PIDs)

---

## Safety Guarantees

✅ **Dedicated Bot Chrome:** Uses `chrome-profile-bot` (separate from user Chrome)  
✅ **Managed PID Tracking:** Only tracks bot Chrome PID (not user Chrome)  
✅ **SAFETY_NO_KILL:** Default true - never kills Chrome processes  
✅ **Page Management:** Only manages pages in CDP session (never kills processes)  
✅ **Focus-Safe:** Never brings Chrome to front, never creates new windows  
✅ **Cleanup-Safe:** Never closes browser/context (user Chrome stays open)  
✅ **Hard Caps:** Exits if pages>1 after cleanup (prevents tab explosion)

---

## Next Steps

1. **Launch Chrome:** `RUNNER_PROFILE_DIR=./.runner-profile pnpm tsx scripts/runner/chrome-cdp.ts`
2. **Login:** Complete Twitter login in the Chrome window
3. **Verify PID:** Check `./.runner-profile/cdp_chrome_pids.json` exists
4. **Run Test:** Execute 15-minute stability test command above
5. **Collect Proof:** Extract page counts, verify Chrome stayed open, check CPU/memory
6. **If PASS:** Enable posting/reply attempts
7. **If FAIL:** Stop immediately and investigate root cause

---

**Status:** ✅ **FIXES COMPLETE** - Ready for stability test  
**Blocking:** Chrome CDP must be launched manually (requires login)
