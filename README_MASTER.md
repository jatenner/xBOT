# xBOT — Master README (Single Source of Truth) v2

> Purpose: This document is the complete, end-to-end description of the xBOT system, including architecture, runtime roles, Mac executor vs Railway control-plane, posting/reply pipelines, observability/proofs, and operational commands.
>
> If a new AI agent reads only ONE document, it should be this one.
>
> **Version:** v2 (enforcement-grade, incident-hardened)  
> **Last Verified:** 2026-01-24  
> **Critical Fixes:** a89a4c31 (executor stop/status/proof), 0c52898e (README_MASTER.md creation)
>
> **📊 Operational Status:** See [`docs/SYSTEM_STATUS.md`](docs/SYSTEM_STATUS.md) for single source of truth on what's proven, unproven, and how to verify each component.

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
- `executor:prove:e2e-post` → `scripts/executor/prove-e2e-post.ts` ✅
- `executor:prove:e2e-reply` → `scripts/executor/prove-e2e-reply.ts` ✅
- `executor:prove:e2e-control-post` → `scripts/executor/prove-e2e-control-to-post.ts` ✅
- `executor:prove:e2e-control-reply` → `scripts/executor/prove-e2e-control-to-reply.ts` ✅
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

### Step 2: Cookie Auth Mode (Alternative to Profile Auth)

**Cookie Auth Mode** uses cookies from `TWITTER_SESSION_B64` instead of a persistent Chrome profile. This is useful for:
- Control-plane (Railway) services that need cookie-based auth
- Quick cookie refresh workflows
- Testing cookie lifetime without maintaining a profile

#### How to Refresh Cookies

1. **Export cookies** from your browser (using a cookie export extension or Playwright)
2. **Save cookies** to `.runner-profile/cookies_input.json` in Playwright format:
   ```json
   {
     "cookies": [
       {
         "name": "auth_token",
         "value": "...",
         "domain": ".x.com",
         "path": "/",
         "expires": -1,
         "httpOnly": true,
         "secure": true,
         "sameSite": "None"
       }
     ]
   }
   ```
3. **Run update command:**
   ```bash
   pnpm run ops:update:cookies
   ```
   This will:
   - Read cookies from `.runner-profile/cookies_input.json` (or `COOKIE_INPUT_PATH`)
   - Normalize and duplicate for both `.x.com` and `.twitter.com` domains
   - Encode to B64 and update `.env.local` with `TWITTER_SESSION_B64`
   - Verify auth with `executor:prove:auth-b64-readwrite`
   - Create/update `AUTH_OK.json` marker with `cookie_auth_mode=true`

#### How to Prove Auth Works

**Quick proof (read/write access):**
```bash
TWITTER_SESSION_B64=<b64> pnpm run executor:prove:auth-b64-readwrite
```

**Persistence proof (measure cookie lifetime):**
```bash
PROOF_DURATION_MINUTES=30 TWITTER_SESSION_B64=<b64> pnpm run executor:prove:auth-b64-persistence
```

**What PASS means:**
- ✅ No login redirects for full duration
- ✅ No challenge URLs detected
- ✅ Logged-in state verified every 60 seconds
- ✅ Report written to `docs/proofs/auth/b64-auth-persistence-<ts>.md`

**What FAIL means:**
- ❌ Login redirect detected → cookies expired/invalid
- ❌ Challenge detected → X.com verification required (manual intervention)
- ❌ Consent wall → should be auto-dismissed, but may need retry
- Check report for failure fingerprint and screenshot

#### How to Bring System Up (Cookie Auth Mode)

```bash
COOKIE_AUTH_MODE=true SOAK_MINUTES=20 pnpm run ops:up:fast
```

This will:
1. ✅ Preflight: OpenAI drift/validation
2. ✅ Run `executor:prove:auth-b64-readwrite` (verify cookies work)
3. ✅ Run `executor:prove:auth-b64-persistence` for `SOAK_MINUTES` (measure lifetime)
4. ✅ Output: `OPS_UP_FAST=PASS minutes_ok=<n>` or `OPS_UP_FAST=FAIL reason=<classification>`

**Note:** Cookie auth mode skips daemon start (executor uses profile auth). Use this for control-plane verification only.

#### Gate Proofs (Cookie Auth)

**Two-gate proof sequence** for comprehensive cookie auth verification:

**Gate 1: 60-Minute Persistence Proof**
```bash
PROOF_DURATION_MINUTES=60 pnpm run executor:prove:auth-b64-persistence
```

**What PASS means:**
- ✅ Auth persisted for full 60 minutes
- ✅ No login redirects detected
- ✅ No challenge URLs detected
- ✅ Logged-in state verified every 60 seconds
- ✅ Report written to `docs/proofs/auth/b64-auth-persistence-<ts>.md`

