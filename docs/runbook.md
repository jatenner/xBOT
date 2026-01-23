# xBOT Runbook

**Last Updated:** 2026-01-23  
**Purpose:** Operational procedures for deploying, verifying, and recovering xBOT

---

## Deployment

### Deploy Both Services

```bash
# Deploy and verify both xBOT and serene-cat
pnpm run deploy:verify:both

# Or manually:
railway up --service xBOT --detach
railway up --service serene-cat --detach
```

### Verify SHA Match

```bash
# Check local SHA
git rev-parse HEAD

# Check Railway SHA (xBOT)
railway run --service xBOT -- node -e "console.log(process.env.RAILWAY_GIT_COMMIT_SHA)"

# Check Railway SHA (serene-cat)
railway run --service serene-cat -- node -e "console.log(process.env.RAILWAY_GIT_COMMIT_SHA)"

# Check boot logs
railway logs --service xBOT --lines 50 | grep "\[BOOT\]"
railway logs --service serene-cat --lines 50 | grep "\[BOOT\]"
```

**Expected:** All SHAs match, boot logs show `execution_mode=control`

---

## Health Checks

### Railway Services

```bash
# Check service status
pnpm run ops:status

# Check logs
pnpm run ops:logs

# Or via Railway CLI
railway status
railway logs --service xBOT --lines 100
railway logs --service serene-cat --lines 100
```

### Health Endpoints

```bash
# xBOT health
curl https://xBOT-production.up.railway.app/healthz

# serene-cat health
curl https://serene-cat-production.up.railway.app/healthz
```

**Expected Response:**
```json
{
  "ok": true,
  "sha": "<git_sha>",
  "service": "xBOT",
  "execution_mode": "control",
  "runner_mode": false,
  "service_role": "main",
  "jobs_enabled": false
}
```

### Database Health

```sql
-- Check recent POST_SUCCESS
SELECT * FROM system_events 
WHERE event_type='POST_SUCCESS' 
ORDER BY created_at DESC LIMIT 5;

-- Check posting queue activity (last 30 min)
SELECT COUNT(*) AS ticks, MAX(created_at) AS last_tick
FROM system_events
WHERE event_type='POSTING_QUEUE_TICK'
  AND created_at >= NOW() - INTERVAL '30 minutes';

-- Check reply queue activity
SELECT COUNT(*) AS ticks, MAX(created_at) AS last_tick
FROM system_events
WHERE event_type='REPLY_QUEUE_TICK'
  AND created_at >= NOW() - INTERVAL '30 minutes';
```

---

## Mac Executor Management

### Start Executor (Headless Daemon)

```bash
# Start headless daemon (24/7, no visible windows)
EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:daemon

# Or via LaunchAgent (auto-starts on boot)
pnpm run executor:start
```

**Key Points:**
- Runs `HEADLESS=true` by default (no visible windows)
- Uses dedicated profile: `${RUNNER_PROFILE_DIR}/executor-chrome-profile`
- Never opens visible windows
- Detects auth walls and exits cleanly

### Stop Executor (Emergency)

```bash
# Method 1: STOP switch (graceful, exits within 10s)
touch ./.runner-profile/STOP_EXECUTOR

# Method 2: Stop LaunchAgent
pnpm run executor:stop

# Method 3: Kill process
pkill -f "executor/daemon"
```

### Repair Login (If Auth Required)

```bash
# Run headed browser for login/challenge repair
RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:auth

# After login, remove AUTH_REQUIRED file
rm ./.runner-profile/AUTH_REQUIRED

# Restart daemon
pnpm run executor:daemon
```

### Check Executor Status

```bash
# Check status
pnpm run executor:status

# View logs
pnpm run executor:logs

# Check config
cat ./.runner-profile/EXECUTOR_CONFIG.json

# Verify headless mode
grep "BOOT: headless=true" ./.runner-profile/executor.log
```

### Verify Executor (15-Minute Proof)

```bash
# Run automated 15-minute proof test
RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:prove:15m

# Expected output: PASS with metrics:
#   windows_opened=0 ✅
#   headless=true ✅
#   pages_max<=1 ✅
#   browser_launches<=1 ✅
#   db_connected=true ✅
#   queues_readable=true ✅
#   stop_switch<=10s ✅
```

**Report:** `docs/EXECUTOR_15MIN_HEADLESS_PROOF.md`

---

## CDP / Profile Recovery

### Check CDP Connection

```bash
# Check if Chrome is running with CDP
curl http://127.0.0.1:9222/json/version

# Expected: JSON response with Chrome version
```

### Start Chrome with CDP

```bash
# Kill existing Chrome
pkill -9 "Google Chrome"

# Start Chrome with CDP (macOS)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-cdp-profile" \
  --no-first-run \
  --no-default-browser-check

# Verify CDP
curl http://127.0.0.1:9222/json/version
```

### Check Session

