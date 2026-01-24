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

---

## What's Implemented but Unproven

⚠️ **Control → Decision Queued → Executor Executes → Result URL Captured (Posting)**
- Control-plane posting queue scheduler creates decisions
- Executor claims and executes them
- Result URL captured and verified
- **How to Prove:** `EXECUTE_REAL_ACTION=true pnpm run executor:prove:e2e-control-post`
- **Evidence Artifact:** `docs/CONTROL_TO_POST_PROOF.md`

⚠️ **Control → Decision Queued → Executor Executes → Result URL Captured (Replying)**
- Control-plane reply queue scheduler creates decisions
- Executor claims and executes them
- Result URL captured and verified
- **How to Prove:** `EXECUTE_REAL_ACTION=true TARGET_TWEET_ID=<id> pnpm run executor:prove:e2e-control-reply`
- **Evidence Artifact:** `docs/CONTROL_TO_REPLY_PROOF.md`

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
| Control→Executor→X (Posting) | UNPROVEN | `EXECUTE_REAL_ACTION=true pnpm run executor:prove:e2e-control-post` | `docs/CONTROL_TO_POST_PROOF.md` |
| Control→Executor→X (Replying) | UNPROVEN | `EXECUTE_REAL_ACTION=true TARGET_TWEET_ID=<id> pnpm run executor:prove:e2e-control-reply` | `docs/CONTROL_TO_REPLY_PROOF.md` |
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

**Report:** `docs/CONTROL_TO_POST_PROOF.md`

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

**Report:** `docs/CONTROL_TO_REPLY_PROOF.md`

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
