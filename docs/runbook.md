# xBOT Runbook

**Last Updated:** 2026-01-23  
**Purpose:** Operational procedures for deploying, verifying, and recovering xBOT

---

## Deployment

### Deploy Both Services (Required)

**CRITICAL:** GitHub deploy may SKIP services due to CI check suite failures, causing Railway drift. **Never rely on GitHub deploy alone.**

**Canonical deploy command (always use this):**
```bash
# Deploy both services explicitly (required)
pnpm run deploy:railway:both

# Or manually:
railway up --service xBOT --detach
railway up --service serene-cat --detach
```

**Why this is required:**
- GitHub Actions may skip deployment if CI checks fail
- Railway services can drift (different SHAs) if not deployed explicitly
- System requires both services to run the same SHA for consistency

**SHA verification (after deploy):**
```bash
# Verify both services show matching SHA
pnpm run verify:sha:both

# Or manually:
railway logs --service xBOT --lines 10 | grep BOOT
railway logs --service serene-cat --lines 10 | grep BOOT
```

**Expected:** Both services show matching SHA and `EXECUTION_MODE=control`.

**Individual service deploy (if needed):**
```bash
pnpm run deploy:railway:xbot    # Deploy xBOT only
pnpm run deploy:railway:serene  # Deploy serene-cat only
```

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

# Install as LaunchAgent service (auto-starts on boot, runs 24/7)
pnpm run executor:install-service
launchctl load -w ~/Library/LaunchAgents/com.xbot.executor.plist

# Or use existing LaunchAgent commands
pnpm run executor:start
```

**Key Points:**
- Runs `HEADLESS=true` by default (no visible windows)
- Uses dedicated profile: `${RUNNER_PROFILE_DIR}/executor-chrome-profile`
- Never opens visible windows
- Detects auth walls and exits cleanly
- Logs written to `${RUNNER_PROFILE_DIR}/logs/executor.log`

### Stop Executor (Emergency)

```bash
# EMERGENCY: If windows pop up repeatedly, run this immediately:
pnpm run executor:stop

# This command:
# - Creates STOP switch (daemon exits within 10s)
# - Kills daemon PID if present
# - Kills chrome-cdp.ts runner processes
# - Kills Playwright/Chromium child processes created by bot
# - Unloads LaunchAgent if installed

# Alternative methods:
# Method 1: STOP switch (graceful, exits within 10s)
touch ./.runner-profile/STOP_EXECUTOR

# Method 2: Kill process directly
pkill -f "executor/daemon"
pkill -f "chrome-cdp.ts"
```

**Root Cause Prevention:**
- CDP mode (`RUNNER_BROWSER=cdp`) is FORBIDDEN for daemon (causes visible Chrome windows)
- LaunchAgent plist must NOT contain `RUNNER_BROWSER=cdp`
- Daemon fails-fast if `RUNNER_BROWSER=cdp` detected
- `install-service.sh` guards against CDP mode installation

**Verification:**
```bash
# Verify everything stopped
pnpm run ops:executor:status

# Expected:
# - Daemon: Not running ✅
# - chrome-cdp.ts processes: None running ✅
# - Bot-owned Chromium: None running ✅
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
# Check status (running/not running, PID, last tick, windows expectation)
pnpm run ops:executor:status

# View logs
pnpm run executor:logs
# Or manually:
tail -f ./.runner-profile/logs/executor.log

# Check config
cat ./.runner-profile/EXECUTOR_CONFIG.json

# Verify headless mode
grep "BOOT: headless=true" ./.runner-profile/logs/executor.log
```

### Install/Uninstall Service

```bash
# Install LaunchAgent service (24/7 background execution)
pnpm run executor:install-service
launchctl load -w ~/Library/LaunchAgents/com.xbot.executor.plist

# Uninstall LaunchAgent service
pnpm run executor:uninstall-service
# Or manually:
launchctl unload ~/Library/LaunchAgents/com.xbot.executor.plist
rm ~/Library/LaunchAgents/com.xbot.executor.plist
```

### Verify Executor (Proof Tests)

```bash
# Quick 5-minute proof test (hard assertions: windows_opened=0 AND browser_launches<=1)
RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:prove:5m

