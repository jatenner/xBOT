# xBOT System Status

**Last Updated:** 2026-01-24  
**Purpose:** Single source of truth for operational status, proof coverage, and verification commands

---

## What's Working (Proven)

✅ **Railway Control-Plane Deployment**
- Both services (`xBOT`, `serene-cat`) deploy via Railway GitHub Integration + Wait for CI
- SHA verification via `/healthz` endpoints (deterministic, cache-busted)
- Evidence: `curl` responses show matching SHAs, `executionMode=control`

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

**Proof Tag:** `control-post-1769281173411`  
**Evidence:** [`docs/proofs/control-post/control-post-1769281173411.md`](docs/proofs/control-post/control-post-1769281173411.md)  
**Tweet:** `https://x.com/Signal_Synapse/status/2015138300814639129`

- Decision ID: `ce631dee-6503-4752-8fc7-ff52a6caced0`
- Claim OK Event ID: `b3630213-3cde-4221-9bfc-d6d565aad906`
- **Note:** Claim instrumentation (CLAIM_ATTEMPT/OK/FAIL events + CLAIM_STALL watchdog) is now part of proof evidence.

✅ **Proof Level 4: Control → Executor → X (REPLYING)** — PROVEN

**Proof Tag:** `control-reply-1769271406334`  
**Evidence:** [`docs/proofs/control-reply/control-reply-1769271406334.md`](docs/proofs/control-reply/control-reply-1769271406334.md)  
**Reply:** `https://x.com/Signal_Synapse/status/2015096733693366778`

- Decision ID: `ed2ab9e6-72e9-4dda-b7b3-28c6c35014f7`
- Target Tweet ID: `2014718451563004351`
- Event ID: `21b78fda-2a0f-453b-b210-b4403d547553`

---

## Phase 4 Completion Summary

**Status:** ✅ **COMPLETE & STABLE**

Phase 4 (Control → Executor → X) is formally complete. The full pipeline from control-plane decision creation through executor execution to verified result URLs is proven and stable.

### What is Proven

1. **Level 4 POST** — Full pipeline proven with immutable evidence:
   - Immutable Proof: [`docs/proofs/control-post/control-post-1769281173411.md`](docs/proofs/control-post/control-post-1769281173411.md)
   - Tweet URL: `https://x.com/Signal_Synapse/status/2015138300814639129`
   - Proof Tag: `control-post-1769281173411`

2. **Level 4 REPLY** — Full pipeline proven with immutable evidence:
   - Immutable Proof: [`docs/proofs/control-reply/control-reply-1769271406334.md`](docs/proofs/control-reply/control-reply-1769271406334.md)
   - Reply URL: `https://x.com/Signal_Synapse/status/2015096733693366778`
   - Proof Tag: `control-reply-1769271406334`

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
| Control→Executor→X (Posting) | ✅ PROVEN | `EXECUTE_REAL_ACTION=true pnpm run executor:prove:e2e-control-post` | `docs/proofs/control-post/control-post-1769281173411.md` (2026-01-24 19:03:35: tweet_url=https://x.com/Signal_Synapse/status/2015138300814639129, decision_id=ce631dee-6503-4752-8fc7-ff52a6caced0, claim_ok_event_id=b3630213-3cde-4221-9bfc-d6d565aad906) |
| Control→Executor→X (Replying) | ✅ PROVEN | `EXECUTE_REAL_ACTION=true TARGET_TWEET_ID=<id> pnpm run executor:prove:e2e-control-reply` | `docs/proofs/control-reply/control-reply-1769271406334.md` (2026-01-24 16:18:00: reply_url=https://x.com/Signal_Synapse/status/2015096733693366778) |
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

### Phase 5A — Reliability & Production Hardening (Planned)

**Status:** ⚠️ **PLANNED / NOT IMPLEMENTED**

This phase focuses on operational stability, predictability, and observability for production deployment. No implementation exists. No PROVEN claims will be added until real execution + proof artifacts exist.

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
