# 🏃 Mac Runner - 24/7 Posting from Residential IP

The Mac Runner polls Supabase for queued decisions and posts them using Playwright with a persistent profile directory. Railway remains the scheduler + brain; Mac handles Playwright + posting.

## Architecture

- **Railway**: Scheduler, brain, learning loop, candidate generation
- **Mac Runner**: Playwright execution, posting, residential IP

## Setup (Step-by-Step)

### Step 1: Install Dependencies

```bash
cd /Users/jonahtenner/Desktop/xBOT
pnpm install
pnpm exec playwright install chromium
```

### Step 2: Sync Environment from Railway

**⚠️ IMPORTANT: Never edit `.env.local` manually. It is auto-generated from Railway.**

```bash
# Sync environment variables from Railway service "xBOT"
pnpm run runner:sync
```

This will:
1. Fetch required variables from Railway (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `OPENAI_API_KEY`)
2. Write them to `.env.local` (auto-generated, do not edit)
3. Add runner defaults (`RUNNER_MODE=true`, `RUNNER_PROFILE_DIR=./.runner-profile`)
4. Create sync metadata in `.runner-profile/env.sync.json`

**Prerequisites:**
- Railway CLI installed: `npm install -g @railway/cli`
- Logged into Railway: `railway login`
- Railway service "xBOT" exists and has required variables

### Step 3: One-Time Interactive Login

```bash
pnpm run runner:login
```

This will:
1. Check that `.env.local` is in sync (fails if out of sync)
2. Open Chromium in headed mode (visible browser)
3. Navigate to https://x.com/home
4. Wait for you to log in manually
5. Save login state to `.runner-profile` directory

**Important**: Complete the login in the browser window, then press Enter in the terminal.

### Step 4: Test Runner (Single Poll)

```bash
# Test with a single poll (checks env sync automatically)
pnpm run runner:once
```

This will:
1. Check that `.env.local` is in sync (fails if out of sync)
2. Poll Supabase for queued decisions
3. Process up to 5 decisions
4. Print summary: queued/processed/success/failed counts

### Step 5: Start Runner

**Option A: LaunchAgent (Recommended - Auto-starts on reboot)**

```bash
chmod +x scripts/runner/setup-mac-runner.sh
./scripts/runner/setup-mac-runner.sh
```

This creates a LaunchAgent that auto-starts the runner on Mac boot.

**Option B: PM2**

```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Start runner
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile pm2 start pnpm --name "xbot-runner" -- exec tsx scripts/runner/poll-and-post.ts

# Save PM2 configuration
pm2 save

# Enable PM2 startup (runs on Mac boot)
pm2 startup
# Follow the command it prints (usually involves sudo)
```

### Step 6: Keep Mac Awake

**Option A: Caffeinate (Terminal)**

```bash
# Prevent Mac from sleeping (run in separate terminal)
caffeinate -dimsu
```

**Option B: System Preferences**

1. System Preferences → Energy Saver
2. Check "Prevent computer from sleeping automatically when the display is off"
3. Uncheck "Put hard disks to sleep when possible"

### Step 6: Verify Health

```bash
pnpm exec tsx scripts/runner/health.ts
```

Should show:
- Last POST_SUCCESS timestamp + tweet URL
- Last POST_FAILED timestamp + reason
- Current backoff state (if any)
- 24h success/failure counts

## Commands

### LaunchAgent Commands

```bash
# Check status
launchctl list | grep com.xbot.runner

# View logs
tail -f ./.runner-profile/runner.log

# Stop runner
launchctl unload ~/Library/LaunchAgents/com.xbot.runner.plist

# Start runner
launchctl load -w ~/Library/LaunchAgents/com.xbot.runner.plist
```

### PM2 Commands (Alternative)

```bash
# Start runner
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile pm2 start pnpm --name "xbot-runner" -- exec tsx scripts/runner/poll-and-post.ts

# Stop runner
pm2 stop xbot-runner

# View logs
pm2 logs xbot-runner

# Restart runner
pm2 restart xbot-runner

# Delete runner
pm2 delete xbot-runner
```

### Health & Debugging

```bash
# Check env sync status
pnpm run runner:check

# Sync env from Railway (if out of sync)
pnpm run runner:sync

# Check health (last success/failure + backoff state)
pnpm exec tsx scripts/runner/health.ts

# Single poll (debug mode)
pnpm run runner:once

# Verify recent posts
pnpm exec tsx scripts/verify-post-success.ts --minutes=240
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

## Confirming a Real Post

After a POST_SUCCESS event:

1. **Check health script**:
   ```bash
   pnpm exec tsx scripts/runner/health.ts
   ```
   Shows last POST_SUCCESS with tweet URL.

2. **Verify in database**:
   ```bash
   pnpm exec tsx scripts/verify-post-success.ts --minutes=240
   ```
   Lists recent POST_SUCCESS events with tweet URLs.

3. **Manual timeline verification**:
   - Open the tweet URL (e.g., `https://x.com/i/status/1234567890`)
   - Verify it appears on @SignalAndSynapse timeline
   - Check replies tab if it's a reply

## Environment Sync

**⚠️ CRITICAL: `.env.local` is auto-generated. Never edit it manually.**

The runner uses Railway variables as the single source of truth. Before starting, the runner checks that `.env.local` matches the last sync from Railway.

### Sync Commands

```bash
# Sync env from Railway (do this first, or when Railway vars change)
pnpm run runner:sync

# Check if env is in sync (runner does this automatically)
pnpm run runner:check
```

### When to Re-sync

- After Railway variables are updated
- After cloning the repo (`.env.local` is gitignored)
- If runner fails with "ENV OUT OF SYNC" error

### Troubleshooting Sync

**"Railway CLI not found"**
```bash
npm install -g @railway/cli
```

**"Not logged into Railway"**
```bash
railway login
```

**"Missing required Railway variable"**
- Check Railway dashboard → xBOT service → Variables
- Ensure all required keys exist: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `OPENAI_API_KEY`

## Troubleshooting

### Runner not starting
1. Check env sync: `pnpm run runner:check`
2. If out of sync: `pnpm run runner:sync`
3. Check logs: `tail -f ./.runner-profile/runner.log` (LaunchAgent) or `pm2 logs xbot-runner` (PM2)
4. Check health: `pnpm exec tsx scripts/runner/health.ts`
5. Verify database connection: Check `DATABASE_URL` in `.env.local` (auto-generated)
6. Check for backoff: Health script shows if backoff is active
7. Verify login: Run login helper again if profile seems invalid

### CONSENT_WALL errors
- Runner automatically enters 30-minute backoff
- Check `RUNNER_ALERT` events in system_events table
- Re-run login helper: `pnpm run runner:login`

### Profile directory issues
- Default location: `./.runner-profile`
- Override with `RUNNER_PROFILE_DIR` env var
- Ensure directory is writable: `chmod -R 755 .runner-profile`
- If login fails, delete profile and re-run login helper: `rm -rf ./.runner-profile`

### LaunchAgent not starting
- Check status: `launchctl list | grep com.xbot.runner`
- Check logs: `tail -f ./.runner-profile/runner.log`
- Reload: `launchctl unload ~/Library/LaunchAgents/com.xbot.runner.plist && launchctl load -w ~/Library/LaunchAgents/com.xbot.runner.plist`

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
