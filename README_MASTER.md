# xBOT — Master README (Single Source of Truth) v2

> Purpose: This document is the complete, end-to-end description of the xBOT system, including architecture, runtime roles, Mac executor vs Railway control-plane, posting/reply pipelines, observability/proofs, and operational commands.
>
> If a new AI agent reads only ONE document, it should be this one.
>
> **Version:** v2 (enforcement-grade, incident-hardened)  
> **Last Verified:** 2026-01-24  
> **Critical Fixes:** a89a4c31 (executor stop/status/proof), 0c52898e (README_MASTER.md creation)

---

## Table of Contents

1. [Reality Check (as of 2026-01-24)](#reality-check-as-of-2026-01-24)
2. [Operator Quickstart (5-Minute Deterministic)](#operator-quickstart-5-minute-deterministic)
3. [Environment Variable Contract](#environment-variable-contract)
4. [State Machine: Decision → Attempt → Outcome](#state-machine-decision--attempt--outcome)
5. [Event Taxonomy (Required Events)](#event-taxonomy-required-events)
6. [Hard Safety Invariants (Auditable Rules)](#hard-safety-invariants-auditable-rules)
7. [Incident Prevention: CDP Mode Must Never Run in Daemon](#incident-prevention-cdp-mode-must-never-run-in-daemon)
8. [Proof Commands (Acceptance Criteria)](#proof-commands-acceptance-criteria)
9. [Incident Playbook: Browser Windows Popup Storm](#incident-playbook-browser-windows-popup-storm)
10. [Service Drift: SHA Verification on Both Railway Services](#service-drift-sha-verification-on-both-railway-services)
11. [What xBOT is](#what-xbot-is)
12. [Non-negotiable objectives](#non-negotiable-objectives)
13. [Key principle: Control-plane vs Executor-plane](#key-principle-control-plane-vs-executor-plane)
14. [Current state summary](#current-state-summary)
15. [System architecture](#system-architecture)
16. [Core pipelines](#core-pipelines)
17. [Execution modes and guardrails](#execution-modes-and-guardrails)
18. [Services: Railway](#services-railway)
19. [Mac Executor: Why it exists and how it must behave](#mac-executor-why-it-exists-and-how-it-must-behave)
20. [Operational commands](#operational-commands)
21. [Verification and proof strategy](#verification-and-proof-strategy)
22. [Troubleshooting](#troubleshooting)
23. [Roadmap: What's built vs what's left](#roadmap-whats-built-vs-whats-left)
24. [Quality + anti-bot constraints](#quality--anti-bot-constraints)
25. [Glossary](#glossary)

---

## Reality Check (as of 2026-01-24)

**Verified Commit SHAs:**
- `a89a4c31` - Emergency fix: executor stop command, status enhancements, LaunchAgent plist fixes, fail-fast guard, 5-minute proof test
- `0c52898e` - Documentation: README_MASTER.md creation, TOC/README pointers

**Critical Fixes Applied:**
- LaunchAgent plist: `RUNNER_BROWSER=cdp` removed, `HEADLESS=true` enforced
- Daemon fail-fast guard: exits immediately if `RUNNER_BROWSER=cdp` detected
- Comprehensive stop command: `pnpm run executor:stop` kills all executor processes
- Enhanced status command: `pnpm run ops:executor:status` shows full executor state
- 5-minute proof test: `pnpm run executor:prove:5m` with hard assertions

**Scripts Verified:**
- `executor:stop` → `scripts/executor/stop.ts` ✅
- `executor:prove:5m` → `scripts/executor/prove-5m.ts` ✅
- `executor:prove:15m` → `scripts/executor/prove-15m.ts` ✅
- `ops:executor:status` → `scripts/ops/executor-status.ts` ✅
- `executor:daemon` → `scripts/executor/daemon.ts` ✅
- `executor:auth` → `scripts/executor/auth.ts` ✅
- `executor:install-service` → `scripts/executor/install-service.sh` ✅

---

## Operator Quickstart (5-Minute Deterministic)

### Step 1: Verify Railway Control-Plane (30 seconds)

```bash
# Check both services are running in control mode
railway logs --service xBOT --lines 5 | grep "EXECUTION_MODE\|BOOT"
railway logs --service serene-cat --lines 5 | grep "EXECUTION_MODE\|BOOT"

# Expected: Both show EXECUTION_MODE=control, BOOT sha=<SHA>
```

**Success Criteria:** Both services show `EXECUTION_MODE=control` and matching SHA.

### Step 2: Verify Mac Executor Status (30 seconds)

```bash
# Check executor status
pnpm run ops:executor:status

# Expected output includes:
# - LaunchAgent: Installed/Loaded status
# - Daemon: Running/Not running, PID if running
# - chrome-cdp.ts processes: None running ✅
# - Bot-owned Chromium: Count (should be 0 if daemon not running)
# - Last 20 log lines
```

**Success Criteria:** Status command completes without errors, shows clear state.

### Step 3: Start Executor (if not running) (1 minute)

```bash
# Option A: Install as LaunchAgent (24/7 background)
pnpm run executor:install-service
launchctl load -w ~/Library/LaunchAgents/com.xbot.executor.plist

# Option B: Run directly (for testing)
pnpm run executor:daemon

# Verify it started
pnpm run ops:executor:status
```

**Success Criteria:** Status shows daemon running, PID present, no chrome-cdp.ts processes.

### Step 4: Verify Headless Operation (2 minutes)

```bash
# Run 5-minute proof test (hard assertions)
pnpm run executor:prove:5m

# Expected output: PASS with:
#   windows_opened=0 ✅ [HARD ASSERTION]
#   browser_launches<=1 ✅ [HARD ASSERTION]
#   headless=true ✅
#   pages_max<=1 ✅
#   stop_switch<=10s ✅
```

**Success Criteria:** Proof test PASSES with all hard assertions met.

### Step 5: Verify Posting Queue Activity (1 minute)

```bash
# Check recent posting queue ticks
railway logs --service serene-cat --lines 50 | grep POSTING_QUEUE_TICK

# Check executor is processing queue
tail -50 ./.runner-profile/logs/executor.log | grep "posting_ready\|posting_attempts"

# Expected: Ticks exist, executor shows attempts_started > 0 when ready candidates exist
```

**Success Criteria:** Queue ticks exist, executor processes ready candidates.

**Total Time:** ~5 minutes  
**Expected Outcome:** System operational, executor headless, queue processing.

---

## Environment Variable Contract

### Control-Plane (Railway) - Required Variables

**MUST BE SET:**
- `EXECUTION_MODE=control` (fail-closed if missing or wrong)
- `DATABASE_URL` (Supabase PostgreSQL connection string)
- `RAILWAY_SERVICE_NAME` (either `xBOT` or `serene-cat`)

**OPTIONAL BUT RECOMMENDED:**
- `SERVICE_ROLE` (inferred from `RAILWAY_SERVICE_NAME` if not set)
- `DISABLE_ALL_JOBS=true` (on non-worker service to prevent duplicate jobs)

**FORBIDDEN ON RAILWAY (Must Never Be Set):**
- `RUNNER_MODE=true` (Railway must never run browser automation)
- `RUNNER_BROWSER=cdp` (Railway must never use CDP mode)
- `RUNNER_PROFILE_DIR` (Railway has no local profile directory)
- `HEADLESS` (Railway doesn't launch browsers)
- `CDP_PORT` (Railway doesn't connect to CDP)

**Default Behavior:**
- If `EXECUTION_MODE` is missing, Railway services default to `control` (fail-closed). **Policy (Doc) — not yet enforced in code:** Should fail-fast if `EXECUTION_MODE` is set to invalid value.
- If `RUNNER_MODE=true` is detected on Railway, system blocks all execution attempts and emits `*_BLOCKED` events with reason `NOT_EXECUTOR_MODE` (enforced in `src/jobs/postingQueue.ts` and `src/jobs/replySystemV2/main.ts`).

### Executor-Plane (Mac) - Required Variables

**MUST BE SET:**
- `EXECUTION_MODE=executor` (fail-closed if missing or wrong)
- `RUNNER_MODE=true` (required for browser automation)
- `RUNNER_PROFILE_DIR=./.runner-profile` (or absolute path)
- `HEADLESS=true` (daemon mode must be headless)
- `DATABASE_URL` (same as Railway, must match)

**FORBIDDEN IN DAEMON MODE (Must Never Be Set):**
- `RUNNER_BROWSER=cdp` (daemon must use direct Playwright launch, not CDP)
- `HEADLESS=false` (daemon must be headless)

**Default Behavior:**
- If `RUNNER_BROWSER=cdp` is detected in daemon, daemon MUST exit immediately with error.
- If `HEADLESS=false` is detected in daemon, daemon MUST exit immediately with error.
- LaunchAgent plist MUST NOT contain `RUNNER_BROWSER=cdp` (enforced by `install-service.sh`).

**Allowed Only in Manual Repair:**
- `HEADLESS=false` in `executor:auth` command (headed browser for login repair)

---

## State Machine: Decision → Attempt → Outcome

### Decision States (`content_metadata.status`)

```
queued → posting → posted
              ↓
           failed
              ↓
          skipped
```

**State Transitions:**

1. **`queued`** (initial state)
   - Decision created by control-plane
   - `scheduled_at` set (may be in future)
   - Ready for executor to claim

2. **`posting`** (claimed by executor)
   - Executor atomically updates: `status='queued'` → `status='posting'`
   - Prevents race conditions (only one executor can claim)
   - Browser automation begins

3. **`posted`** (success)
   - Tweet posted successfully
   - `tweet_id` populated
   - `posted_at` timestamp set
   - `POST_SUCCESS` event emitted

4. **`failed`** (execution failure)
   - Browser automation failed
   - `error_message` populated
   - `POST_FAILED` event emitted with reason

5. **`skipped`** (filtered out)
   - Decision filtered by executor (e.g., duplicate, invalid)
   - `skip_reason` populated
   - No event emitted (not a failure)

**Invariants:**
- Only `status='queued'` decisions can be claimed (atomic update with WHERE clause)
- `status='posting'` decisions must transition to `posted`/`failed`/`skipped` (no orphaned posting state)
- `tweet_id` is NULL until `status='posted'`
- `posted_at` is NULL until `status='posted'`

### Attempt Lifecycle (Executor-Side)

```
[Executor starts] → [Claim decision: queued→posting] → [Browser automation] → [Record outcome]
                                                              ↓
                                                      [Update status: posting→posted/failed]
                                                              ↓
                                                      [Emit POST_SUCCESS/POST_FAILED event]
```

**Critical Points:**
- Claim is atomic (single SQL UPDATE with WHERE `status='queued'`)
- If claim fails (0 rows updated), decision was already claimed by another executor
- Browser automation must complete within runtime cap (60s per tick)
- Outcome must be recorded even if browser automation fails

---

## Event Taxonomy (Required Events)

### Control-Plane Events (Railway)

**POSTING_QUEUE_TICK** (required, periodic)
- Emitted by posting queue scheduler
- Contains: `ready_candidates`, `selected_candidates`, `attempts_started`
- Frequency: Every tick interval (typically 1-5 minutes)
- In control mode: `attempts_started=0` (blocked)

**REPLY_QUEUE_TICK** (required, periodic)
- Emitted by reply queue scheduler
- Contains: `ready_candidates`, `selected_candidates`, `attempts_started`
- Frequency: Every tick interval
- In control mode: `attempts_started=0` (blocked)

**POSTING_QUEUE_BLOCKED** (required when blocked)
- Emitted when control-plane blocks execution attempt
- Contains: `reason` (e.g., `NOT_EXECUTOR_MODE`, `RUNNER_MODE_NOT_SET`)
- Must be emitted for every blocked attempt

**REPLY_QUEUE_BLOCKED** (required when blocked)
- Emitted when control-plane blocks reply attempt
- Contains: `reason`
- Must be emitted for every blocked attempt

### Executor-Plane Events (Mac)

**EXECUTOR_DAEMON_TICK** (required, periodic)
- Emitted by executor daemon every tick
- Contains: `pages`, `browser_launch_count`, `posting_ready`, `posting_attempts`, `reply_ready`, `reply_attempts`, `backoff_seconds`
- Frequency: Every tick interval (typically 60 seconds)
- Used for observability and proof validation

**POST_SUCCESS** (required on successful post)
- Emitted when tweet posted successfully
- Contains: `decision_id`, `tweet_id`, `posted_at`
- Must be emitted for every successful post

**POST_FAILED** (required on failed post)
- Emitted when post attempt fails
- Contains: `decision_id`, `reason`, `failed_at`
- Must be emitted for every failed attempt

**EXECUTOR_AUTH_REQUIRED** (required when auth wall detected)
- Emitted when executor detects login/challenge wall
- Contains: `reason`, `detected_at`
- Executor must exit cleanly after emitting this event

**Event Invariants:**
- Every `POST_SUCCESS` must have corresponding `content_metadata` row with `status='posted'` and `tweet_id` populated
- Every `POST_FAILED` must have corresponding `content_metadata` row with `status='failed'` and `error_message` populated
- `POSTING_QUEUE_TICK` and `REPLY_QUEUE_TICK` must exist frequently (evidence of scheduler running)
- `EXECUTOR_DAEMON_TICK` must exist when executor is running (evidence of executor running)

---

## Hard Safety Invariants (Auditable Rules)

### Invariant 1: Control-Plane Never Executes Browser Automation

**Rule:** Railway services with `EXECUTION_MODE=control` MUST NOT attempt browser posting/replying.

**Enforcement:**
- Boot-time check: If `RUNNER_MODE=true` detected on Railway, fail-fast
- Runtime check: All execution attempts blocked, `attempts_started=0` in control mode
- Proof: `POSTING_QUEUE_TICK` events show `attempts_started=0` on Railway

**Audit Query:**
```sql
SELECT COUNT(*) AS blocked_attempts
FROM system_events
WHERE event_type='POSTING_QUEUE_BLOCKED'
  AND created_at >= NOW() - INTERVAL '1 hour';
```

### Invariant 2: Executor Daemon Never Opens Visible Windows

**Rule:** Executor daemon MUST run headless (`HEADLESS=true`) and MUST NOT open visible Chrome windows.

**Enforcement:**
- Boot-time check: If `HEADLESS=false` detected, daemon exits immediately
- Boot-time check: If `RUNNER_BROWSER=cdp` detected, daemon exits immediately
- LaunchAgent plist: Must contain `HEADLESS=true`, must NOT contain `RUNNER_BROWSER=cdp`
- Proof: `executor:prove:5m` validates `windows_opened=0`

**Audit Command:**
```bash
# Verify LaunchAgent plist
cat ~/Library/LaunchAgents/com.xbot.executor.plist | grep -E "RUNNER_BROWSER|HEADLESS"

# Expected: HEADLESS=true present, RUNNER_BROWSER absent
```

### Invariant 3: Single Executor Instance

**Rule:** Only one executor daemon process can run at a time.

**Enforcement:**
- PID lock file: `RUNNER_PROFILE_DIR/executor.pid`
- Lock format: `PID:START_TIMESTAMP`
- If lock exists and process alive, new daemon exits immediately
- Stale locks (dead process) auto-cleaned

**Audit Command:**
```bash
# Check for multiple executor processes
ps aux | grep "executor/daemon" | grep -v grep | wc -l

# Expected: 0 or 1 (never > 1)
```

### Invariant 4: STOP Switch Must Exit Within 10 Seconds

**Rule:** Executor daemon MUST check STOP switch frequently and exit within 10 seconds when detected.

**Enforcement:**
- STOP switch file: `RUNNER_PROFILE_DIR/STOP_EXECUTOR`
- Checked: Before/after each queue tick, during backoff sleep (1s increments), at top-level loop
- Proof: `executor:prove:5m` validates `stop_switch_seconds <= 10`

**Audit Command:**
```bash
# Create STOP switch and measure exit time
time (touch ./.runner-profile/STOP_EXECUTOR && sleep 15 && pnpm run ops:executor:status)

# Expected: Daemon exits within 10 seconds
```

### Invariant 5: Page Cap (Pages <= 1)

**Rule:** Executor daemon MUST maintain exactly 1 page (never > 1).

**Enforcement:**
- Runtime check: After each browser operation, enforce page cap
- If pages > 1, close extras immediately
- If pages > 3, exit with error (hard cap)
- Proof: `executor:prove:5m` validates `pages_max <= 1`

**Audit Query:**
```sql
SELECT MAX((event_data->>'pages')::int) AS max_pages
FROM system_events
WHERE event_type='EXECUTOR_DAEMON_TICK'
  AND created_at >= NOW() - INTERVAL '1 hour';

-- Expected: max_pages <= 1
```

### Invariant 6: Browser Launch Rate Limit (<= 1 per minute)

**Rule:** Executor daemon MUST limit browser launches to at most 1 per minute.

**Enforcement:**
- Rate limit: `MAX_BROWSER_LAUNCHES_PER_MINUTE = 1`
- Cooldown: `BROWSER_LAUNCH_COOLDOWN_MS = 60000` (1 minute)
- Proof: `executor:prove:5m` validates `browser_launches <= 1`

**Audit Query:**
```sql
SELECT MAX((event_data->>'browser_launch_count')::int) AS max_launches
FROM system_events
WHERE event_type='EXECUTOR_DAEMON_TICK'
  AND created_at >= NOW() - INTERVAL '5 minutes';

-- Expected: max_launches <= 1 (for 5-minute window)
```

---

## Incident Prevention: CDP Mode Must Never Run in Daemon

### Root Cause (Historical Incident)

**What Happened:**
- LaunchAgent plist contained `RUNNER_BROWSER=cdp`
- This forced CDP mode, which requires `chrome-cdp.ts` to launch visible Chrome windows
- Result: Browser popup storm, Mac frozen

**Why It Happened:**
- CDP mode connects to an existing Chrome instance (requires visible Chrome)
- Daemon should use direct Playwright launch (headless, no visible windows)
- LaunchAgent plist incorrectly configured for CDP mode

### Prevention Rules (Enforcement-Grade)

**Rule 1: LaunchAgent Plist Must Never Set RUNNER_BROWSER=cdp**

**Enforcement:**
- `scripts/executor/install-service.sh` generates plist WITHOUT `RUNNER_BROWSER`
- Manual plist edits must NOT add `RUNNER_BROWSER=cdp`
- Audit: `cat ~/Library/LaunchAgents/com.xbot.executor.plist | grep RUNNER_BROWSER` must return nothing

**Rule 2: Daemon Must Fail-Fast If RUNNER_BROWSER=cdp Detected**

**Enforcement:**
- `scripts/executor/daemon.ts` checks `RUNNER_BROWSER` at boot
- If `RUNNER_BROWSER=cdp`, daemon exits immediately with error message
- Error message instructs: "Remove RUNNER_BROWSER=cdp from LaunchAgent plist"

**Code Location:**
```typescript
// scripts/executor/daemon.ts (lines 50-58)
if (RUNNER_BROWSER.toLowerCase() === 'cdp') {
  console.error('[EXECUTOR_DAEMON] 🚨 FATAL: RUNNER_BROWSER=cdp is not allowed in daemon mode');
  console.error('[EXECUTOR_DAEMON] 🚨 CDP mode requires visible Chrome windows (chrome-cdp.ts)');
  console.error('[EXECUTOR_DAEMON] 🚨 Daemon MUST use direct Playwright launch (headless=true)');
  console.error('[EXECUTOR_DAEMON] 🚨 Remove RUNNER_BROWSER=cdp from LaunchAgent plist');
  process.exit(1);
}
```

**Rule 3: chrome-cdp.ts Must Never Be Auto-Started by Daemon**

**Enforcement:**
- Daemon does NOT call `chrome-cdp.ts` script
- Daemon uses `chromium.launchPersistentContext()` directly (headless)
- `chrome-cdp.ts` is only for manual CDP setup (not daemon)

**Rule 4: LaunchAgent Must Set HEADLESS=true**

**Enforcement:**
- `scripts/executor/install-service.sh` sets `HEADLESS=true` in plist
- Daemon checks `HEADLESS` at boot, exits if `false`
- Audit: `cat ~/Library/LaunchAgents/com.xbot.executor.plist | grep HEADLESS` must show `HEADLESS=true`

### Verification Checklist

**Before Starting Executor:**
1. ✅ LaunchAgent plist does NOT contain `RUNNER_BROWSER=cdp`
2. ✅ LaunchAgent plist DOES contain `HEADLESS=true`
3. ✅ Daemon fail-fast guard exists in code
4. ✅ `chrome-cdp.ts` processes are NOT running
5. ✅ Executor uses `chromium.launchPersistentContext()` (not `connectOverCDP()`)

**After Starting Executor:**
1. ✅ `executor:prove:5m` PASSES with `windows_opened=0`
2. ✅ `ops:executor:status` shows no chrome-cdp.ts processes
3. ✅ Logs show "BOOT: headless=true" and "chromium.launch() mode (NOT connectOverCDP)"

---

## Proof Commands (Acceptance Criteria)

### Proof Level 0: Deploy Consistency

**Command:**
```bash
# Preferred: Use /healthz endpoint
curl -s https://xbot-production-844b.up.railway.app/healthz | jq '{sha, serviceName, executionMode, runnerMode}'
curl -s https://serene-cat-production.up.railway.app/healthz | jq '{sha, serviceName, executionMode, runnerMode}'

# Fallback: BOOT logs
railway logs --service xBOT --lines 10 | grep BOOT
railway logs --service serene-cat --lines 10 | grep BOOT
```

**Acceptance Criteria:**
- Both services show matching `sha` (via `/healthz` or `BOOT sha=<SHA>` in logs)
- Both services show `executionMode=control` (via `/healthz`) or `EXECUTION_MODE=control` (in BOOT logs)

**PASS/FAIL:** PASS if SHAs match and both are control mode.

### Proof Level 1: Control-Plane Integrity

**Command:**
```bash
# Check posting queue ticks
railway logs --service serene-cat --lines 100 | grep POSTING_QUEUE_TICK | tail -5

# Check reply queue ticks
railway logs --service serene-cat --lines 100 | grep REPLY_QUEUE_TICK | tail -5
```

**Acceptance Criteria:**
- `POSTING_QUEUE_TICK` events exist (at least 1 in last 10 minutes)
- `REPLY_QUEUE_TICK` events exist (at least 1 in last 10 minutes)
- Both show `attempts_started=0` (blocked in control mode)

**PASS/FAIL:** PASS if ticks exist and attempts_started=0.

### Proof Level 2: Executor Stability (Critical)

**Command:**
```bash
pnpm run executor:prove:5m
```

**Acceptance Criteria (HARD ASSERTIONS):**
- `windows_opened=0` ✅ (no visible windows)
- `browser_launches<=1` ✅ (only one browser launch)
- `headless=true` ✅
- `pages_max<=1` ✅
- `db_connected=true` ✅
- `queues_readable=true` ✅
- `stop_switch_seconds<=10` ✅ (STOP switch works)

**PASS/FAIL:** PASS only if ALL hard assertions pass. FAIL if any hard assertion fails.

**Report Location:** `docs/EXECUTOR_5MIN_HEADLESS_PROOF.md` (created by proof script)

**Extended Proof (15 minutes):**
```bash
pnpm run executor:prove:15m
```

**Same acceptance criteria as 5-minute proof, but validates stability over longer duration.**

**Report Location:** `docs/EXECUTOR_15MIN_HEADLESS_PROOF.md` (created by proof script)

### Proof Level 3: Execution Proof (Posting/Replies)

**Command:**
```bash
# Check executor is processing queue
tail -100 ./.runner-profile/logs/executor.log | grep "posting_attempts\|reply_attempts"

# Check POST_SUCCESS events
railway logs --service xBOT --lines 200 | grep POST_SUCCESS | tail -5
```

**Acceptance Criteria:**
- Executor logs show `posting_attempts > 0` when ready candidates exist
- `POST_SUCCESS` events exist in system_events table
- Tweet URLs are reachable (manual verification)

**PASS/FAIL:** PASS if attempts > 0 and POST_SUCCESS events exist.

### Proof Level 4: Learning Proof

**Command:**
```sql
-- Check metrics collected
SELECT COUNT(*) AS metrics_count
FROM outcomes
WHERE collected_at >= NOW() - INTERVAL '24 hours';

-- Check learning summary updated
SELECT MAX(updated_at) AS last_learning_update
FROM learning_posts
LIMIT 1;
```

**Acceptance Criteria:**
- Metrics collected in last 24 hours
- Learning summary updated recently

**PASS/FAIL:** PASS if metrics exist and learning summary updated.

---

## Incident Playbook: Browser Windows Popup Storm

### Symptom

Mac is opening many X/Chrome windows repeatedly. System becomes unusable.

### Immediate Response (Step 1: Emergency Stop)

```bash
# Run comprehensive stop command (kills everything)
pnpm run executor:stop

# This command:
# - Creates STOP switch
# - Kills daemon PID if present
# - Kills chrome-cdp.ts runner processes
# - Kills bot-owned Chromium processes
# - Unloads LaunchAgent if installed
```

**Expected Outcome:** All executor processes stopped within 10 seconds.

**Verification:**
```bash
pnpm run ops:executor:status

# Expected:
# - Daemon: Not running ✅
# - chrome-cdp.ts processes: None running ✅
# - Bot-owned Chromium: None running ✅
```

### Root Cause Investigation (Step 2: Status Check)

```bash
# Check LaunchAgent plist
cat ~/Library/LaunchAgents/com.xbot.executor.plist | grep -E "RUNNER_BROWSER|HEADLESS"

# Expected:
# - HEADLESS=true present ✅
# - RUNNER_BROWSER absent ✅ (if present, this is the root cause)
```

**If `RUNNER_BROWSER=cdp` is present:**
- **Root Cause Identified:** LaunchAgent plist incorrectly configured for CDP mode
- **Fix Required:** Reinstall LaunchAgent service (see Step 3)

**If `RUNNER_BROWSER` is absent but windows still appearing:**
- Check for multiple executor processes: `ps aux | grep executor`
- Check for chrome-cdp.ts processes: `ps aux | grep chrome-cdp.ts`
- Check for old LaunchAgent: `launchctl list | grep xbot`

### Fix and Reinstall (Step 3: Reinstall Service)

```bash
# Uninstall old LaunchAgent
pnpm run executor:uninstall-service

# Reinstall with correct configuration
pnpm run executor:install-service

# Verify plist is correct
cat ~/Library/LaunchAgents/com.xbot.executor.plist | grep -E "RUNNER_BROWSER|HEADLESS"

# Expected:
# - HEADLESS=true ✅
# - RUNNER_BROWSER absent ✅

# Load LaunchAgent
launchctl load -w ~/Library/LaunchAgents/com.xbot.executor.plist
```

**Expected Outcome:** LaunchAgent reinstalled with correct configuration.

### Verification (Step 4: Proof Test)

```bash
# Run 5-minute proof test
pnpm run executor:prove:5m

# Expected: PASS with windows_opened=0 ✅
```

**If proof FAILS:**
- Check daemon logs: `tail -100 ./.runner-profile/logs/executor.log`
- Verify daemon fail-fast guard triggered: `grep "FATAL.*cdp" ./.runner-profile/logs/executor.log`
- Re-check LaunchAgent plist configuration

**If proof PASSES:**
- System is fixed. Executor running headless, no visible windows.

### Prevention Checklist

**Before Starting Executor:**
1. ✅ LaunchAgent plist does NOT contain `RUNNER_BROWSER=cdp`
2. ✅ LaunchAgent plist DOES contain `HEADLESS=true`
3. ✅ No chrome-cdp.ts processes running
4. ✅ Only one executor process (check PID lock)

**After Starting Executor:**
1. ✅ `executor:prove:5m` PASSES with `windows_opened=0`
2. ✅ `ops:executor:status` shows no chrome-cdp.ts processes
3. ✅ Logs confirm headless mode

---

## Service Drift: SHA Verification on Both Railway Services

### Problem

Railway services (`xBOT` and `serene-cat`) can drift if not deployed explicitly. They may run different code versions, causing inconsistent behavior.

### Verification Command

**Preferred method (via /healthz endpoint):**
```bash
# Get local SHA
git rev-parse HEAD

# Get Railway service SHAs via /healthz (fastest, most reliable)
curl -s https://xbot-production-844b.up.railway.app/healthz | jq -r '.sha'
curl -s https://serene-cat-production.up.railway.app/healthz | jq -r '.sha'

# Or via Railway CLI (if /healthz not exposed)
railway run --service xBOT -- node -e "console.log(process.env.RAILWAY_GIT_COMMIT_SHA)"
railway run --service serene-cat -- node -e "console.log(process.env.RAILWAY_GIT_COMMIT_SHA)"

# Fallback: BOOT logs (if /healthz unavailable)
railway logs --service xBOT --lines 10 | grep BOOT | head -1
railway logs --service serene-cat --lines 10 | grep BOOT | head -1
```

**Expected:** All three SHAs match. The `/healthz` endpoint returns `{ sha, serviceName, executionMode, runnerMode }` and is preferred for SHA verification when exposed.

### Resolution: Deploy Both Services Explicitly

```bash
# Deploy both services explicitly
railway up --service xBOT --detach
railway up --service serene-cat --detach

# Or use convenience script
pnpm run deploy:verify:both

# Verify SHAs match after deploy
railway logs --service xBOT --lines 10 | grep BOOT
railway logs --service serene-cat --lines 10 | grep BOOT
```

**Expected:** Both services show matching SHA after deploy.

### Prevention

**Always deploy both services:**
- Use `pnpm run deploy:railway:both` (canonical command, deploys both services)
- Or manually: `railway up --service xBOT --detach && railway up --service serene-cat --detach`
- **Never rely on GitHub deploy alone** (may skip due to CI failures)

**Verify after every deploy:**
- **Preferred:** Use `/healthz` endpoint: `curl -s <service-url>/healthz | jq '.sha'` (fastest, most reliable)
- Or run `pnpm run verify:sha:both` to check SHAs match (uses BOOT logs)
- Or manually: `railway logs --service xBOT --lines 10 | grep BOOT` and `railway logs --service serene-cat --lines 10 | grep BOOT`
- Check both show `EXECUTION_MODE=control` (visible in `/healthz` response as `executionMode`)

---

## What xBOT is

xBOT is an autonomous Twitter/X growth system that:
- Generates high-quality posts + replies (not spammy, not obviously a bot)
- Posts at a sustainable cadence with hard safety limits
- Measures outcomes (views/likes/replies/retweets/follows where possible)
- Learns from performance and improves content strategy over time
- Runs 24/7 with a robust control-plane + a separate execution layer

It is built around:
- A database (Supabase Postgres) that stores everything: plans, decisions, attempts, results, and learning signals
- A control-plane scheduler (Railway) that should be safe/always-on
- A browser automation executor (Mac) because real posting/replying requires a real logged-in browser session

---

## Non-negotiable objectives

### 1) Autonomy
- System should run without manual babysitting.

### 2) Stability + Safety
- Must never lock up the user's computer.
- Must be stoppable instantly.
- Must not create runaway browser windows/tabs/processes.

### 3) Correctness / Observability
- Every major action should be provable via logs + DB events.
- We should always be able to answer: "Is it running? Is it posting? Why not?"

### 4) Growth reality
- Early posts may get low views. Learning must avoid naive "pick the best of 0–15 views."
- We need a strategy that incorporates:
  - prior knowledge from external reference sets (successful accounts / structures)
  - exploration vs exploitation
  - time-of-day/day-of-week effects
  - topic selection + format selection
  - compounding loops (replying + engagement harvesting)

### 5) Cadence goals
User preference (business requirement):
- Posts: not just 2–6/day. Targeting more like ~6–20/day (but with guardrails).
- Replies: potentially ~4/hour (if safe), not "hard sessions only."

However cadence MUST be:
- bounded (max/day)
- adaptable (learned)
- and not spammy (avoid "100 posts/hour")

---

## Key principle: Control-plane vs Executor-plane

### Control-plane (Railway)
- Runs continuously.
- Creates plans, schedules decisions, evaluates candidates, enqueues work.
- MUST NOT attempt real browser posting/replying.
- Should be safe even if it runs 24/7 with no UI.

### Executor-plane (Mac)
- Actually performs browser actions (post/reply) using a real logged-in session.
- Must run safely in the background.
- Must never seize the user's computer.
- Must be stoppable and single-instance.

We implemented `EXECUTION_MODE` to enforce this split.

---

## Current state summary

### What is verified working (historically proven in this project)
- Railway services deploy properly (sometimes required explicit per-service deploy).
- Posting queue "ticks" fire frequently (scheduler running).
- Reply queue "ticks" fire (scheduler running).
- Control-plane guardrails can block execution attempts on Railway when not allowed.

### What became a major issue
- The Mac executor pathway previously created visible Chrome windows / infinite tabs, freezing the laptop.
- That is unacceptable and must be prevented by architecture, not wishful thinking.

### What we moved toward
- A **true headless Mac executor daemon**:
  - no visible windows
  - dedicated userDataDir under RUNNER_PROFILE_DIR
  - strict caps: pages <= 1, launches <= 1/min
  - STOP switch
  - PID lock
  - clean exit if auth is required (no loops)

### Proof-driven approach
- Every stability claim must be validated by an automated proof script (15-minute proof baseline) that outputs PASS/FAIL.

---

## System architecture

### Major components
1) **Scheduler / JobManager**
   - Periodic ticks run posting/reply/learning schedulers.
   - Emits system_events for every tick and block reason.

2) **Database (Supabase Postgres)**
   Stores:
   - planned content decisions (queued)
   - posting attempts + outcomes
   - reply candidates + outcomes
   - learning signals and summaries
   - system_events (ticks, blocked reasons, success/failure)

3) **Services (Railway)**
   - Two services exist historically:
     - `xBOT`
     - `serene-cat`
   - They may run the same codebase but can drift if not deployed explicitly.
   - We must verify SHAs on both services.

4) **Mac Executor Daemon**
   - headless browser automation
   - pulls "ready" queued decisions from DB and executes them
   - reports outcomes back to DB

---

## Core pipelines

### Posting pipeline

High-level:
1) Control-plane identifies post opportunities / content ideas
2) Generates or selects a post
3) Writes a `decision` into DB (queued/scheduled)
4) Executor picks it up when ready
5) Executor attempts post via browser
6) Records success/failure, tweet_id, metadata
7) Metrics collection later updates performance

Key truth:
- Control-plane can tick forever; **only executor can actually post.**

### Reply pipeline

High-level:
1) Control-plane discovers reply opportunities (mentions, replies, targets)
2) Scores / filters candidates
3) Schedules reply decisions into DB
4) Executor performs replies via browser
5) Records success/failure and links back

Key truth:
- Replies require real browser auth; Railway must not do it.

### Learning pipeline

Learning is only meaningful if:
- we track outcomes reliably (views, engagement, follows)
- we have enough volume and enough diversity
- we incorporate a prior (external baseline) so early low-view noise doesn't mislead us

Learning should optimize:
- what to post (topic, format, structure)
- when to post (time/day)
- how often to post (cadence policy)
- when/where to reply (targets, threads, styles)

---

## Execution modes and guardrails

### `EXECUTION_MODE`
- `control`: safe scheduler only (Railway)
- `executor`: allowed to run browser automation (Mac)

### `RUNNER_MODE`
- `true` only when we intend to automate browser actions.

### Guardrail requirements
Executor must enforce:
- single instance lock
- STOP switch
- no visible windows in daemon mode
- no infinite tab creation
- rate limit restarts
- clean auth-required exit

Railway must enforce:
- attempts_started stays 0 in control mode
- emit `*_BLOCKED` events when blocked properly

---

## Services: Railway

### Important fact
Updating one service does NOT automatically update the other unless:
- Railway is configured to deploy both from the same pipeline, OR
- you explicitly deploy each service.

We previously saw drift:
- `xBOT` updated recently
- `serene-cat` showed older deploy timestamps
Then we resolved by explicitly deploying `serene-cat`.

### Required: SHA verification on both services
We rely on boot fingerprints:
- `[BOOT] sha=<SHA> ... railway_service=<name> ...`

And/or `/healthz` endpoints returning fingerprint JSON (if exposed).

---

## Mac Executor: Why it exists and how it must behave

### Why Mac?
Because posting/replying on X requires:
- a real logged-in session
- a browser environment that survives X challenges
- reliable page interactions

Railway typically lacks:
- stable browser environment
- safe UI
- interactive login

### Required behavior
The executor daemon must:
- run headless by default
- never open visible windows
- never touch the user's normal Chrome profile
- use a dedicated `userDataDir` under RUNNER_PROFILE_DIR
- be stoppable instantly
- have strict caps
- emit clear "auth required" signals and stop, not loop

### When headed mode is acceptable
Only for a dedicated manual repair command:
- `executor:auth`
Used only when auth expires or X challenges.

---

## Operational commands

> Note: adjust path/env based on repo location. Default assumes repo root.

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
# Preferred: Use /healthz endpoint (fastest, most reliable)
curl -s https://xbot-production-844b.up.railway.app/healthz | jq '{sha, serviceName, executionMode, runnerMode}'
curl -s https://serene-cat-production.up.railway.app/healthz | jq '{sha, serviceName, executionMode, runnerMode}'

# Or use convenience script (uses BOOT logs)
pnpm run verify:sha:both

# Or manually via BOOT logs:
railway logs --service xBOT --lines 10 | grep BOOT
railway logs --service serene-cat --lines 10 | grep BOOT
```

**Expected:** Both services show matching SHA and `executionMode=control` (visible in `/healthz` response).

**Individual service deploy (if needed):**
```bash
pnpm run deploy:railway:xbot    # Deploy xBOT only
pnpm run deploy:railway:serene  # Deploy serene-cat only
```

### Control-plane expected signals
In control mode:
- ticks continue
- execution attempts remain blocked
- system emits "blocked reason" events

### Mac executor (daemon)
Canonical environment:
- `RUNNER_PROFILE_DIR=./.runner-profile`

Start daemon:
- `EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:daemon`

Stop daemon:
- `pnpm run executor:stop` (comprehensive stop: kills daemon, chrome-cdp.ts, Chromium processes, unloads LaunchAgent)

Status:
- `pnpm run ops:executor:status` (shows LaunchAgent status, daemon PID, chrome-cdp.ts processes, Chromium count, last 20 log lines)

Auth repair (headed, allowed to open window):
- `RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:auth`

---

## Verification and proof strategy

We don't "hope" things work. We prove them.

### Proof levels

#### Level 0: Deploy consistency
- Both Railway services show the same boot SHA.

#### Level 1: Control-plane integrity
- POSTING_QUEUE_TICK and REPLY_QUEUE_TICK events exist frequently
- Attempts started = 0 on Railway in control mode
- Block reasons emitted correctly

#### Level 2: Executor stability (critical)
Must PASS:
- windows_opened = 0
- headless = true
- pages_max <= 1
- browser_launches <= 1 (or <= 1/min)
- STOP switch exits <= 10 seconds
- no UI disruption

We use automated proof tests that print PASS/FAIL and write reports:
- `executor:prove:5m` → `docs/EXECUTOR_5MIN_HEADLESS_PROOF.md` (5-minute proof)
- `executor:prove:15m` → `docs/EXECUTOR_15MIN_HEADLESS_PROOF.md` (15-minute proof)

#### Level 3: Execution proof (posting/replies)
- Show attempts started > 0 on Mac executor
- Show POST_SUCCESS events occurring
- Confirm tweet URLs reachable
- Confirm no runaway loops

#### Level 4: Learning proof
- Metrics collected and written back
- Learning summary updated periodically
- Evidence that exploration/exploitation decisions change over time

---

## Troubleshooting

### Symptom: "Browser windows keep opening / tabs infinite"
Cause:
- You are not actually running the headless daemon, OR
- an old LaunchAgent / old command is auto-restarting, OR
- a headed CDP connector script is still running, OR
- multiple executors are running simultaneously.

Required response:
1) STOP switch immediately:
   - `pnpm run executor:stop` (comprehensive stop)
2) Verify everything stopped:
   - `pnpm run ops:executor:status`
3) Check LaunchAgent plist:
   - `cat ~/Library/LaunchAgents/com.xbot.executor.plist | grep RUNNER_BROWSER`
   - If `RUNNER_BROWSER=cdp` present, reinstall service (see Incident Playbook)
4) Only then restart with the correct `executor:daemon`.

### Symptom: "Headless proof FAIL: stop_switch_seconds=999"
Cause:
- proof script did not observe daemon exiting quickly after STOP switch.
Common reasons:
- daemon sleep not interruptible
- STOP is only checked between long operations
- STOP file path mismatch (wrong RUNNER_PROFILE_DIR)

Fix requirement:
- STOP must be checked:
  - before/after each queue tick
  - during backoff sleep (sleep in 1s increments)
  - at top-level loop

### Symptom: "Not posting even though decisions exist"
Possible causes:
- Executor not running
- Executor blocked by auth
- X challenge/login wall
- Candidate selection yields 0 attempts (filters too strict)
- DB readiness windows wrong

Required evidence:
- DB shows `posting_ready > 0`
- Executor emits attempt start + outcome events

---

## Roadmap: What's built vs what's left

### Built / in place (system foundations)
- Railway control-plane scheduler ticking (posting + reply tick events exist historically)
- Two-service deployment + SHA verification approach
- EXECUTION_MODE split control vs executor
- Extensive docs pack created:
  - README_MASTER.md (canonical), ARCHITECTURE/RUNBOOK/STATUS/DECISION_LOG/TOC/TODO

### Built but must be proven stable
- Mac executor daemon + 5-minute/15-minute proof scripts
- STOP switch + PID lock + caps + headless-by-default architecture
- Comprehensive stop command + enhanced status command
- Fail-fast guards preventing CDP mode in daemon

### Still missing / needs design hardening
#### 1) True "Twitter expert brain" learning loop
We need:
- strong priors from external reference sets
- robust metrics normalization
- exploration strategy
- time-based seasonality tracking
- content taxonomy and outcome attribution

#### 2) Cadence policy that learns safely
Instead of hard-coded "6–20 always" or "2–6 always," we need:
- min/day + max/day safety bounds
- dynamic target based on performance, stability, and account trust
- ramp schedule: start lower, scale up when quality & metrics validate

#### 3) Reply scale strategy without spam
We need:
- targeting rules (which accounts/threads)
- diversity of reply styles
- cooldowns to avoid bot-like cadence
- "conversation graph" rules (not replying to everyone nonstop)

#### 4) Robust "auth required" + recovery workflow
- daemon exits cleanly if auth fails
- emits a DB/system event to alert
- requires manual `executor:auth` repair
- resumes afterwards automatically

---

## Quality + anti-bot constraints

We must avoid:
- repetitive templates
- too-high frequency bursts
- replying to everything like a machine
- posting without real value or unique angle

We must build:
- content originality constraints (semantic dedupe, topic rotation)
- style variation
- evidence-based claims (avoid hallucination)
- "human-like" pacing constraints (even if high volume, avoid robotic intervals)

---

## Glossary

- **Decision**: a planned post/reply item inserted into DB, waiting to execute
- **Attempt**: an execution trial to post/reply; success/failure recorded
- **Tick event**: periodic scheduler run event (e.g., POSTING_QUEUE_TICK)
- **Control-plane**: scheduling/decision-making (Railway)
- **Executor-plane**: browser automation performing actions (Mac)
- **EXECUTION_MODE**: control vs executor
- **RUNNER_PROFILE_DIR**: dedicated storage directory for executor browser profile, locks, logs, STOP switch

---

## Final note: How we work going forward (process discipline)

1) No more "trust me it works." Everything has a proof command + PASS/FAIL.
2) If a change affects runtime behavior, we update:
   - README_MASTER.md (canonical)
   - ARCHITECTURE
   - RUNBOOK
   - STATUS snapshot
3) Any daemon must:
   - never seize the user's computer
   - have STOP switch and single-instance enforcement
   - run headless by default
   - fail-fast if CDP mode detected
4) Cadence is a learned policy bounded by safety rails, not pure hardcode.
5) LaunchAgent plist must NEVER contain `RUNNER_BROWSER=cdp` (enforced by install script and daemon fail-fast guard).

---
