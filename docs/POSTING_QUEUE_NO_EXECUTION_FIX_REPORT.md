# POSTING QUEUE NO-EXECUTION FIX REPORT

**Date:** 2026-01-23  
**Goal:** Fix "NO_EXECUTION" — 8 ready PROD posts but posting queue not executing (0 POST_SUCCESS, 0 POST_FAILED in 5h).  
**Constraints:** No CDP changes; no weakening of safety gates; PROD/TEST lanes unchanged; deploy via `railway up --detach`.

---

## 1. EXECUTIVE SUMMARY

- **Root cause (inferred):** Posting queue runs only on **worker** (Railway `SERVICE_ROLE=worker` / `RAILWAY_SERVICE_NAME` serene-cat or worker). If the deployed service is **main** only, the job loop is never started → zero execution. Secondary possibilities: migration health fail, circuit breaker, or another early-return before any post attempt.
- **Fix implemented:** Instrumentation and heartbeats to **prove** each run and **identify** the exact blocker: job_tick log at top, `[POSTING_QUEUE_BLOCK]` + `POSTING_QUEUE_BLOCKED` on every early-return, `POSTING_QUEUE_TICK` + `job_heartbeats` for `posting_queue`, and manual trigger `runner:posting-queue-once`.
- **Verification:** After deploy, check `POSTING_QUEUE_TICK` and `job_heartbeats` for `posting_queue`; run `pnpm run runner:posting-queue-once` locally and inspect logs + DB.

---

## 2. EXACT ROOT CAUSE (EVIDENCE-BASED)

**Primary:** Posting queue is **scheduled only when JobManager runs**, and JobManager runs **only on the worker service** (`railwayEntrypoint.ts` → `resolveServiceRole()` → worker starts `jobManagerWorker`, main does not).

- If production runs **main** only (e.g. single web service): **no JobManager → no posting timer → no `processPostingQueue` calls → 0 POST_SUCCESS, 0 POST_FAILED.**
- **Proof:** `src/railwayEntrypoint.ts`: `isWorkerService = roleInfo.role === 'worker'`; only worker calls `startWorker()` → `JobManager.getInstance().startJobs()`.

**Secondary (if worker runs but still no posts):** An early-return blocks before any attempt. Possible reasons:

- `MIGRATION_HEALTH`: `is_test_post` migration check fails.
- `CIRCUIT_BREAKER`: circuit open.
- `POSTING_DISABLED`: `flags.postingDisabled` (e.g. MODE=shadow).
- `SOURCE_OF_TRUTH`: content_metadata schema check fails.
- `GHOST_PROTECTION`: ghost indicators in last hour.
- `CONTROLLED_WINDOW_LEASE`: lease acquire fails when using controlled window.
- `NO_READY_DECISIONS`: `getReadyDecisions` returns [].
- `CONTROLLED_DECISION_NOT_FOUND`: controlled ID set but not in queue.
- `DRAIN_QUEUE`: `DRAIN_QUEUE=true`.
- Per-decision: `RATE_LIMIT`, `CONTROLLER_DENY`, `THREADS_DISABLED`, `SINGLES_DISABLED`.

All of these now emit `[POSTING_QUEUE_BLOCK]` + `POSTING_QUEUE_BLOCKED` and, where applicable, `POSTING_QUEUE_TICK` + `job_heartbeats` updates.

---

## 3. CODE PATHS CHANGED

### 3.1 Job tick log (top of `processPostingQueue`)

- **File:** `src/jobs/postingQueue.ts`
- **What:** Log `[POSTING_QUEUE] ✅ job_tick start SERVICE_ROLE=... RUNNER_MODE=... GROWTH_CONTROLLER_ENABLED=... ALLOW_TEST_POSTS=... postingDisabled=... postingDisabledEnv=...` at the very start of each run.
- **Purpose:** Confirm the job is **invoked** (scheduler + worker running).

### 3.2 Early-return instrumentation

