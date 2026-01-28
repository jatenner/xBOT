# xBOT System Status

**Last Updated:** 2026-01-26  
**Purpose:** Single source of truth for operational status, proof coverage, and verification commands

---

## What's Working (Proven)

✅ **Reply System V2 PLAN_ONLY Bridge** — PROVEN (Generation)

**Proof Tag:** `e2e-reply-v2-plan-only-grounding-fix-1769633000000`  
**Evidence:** [`docs/proofs/learning/e2e-reply-v2-plan-only-grounding-fix-1769633000000.md`](docs/proofs/learning/e2e-reply-v2-plan-only-grounding-fix-1769633000000.md)  
**Commit SHA:** `2fe9965b768fc93c09048801ea7786133a66020a`

- Railway planner creates `reply_v2_planner` decisions with `status='queued'` and strategy attribution
- Mac Runner daemon consumes queued decisions
- PLAN_ONLY content generation works: OpenAI API calls succeed, content generated with `generated_by='mac_runner'`
- Grounding check passes: Generated content includes 2+ terms from tweet snapshot
- **Note:** Posting currently blocked by stale targets (expected behavior). Need fresh opportunities from harvester.

✅ **Railway Control-Plane Deployment**
- Both services (`xBOT`, `serene-cat`) deploy via Railway GitHub Integration + Wait for CI
- SHA verification via `/healthz` endpoints (deterministic, cache-busted)
- Evidence: `curl` responses show matching SHAs, `executionMode=control`

**If Railway deploy is SKIPPED due to CI failure:**
- Run manual deploy: `pnpm run deploy:railway:both`
- If unauthorized, run: `railway login --browserless` (follow prompts)
- Verify SHA match: `pnpm run verify:sha:both`
- Both services must show matching SHA and `executionMode=control`

✅ **Executor Safety (Headless Operation)**
- Executor daemon runs headless (`HEADLESS=true` enforced)
- No visible Chrome windows (`windows_opened=0` proven)
- No CDP processes (`chrome_cdp_processes=0` proven)
- Page cap enforced (`pages_max<=1` proven)
- STOP switch exits within 10 seconds
- Evidence: `docs/EXECUTOR_5MIN_HEADLESS_PROOF.md`, `docs/EXECUTOR_15MIN_HEADLESS_PROOF.md`

✅ **End-to-End Posting Execution**
- Single posting decision seeded → executor claims → attempt recorded → outcome recorded → event emitted
- Evidence: `docs/EXECUTION_E2E_POST_PROOF.md`

✅ **End-to-End Reply Execution**
- Single reply decision seeded → executor claims → attempt recorded → outcome recorded → event emitted
- Executor safety invariants remain true during reply execution
- Evidence: `docs/EXECUTION_E2E_REPLY_PROOF.md`

✅ **Proof Level 4: Control → Executor → X (POSTING)** — PROVEN

**Proof Tag:** `control-post-1769385308714`  
**Evidence:** [`docs/proofs/control-post/control-post-1769385308714.md`](docs/proofs/control-post/control-post-1769385308714.md)  
**Tweet:** `https://x.com/Signal_Synapse/status/2015574485135487461`

- Decision ID: `ce631dee-6503-4752-8fc7-ff52a6caced0`
- Claim OK Event ID: `b3630213-3cde-4221-9bfc-d6d565aad906`
- **Note:** Claim instrumentation (CLAIM_ATTEMPT/OK/FAIL events + CLAIM_STALL watchdog) is now part of proof evidence.

✅ **Proof Level 4: Control → Executor → X (REPLY)** — PROVEN

**Proof Tag:** `control-reply-1769440472369`  
**Evidence:** [`docs/proofs/control-reply/control-reply-1769440472369.md`](docs/proofs/control-reply/control-reply-1769440472369.md)  
**Reply:** `https://x.com/Signal_Synapse/status/2015805866801295663`

- Decision ID: `aa05774f-e0fd-494c-8ea1-48e91b8df55a`
- Target Tweet ID: `2015580329344446898`
- Reply Tweet ID: `2015805866801295663`
- Success Event ID: `39b6ce05-bc91-4f0c-af51-c106ddd05a32`
- Attempt ID: `663ef150-368a-4172-afd5-5eacd6c45423`