**What FAIL means:**
- ❌ Login redirect detected → cookies expired/invalid
- ❌ Challenge detected → X.com verification required (manual intervention)
- ❌ Consent wall → check report for details
- **Action:** Check report for failure classification, screenshot paths, and exact failure minute

**If Gate 1 FAILS:** Stop here. Check the persistence report for failure classification and screenshot paths. Cookies may need to be refreshed.

**Gate 2: System Bring-Up with Execution Proof** (only if Gate 1 PASSES)
```bash
COOKIE_AUTH_MODE=true REQUIRE_EXECUTION_PROOF=true SOAK_MINUTES=20 pnpm run ops:up:fast
```

**What PASS means:**
- ✅ All preflight checks passed (OpenAI drift/validation)
- ✅ B64 auth readwrite proof passed
- ✅ B64 auth persistence proof passed (20 minutes)
- ✅ Execution proof passed (real reply posted)
- ✅ Reply URL available in execution ledger
- ✅ Output: `OPS_UP_FAST=PASS minutes_ok=<n>`

**What FAIL means:**
- ❌ Preflight failed → check OpenAI key sync
- ❌ Auth readwrite failed → cookies invalid
- ❌ Auth persistence failed → cookies expired during soak
- ❌ Execution proof failed → check execution ledger for classification
- **Action:** Check execution ledger (`docs/proofs/execution/execution-ledger.jsonl`) for latest entry with failure classification and report path

**Execution Ledger Entry Format:**
- `ts` - Timestamp
- `proof_type` - "e2e-control-reply" or "e2e-control-post"
- `target_tweet_id` - Tweet ID used for proof
- `decision_id` - Decision UUID
- `passed` - true/false
- `failure_classification` - Classification if failed
- `reply_url` - Reply URL if successful (for replies)
- `tweet_url` - Tweet URL if successful (for posts)
- `time_to_success_seconds` - Time to complete
- `report_path` - Path to proof report

**Quick Gate Proofs Command:**
```bash
pnpm run ops:gate:proofs
```

This runs both gates sequentially and reports final verdict with artifacts.

#### Auth Persistence (Cookie Mode) — Current Status

**Latest Findings (2026-02-03):**

Auth persistence investigation is in progress with forensics instrumentation added to capture root cause of auth flips around ~29 minutes.

**How to Run Persistence Matrix:**

```bash
# Run controlled matrix (A: 60s, B: 180s+jitter, C: 300s+jitter)
pnpm run ops:auth:persistence:matrix
```

This runs 3 variants back-to-back (stops on first PASS):
- **Variant A:** 60s ticks, no jitter (baseline)
- **Variant B:** 180s ticks, ±20% jitter (human-ish)
- **Variant C:** 300s ticks, ±20% jitter (more human)

**Artifacts:**
- Reports: `docs/proofs/auth/b64-auth-persistence-<ts>.md`
- Forensics snapshots: `docs/proofs/auth/b64-auth-flip-snapshot-<reason>-<ts>.json`
- Screenshots: `docs/proofs/auth/b64-auth-persistence-fail-<reason>-<ts>.png`
- Matrix results: `docs/proofs/auth/auth-persistence-matrix.jsonl`
- Root cause analysis: `docs/proofs/auth/AUTH_PERSISTENCE_ROOT_CAUSE.md` (generated after matrix)

**What PASS Means:**
- ✅ Auth persisted for full 60 minutes
- ✅ No login_redirect events
- ✅ No challenge_suspected events
- ✅ Forensics show cookies stable throughout

**What FAIL Means:**
- ❌ Check `AUTH_PERSISTENCE_ROOT_CAUSE.md` for determination:
  - **EXPIRY/ROTATION:** Cookies expired/rotated → implement refresh strategy
  - **REVOCATION_BY_PATTERN:** Pattern detection → adjust cadence/jitter, stop aggressive polling
  - **COOKIE_ONLY_INSUFFICIENT:** Cookies present but auth fails → migrate to storageState/persistent profile

**Status Commands:**
```bash
# Check latest persistence report
pnpm run ops:gate:status

# Analyze matrix results and generate root cause
tsx scripts/ops/analyze-auth-persistence-root-cause.ts
```

**Next Action if FAIL:**
Based on determination in `AUTH_PERSISTENCE_ROOT_CAUSE.md`:
1. If EXPIRY/ROTATION: Implement cookie refresh or migrate to storageState
2. If REVOCATION_BY_PATTERN: Adjust daemon cadence to 180s+ with jitter
3. If COOKIE_ONLY_INSUFFICIENT: Migrate to Playwright storageState or persistent userDataDir