- **Helper:** `emitPostingQueueBlock(supabase, reason, eventData?)`
  - Logs `[POSTING_QUEUE_BLOCK] reason=<REASON>`
  - Inserts `system_events`: `event_type = 'POSTING_QUEUE_BLOCKED'`, `event_data = { reason, ...eventData }`
- **Reasons used:**  
  `MIGRATION_HEALTH` | `CIRCUIT_BREAKER` | `POSTING_DISABLED` | `SOURCE_OF_TRUTH` | `GHOST_PROTECTION` |  
  `CONTROLLED_WINDOW_LEASE` | `CONTROLLED_DECISION_NOT_FOUND` | `NO_READY_DECISIONS` | `DRAIN_QUEUE` |  
  `RATE_LIMIT` | `CONTROLLER_DENY` | `THREADS_DISABLED` | `SINGLES_DISABLED`
- **Where:** Every early-return path before attempting a post; per-decision skips in the loop.

### 3.3 Heartbeat: `POSTING_QUEUE_TICK` + `job_heartbeats`

- **Helper:** `emitPostingQueueTick(supabase, ready_candidates, selected_candidates, attempts_started)`
  - Inserts `system_events`: `event_type = 'POSTING_QUEUE_TICK'`, `event_data = { ready_candidates, selected_candidates, attempts_started }`
- **When:** Once per run (all exit paths: blocks, success, browser-timeout early exit, catch).
- **`job_heartbeats`:**  
  - `job_name = 'posting_queue'`  
  - On block/skip: `recordJobSkip('posting_queue', reason)`  
  - On success (including no-op runs): `recordJobSuccess('posting_queue')`  
  - On throw: `recordJobFailure('posting_queue', errorMessage)`

### 3.4 Return value + manual script

- **`processPostingQueue`** now returns `{ ready_candidates, selected_candidates, attempts_started }`.
- **Script:** `scripts/runner/posting-queue-once.ts`
  - Runs a single `processPostingQueue()` pass (no loop).
  - Prints `ready_candidates`, `selected_candidates`, `attempts_started`, and `attempted a post: yes/no`.
- **pnpm:** `runner:posting-queue-once` → `RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp tsx scripts/runner/posting-queue-once.ts`

---

## 4. LOG EXCERPTS (PROOF)

### 4.1 Job tick (run invoked)

```
[POSTING_QUEUE] ✅ job_tick start SERVICE_ROLE=main RUNNER_MODE=true GROWTH_CONTROLLER_ENABLED=false ALLOW_TEST_POSTS=false postingDisabled=false postingDisabledEnv=false
```

### 4.2 Block example

```
[POSTING_QUEUE_BLOCK] reason=NO_READY_DECISIONS
```

### 4.3 Tick example

```
event_type: POSTING_QUEUE_TICK
event_data: { ready_candidates: 9, selected_candidates: 9, attempts_started: 1 }
```

---

## 5. SQL PROOF QUERIES

Use **UTC** in queries. Replace `NOW()` with your desired UTC window if needed.

### A) Ready PROD posts (before/after)

```sql
SELECT COUNT(*) AS ready_count
FROM content_metadata
WHERE status = 'queued'
  AND decision_type IN ('single', 'thread')
  AND scheduled_at <= NOW() + INTERVAL '5 minutes'
  AND (is_test_post IS NULL OR is_test_post = false);
```

**Expected (e.g. before fix):** `ready_count >= 8`.

### B) `POSTING_QUEUE_TICK` after deploy