# Full 15-minute proof test
RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:prove:15m

# Expected output: PASS with metrics:
#   windows_opened=0 ✅ [HARD ASSERTION]
#   browser_launches<=1 ✅ [HARD ASSERTION]
#   headless=true ✅
#   pages_max<=1 ✅
#   db_connected=true ✅
#   queues_readable=true ✅
#   stop_switch<=10s ✅
```

**Reports:** 
- `docs/EXECUTOR_5MIN_HEADLESS_PROOF.md` (5-minute test)
- `docs/EXECUTOR_15MIN_HEADLESS_PROOF.md` (15-minute test)

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

### Browser Windows Pop Up Repeatedly (EMERGENCY)

**Symptoms:**
- Mac is opening many X/Chrome windows repeatedly
- System becomes unusable
- Multiple Chrome windows appear

**Recovery (IMMEDIATE):**
```bash
# 1. EMERGENCY STOP: Run comprehensive stop command
pnpm run executor:stop

# This will:
# - Create STOP switch
# - Kill daemon PID
# - Kill chrome-cdp.ts processes
# - Kill bot-owned Chromium processes
# - Unload LaunchAgent

# 2. Verify everything stopped
pnpm run ops:executor:status

# 3. If windows still appearing, force kill Chrome
pkill -9 "Google Chrome"

# 4. Check root cause
# - Check LaunchAgent plist: cat ~/Library/LaunchAgents/com.xbot.executor.plist
# - Verify RUNNER_BROWSER is NOT set to "cdp"
# - Verify HEADLESS=true is set
# - Check logs: tail -100 ./.runner-profile/logs/executor.log
```

**Root Cause Prevention:**
- LaunchAgent plist must NOT have `RUNNER_BROWSER=cdp` (causes visible windows)
- LaunchAgent plist MUST have `HEADLESS=true`
- Daemon will fail-fast if `RUNNER_BROWSER=cdp` is detected (enforced in `scripts/executor/daemon.ts`)
- Daemon will fail-fast if `HEADLESS=false` is detected (enforced in `scripts/executor/daemon.ts`)
- Use `pnpm run executor:install-service` to regenerate correct plist (enforced by `scripts/executor/install-service.sh`)

### Executor Tab Explosion

**Symptoms:**
- Mac becomes unusable (input lag)
- Chrome has infinite tabs
- Executor logs show `pages=4` or higher

**Recovery:**
```bash
# 1. IMMEDIATELY: Run emergency stop
pnpm run executor:stop

# 2. Kill Chrome if still growing
pkill -9 "Google Chrome"

# 3. Verify executor stopped
pnpm run ops:executor:status

# 4. Check logs for root cause
tail -100 ./.runner-profile/logs/executor.log | grep "EXECUTOR_GUARD"
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

## PROOF_MODE Contract

**Purpose:** `PROOF_MODE=true` enables isolated proof execution for Level 4 proofs (Control → Executor → X), ensuring deterministic, reproducible test runs without interference from background work.

**When Active:** Set `PROOF_MODE=true` when running Level 4 proof scripts (`executor:prove:e2e-control-post`, `executor:prove:e2e-control-reply`).

### What PROOF_MODE Disables/Pauses

**Executor Daemon (`scripts/executor/daemon.ts`):**
- **Reply queue background work:** Skips feeds/discovery/keyword work that consumes browser pool
- **Non-proof decision processing:** Only processes decisions with `proof_tag` starting with `control-post-` or `control-reply-`

**Posting Queue (`src/jobs/postingQueue.ts`):**
- **Background decision selection:** When `PROOF_MODE=true`, only selects decisions matching proof tags
- **Rate limit checks:** Bypassed for proof decisions (allows proof to run even if rate limits are active)
- **Post limit checks:** Bypassed for proof decisions (allows proof to run even if hourly limits reached)

**Safety Rationale:** Proof decisions are:
- Single, deterministic decisions seeded by proof scripts
- Required to complete for proof verification
- Not subject to production rate limiting (proofs must be reproducible)
- Isolated from production traffic (proof tags prevent interference)

