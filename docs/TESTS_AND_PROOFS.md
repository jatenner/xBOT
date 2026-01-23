# Tests and Proofs

**Last Updated:** 2026-01-23  
**Purpose:** Catalog of all proof/verification scripts and what they validate

---

## Proof Scripts

### Deployment Verification

**Script:** `scripts/ops/deploy_and_verify_both.ts`  
**Command:** `pnpm run deploy:verify:both`  
**What it checks:**
- Deploys both xBOT and serene-cat services
- Verifies SHA match between local and deployed
- Checks boot logs for correct execution mode
- **Last known result:** See `docs/FINAL_DEPLOY_AND_REPLY_SUMMARY.md`

**Script:** `scripts/ops/deploy_and_verify.ts`  
**Command:** `pnpm run deploy:verify`  
**What it checks:**
- Deploys single service
- Verifies SHA match
- **Last known result:** UNKNOWN

---

### Control/Executor Split Proof

**Script:** `docs/CONTROL_EXECUTOR_SPLIT_PROOF.md` (documentation)  
**SQL Queries:**
```sql
-- Verify Railway blocks attempts
SELECT COUNT(*) FROM system_events
WHERE event_type='POSTING_QUEUE_BLOCKED'
  AND event_data->>'reason'='NOT_EXECUTOR_MODE'
  AND created_at >= NOW() - INTERVAL '30 minutes';

-- Verify attempts_started=0 on Railway
SELECT event_data->>'attempts_started' AS attempts
FROM system_events
WHERE event_type='POSTING_QUEUE_TICK'
  AND created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC LIMIT 10;
```

**What it checks:**
- Railway emits `POSTING_QUEUE_BLOCKED` with `NOT_EXECUTOR_MODE`
- Railway `attempts_started=0` always
- Mac executor `attempts_started > 0` when running
- **Last known result:** ✅ PASS (2026-01-23) - See `docs/CONTROL_EXECUTOR_SPLIT_PROOF.md`

---

### Posting Throughput Proof

**Script:** `docs/POSTING_THROUGHPUT_PROOF_2H.md` (documentation)  
**SQL Queries:**
```sql
-- Count POST_SUCCESS in last 2 hours
SELECT COUNT(*) AS success_count, MAX(created_at) AS last_success
FROM system_events
WHERE event_type='POST_SUCCESS'
  AND created_at >= NOW() - INTERVAL '2 hours';

-- Count POSTING_QUEUE_TICK
SELECT COUNT(*) AS tick_count, MAX(created_at) AS last_tick
FROM system_events
WHERE event_type='POSTING_QUEUE_TICK'
  AND created_at >= NOW() - INTERVAL '2 hours';

-- Check stuck work
SELECT status, COUNT(*) AS count, MIN(created_at) AS oldest
FROM content_metadata
WHERE status IN ('queued', 'posting', 'blocked')
GROUP BY status;
```

**What it checks:**
- Posting queue executing (ticks present)
- Real posts happening (POST_SUCCESS events)
- No stuck work accumulating
- **Last known result:** ⚠️ PARTIAL PASS (2026-01-23) - No POST_SUCCESS in 2h, attributed to Railway lack of browser access

---

### Executor Stability Proof

**Script:** `scripts/runner/verify-executor-stability.ts`  
**Command:** `pnpm tsx scripts/runner/verify-executor-stability.ts`  
**What it checks:**
- Runs executor for 10 minutes
- Verifies page count stays at 1
- Checks for hard cap triggers
- Verifies STOP switch works
- **Last known result:** UNKNOWN (not run yet)

**Manual verification:**
```bash
# Run executor with timeout
EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile timeout 600 pnpm run runner:posting-queue-once 2>&1 | tee executor-test.log

# Check page count
grep "EXECUTOR_GUARD" executor-test.log | grep "pages="
# Expected: All show pages=1 (or pages=0)
```

---

### Executor Tab Explosion Root Cause

**Script:** `docs/EXECUTOR_TAB_EXPLOSION_ROOT_CAUSE.md` (documentation)  
**What it checks:**
- Identifies root cause (LaunchAgent + executor-daemon.ts loop)
- Documents guardrails implemented
- Provides recovery procedures
- **Last known result:** ✅ FIXED (2026-01-23) - Guardrails implemented

---

### Session Check

**Script:** `scripts/runner/session-check.ts`  
**Command:** `pnpm run runner:session`  
**What it checks:**
- CDP connection
- Twitter session validity
- Consent wall detection
- Challenge detection
- **Last known result:** UNKNOWN (run to verify)

---

### Executor Status

**Script:** `scripts/runner/executor-status.ts`  
**Command:** `pnpm run executor:status`  
**What it checks:**
- CDP reachability
- Last executor.log entries
- System events counts (last 20 min)
- **Last known result:** UNKNOWN (run to verify)

---

### Posting Queue Execution Proof

**Script:** `docs/POSTING_QUEUE_EXECUTION_PROOF.md` (documentation)  
**SQL Queries:**
```sql
-- Check POSTING_QUEUE_TICK events
SELECT event_data->>'ready_candidates' AS ready,
       event_data->>'attempts_started' AS attempts,
       created_at
FROM system_events
WHERE event_type='POSTING_QUEUE_TICK'
  AND created_at >= NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC LIMIT 10;
```

**What it checks:**
- Posting queue executing (ticks present)
- Attempts started > 0 (on executor)
- Queue depletion
- **Last known result:** ✅ EXECUTING (2026-01-23) - See `docs/POSTING_QUEUE_EXECUTION_PROOF.md`

---

### Deploy and Reply Execution Proof

**Script:** `docs/DEPLOY_AND_REPLY_EXECUTION_PROOF.md` (documentation)  
**What it checks:**
- Service identification (xBOT vs serene-cat)
- Deploy fingerprint enforcement
- Reply queue instrumentation
- **Last known result:** ✅ COMPLETE (2026-01-23) - See `docs/DEPLOY_AND_REPLY_EXECUTION_PROOF.md`

---

## How to Run Proofs

**Quick verification:**
```bash
# Update status snapshot (includes DB queries)
pnpm run docs:snapshot

# Check executor stability
pnpm tsx scripts/runner/verify-executor-stability.ts

# Check session
pnpm run runner:session

# Check executor status
pnpm run executor:status
```

**Manual SQL verification:**
```sql
-- See queries above in each proof section
-- Run in Supabase SQL editor or via psql
```

---

## Adding New Proofs

**When adding a new proof script:**

1. Add entry to this file with:
   - Script path
   - Command to run
   - What it checks
   - SQL queries (if applicable)
   - Last known result

2. Update `docs/STATUS.md` if proof reveals current state

3. Commit with message: `docs: add proof script <name>`

---

**See [RUNBOOK.md](./RUNBOOK.md) for operational procedures.**