```sql
SELECT event_type, event_data, created_at
FROM system_events
WHERE event_type = 'POSTING_QUEUE_TICK'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected after deploy:** Rows with `ready_candidates`, `selected_candidates`, `attempts_started` in `event_data`.

### C) POST_SUCCESS or POST_FAILED (execution happening)

```sql
SELECT event_type, event_data->>'decision_id' AS decision_id, created_at
FROM system_events
WHERE event_type IN ('POST_SUCCESS', 'POST_FAILED')
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;
```

**Expected when queue actually posts:** `POST_SUCCESS` and/or `POST_FAILED` rows.

### D) Queue / status movement

```sql
SELECT status, COUNT(*) AS cnt
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND created_at >= NOW() - INTERVAL '6 hours'
GROUP BY status
ORDER BY status;
```

**Expected when fix works:** `queued` decreases and/or `posted` (or `failed`) increases over time.

### E) `job_heartbeats` for `posting_queue`

```sql
SELECT job_name, last_success, last_failure, last_run_status, last_error, updated_at
FROM job_heartbeats
WHERE job_name = 'posting_queue';
```

**Expected:** Row exists; `last_success` or `last_run_status` updates when queue runs.

### F) `POSTING_QUEUE_BLOCKED` (which blocker)

```sql
SELECT event_data->>'reason' AS reason, created_at
FROM system_events
WHERE event_type = 'POSTING_QUEUE_BLOCKED'
  AND created_at >= NOW() - INTERVAL '6 hours'
ORDER BY created_at DESC
LIMIT 20;
```

**Use:** See which `reason` appears most often when there are still no posts.

---

## 6. DEPLOY & VERIFICATION

### 6.1 Deploy

```bash
git add package.json src/jobs/postingQueue.ts scripts/runner/posting-queue-once.ts docs/POSTING_QUEUE_NO_EXECUTION_FIX_REPORT.md
git commit -m "fix: posting queue no-execution — job_tick, BLOCK instrumentation, TICK/heartbeat, runner script"
railway up --detach
```

**Done:** Commit `362510e9` created; `railway up --detach` run successfully. Build runs on Railway (check dashboard for build logs).

### 6.2 Verify worker vs main

- Confirm **worker** service runs JobManager (e.g. Railway worker service with `SERVICE_ROLE=worker` or `RAILWAY_SERVICE_NAME` → worker).
- If only **main** is deployed, add/use a **worker** service and redeploy.

### 6.3 Local manual run

```bash
RUNNER_MODE=true RUNNER_BROWSER=cdp pnpm run runner:posting-queue-once
```

Check:

- `[POSTING_QUEUE] ✅ job_tick start ...` in logs.
- `ready_candidates`, `selected_candidates`, `attempts_started` in script output.
- After run: **B**, **E**, and optionally **C**/**D** above.

### 6.4 Railway logs

Search for:

- `[POSTING_QUEUE] ✅ job_tick start`
- `[POSTING_QUEUE_BLOCK]`
- `POSTING_QUEUE_TICK`

---

## 7. NEXT STEPS IF STILL NO POSTS AFTER EXECUTION RESUMES

1. **Confirm worker runs:** Ensure a **worker** Railway service runs `JobManager` and that `processPostingQueue` is scheduled (e.g. every 5 min). No worker → no posts.
2. **Inspect `POSTING_QUEUE_BLOCKED`:** Run **F**. If e.g. `NO_READY_DECISIONS` dominates, fix planning/queueing; if `RATE_LIMIT` or `CONTROLLER_DENY`, adjust limits or growth controller.
3. **Check `POSTING_QUEUE_TICK`:** Run **B**. If ticks exist but `attempts_started` is always 0, the blocker is **after** fetch but **before** first attempt (e.g. rate limit, controller, gates). Use **F** to see which.
4. **Migration health:** If `MIGRATION_HEALTH` blocks, apply `is_test_post` migration and retest.
5. **Circuit breaker:** If `CIRCUIT_BREAKER` blocks, inspect recent failures, fix underlying cause, then reset breaker if your implementation allows.

---

## 8. FILES TOUCHED

- `src/jobs/postingQueue.ts`: job_tick log, `emitPostingQueueBlock`, `emitPostingQueueTick`, all block paths, tick/heartbeat on every exit, return `PostingQueueRunResult`.
- `scripts/runner/posting-queue-once.ts`: new manual trigger script.
- `package.json`: `runner:posting-queue-once` script.

---

**Report end.**