### Step 3: Verify Mac Executor Status (30 seconds)

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
- Proof scripts validate `chrome_cdp_processes=0` [HARD ASSERTION]

**Rule 5: install-service.sh Must Guard Against RUNNER_BROWSER=cdp**

**Enforcement:**
- `scripts/executor/install-service.sh` checks existing plist for `RUNNER_BROWSER=cdp`
- If found, installation aborts unless `FORCE_INSTALL=true`
- Prevents accidental CDP mode installation

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
1. ✅ `executor:prove:5m` PASSES with all hard assertions (windows_opened=0, chrome_cdp_processes=0, etc.)
2. ✅ `ops:executor:status` shows no chrome-cdp.ts processes
3. ✅ Logs show "BOOT: headless=true" and "chromium.launch() mode (NOT connectOverCDP)"
4. ✅ STOP switch exits within 10 seconds (validated by proof scripts)

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
- `windows_opened=0` ✅ (no visible windows) [HARD]
- `headless=true` ✅ (always headless) [HARD]
- `pages_max<=1` ✅ (max 1 page) [HARD]
- `browser_launches<=1` ✅ (max 1 launch per minute) [HARD]
- `chrome_cdp_processes=0` ✅ (no CDP processes) [HARD]
- `stop_switch_seconds<=10` ✅ (STOP switch works) [HARD]
- `db_connected=true` ✅
- `queues_readable=true` ✅

**PASS/FAIL:** PASS only if ALL hard assertions pass. FAIL if any hard assertion fails.

**Report Location:** `docs/EXECUTOR_5MIN_HEADLESS_PROOF.md` (created by proof script)

**Extended Proof (15 minutes):**
```bash
pnpm run executor:prove:15m
```

**Same acceptance criteria as 5-minute proof, but validates stability over longer duration.**

**Report Location:** `docs/EXECUTOR_15MIN_HEADLESS_PROOF.md` (created by proof script)

### Proof Level 3: Execution Proof (Posting/Replies)

**Posting E2E Proof:**
```bash
# End-to-end posting proof (seeds decision, runs executor, verifies execution)
pnpm run executor:prove:e2e-post
```

**Acceptance Criteria (Posting E2E Proof):**
- `decision_queued=true` ✅ (decision inserted)
- `decision_claimed=true` ✅ (executor claimed decision)
- `attempt_recorded=true` ✅ (attempt recorded in outcomes)
- `result_recorded=true` ✅ (result recorded)
- `post_success_event=true` OR `post_failed_event=true` ✅ (event emitted)

**PASS/FAIL:** PASS only if ALL checks pass. FAIL if any check fails.

**Report Location:** `docs/EXECUTION_E2E_POST_PROOF.md` (created by proof script)

**Reply E2E Proof:**
```bash
# End-to-end reply proof (seeds ONE reply decision, runs executor, verifies execution)
# TARGET_TWEET_ID is REQUIRED (must be valid numeric tweet ID >= 15 digits)
TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-reply

# DRY_RUN mode: seed decision only, no execution (safe for testing)
DRY_RUN=true TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-reply
```

**How to extract tweet ID from URL:**
- URL: `https://x.com/username/status/1234567890123456789`
- Extract: `1234567890123456789` (the number after `/status/`)

**Requirements:**
- `TARGET_TWEET_ID`: Required environment variable, must be numeric string with >= 15 digits
- Script fails fast if `TARGET_TWEET_ID` is missing or invalid
- `DRY_RUN=true`: Optional, seeds decision but does not start daemon or attempt reply

**Acceptance Criteria (Reply E2E Proof - HARD ASSERTIONS):**
- `reply_decision_queued=true` ✅ (reply decision inserted)
- `reply_decision_claimed=true` ✅ (executor claimed reply decision)
- `reply_attempt_recorded=true` ✅ (attempt recorded in outcomes)
- `reply_result_recorded=true` ✅ (result recorded)
- `reply_success_event=true` OR `reply_failed_event=true` ✅ (event emitted)
- `reply_count=1` ✅ (exactly ONE reply attempt) [HARD]
- `windows_opened=0` ✅ (no visible windows) [HARD]
- `chrome_cdp_processes=0` ✅ (no CDP processes) [HARD]
- `pages_max<=1` ✅ (max 1 page) [HARD]

**PASS/FAIL:** PASS only if ALL checks pass (including executor safety invariants). FAIL if any check fails.

**Report Location:** `docs/EXECUTION_E2E_REPLY_PROOF.md` (created by proof script)
- Includes: `decision_id`, `target_tweet_id`, `proof_tag`, `reply_url` (if available)
- DRY_RUN reports are clearly marked

