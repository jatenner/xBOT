# 🏃 Mac Runner - 24/7 Posting from Residential IP

The Mac Runner polls Supabase for queued decisions and posts them using Playwright with a persistent profile directory. Railway remains the scheduler + brain; Mac handles Playwright + posting.

## Architecture

- **Railway**: Scheduler, brain, learning loop, candidate generation
- **Mac Runner**: Playwright execution, posting, residential IP

## Setup

### 1. Install Playwright Browsers

```bash
cd /Users/jonahtenner/Desktop/xBOT
pnpm exec playwright install chromium
```

### 2. Configure Environment

Ensure `.env` has:
- `DATABASE_URL` (Supabase connection string)
- `TWITTER_SESSION_B64` (Base64-encoded Twitter session cookies)
- `RUNNER_PROFILE_DIR` (optional, defaults to `./.runner-profile`)
- `RUNNER_MAX_DECISIONS` (optional, defaults to 5)

### 3. Start Runner with PM2

```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Start runner
pm2 start pnpm --name "xbot-runner" -- exec tsx scripts/runner/poll-and-post.ts

# Save PM2 configuration
pm2 save

# Enable PM2 startup (runs on Mac boot)
pm2 startup
# Follow the command it prints (usually involves sudo)
```

### 4. Keep Mac Awake

```bash
# Prevent Mac from sleeping (run in separate terminal)
caffeinate -d
```

Or use System Preferences → Energy Saver → "Prevent computer from sleeping automatically when the display is off"

## Commands

### Start Runner
```bash
pm2 start xbot-runner
```

### Stop Runner
```bash
pm2 stop xbot-runner
```

### View Logs
```bash
pm2 logs xbot-runner
```

### Restart Runner
```bash
pm2 restart xbot-runner
```

### Check Health
```bash
pnpm exec tsx scripts/runner/health.ts
```

### Single Poll (Debug)
```bash
pnpm exec tsx scripts/runner/poll-and-post.ts --once
```

## How It Works

1. **Polling**: Every 60 seconds, queries Supabase for queued decisions (`status='queued'`, `scheduled_at <= now`)
2. **Posting**: Uses same `processPostingQueue()` function as Railway production
3. **Profile Persistence**: Playwright profile stored in `RUNNER_PROFILE_DIR` (default: `./.runner-profile`)
4. **Backoff**: If CONSENT_WALL or login required detected, stops attempts for 30 minutes and emits `RUNNER_ALERT` system event
5. **Events**: Writes `POST_SUCCESS`/`POST_FAILED` system_events same as production

## Backoff Behavior

- **Trigger**: CONSENT_WALL or login required detected
- **Duration**: 30 minutes
- **Action**: Emits `RUNNER_ALERT` system event, skips polling until backoff expires
- **Reset**: Automatically resets on successful post

## Monitoring

Check health anytime:
```bash
pnpm exec tsx scripts/runner/health.ts
```

Shows:
- Last POST_SUCCESS timestamp + URL
- Last POST_FAILED timestamp + reason
- Current backoff state (if active)
- 24h success/failure counts

## Troubleshooting

### Runner not posting
1. Check PM2 logs: `pm2 logs xbot-runner`
2. Check health: `pnpm exec tsx scripts/runner/health.ts`
3. Verify database connection: Check `DATABASE_URL` in `.env`
4. Check for backoff: Health script shows if backoff is active

### CONSENT_WALL errors
- Runner automatically enters 30-minute backoff
- Check `RUNNER_ALERT` events in system_events table
- Verify `TWITTER_SESSION_B64` is valid and not expired

### Profile directory issues
- Default location: `./.runner-profile`
- Override with `RUNNER_PROFILE_DIR` env var
- Ensure directory is writable: `chmod -R 755 .runner-profile`

## PM2 Commands Reference

```bash
# List all processes
pm2 list

# View logs (real-time)
pm2 logs xbot-runner

# View logs (last 100 lines)
pm2 logs xbot-runner --lines 100

# Restart
pm2 restart xbot-runner

# Stop
pm2 stop xbot-runner

# Delete
pm2 delete xbot-runner

# Save current process list
pm2 save

# Show startup command (to enable auto-start)
pm2 startup
```
