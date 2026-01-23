# Executor Tab Explosion - Root Cause Analysis

**Date:** 2026-01-23  
**Severity:** SEV1 - Mac becomes unusable, infinite Chrome tabs  
**Status:** ✅ **FIXED** - Hard caps and emergency stops implemented

---

## Root Cause

### Primary Culprit: LaunchAgent Running `executor-daemon.ts` in Infinite Loop

**File:** `scripts/runner/executor-daemon.ts`  
**LaunchAgent:** `~/Library/LaunchAgents/com.xbot.executor.plist`  
**Loop:** `while (true)` at line 156

**What Happens:**
1. LaunchAgent starts `executor-daemon.ts` on Mac boot
2. Daemon runs `while (true)` loop every 2 minutes
3. Each tick calls `runPostingQueue()` and `runReplyQueue()`
4. These functions create browser pages via `UltimateTwitterPoster.ensureContext()`
5. **BUG:** Pages are created but never properly closed/reused
6. Each tick creates new pages → tab explosion

### Secondary Issues:

1. **Multiple Loop Scripts Running Simultaneously:**
   - `executor-daemon.ts` (LaunchAgent)
   - `poll-and-post.ts` (manual or LaunchAgent)
   - `schedule-and-post.ts --loop` (recursive)
   - `daemon.ts` (alternative daemon)

2. **No Page Reuse:**
   - `UltimateTwitterPoster.ensureContext()` creates new page if `this.page` is null
   - Pages accumulate across ticks
   - No cleanup between ticks

3. **No Hard Caps:**
   - No limit on page count
   - No limit on Chrome processes
   - No runtime cap per tick
   - No emergency stop mechanism

---

## Before/After Behavior

### BEFORE (Broken):

```
LaunchAgent → executor-daemon.ts → while(true) loop
  ↓
Tick 1: Creates page 1
Tick 2: Creates page 2 (page 1 still open)
Tick 3: Creates page 3 (pages 1-2 still open)
...
Tick N: Creates page N (N-1 pages still open)
Result: Infinite tabs, Mac freezes
```

### AFTER (Fixed):

```
LaunchAgent → executor-daemon.ts → while(true) loop
  ↓
Tick 1: 
  - Check STOP switch ✅
  - Check Chrome process cap ✅
  - Create page 1 ✅
  - Close extra pages (keep 1) ✅
  - Runtime cap: 60s max ✅
Tick 2:
  - Check STOP switch ✅
  - Reuse page 1 (don't create new) ✅
  - Close extra pages if any ✅
  - Runtime cap: 60s max ✅
...
Result: Max 1 page, Mac stays responsive
```

---

## How to Reproduce Safely

### ⚠️ DO NOT RUN WITHOUT STOP SWITCH READY

```bash
# 1. Create STOP switch first (safety net)
touch ./.runner-profile/STOP_EXECUTOR

# 2. Check if LaunchAgent is running
launchctl list | grep com.xbot.executor

# 3. If running, stop it first
launchctl unload ~/Library/LaunchAgents/com.xbot.executor.plist

# 4. Run executor manually (with guardrails)
EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile pnpm run runner:posting-queue-once

# 5. Monitor page count in logs
# Look for: [EXECUTOR_GUARD] pages=1 chrome_pids=... backoff=0s

# 6. If tabs start growing, immediately:
rm ./.runner-profile/STOP_EXECUTOR  # Remove to allow stop
touch ./.runner-profile/STOP_EXECUTOR  # Create to trigger stop
# Executor will exit on next check (within seconds)
```

---

## How to Stop Immediately

### Method 1: STOP Switch (Recommended - Works Even in Hot Loops)

```bash
# Create STOP switch file
touch ./.runner-profile/STOP_EXECUTOR

# Executor checks this file in every loop iteration
# Will exit within seconds (even if in hot loop)
```

### Method 2: Environment Variable

```bash
# Set env var (works even if file system is slow)
export STOP_EXECUTOR=true
# Then kill process
pkill -f executor-daemon
```

### Method 3: Stop LaunchAgent

```bash
# Unload LaunchAgent (stops auto-restart)
launchctl unload ~/Library/LaunchAgents/com.xbot.executor.plist

# Kill running processes
pkill -f executor-daemon
pkill -f "poll-and-post"
pkill -f "schedule-and-post"
```

### Method 4: Emergency Kill All Chrome

```bash
# Last resort - kills all Chrome (use with caution)
pkill -9 "Google Chrome"
```

---

## Fixes Implemented

### 1. Emergency Stop Switch

**File:** `src/infra/executorGuard.ts`

- Checks `./.runner-profile/STOP_EXECUTOR` file
- Checks `STOP_EXECUTOR=true` env var
- Works even in hot loops (checked every iteration)
- Immediate exit (no cleanup delay)