**Important:** Replies are proven one-at-a-time before scale. The reply proof validates:
1. Single reply decision execution (no spam/loops)
2. Executor safety invariants remain true during reply execution
3. Proper event emission (REPLY_SUCCESS or REPLY_FAILED)
4. Reply URL extraction from event_data or outcomes.result (best effort)

**Manual Checks (Alternative):**
```bash
tail -100 ./.runner-profile/logs/executor.log | grep "posting_attempts\|reply_attempts"
railway logs --service xBOT --lines 200 | grep "POST_SUCCESS\|REPLY_SUCCESS" | tail -5
```

### Proof Regression Gate (CI)

**Automated Regression Testing:**
- **PRs and pushes to main:** Run Level 4 proofs in DRY_RUN mode (safe, no Twitter side effects)
- **Real execution:** Manual trigger via GitHub Actions workflow_dispatch only
- **Local testing:** `pnpm run proof:regression` (runs both proofs in DRY_RUN)

**Documentation Rules:**
- Docs marked PROVEN only when proof report exists with `https://x.com/` URL
- See [`docs/SYSTEM_STATUS.md`](docs/SYSTEM_STATUS.md) for full regression gate details

### Proof Level 4: Control → Executor → X (Full Pipeline)

**Status:**
- **POSTING:** ✅ PROVEN — `control-post-1769385308714`  
  Evidence: [`docs/proofs/control-post/control-post-1769385308714.md`](docs/proofs/control-post/control-post-1769385308714.md)  
  Tweet: `https://x.com/Signal_Synapse/status/2015574485135487461`

- **REPLY:** ✅ PROVEN — [`docs/proofs/control-reply/control-reply-1769440472369.md`](docs/proofs/control-reply/control-reply-1769440472369.md) — Reply: `https://x.com/Signal_Synapse/status/2015805866801295663`

### Phase 4 Completion Summary

**Status:** ✅ **COMPLETE & STABLE**

Phase 4 (Control → Executor → X) is formally complete. The full pipeline from control-plane decision creation through executor execution to verified result URLs is proven and stable.

**What is Proven:**
- Level 4 POST — Full pipeline proven with immutable evidence (see proof reference above)
- Level 4 REPLY — Full pipeline proven with immutable evidence (see proof reference above)

**Stability Commitment:**
- No further executor or proof changes should be made unless a regression is detected
- All PROVEN claims reference immutable proof files under `docs/proofs/control-post/` and `docs/proofs/control-reply/`
- CI enforces verification via `verify:docs:truth`

See [`docs/SYSTEM_STATUS.md`](docs/SYSTEM_STATUS.md) for complete Phase 4 completion details.

**Posting Pipeline Proof:**
```bash
# DRY_RUN (safe, no posting)
pnpm run executor:prove:e2e-control-post

# Real execution (requires explicit opt-in)
EXECUTE_REAL_ACTION=true pnpm run executor:prove:e2e-control-post
```

**What It Proves:**
1. Control-plane creates exactly ONE posting decision (mimics posting queue scheduler)
2. Decision enters `queued` state with correct `pipeline_source`
3. Executor daemon claims decision (`queued → posting`)
4. Executor executes posting attempt
5. Outcome recorded (success or failure)
6. Event emitted (`POST_SUCCESS` or `POST_FAILED`)
7. Result URL captured (if successful)

**PASS Criteria (HARD ASSERTIONS):**
- `exactly_one_decision=1` ✅ [HARD]
- `exactly_one_attempt=1` ✅ [HARD]
- `outcome_recorded=true` ✅
- `success_or_failure_event_present=true` ✅
- `windows_opened=0` ✅ [HARD]
- `chrome_cdp_processes=0` ✅ [HARD]
- `pages_max<=1` ✅ [HARD]
- `result_url_captured=true` (if successful) ✅

**Report Location:** `docs/CONTROL_TO_POST_PROOF.md` (created by proof script)

**✅ Status:** PROVEN — `control-post-1769385308714`  
Evidence: [`docs/proofs/control-post/control-post-1769385308714.md`](docs/proofs/control-post/control-post-1769385308714.md)  
Tweet: `https://x.com/Signal_Synapse/status/2015574485135487461`

**Note:** Older Attempt (2026-01-24): FAILED (historical) — Real execution attempt failed. Decision created and claimed, but posting attempt timed out after 180s. No attempt recorded in outcomes, no POST_SUCCESS/POST_FAILED event emitted. Root cause: Playwright posting operation timed out. See `docs/CONTROL_TO_POST_PROOF.md` for full details.  
**Current Status:** ✅ PROVEN via `control-post-1769385308714`

**Reply Pipeline Proof:**
```bash
# DRY_RUN (safe, no replying)
TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-control-reply

# Real execution (requires explicit opt-in)
EXECUTE_REAL_ACTION=true TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-control-reply
```

