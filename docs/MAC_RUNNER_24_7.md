# 🏃 Mac Runner 24/7 Hardening

This document explains how to set up xBOT to run 24/7 on your Mac using LaunchAgent and the daemon mode.

## Overview

The Mac Runner system consists of:
1. **LaunchAgent**: Automatically starts Chrome CDP and the runner daemon on login
2. **Daemon Mode**: Long-running process that continuously checks session, runs pipeline jobs, and writes heartbeats
3. **Watchdog**: Monitors for inactivity and emits alerts if no posts/activity for X hours

---

## Installation

### Step 1: Install LaunchAgent

Run the installer script:

```bash
cd /path/to/xBOT
./scripts/mac/install-launchagent.sh
```

This will:
- Create a LaunchAgent plist at `~/Library/LaunchAgents/com.xbot.runner.plist`
- Load the LaunchAgent so it starts on login
- Configure it to keep the daemon running (auto-restart on crash)

### Step 2: Verify Installation

Check that the LaunchAgent is loaded:

```bash
launchctl list | grep com.xbot.runner
```

You should see output like:
```
PID    Status  Label
12345  0       com.xbot.runner
```

### Step 3: Check Logs

Monitor daemon logs:

```bash
# Standard output
tail -f ./.runner-profile/daemon.log

# Errors
tail -f ./.runner-profile/daemon-error.log
```

---

## Uninstallation

To remove the LaunchAgent:

```bash
./scripts/mac/uninstall-launchagent.sh
```

Or manually:

```bash
launchctl unload ~/Library/LaunchAgents/com.xbot.runner.plist
rm ~/Library/LaunchAgents/com.xbot.runner.plist
```

---

## Manual Operation

### Start Daemon Manually

```bash
pnpm run runner:daemon
```

### Start Chrome CDP Manually

```bash
pnpm run runner:chrome-cdp
```

### Check Session

```bash
pnpm run runner:session
```

### Run Pipeline Once

```bash
pnpm run runner:schedule-once
```

---

## Daemon Behavior

The daemon runs in an infinite loop with the following steps:

1. **CDP Check**: Verifies Chrome CDP is reachable on port 9222
   - If down, records heartbeat and sleeps with exponential backoff
   - Does not proceed until CDP is available

2. **Session Check**: Validates X.com session is still logged in
   - If invalid, records heartbeat and sleeps with exponential backoff
   - Does not proceed until session is valid

3. **Pipeline Execution**: Runs `runner:schedule-once` which:
   - Harvests reply candidates
   - Schedules and posts replies
   - Records POST_SUCCESS events

4. **Activity Watchdog**: Checks for inactivity:
   - If no POST_SUCCESS or plan execution for X hours (default: 6h), emits alert
   - Writes `ALERT_NO_ACTIVITY` event to `system_events` table

5. **Heartbeat**: Records status to:
   - `system_events` table (type: `RUNNER_DAEMON_HEARTBEAT`)
   - `job_heartbeats` table (job_name: `runner_daemon`)

6. **Sleep**: Waits with exponential backoff and jitter:
   - Base sleep: 60 seconds (configurable via `DAEMON_SLEEP_SECONDS`)
   - Backoff: Multiplied by failure count
   - Max sleep: 300 seconds (5 minutes)

---

## Configuration

### Environment Variables

Create or edit `.env.local`:

```bash
# CDP Configuration
CDP_PORT=9222
RUNNER_PROFILE_DIR=./.runner-profile
RUNNER_BROWSER=cdp

# Daemon Configuration
DAEMON_SLEEP_SECONDS=60
DAEMON_MAX_SLEEP=300
NO_ACTIVITY_ALERT_HOURS=6

# Runner Configuration
RUNNER_MODE=true
```

---

## Verification Commands

### 1. Check LaunchAgent Status

```bash
launchctl list | grep com.xbot.runner
```

**Expected:** Should show PID and status 0

### 2. Check CDP is Reachable

```bash
curl http://127.0.0.1:9222/json/version
```

**Expected:** Should return JSON with Chrome version info

### 3. Check Heartbeats

```sql
-- Check recent heartbeats
SELECT 
  event_type,
  event_data->>'status' as status,
  created_at
FROM system_events
WHERE event_type = 'RUNNER_DAEMON_HEARTBEAT'
ORDER BY created_at DESC
LIMIT 10;

-- Check job_heartbeats table
SELECT 
  job_name,
  last_run_status,
  last_success,
  last_failure,
  consecutive_failures,
  updated_at
FROM job_heartbeats
WHERE job_name = 'runner_daemon';
```

**Expected:** Recent heartbeats with status OK, CDP_DOWN, SESSION_INVALID, or ERROR

### 4. Check Activity Alerts

```sql
SELECT 
  event_type,
  event_data->>'hours_since_post' as hours_since_post,
  event_data->>'threshold_hours' as threshold,
  created_at
FROM system_events
WHERE event_type = 'ALERT_NO_ACTIVITY'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** Should only have alerts if no activity for >6 hours

---

## Troubleshooting

### Daemon Not Starting

1. Check LaunchAgent is loaded:
   ```bash
   launchctl list | grep com.xbot.runner
   ```

2. Check error logs:
   ```bash
   tail -f ./.runner-profile/daemon-error.log
   ```

3. Try running daemon manually:
   ```bash
   pnpm run runner:daemon
   ```

### CDP Not Running

1. Start Chrome CDP manually:
   ```bash
   pnpm run runner:chrome-cdp
   ```

2. Verify CDP is accessible:
   ```bash
   curl http://127.0.0.1:9222/json/version
   ```

### Session Expired

1. Check session status:
   ```bash
   pnpm run runner:session
   ```

2. If expired, re-login:
   ```bash
   pnpm run runner:login
   ```

### No Activity Alerts

If you're seeing `ALERT_NO_ACTIVITY` events:

1. Check if posting is working:
   ```sql
   SELECT * FROM system_events
   WHERE event_type = 'POST_SUCCESS'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

2. Check if plan execution is happening:
   ```sql
   SELECT * FROM growth_execution
   ORDER BY last_updated DESC
   LIMIT 5;
   ```

3. Verify daemon is running:
   ```bash
   ps aux | grep runner:daemon
   ```

---

## Safety Features

### Fail-Closed Behavior

- Daemon will **not** proceed if:
  - CDP is not reachable
  - Session is invalid
  - Pipeline errors occur repeatedly

### Exponential Backoff

- Sleep time increases with consecutive failures
- Max sleep capped at 5 minutes
- Automatic recovery when conditions improve

### Activity Monitoring

- Alerts if no activity for 6+ hours
- Writes to `system_events` for visibility
- Does not stop the daemon, only logs alerts

---

## Next Steps

Once the daemon is running 24/7:

1. Monitor logs daily: `tail -f ./.runner-profile/daemon.log`
2. Check heartbeats weekly: SQL queries above
3. Review activity alerts: Check `ALERT_NO_ACTIVITY` events
4. Enable Growth Controller when ready: See `docs/ADAPTIVE_GROWTH_CONTROLLER.md`
