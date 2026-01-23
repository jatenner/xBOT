# Executor Daemon Stability Proof

**Date:** 2026-01-23  
**Purpose:** Verify Mac executor daemon runs safely 24/7 without tab explosions or freezes

---

## Overview

The executor daemon (`scripts/executor/daemon.ts`) is a single long-running process that:
- Uses ONE CDP connection + ONE page (reused across iterations)
- Never opens more than 1 page (hard enforced)
- Never spawns multiple daemons (PID lock)
- STOP switch exits gracefully within 10s
- Hard resource caps (pages, Chrome processes, runtime)

---

## Commands to Run

### 1. Start Executor Daemon

```bash
# Ensure Chrome is running with CDP
pnpm run runner:chrome-cdp

# Start daemon
EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:daemon
```

### 2. Monitor Logs

```bash
# Watch logs in real-time
tail -f ./.runner-profile/executor.log

# Or watch console output directly
# (logs are printed to stdout)
```

### 3. Stop Executor (Emergency)

```bash
# Method 1: STOP switch (graceful exit within 10s)
touch ./.runner-profile/STOP_EXECUTOR

# Method 2: Kill process
pkill -f "executor/daemon"
```

---

## How to Confirm Pages Stay at 1

### Method 1: Log Analysis

**Look for structured log lines:**
```
[EXECUTOR_DAEMON] ts=... pages=1 pids=[...] posting_ready=... posting_attempts=... reply_ready=... reply_attempts=... backoff=0s
```

**Expected:** All log lines show `pages=1` (never `pages=2` or higher)

**Command:**
```bash
# Extract page counts from logs
grep "EXECUTOR_DAEMON" ./.runner-profile/executor.log | grep -o "pages=[0-9]*" | sort | uniq -c

# Expected output:
#    100 pages=1
# (all lines show pages=1)
```

### Method 2: Manual Chrome Check

1. Open Chrome
2. Count tabs/windows
3. Run daemon for 60 minutes
4. Count tabs/windows again

**Expected:** Tab count stays stable (no growth)

### Method 3: SQL Query

```sql
-- Check page counts from tick events
SELECT 
  event_data->>'pages' AS pages,
  COUNT(*) AS count,
  MAX(created_at) AS last_seen
FROM system_events
WHERE event_type='EXECUTOR_DAEMON_TICK'
  AND created_at >= NOW() - INTERVAL '60 minutes'
GROUP BY pages
ORDER BY pages;
```

**Expected:** All rows show `pages=1`

---

## How to Confirm STOP Switch Exits

### Test Procedure

1. Start daemon:
```bash
EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:daemon
```

2. Wait for at least one tick (60s)

3. Create STOP switch:
```bash
touch ./.runner-profile/STOP_EXECUTOR
```

4. Watch logs for graceful exit:
```
[EXECUTOR_DAEMON] 🛑 STOP switch triggered - exiting gracefully...
[EXECUTOR_DAEMON] 🧹 Cleaning up...
[EXECUTOR_DAEMON] 🔓 Lock released
[EXECUTOR_DAEMON] ✅ Exited gracefully
```

**Expected:** Daemon exits within 10 seconds of creating STOP switch

**Verification:**
```bash
# Check process is gone
ps aux | grep "executor/daemon" | grep -v grep
# Expected: No output (process exited)

# Check lock file is removed
ls -la ./.runner-profile/executor.pid
# Expected: No such file (lock released)
```

---

## SQL to Show EXECUTOR_DAEMON_TICK Events

### Recent Ticks (Last 60 Minutes)

```sql
SELECT 
  created_at,
  event_data->>'pages' AS pages,
  event_data->>'chrome_pids' AS chrome_pids,
  event_data->>'posting_ready' AS posting_ready,
  event_data->>'posting_attempts' AS posting_attempts,
  event_data->>'reply_ready' AS reply_ready,
  event_data->>'reply_attempts' AS reply_attempts,
  event_data->>'backoff_seconds' AS backoff,
  event_data->>'last_error' AS last_error
FROM system_events
WHERE event_type='EXECUTOR_DAEMON_TICK'
  AND created_at >= NOW() - INTERVAL '60 minutes'
ORDER BY created_at DESC
LIMIT 20;
```

### Page Count Distribution

```sql
SELECT 
  event_data->>'pages' AS pages,
  COUNT(*) AS count,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen
FROM system_events
WHERE event_type='EXECUTOR_DAEMON_TICK'
  AND created_at >= NOW() - INTERVAL '60 minutes'
GROUP BY pages
ORDER BY pages;
```