**What It Proves:**
1. Control-plane creates exactly ONE reply decision (mimics reply scheduler)
2. Decision enters `queued` state with correct `pipeline_source`
3. Executor daemon claims decision (`queued → replying`)
4. Executor executes reply attempt
5. Outcome recorded (success or failure)
6. Event emitted (`REPLY_SUCCESS` or `REPLY_FAILED`)
7. Result URL captured (if successful)

**PASS Criteria (HARD ASSERTIONS):**
- `exactly_one_decision=1` ✅ [HARD]
- `exactly_one_attempt=1` ✅ [HARD]
- `outcome_recorded=true` ✅
- `success_or_failure_event_present=true` ✅
- `windows_opened=0` ✅ [HARD]
- `chrome_cdp_processes=0` ✅ [HARD]
- `pages_max<=1` ✅ [HARD]
- `result_url_captured=true` (if successful) ✅

**Report Location:** `docs/CONTROL_TO_REPLY_PROOF.md` (created by proof script)

**✅ Status:** PROVEN — `control-reply-1769440472369`  
Evidence: [`docs/proofs/control-reply/control-reply-1769440472369.md`](docs/proofs/control-reply/control-reply-1769440472369.md)  
Reply: `https://x.com/Signal_Synapse/status/2015805866801295663`

**Note:** Older Attempt (2026-01-24): FAILED (historical) — Real execution attempt failed. Decision created but never claimed within 5-minute timeout. Decision status remained "queued". Root cause: Executor did not process the decision within timeout period. See `docs/CONTROL_TO_REPLY_PROOF.md` for full details.  
**Current Status:** ✅ PROVEN via `control-reply-1769440472369`

**Safety Gating:**
- **Default:** DRY_RUN mode (seeds decision, validates flow, but does NOT post/reply)
- **EXECUTE_REAL_ACTION=true:** Required to actually post/reply on X
- **TARGET_TWEET_ID:** Required for reply proofs (must be valid numeric >= 15 digits)

**Important:** Proof Level 4 validates the complete control→executor→X pipeline, proving that:
1. Control-plane schedulers create decisions correctly
2. Executor claims and executes them reliably
3. Results are captured and verifiable
4. Executor safety invariants remain true throughout

### Proof Level 5: Learning Proof

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

### Official Deploy Mechanism: Railway GitHub Integration + Wait for CI

Railway automatically deploys from `main` branch when GitHub Actions checks pass. Both services (`xBOT` and `serene-cat`) have "Wait for CI" enabled, ensuring deployments only occur when CI is green.