### 2. Hard Page Count Cap

**Rule:** If browser has > 3 pages → **HARD EXIT** (do not retry)

**Implementation:**
- `closeExtraPages()` checks count before closing
- If > 3 pages, exits immediately with error
- `createPageWithGuard()` prevents creation if count >= 3

### 3. Hard Chrome Process Cap

**Rule:** If > 1 Chrome instance → **HARD EXIT**

**Implementation:**
- `checkChromeProcessCap()` detects multiple Chrome PIDs
- Exits immediately if multiple instances found

### 4. Hard Runtime Cap

**Rule:** Any single tick max 60 seconds → **ABORT TICK**

**Implementation:**
- `createRuntimeCap(60000)` sets timeout per tick
- Aborts tick after 60s, closes pages, exits

### 5. Single-Instance Lock

**File:** `./.runner-profile/executor.pid`

- Only one executor can run at a time
- Stale locks auto-cleaned (dead process detection)
- Prevents duplicate executors doubling tab creation

### 6. Page Reuse Enforcement

**Implementation:**
- `UltimateTwitterPoster.ensureContext()` reuses existing page
- `closeExtraPages()` called before each operation
- `createPageWithGuard()` logs every page creation with stack trace

### 7. Instrumentation

**Every tick logs:**
```
[EXECUTOR_GUARD] pages=<n> chrome_pids=<pid1,pid2,...> failures=<n> backoff=<s> stop=NO lock=NO
```

**Every page creation logs:**
```
[EXECUTOR_GUARD] 📄 Creating page - caller: <file>::<function>
[EXECUTOR_GUARD] 📄 Stack: <stack trace>
```

---

## Verification Command

### Run for 10 Minutes and Verify:

```bash
# 1. Create STOP switch (safety net)
touch ./.runner-profile/STOP_EXECUTOR

# 2. Start executor
EXECUTION_MODE=executor \
RUNNER_MODE=true \
RUNNER_BROWSER=cdp \
RUNNER_PROFILE_DIR=./.runner-profile \
timeout 600 \
pnpm run runner:posting-queue-once 2>&1 | tee executor-test.log

# 3. Check logs for page count
grep "EXECUTOR_GUARD" executor-test.log | grep "pages="

# Expected: All lines show pages=1 (or pages=0)
# Bad: Any line shows pages=2, pages=3, etc.

# 4. Check Chrome manually
# Open Chrome → Count tabs → Should stay stable

# 5. Check CPU usage
top -pid $(pgrep -f "executor-daemon" | head -1)

# Expected: CPU < 50%
# Bad: CPU > 90% (indicates runaway loop)
```

### Success Criteria:

- ✅ Page count stays at 1 (or 0) for entire 10 minutes
- ✅ No new Chrome windows/tabs appear
- ✅ CPU usage stays reasonable (< 50%)
- ✅ Logs show `[EXECUTOR_GUARD]` entries every tick
- ✅ STOP switch works (create file → executor exits within seconds)

---

## Files Modified

1. `src/infra/executorGuard.ts` - Added hard caps, emergency stops, instrumentation
2. `src/infra/playwright/runnerLauncher.ts` - Integrated guard checks
3. `src/posting/UltimateTwitterPoster.ts` - Page reuse + guarded creation
4. `scripts/runner/posting-queue-once.ts` - Guard initialization + runtime cap
5. `scripts/runner/reply-queue-once.ts` - Guard initialization + runtime cap
6. `scripts/runner/poll-and-post.ts` - Stop switch in loop + runtime cap
7. `scripts/runner/schedule-and-post.ts` - Stop switch in loop
8. `scripts/runner/executor-daemon.ts` - Stop switch in loop + runtime cap + max failures
9. `scripts/runner/daemon.ts` - Stop switch in loop + runtime cap + max failures

---

## Prevention Checklist

Before running executor:

- [ ] Create STOP switch: `touch ./.runner-profile/STOP_EXECUTOR`
- [ ] Check for duplicate executors: `ps aux | grep executor`
- [ ] Check LaunchAgent status: `launchctl list | grep com.xbot.executor`
- [ ] Verify Chrome is running: `ps aux | grep "Google Chrome" | wc -l` (should be 1)
- [ ] Monitor logs for page count: `tail -f executor.log | grep EXECUTOR_GUARD`

If tabs start growing:

1. **IMMEDIATELY:** `touch ./.runner-profile/STOP_EXECUTOR`
2. Wait 10 seconds for executor to exit
3. Check Chrome tabs (should stop growing)
4. If still growing: `pkill -9 "Google Chrome"`

---

**Last Updated:** 2026-01-23  
**Status:** ✅ **FIXED** - All guardrails implemented and active