✅ **Phase 5A.1: Executor Health & Liveness** — PROVEN

**Proof Tag:** `health-1769357503409`  
**Evidence:** [`docs/proofs/health/health-1769357503409.md`](docs/proofs/health/health-1769357503409.md)

- Boot Event ID: `da9edc7a-2014-465b-aa48-81049c9e0c55`
- Ready Event ID: `36bafabc-eed4-496c-9b18-557ce7a9add5`
- Tick Event Count: 2
- Health OK Event ID: `944369ef-6023-48f5-a4bb-2122615633ab`

---

## Phase 4 Completion Summary

**Status:** ✅ **COMPLETE & STABLE**

Phase 4 (Control → Executor → X) is formally complete. The full pipeline from control-plane decision creation through executor execution to verified result URLs is proven and stable.

### What is Proven

1. **Level 4 POST** — Full pipeline proven with immutable evidence:
   - Immutable Proof: [`docs/proofs/control-post/control-post-1769385308714.md`](docs/proofs/control-post/control-post-1769385308714.md)
   - Tweet URL: `https://x.com/Signal_Synapse/status/2015574485135487461`
   - Proof Tag: `control-post-1769385308714`

2. **Level 4 REPLY** — Full pipeline proven with immutable evidence:
   - Immutable Proof: [`docs/proofs/control-reply/control-reply-1769440472369.md`](docs/proofs/control-reply/control-reply-1769440472369.md)
   - Reply URL: `https://x.com/Signal_Synapse/status/2015805866801295663`
   - Proof Tag: `control-reply-1769440472369`

### Stability Commitment

**No further executor or proof changes should be made unless a regression is detected.**

Phase 4 proof artifacts are immutable and append-only. All PROVEN claims reference immutable proof files under:
- `docs/proofs/control-post/`
- `docs/proofs/control-reply/`

CI enforces verification via `verify:docs:truth` — PROVEN claims must reference existing immutable proof files containing PASS status and `https://x.com/` URLs.

---

## What's Implemented but Unproven

~~**Note:** These items are now PROVEN and moved to Phase 4 Completion Summary above.~~

⚠️ **Learning System Updates**
- Metrics collected from outcomes
- Learning summaries updated
- **How to Prove:** SQL queries on `outcomes` and `learning_posts` tables
- **Evidence Artifact:** Manual SQL verification

---

## What's Not Built Yet

❌ **Automated Learning Feedback Loop**
- Learning system does not automatically adjust posting/reply strategies based on outcomes

❌ **Multi-Executor Coordination**
- System assumes single executor instance
- No coordination for multiple executors

❌ **Rate Limit Enforcement**
- No automatic rate limiting based on Twitter API limits
- Relies on manual cooldown configuration

---

## Proof Scoreboard