**How it works:**
1. Push to `main` branch
2. GitHub Actions runs required checks (`deploy-gate.yml`, `growth-gate.yml`)
3. When checks pass, Railway GitHub Integration automatically deploys both services
4. Both services run the same SHA (ensured by Railway's GitHub integration)

**Manual/Emergency Deploy (CLI):**
CLI deployment via `pnpm run deploy:railway:both` is for emergency manual deployments only. Railway GitHub Integration is the canonical deployment mechanism.

**If Railway deploy is SKIPPED due to CI failure:**
1. Run manual deploy: `pnpm run deploy:railway:both`
2. If unauthorized, run: `railway login --browserless` (follow prompts)
3. Verify SHA match: `pnpm run verify:sha:both`
4. Both services must show matching SHA and `executionMode=control`

```bash
# Emergency manual deploy (only if Railway GitHub Integration fails)
pnpm run deploy:railway:xbot    # Deploy xBOT only
pnpm run deploy:railway:serene  # Deploy serene-cat only
pnpm run deploy:railway:both    # Deploy both services
```

**SHA verification (after deploy):**
```bash
# Preferred: Use /healthz endpoint (fastest, most reliable)
pnpm run verify:sha:both

# Or manually via curl:
curl -s "https://xbot-production-844b.up.railway.app/healthz?ts=$(date +%s)" | jq '{sha, serviceName, executionMode, runnerMode}'
curl -s "https://serene-cat-production.up.railway.app/healthz?ts=$(date +%s)" | jq '{sha, serviceName, executionMode, runnerMode}'
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

## Phase 5 — System Evolution (PLANNED)

**Status:** ⚠️ **PLANNED / NOT IMPLEMENTED**

This section describes potential future work. None of this is implemented, proven, or committed. These are conceptual placeholders for planning purposes only.

### Phase 5A — Reliability & Production Hardening

**Status:** 🚧 **IN PROGRESS**

This phase focuses on operational stability, predictability, and observability for production deployment.

#### Phase 5A.1: Executor Health & Liveness — ✅ PROVEN

**Status:** ✅ **PROVEN**

Executor health and liveness signals are working correctly. Health events (BOOT, READY, TICK, HEALTH_OK) are emitted deterministically and observable via system_events.

**Evidence:** [`docs/proofs/health/health-1769357503409.md`](docs/proofs/health/health-1769357503409.md)

#### Phase 5A.2: Rate Limit Awareness + Circuit Breaker Observability — ✅ PROVEN

**Status:** ✅ **PROVEN**

Rate limit detection, active heartbeats, bypass events, and clearing are working correctly. Structured events (`EXECUTOR_RATE_LIMIT_DETECTED`, `EXECUTOR_RATE_LIMIT_ACTIVE`, `EXECUTOR_RATE_LIMIT_CLEARED`, `EXECUTOR_RATE_LIMIT_BYPASS`) are emitted deterministically and observable via system_events.

**Proof Tag:** `rate-limit-1769375487279`  
**Evidence:** [`docs/proofs/rate-limit/rate-limit-1769375487279.md`](docs/proofs/rate-limit/rate-limit-1769375487279.md)

- Detected Event ID: `ecf6d0b4-ebaf-4e9b-b2eb-d0947bab109d`
- Active Event IDs: `37a0ca72-789f-4e11-a472-a061170c849f`, `a51b8491-4bb6-4874-ae44-1cf53e420185`
- Cleared Event ID: `1628aa97-763a-4bc2-a790-71ef68390a39`

#### Phase 5A.3: Long-Running Executor Stability — ✅ PROVEN

**Status:** ✅ **PROVEN**

Proves executor can run continuously without degradation over extended periods (default: 30 minutes). Validates continuous health event emission, absence of crashes, and stable operation.

**Proof Tag:** `stability-1769467679448`  
**Evidence:** [`docs/proofs/stability/stability-1769467679448.md`](docs/proofs/stability/stability-1769467679448.md)

- Boot Event ID: `625ff7d4-6a35-439b-bb86-a934deb86e8e`
- Ready Event ID: `ede4634e-39fc-4c2e-a6b9-5086fbe3a348`
- Health OK Events: 30
- Duration: 30 minutes

**Requirements:**
- EXECUTOR_HEALTH_BOOT seen within 20s
- EXECUTOR_HEALTH_READY seen within 90s
- ≥1 EXECUTOR_HEALTH_OK every 60s (no gaps >90s)
- No EXECUTOR_DAEMON_CRASH events
- No browser pool exhaustion
- Duration completed successfully

**Proof Script:** `pnpm run executor:prove:long-run-stability`  
**Custom Duration:** `PROOF_DURATION_MINUTES=60 pnpm run executor:prove:long-run-stability`

**Operator Runbook:**

1. **Stop executor first** (if running):
   ```bash
   pnpm run executor:stop
   ```

2. **Run proof** (default 30 minutes):
   ```bash
   pnpm run executor:prove:long-run-stability
   ```
   
   Or with custom duration (60 minutes):
   ```bash
   PROOF_DURATION_MINUTES=60 pnpm run executor:prove:long-run-stability
   ```

#### Phase 5A.4: Stability Under Real Load (2 hours) — ✅ PROVEN

**Status:** ✅ **PROVEN**

Proves executor can run continuously for 2 hours under real workload conditions without degradation. Validates continuous health event emission, absence of crashes, browser pool stability, and actual pipeline progress (workload processing).

**Claim:** Executor maintains stability and processes workload over extended 2-hour period under real production-like conditions.

**Proof Tag:** `stability-1769538319189`  
**Evidence:** [`docs/proofs/stability/stability-1769538319189.md`](docs/proofs/stability/stability-1769538319189.md)

- Boot Event ID: `05f4bbab-1596-4f11-9b0d-e0639d722564`
- Ready Event ID: `0412c6eb-afe1-473b-9f09-d5f583428f3b`
- Health OK Events: 119
- Max Gap: 60.0s
- Duration: 120 minutes
- Workload Progress: 3 transitions (`aa05774f-e0fd-494c-8ea1-48e91b8df55a`, `f8397f00-db0c-4844-9f50-2d2c370bbb97`, `888061ef-c4cf-4027-8fee-aafe086b1450`)

**Acceptance Criteria:**
- EXECUTOR_HEALTH_BOOT seen within 20s
- EXECUTOR_HEALTH_READY seen within 90s
- ≥1 EXECUTOR_HEALTH_OK every 60s (no gaps >90s)
- No EXECUTOR_DAEMON_CRASH events
- No browser pool exhaustion indicators
- At least one unit of pipeline progress observed (content_metadata status transition from `queued` → `posted` OR `queued` → `posting` during proof period)
- Duration completed successfully (2 hours)

**Proof Script:** `pnpm run executor:prove:stability-real-load`

**Operator Runbook:**

1. **Stop executor first** (if running):
   ```bash
   pnpm run executor:stop
   ```

2. **Run proof** (2 hours):
   ```bash
   pnpm run executor:prove:stability-real-load
   ```

#### Phase 5A.5: STOP Switch Under Real Load — ✅ PROVEN

**Status:** ✅ **PROVEN**

Proves that the STOP switch halts the executor safely under real load, with bounded shutdown time and no state corruption. Validates graceful completion of in-flight operations, no new posts after STOP observed, and clean exit.

**Proof Tag:** `stop-switch-1769549639527`  
**Evidence:** [`docs/proofs/stability/stop-switch-1769549639527.md`](docs/proofs/stability/stop-switch-1769549639527.md)

- Stop Trigger Time: `2026-01-27T21:34:17.758Z`
- Stop Observed Latency: 1.0s
- Shutdown Completion Latency: 100.8s
- Decisions In Progress (before STOP): 10
- No New Posts After STOP: ✅ (0 new posts)
- No Duplicate Posts: ✅
- Clean Exit: ✅ (exit code 0)

**Acceptance Criteria:**
- STOP observed latency: Daemon detects STOP within ≤10 seconds of file creation
- Shutdown completion latency: Daemon exits cleanly within ≤300 seconds of STOP trigger
- No new posts after STOP observed (only posts that were NOT already in progress)
- No duplicate posts for the same decision
- Clean exit (exit code 0)

**Proof Script:** `pnpm run executor:prove:stop-switch-under-load`

**Remaining Phase 5A Items (Planned):**

#### 5A.1 Goals

**Why Phase 5A exists:**

- **Operational stability:** Ensure executor runs reliably for extended periods without degradation or crashes
- **Predictability:** Make system behavior deterministic and observable under various failure modes (rate limits, network issues, auth challenges)
- **Observability:** Provide clear signals for diagnosing issues, understanding system state, and making operational decisions
- **Production readiness:** Bridge the gap between proof-of-concept (Phase 4) and production-grade reliability

#### 5A.2 In-Scope Items (Planned)

**What would be built in Phase 5A (examples, non-binding):**

1. **Rate limit awareness & adaptive scheduling:**
   - Detect rate limit responses (HTTP 429) from X platform
   - Track rate limit windows and remaining capacity
   - Adjust decision scheduling to respect rate limits proactively
   - Emit observable events when rate limits are encountered or cleared

2. **Backoff strategy observability:**
   - Log and emit events for all retry decisions (when, why, duration)
   - Track backoff durations and escalation patterns
   - Make failure recovery paths visible in system_events and logs
   - Provide metrics on retry success rates

3. **Executor health metrics:**
   - Browser pool saturation signals (available vs. in-use browsers)
   - Decision processing rates (decisions claimed/sec, attempts/sec)
   - Error rates by category (rate limit, timeout, auth failure, etc.)
   - Resource usage metrics (memory, CPU, browser instances)

4. **Browser pool saturation signals:**
   - Emit events when browser pool is exhausted
   - Track wait times for browser availability
   - Provide visibility into browser pool bottlenecks

5. **Long-running executor stability:**
   - Extended stability proofs (beyond 15 minutes) to detect memory leaks
   - Graceful degradation when resources are constrained
   - Automatic recovery from transient failures

**Note:** These are planning concepts only. No implementation exists.

#### 5A.3 Out-of-Scope (Explicit)

**What is NOT part of Phase 5A:**

- **Learning logic:** Content strategy, engagement analysis, or outcome-driven learning loops (Phase 5B)
- **Multi-executor coordination:** Scaling across multiple executor instances (Phase 5C)
- **Content generation changes:** Modifications to AI content generation or posting strategies
- **New posting/reply features:** Adding new types of actions or capabilities
- **Database schema changes:** Major schema modifications (minor additions for observability may be in-scope)

#### 5A.4 Success Criteria (No Code Yet)

**Acceptance criteria for Phase 5A completion:**

1. **Signals must exist:**
   - Rate limit detection events (`RATE_LIMIT_DETECTED`, `RATE_LIMIT_CLEARED`) with window information
   - Browser pool saturation events (`BROWSER_POOL_EXHAUSTED`, `BROWSER_POOL_AVAILABLE`)
   - Health metrics available via queryable endpoints or system_events aggregation
   - Backoff/retry decisions logged with reason and duration

2. **Failures must be observable:**
   - All failure modes (rate limit, timeout, auth failure, browser crash) emit structured events
   - Failure recovery paths are traceable through system_events
   - Root cause analysis possible via event correlation

3. **Guarantees must hold:**
   - Executor does not exceed platform rate limits (proactive, not reactive)
   - Browser pool exhaustion does not cause deadlock (backpressure or graceful degradation)
   - Extended stability proofs (e.g., 1-hour) pass without memory leaks or degradation
   - Health metrics are queryable in real-time (within 30 seconds of state change)

**Note:** These criteria are planning targets. Actual implementation may differ based on technical constraints.

#### 5A.5 Future Proof Strategy

**How Phase 5A would be proven:**

- **Extend existing proofs:** Phase 4 proofs (Level 4 POST/REPLY) would be extended to verify:
  - Rate limit detection and adaptive scheduling behavior
  - Browser pool saturation handling
  - Health metrics accuracy
- **New proof level (if needed):** A "Level 5" proof might be required for:
  - Extended stability (1-hour+ runs)
  - Rate limit recovery scenarios
  - Browser pool exhaustion recovery
- **Proof artifacts:** All proofs would follow the same immutable artifact pattern as Phase 4:
  - Append-only proof reports in `docs/proofs/`
  - INDEX.md tracking
  - CI enforcement via `verify:docs:truth`

**Note:** Proof strategy is conceptual. Actual proof design would be determined during implementation.

### Phase 5B — Learning & Intelligence (Planned)

**Conceptual areas (non-binding, descriptive only):**

- **Engagement ingestion:** Collecting and analyzing engagement metrics (likes, retweets, replies) from posted content
- **Outcome-driven learning loops:** Using engagement data to inform content generation and posting strategies
- **Strategy evolution:** Adaptive content strategies based on historical performance and engagement patterns

**Note:** These are planning concepts only. No implementation exists.

### Phase 5C — Scale & Coordination (Planned)

**Conceptual areas (non-binding, descriptive only):**

- **Multi-executor coordination:** Coordinating multiple executor instances across different machines or regions
- **Throughput control:** Managing posting/reply rates across multiple executors to stay within platform limits
- **Sharding / isolation strategies:** Distributing work across executors with clear isolation boundaries

**Note:** These are planning concepts only. No implementation exists.

---

## NEXT MILESTONES

### Proving Phase: OK-Only Runtime Preflight Gating (ACTIVE)

**Status:** Strict OK-only gating enabled for proving phase  
**Commit SHA:** `0d014751`

- Runtime preflight check runs on Mac Runner before generation/posting
- Only decisions with `runtime_preflight_status='ok'` proceed to generation
- All non-ok statuses (deleted/timeout/error) are blocked immediately
- No fallback posting on timeout during proving phase (correctness over throughput)
- Decision selection prioritizes `runtime_preflight_status='ok'` > `preflight_status='ok'` > others

**Next Milestones:**
- **P1:** 1 posted reply + reward (IN PROGRESS)
  - Run: `pnpm tsx scripts/ops/e2e-prove-1-posted-reply.ts`
- **P2:** 5 posted replies + strategy_rewards updated
- **P3:** Enable timeout fallback with guardrails (Phase 2)

1. **Reply Learning Loop** — In progress
   - ✅ Strategy attribution (`features.strategy_id`, `features.selection_mode`)
   - ✅ Reward computation (`features.reward`)
   - ✅ `strategy_rewards` table updates
   - ✅ PLAN_ONLY generation working
   - ✅ Runtime preflight OK-only gating (proving phase)
   - 🔄 **Next:** Get 1 posted reply + reward, then scale to 5

2. **Posting Strategy Learning** — Planned
   - Multi-strategy content generation with ε-greedy selection
   - Reward attribution and strategy optimization
   - Similar to reply learning but for original posts

3. **Follower-Per-Day KPI Loop** — Planned
   - Track follower growth rate
   - Optimize posting/reply volume and timing
   - A/B test strategies for follower acquisition

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

## NO NEW SYSTEMS RULE (Default)

**Principle:** Do NOT create new jobs, queues, tables, schedulers, pipelines, or abstractions unless absolutely necessary.

**Default Behavior:** Only make small, surgical edits to finish the next proof milestone.

**Exception Process:** If a new system is believed necessary, write a "Necessity Justification" section that passes ALL tests:

1. **Blocking:** Milestone cannot be completed otherwise
2. **Proofable:** Can be proven deterministically
3. **Net Simplification:** System simplifies after ship (not just adds complexity)
4. **Doc-First:** Explainable in <25 lines
5. **Rollback Plan:** Includes feature flags and clear rollback steps

**Examples of What NOT to Do:**
- Creating a new queue system when existing queues work
- Adding a new scheduler when existing schedulers can be extended
- Creating new tables when existing schema can accommodate
- Building new abstractions when direct code changes suffice

**Examples of What IS Allowed:**
- Adding instrumentation/logging to existing systems
- Fixing bugs in existing code paths
- Adding configuration flags to existing systems
- Documenting operational runbooks

---