**Expected:** All rows show `pages=1`

### Failure Rate

```sql
SELECT 
  COUNT(*) AS total_ticks,
  COUNT(CASE WHEN event_data->>'last_error' IS NOT NULL THEN 1 END) AS failed_ticks,
  ROUND(100.0 * COUNT(CASE WHEN event_data->>'last_error' IS NOT NULL THEN 1 END) / COUNT(*), 2) AS failure_rate_pct
FROM system_events
WHERE event_type='EXECUTOR_DAEMON_TICK'
  AND created_at >= NOW() - INTERVAL '60 minutes';
```

---

## What "PASS" Looks Like for 60-Minute Test

### Success Criteria

1. **Page Count:** All ticks show `pages=1` (never exceeds 1)
2. **Chrome Processes:** Stable (1 or small fixed number, no growth)
3. **STOP Switch:** Exits gracefully within 10s when triggered
4. **No Tab Growth:** Manual Chrome check shows stable tab count
5. **No Freezes:** Mac remains responsive throughout test
6. **Tick Events:** Regular `EXECUTOR_DAEMON_TICK` events every ~60s
7. **Lock File:** Created on start, removed on exit
8. **No Hard Cap Triggers:** No "HARD CAP EXCEEDED" errors in logs

### Sample Log Output (PASS)

```
[EXECUTOR_DAEMON] ts=2026-01-23T12:00:00.000Z pages=1 pids=[12345] posting_ready=5 posting_attempts=1 reply_ready=3 reply_attempts=0 backoff=0s
[EXECUTOR_DAEMON] ts=2026-01-23T12:01:00.000Z pages=1 pids=[12345] posting_ready=4 posting_attempts=1 reply_ready=3 reply_attempts=0 backoff=0s
[EXECUTOR_DAEMON] ts=2026-01-23T12:02:00.000Z pages=1 pids=[12345] posting_ready=3 posting_attempts=0 reply_ready=2 reply_attempts=1 backoff=0s
...
```

**Key indicators:**
- `pages=1` consistently
- `pids=[...]` stable (same PID or small set)
- `backoff=0s` (no failures)
- Regular ticks every ~60s

### Sample Log Output (FAIL)

```
[EXECUTOR_DAEMON] ts=2026-01-23T12:00:00.000Z pages=1 pids=[12345] ...
[EXECUTOR_DAEMON] ts=2026-01-23T12:01:00.000Z pages=2 pids=[12345,12346] ...  ← FAIL: pages > 1
[EXECUTOR_DAEMON] 🚨 MULTIPLE PAGES: 2 detected - closing extras
[EXECUTOR_DAEMON] ts=2026-01-23T12:02:00.000Z pages=3 pids=[12345,12346,12347] ...  ← FAIL: pages > 1
[EXECUTOR_DAEMON] 🚨 HARD CAP EXCEEDED: 3 pages after cleanup - EXITING
```

**Failure indicators:**
- `pages=2` or higher
- Multiple Chrome PIDs growing
- "HARD CAP EXCEEDED" errors
- Tab count growing in Chrome

---

## Verification Checklist

- [ ] Daemon starts successfully
- [ ] CDP connection established
- [ ] Single page created/reused
- [ ] Logs show `pages=1` consistently
- [ ] Chrome tab count stays stable
- [ ] STOP switch exits within 10s
- [ ] Lock file created on start
- [ ] Lock file removed on exit
- [ ] No "HARD CAP EXCEEDED" errors
- [ ] No multiple Chrome processes
- [ ] Tick events emitted regularly
- [ ] SQL queries show `pages=1` for all ticks
- [ ] Mac remains responsive (no freezes)

---

## Troubleshooting

### Daemon Won't Start

**Error:** `CDP not reachable on port 9222`

**Fix:**
```bash
# Start Chrome with CDP
pnpm run runner:chrome-cdp
```

### Pages Exceed 1

**Error:** Logs show `pages=2` or higher

**Fix:**
- Check for other scripts creating pages
- Verify daemon is only executor running
- Check Chrome manually for extra tabs

### STOP Switch Doesn't Work

**Error:** Daemon doesn't exit after creating STOP switch

**Fix:**
- Verify file path: `./.runner-profile/STOP_EXECUTOR`
- Check file permissions
- Wait up to 10 seconds (checks every second)

---

**See [ARCHITECTURE.md](./ARCHITECTURE.md) for system details.**