| Feature | Status | How to Prove | Evidence Artifact |
|---------|--------|--------------|-------------------|
| Railway Deployment | PROVEN | `curl` both `/healthz` endpoints | Manual verification |
| Executor Headless Safety | PROVEN | `pnpm run executor:prove:5m` | `docs/EXECUTOR_5MIN_HEADLESS_PROOF.md` |
| Executor Stability (15m) | PROVEN | `pnpm run executor:prove:15m` | `docs/EXECUTOR_15MIN_HEADLESS_PROOF.md` |
| E2E Posting Execution | PROVEN | `pnpm run executor:prove:e2e-post` | `docs/EXECUTION_E2E_POST_PROOF.md` |
| E2E Reply Execution | PROVEN | `TARGET_TWEET_ID=<id> pnpm run executor:prove:e2e-reply` | `docs/EXECUTION_E2E_REPLY_PROOF.md` |
| Control→Executor→X (Posting) | ✅ PROVEN | `EXECUTE_REAL_ACTION=true pnpm run executor:prove:e2e-control-post` | `docs/proofs/control-post/control-post-1769385308714.md` (2026-01-25 23:56:46: tweet_url=https://x.com/Signal_Synapse/status/2015574485135487461) |
| Control→Executor→X (Replying) | 🚧 IN PROGRESS | `EXECUTE_REAL_ACTION=true TARGET_TWEET_ID=<id> pnpm run executor:prove:e2e-control-reply` | Real execution proof pending completion |
| Learning System Updates | UNPROVEN | SQL queries on `outcomes` and `learning_posts` | Manual verification |

---

## Production Verification

### Health Endpoints

**xBOT Service:**
```bash
curl -s "https://xbot-production-844b.up.railway.app/healthz?ts=$(date +%s)" | jq '{sha, serviceName, executionMode, runnerMode}'
```

**serene-cat Service:**
```bash
curl -s "https://serene-cat-production.up.railway.app/healthz?ts=$(date +%s)" | jq '{sha, serviceName, executionMode, runnerMode}'
```

**Expected Response:**
- Both show matching `sha` (latest commit SHA)
- Both show `executionMode: "control"`
- Both show `runnerMode: false`

### GitHub Checks (Required for Railway Deploy)

**Workflows:**
- `Deploy Gate (Build Validation)` - Must be SUCCESS
- `Growth Gate CI/CD` - Must be SUCCESS

**Check via GitHub API:**
```bash
# Get latest commit SHA
COMMIT_SHA=$(git rev-parse HEAD)

# Check workflow status (requires GitHub token)
curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/<owner>/<repo>/commits/$COMMIT_SHA/check-runs" | \
  jq '.check_runs[] | select(.name | contains("Deploy Gate") or contains("Growth Gate")) | {name, status, conclusion}'
```

**Expected:** Both workflows show `status: "completed"` and `conclusion: "success"`

---

## Executor Verification

### Quick Safety Proof (5 minutes)
```bash
pnpm run executor:prove:5m
```

**PASS Criteria:**
- `windows_opened=0` [HARD]
- `headless=true` [HARD]
- `pages_max<=1` [HARD]
- `browser_launches<=1` [HARD]
- `chrome_cdp_processes=0` [HARD]
- `stop_switch_seconds<=10` [HARD]

**Report:** `docs/EXECUTOR_5MIN_HEADLESS_PROOF.md`

### Extended Stability Proof (15 minutes)
```bash
pnpm run executor:prove:15m
```

**Same criteria as 5-minute proof, validates stability over longer duration.**

**Report:** `docs/EXECUTOR_15MIN_HEADLESS_PROOF.md`

### End-to-End Posting Proof
```bash
pnpm run executor:prove:e2e-post
```

**PASS Criteria:**
- `decision_queued=true`
- `decision_claimed=true`
- `attempt_recorded=true`
- `result_recorded=true`
- `post_success_event=true` OR `post_failed_event=true`

**Report:** `docs/EXECUTION_E2E_POST_PROOF.md`

### End-to-End Reply Proof
```bash
TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-reply
```

**PASS Criteria:**
- `reply_decision_queued=true`
- `reply_decision_claimed=true`
- `reply_attempt_recorded=true`
- `reply_result_recorded=true`
- `reply_success_event=true` OR `reply_failed_event=true`
- `reply_count=1` [HARD]
- `windows_opened=0` [HARD]
- `chrome_cdp_processes=0` [HARD]
- `pages_max<=1` [HARD]

**DRY_RUN Mode:**
```bash
DRY_RUN=true TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-reply
```

**Report:** `docs/EXECUTION_E2E_REPLY_PROOF.md`

---

## Common Failure Codes

When Proof Level 4 fails, the proof reports include diagnostic snapshots with failure codes. Here's what each code means and where to find evidence:

| Failure Code | Meaning | Evidence Location | Next Steps |
|--------------|---------|------------------|------------|
| `RATE_LIMITED_429` | HTTP 429 rate limit detected | `system_events` (POST_FAILED/REPLY_FAILED event_data.http_status=429) | Wait for cooldown period, check rate limit status |
| `PLAYWRIGHT_TIMEOUT` | Playwright operation timed out (>180s) | `system_events` (POST_FAILED/REPLY_FAILED event_data.is_timeout=true) | Check network connectivity, auth status, browser health |
| `AUTH_REQUIRED` | Authentication/login required | `system_events` (POST_FAILED/REPLY_FAILED event_data.error_code=AUTH_REQUIRED) | Run `pnpm run executor:auth` to refresh session |
| `CLAIM_STARVATION` | Decision not claimed by executor | `system_events` (EXECUTOR_DECISION_SKIPPED events) | Check executor health, queue priority, rate limits |
| `UNKNOWN` | Unclassified error | `system_events` (POST_FAILED/REPLY_FAILED event_data.error_code=UNKNOWN) | Check error_message field, log excerpts in proof report |

### Evidence Locations

**For each execution attempt, check:**

1. **Outcomes Table** (`outcomes`):
   - `decision_id` → Find attempt/result rows
   - `result` JSONB → Contains error details if failed

2. **System Events** (`system_events`):
   - `POST_SUCCESS` / `POST_FAILED` / `REPLY_SUCCESS` / `REPLY_FAILED` → Execution result
   - `EXECUTOR_DECISION_SKIPPED` → Why decision wasn't claimed
   - Filter by `event_data->>decision_id` or `event_data->>proof_tag`

3. **Content Metadata** (`content_metadata`):
   - `status` → Final status (queued/posting/posted/failed)
   - `error_message` → Error details if failed
   - `features->>proof_tag` → Proof tag for filtering

4. **Proof Reports** (Immutable artifacts in `docs/proofs/control-post/` and `docs/proofs/control-reply/`):
   - Each proof run creates a new immutable file: `<proof_tag>.md`
   - INDEX.md files track all proof runs (append-only)
   - Diagnostic snapshot section (on failure)
   - Log excerpts (last 20 relevant lines)
   - Failure event data (pretty-printed JSON)

---

## Proof Regression Gate (CI)

**Purpose:** Automated regression testing for Level 4 proofs to ensure they never break.

**CI Behavior:**
- **PRs and pushes to main:** Run Level 4 POST and REPLY proofs in DRY_RUN mode (safe, no Twitter side effects)
- **Real execution:** Requires manual trigger via GitHub Actions workflow_dispatch
- **Artifacts:** Proof reports uploaded as workflow artifacts for inspection

**Local Testing:**
```bash
# Run both proofs in DRY_RUN mode locally
pnpm run proof:regression

# Or run individually:
pnpm run executor:prove:e2e-control-post
TARGET_TWEET_ID=2014718451563004351 pnpm run executor:prove:e2e-control-reply
```

**Manual Real Execution:**
- Go to GitHub Actions → "Proof Regression Gate" → "Run workflow"
- Select mode: `post`, `reply`, or `both`
- For reply/both modes, provide `target_tweet_id` (numeric, >= 15 digits)
- Workflow will run with `PROOF_MODE=true EXECUTE_REAL_ACTION=true`
- Proof reports uploaded as artifacts

**Documentation Rules:**
- Docs (`SYSTEM_STATUS.md`, `README_MASTER.md`) must only be marked PROVEN when:
  - Immutable proof report exists (`docs/proofs/control-post/<proof_tag>.md` or `docs/proofs/control-reply/<proof_tag>.md`)
  - Proof report shows `Status: ✅ PASS`
  - Proof report includes `https://x.com/` URL (verifies actual execution)
  - Pointer files (`docs/CONTROL_TO_POST_PROOF.md`, `docs/CONTROL_TO_REPLY_PROOF.md`) reference the immutable report
  - Evidence includes decision_id, proof_tag, and key system_events IDs

---

## Control→Executor→X Proof (Level 4)

### Posting Pipeline Proof

**Command:**
```bash
# DRY_RUN (safe, no posting)
pnpm run executor:prove:e2e-control-post

# Real execution (requires explicit opt-in)
EXECUTE_REAL_ACTION=true pnpm run executor:prove:e2e-control-post
```

**What It Proves:**
1. Control-plane posting queue scheduler creates exactly ONE eligible decision
2. Decision enters `queued` state with correct `pipeline_source` and required fields
3. Executor daemon claims decision (`queued → posting`)
4. Executor executes posting attempt
5. Outcome recorded (success or failure)
6. Event emitted (`POST_SUCCESS` or `POST_FAILED`)
7. Result URL captured (if successful)

**PASS Criteria:**
- `exactly_one_decision=1` [HARD]
- `exactly_one_attempt=1` [HARD]
- `outcome_recorded=true`
- `success_or_failure_event_present=true`
- `windows_opened=0` [HARD]
- `chrome_cdp_processes=0` [HARD]
- `pages_max<=1` [HARD]
- `result_url_captured=true` (if successful)

**Report:** Immutable proof files in `docs/proofs/control-post/` (see INDEX.md for latest)

### Reply Pipeline Proof

**Command:**
```bash
# DRY_RUN (safe, no replying)
TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-control-reply

# Real execution (requires explicit opt-in)
EXECUTE_REAL_ACTION=true TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-control-reply
```

**What It Proves:**
1. Control-plane reply queue scheduler creates exactly ONE eligible reply decision
2. Decision enters `queued` state with correct `pipeline_source` and required fields
3. Executor daemon claims decision (`queued → replying`)
4. Executor executes reply attempt
5. Outcome recorded (success or failure)
6. Event emitted (`REPLY_SUCCESS` or `REPLY_FAILED`)
7. Result URL captured (if successful)

**PASS Criteria:**
- `exactly_one_decision=1` [HARD]
- `exactly_one_attempt=1` [HARD]
- `outcome_recorded=true`
- `success_or_failure_event_present=true`
- `windows_opened=0` [HARD]
- `chrome_cdp_processes=0` [HARD]
- `pages_max<=1` [HARD]
- `result_url_captured=true` (if successful)

**Report:** Immutable proof files in `docs/proofs/control-reply/` (see INDEX.md for latest)

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

- Boot Event ID: `da9edc7a-2014-465b-aa48-81049c9e0c55`
- Ready Event ID: `36bafabc-eed4-496c-9b18-557ce7a9add5`
- Tick Event Count: 2
- Health OK Event ID: `944369ef-6023-48f5-a4bb-2122615633ab`

#### Phase 5A.2: Rate Limit Awareness + Circuit Breaker Observability — ✅ PROVEN

**Status:** ✅ **PROVEN**

Rate limit detection, active heartbeats, bypass events, and clearing are working correctly. Structured events (`EXECUTOR_RATE_LIMIT_DETECTED`, `EXECUTOR_RATE_LIMIT_ACTIVE`, `EXECUTOR_RATE_LIMIT_CLEARED`, `EXECUTOR_RATE_LIMIT_BYPASS`) are emitted deterministically and observable via system_events.

**Proof Tag:** `rate-limit-1769375487279`  
**Evidence:** [`docs/proofs/rate-limit/rate-limit-1769375487279.md`](docs/proofs/rate-limit/rate-limit-1769375487279.md)

- Detected Event ID: `ecf6d0b4-ebaf-4e9b-b2eb-d0947bab109d`
- Active Event IDs: `f3ae8e14-4723-4d3a-acf5-404861a23557`, `f574120a-2ff0-4a94-9f22-8d4bda9ac27d`
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

## Safety Gating

**All Proof Level 4 scripts require explicit opt-in for real actions:**

- **DRY_RUN mode (default):** Seeds decision, validates control→executor flow, but does NOT execute posting/replying
- **EXECUTE_REAL_ACTION=true:** Required to actually post/reply on X
- **TARGET_TWEET_ID:** Required for reply proofs (must be valid numeric >= 15 digits)

**Example Safe Usage:**
```bash
# Safe: DRY_RUN mode (no posting)
pnpm run executor:prove:e2e-control-post

# Safe: DRY_RUN mode for reply (no replying)
TARGET_TWEET_ID=1234567890123456789 pnpm run executor:prove:e2e-control-reply

# Real execution: Requires explicit opt-in
EXECUTE_REAL_ACTION=true pnpm run executor:prove:e2e-control-post
```

---

## Next Steps

1. **Run Proof Level 4 (Posting):**
   - First: `pnpm run executor:prove:e2e-control-post` (DRY_RUN)
   - Then: `EXECUTE_REAL_ACTION=true pnpm run executor:prove:e2e-control-post` (if DRY_RUN passes)

2. **Run Proof Level 4 (Replying):**
   - First: `TARGET_TWEET_ID=<id> pnpm run executor:prove:e2e-control-reply` (DRY_RUN)
   - Then: `EXECUTE_REAL_ACTION=true TARGET_TWEET_ID=<id> pnpm run executor:prove:e2e-control-reply` (if DRY_RUN passes)

3. **Verify Learning System:**
   - Query `outcomes` table for recent metrics
   - Query `learning_posts` table for updated summaries

4. **Update This Document:**
   - Mark Proof Level 4 as PROVEN once evidence artifacts exist
   - Add any new proof coverage