```bash
# Check Twitter session
pnpm run runner:session

# Expected: SESSION_OK with URL
```

### Login / Re-login

```bash
# Login to Twitter
pnpm run runner:login

# Follow prompts to complete login
```

### Reset Profile

```bash
# Reset Chrome profile (nuclear option)
pnpm run runner:reset-chrome

# Then re-login
pnpm run runner:login
```

---

## Incident Response

### Posting Queue Not Running

**Symptoms:**
- No `POSTING_QUEUE_TICK` events in last 10 min
- Queue has `status='queued'` decisions but nothing processing

**Diagnosis:**
```bash
# Check Railway logs
railway logs --service serene-cat --lines 100 | grep POSTING_QUEUE

# Check if jobs enabled
railway logs --service serene-cat --lines 50 | grep "jobs_enabled"

# Check DB for ticks
# SQL: SELECT COUNT(*) FROM system_events WHERE event_type='POSTING_QUEUE_TICK' AND created_at >= NOW() - INTERVAL '30 minutes';
```

**Recovery:**
1. Check `SERVICE_ROLE` is `worker` on serene-cat
2. Check `EXECUTION_MODE=control` (should be control, not executor)
3. Restart service: `railway up --service serene-cat --detach`
4. Verify ticks resume: `railway logs --service serene-cat --lines 50 | grep POSTING_QUEUE_TICK`

### Executor Tab Explosion

**Symptoms:**
- Mac becomes unusable (input lag)
- Chrome has infinite tabs
- Executor logs show `pages=4` or higher

**Recovery:**
```bash
# 1. IMMEDIATELY: Create STOP switch
touch ./.runner-profile/STOP_EXECUTOR

# 2. Wait 10 seconds for executor to exit

# 3. Kill Chrome if still growing
pkill -9 "Google Chrome"

# 4. Verify executor stopped
ps aux | grep executor-daemon

# 5. Check logs for root cause
tail -100 ./.runner-profile/executor.log | grep "EXECUTOR_GUARD"
```

**Prevention:**
- Guardrails should prevent this (hard cap at 3 pages)
- If it happens, check logs for why guardrails didn't trigger

### No POST_SUCCESS Events

**Symptoms:**
- `POSTING_QUEUE_TICK` events exist but `attempts_started=0`
- No `POST_SUCCESS` events in last 2+ hours

**Diagnosis:**
```bash
# Check Railway is control-plane (should block attempts)
railway logs --service serene-cat --lines 50 | grep "CONTROL-PLANE MODE"

# Check Mac executor is running
pnpm run executor:status

# Check executor logs for errors
pnpm run executor:logs | grep -i error
```

**Recovery:**
1. Verify Railway is `EXECUTION_MODE=control` (should block attempts)
2. Verify Mac executor is `EXECUTION_MODE=executor` + `RUNNER_MODE=true`
3. Check executor can connect to CDP: `curl http://127.0.0.1:9222/json/version`
4. Check session: `pnpm run runner:session`
5. Run one-shot test: `pnpm run runner:posting-queue-once`

### Auth Wall Detected

**Symptoms:**
- Daemon exits with `EXECUTOR_AUTH_REQUIRED` event
- `AUTH_REQUIRED` file exists in profile dir
- Login/challenge wall detected

**Recovery:**
```bash
# 1. Run headed auth repair
RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:auth

# 2. Complete login/challenge in browser window
# 3. Press Enter to close browser

# 4. Remove AUTH_REQUIRED file (auto-removed by auth command)
# 5. Restart daemon
pnpm run executor:daemon
```

### Browser Launch Issues

**Symptoms:**
- Daemon fails to launch browser
- Rate-limited browser launches

**Recovery:**
```bash
# Check browser launch count in logs
grep "browser_launches" ./.runner-profile/executor.log

# Wait for cooldown (max 1 launch per minute)
# Restart daemon if needed
touch ./.runner-profile/STOP_EXECUTOR
sleep 10
pnpm run executor:daemon
```

### Session Expired

**Symptoms:**
- Executor logs show "SESSION_EXPIRED"
- Session check fails

**Recovery:**
```bash
# 1. Check session
pnpm run runner:session

# 2. If expired, login
pnpm run runner:login

# 3. Verify session
pnpm run runner:session

# Expected: SESSION_OK
```

---

## Verification Scripts

**All proof/verification scripts:** See `docs/TESTS_AND_PROOFS.md`

**Quick verification:**
```bash
# Update status snapshot
pnpm run docs:snapshot

# Check current state
cat docs/STATUS.md
```

---

## Environment Sync

### Sync Env from Railway

```bash
# Auto-sync (recommended)
pnpm run runner:autosync

# Manual sync
pnpm run runner:sync

# Verify sync
pnpm run runner:check
```

**Required for:** Mac executor needs same `DATABASE_URL` and other env vars as Railway

---

**See [ARCHITECTURE.md](./ARCHITECTURE.md) for system details.**
