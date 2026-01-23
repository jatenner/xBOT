# Mac Executor Stability Guide

**Purpose:** Prevent runaway Chrome/CDP loops and tab leaks that freeze Mac

---

## 🛡️ Guardrails Implemented

### 1. STOP SWITCH
**File:** `./.runner-profile/STOP_EXECUTOR`

**Usage:**
```bash
# Stop executor immediately
touch ./.runner-profile/STOP_EXECUTOR

# Allow executor to run
rm ./.runner-profile/STOP_EXECUTOR
```

**Behavior:** Executor checks this file before launching Chrome. If it exists, exits immediately.

---

### 2. SINGLE-INSTANCE LOCK
**File:** `./.runner-profile/executor.pid`

**Format:** `PID:START_TIMESTAMP`

**Behavior:**
- Only one executor can run at a time
- If lock exists and process is alive, new executor exits
- Stale locks (dead process) are automatically cleaned up
- Lock is released on normal exit or SIGINT/SIGTERM

**Manual cleanup (if needed):**
```bash
rm ./.runner-profile/executor.pid
```

---

### 3. TAB LEAK GUARDRAILS

**Rules:**
- Never create more than 1 page per run
- Reuse existing page if available
- Before each cycle, close all extra tabs/pages except 1
- Always cleanup pages in finally blocks

**Implementation:**
- `runnerLauncher.ts` closes extra pages after connecting
- `UltimateTwitterPoster.ts` reuses existing page instead of creating new one
- Guard system logs page count on every tick

---

### 4. RETRY BACKOFF

**Schedule:** Exponential backoff
- 1st failure: 30 seconds
- 2nd failure: 60 seconds  
- 3rd failure: 2 minutes
- 4th failure: 5 minutes
- 5th+ failure: 10 minutes (max)

**After 5 consecutive failures:**
- Sleep 10 minutes
- Emit `EXECUTOR_COOLDOWN` event to system_events
- Log warning with backoff duration

**Reset:** Success resets failure counter to 0

---

### 5. LOGGING PROOF

**Every tick logs:**
```
[EXECUTOR_GUARD] pages=<n> chrome_pids=<pid1,pid2,...> failures=<n> backoff=<s> stop=NO lock=NO
```

**Fields:**
- `pages`: Number of open pages/tabs
- `chrome_pids`: Chrome process IDs (comma-separated)
- `failures`: Consecutive failure count
- `backoff`: Current backoff seconds
- `stop`: Whether STOP switch triggered
- `lock`: Whether single-instance lock triggered

---

## 🚀 Start/Stop Commands

### Start Executor

**Posting Queue:**
```bash
EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile pnpm run runner:posting-queue-once
```

**Reply Queue:**
```bash
EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile pnpm run runner:reply-queue-once
```

### Stop Executor (Immediate)

```bash
# Create STOP switch file
touch ./.runner-profile/STOP_EXECUTOR

# Executor will exit on next check (within seconds)
```

### Stop Executor (Graceful)

```bash
# Find executor PID
cat ./.runner-profile/executor.pid

# Kill process (replace <PID> with actual PID)
kill <PID>

# Lock file will be cleaned up automatically
```

### Emergency Stop (Kill All Chrome)

```bash
# Kill all Chrome processes (use with caution)
pkill -9 "Google Chrome"
```

---

## ✅ Verification: Confirm No Tab Growth

### Method 1: Check Logs

Look for `[EXECUTOR_GUARD]` log lines:
```bash
# Run executor and watch logs
EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_BROWSER=cdp pnpm run runner:posting-queue-once 2>&1 | grep EXECUTOR_GUARD
```

**Expected:** `pages=1` consistently (or `pages=0` if no page created)

**Bad:** `pages=2`, `pages=3`, etc. (indicates tab leak)

### Method 2: Check Chrome Manually

1. Open Chrome
2. Count tabs in the window
3. Run executor for 10 minutes
4. Count tabs again

**Expected:** Tab count stays the same or decreases

**Bad:** Tab count increases

### Method 3: Monitor Chrome PIDs

```bash
# Watch Chrome processes
watch -n 1 'ps aux | grep "Google Chrome" | grep -v grep | wc -l'
```

**Expected:** Stable number of Chrome processes

**Bad:** Increasing number of Chrome processes

---

## 🔍 Troubleshooting

### Problem: Executor won't start (lock triggered)

**Solution:**
```bash
# Check if lock file exists
ls -la ./.runner-profile/executor.pid

# Check if process is alive
cat ./.runner-profile/executor.pid | cut -d: -f1 | xargs ps -p

# If process is dead, remove lock
rm ./.runner-profile/executor.pid
```

### Problem: Tabs still growing

**Check:**
1. Are multiple executors running? (check `executor.pid`)
2. Are LaunchAgents enabled? (check `launchctl list | grep xbot`)
3. Are there manual executor processes? (`ps aux | grep runner`)

**Solution:**
```bash
# Stop all executors
touch ./.runner-profile/STOP_EXECUTOR
pkill -f "runner:posting-queue-once"
pkill -f "runner:reply-queue-once"

# Disable LaunchAgents
launchctl unload ~/Library/LaunchAgents/com.xbot.runner.plist

# Clean up lock
rm ./.runner-profile/executor.pid

# Restart Chrome CDP
pnpm run runner:chrome-cdp
```

### Problem: Backoff too aggressive

**Check failure count:**
```bash
# Look for failure logs
grep "EXECUTOR_COOLDOWN" logs/*.log
```

**Reset backoff:**
- Successfully complete one run (resets counter)
- Or manually edit guard state (not recommended)

---

## 📊 Monitoring

### Check Guard State

The executor logs guard state on every tick. Look for:
```
[EXECUTOR_GUARD] pages=1 chrome_pids=12345 failures=0 backoff=0s stop=NO lock=NO
```

### Check System Events

```sql
SELECT 
  event_type,
  event_data->>'consecutive_failures' AS failures,
  event_data->>'backoff_seconds' AS backoff,
  created_at
FROM system_events
WHERE event_type = 'EXECUTOR_COOLDOWN'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎯 Best Practices

1. **Always use STOP switch** before killing processes manually
2. **Monitor page count** in logs - should stay at 1
3. **Check for duplicate executors** before starting
4. **Use backoff** - don't manually retry immediately after failures
5. **Clean up stale locks** if executor crashes

---

**Last Updated:** 2026-01-23  
**Status:** ✅ Guardrails implemented and active