### What PROOF_MODE Filters

**Decision Selection:**
- **Posting:** Only processes decisions where `features.proof_tag` starts with `control-post-`
- **Replying:** Only processes decisions where `features.proof_tag` starts with `control-reply-`
- **All other decisions:** Skipped (prevents background work from interfering with proof)

**Event Emission:**
- `EXECUTOR_PROOF_POST_CANDIDATE_FOUND` - Emitted for each proof decision found
- `EXECUTOR_PROOF_POST_SELECTED` - Emitted when proof decision is selected for processing
- `EXECUTOR_PROOF_POST_SKIPPED` - Emitted if proof decision is skipped (with reason)
- `EXECUTOR_PROOF_POST_CLAIM_STALL` - Emitted if proof decision selected but not claimed within 30s

### What PROOF_MODE Prioritizes

**Browser Pool Priority:**
- Proof decisions receive `BrowserPriority.PROOF` (highest priority)
- Ensures proof decisions are not starved by other browser operations
- Proof decisions bypass browser semaphore queue delays

**Selection Priority:**
- Proof decisions are selected ahead of normal backlog
- Proof tag filtering ensures only proof decisions are considered
- Claim attempts happen immediately (no rate limit delays)

### What PROOF_MODE Bypasses

**Rate Limits:**
- Content posting rate limits (hourly post limits)
- Reply rate limits (hourly reply limits)
- **Rationale:** Proofs must be deterministic and reproducible. Rate limits are production safeguards, not proof constraints.

**Post Limits:**
- Hourly post count limits
- Daily post count limits
- **Rationale:** Proofs execute single decisions. Production limits prevent spam; proofs validate functionality.

**Circuit Breakers:**
- Posting circuit breaker checks
- **Rationale:** Proofs must run even if production circuit breaker is open (due to unrelated failures).

**Safety Gates:**
- Some safety gates are bypassed for proof decisions (e.g., ROOT_CHECK, ANCHOR_CHECK for replies)
- **Rationale:** Proof decisions use seeded/controlled data. Production gates prevent mistakes; proofs validate execution path.

### Required Evidence for PROVEN Status

**Proof Report (`docs/CONTROL_TO_POST_PROOF.md` or `docs/CONTROL_TO_REPLY_PROOF.md`):**
- Must exist and show `Status: ✅ PASS`
- Must include `result_url` with `https://x.com/` URL (verifies actual execution)
- Must include `decision_id`, `proof_tag`, and key event IDs

**System Events (in `system_events` table):**
- `EXECUTOR_DAEMON_BOOT` - Daemon started
- `EXECUTOR_DAEMON_READY` - Browser initialized
- `EXECUTOR_DAEMON_TICK_START` - Daemon processing loop started
- `EXECUTOR_PROOF_POST_SELECTED` (or `EXECUTOR_PROOF_REPLY_SELECTED`) - Decision selected
- `EXECUTOR_DECISION_CLAIM_ATTEMPT` - Claim attempt started
- `EXECUTOR_DECISION_CLAIM_OK` - Decision successfully claimed
- `POST_SUCCESS` or `REPLY_SUCCESS` - Execution succeeded (with `tweet_id` or `reply_tweet_id`)

**Verification:**
```bash
# Check proof report exists and shows PASS
cat docs/CONTROL_TO_POST_PROOF.md | grep "Status: ✅ PASS"

# Verify tweet URL exists in report
grep "https://x.com/" docs/CONTROL_TO_POST_PROOF.md

# Check system events for proof decision
# (Replace DECISION_ID with actual decision_id from proof report)
psql $DATABASE_URL -c "SELECT event_type, created_at FROM system_events WHERE event_data->>'decision_id' = 'DECISION_ID' ORDER BY created_at;"
```

**Documentation Update:**
- Once proof PASSes with verified URL, update `docs/SYSTEM_STATUS.md` to mark Level 4 as PROVEN
- Include decision_id, proof_tag, tweet_url, and claim event IDs in evidence
- Link to proof report file

---

**See [ARCHITECTURE.md](./ARCHITECTURE.md) for system details.**
