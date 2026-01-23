# xBOT Architecture

**Last Updated:** 2026-01-23  
**SHA:** `2db22302785395a6c673809e15641143cdadc76c`

---

## System Overview

xBOT is a split-architecture autonomous Twitter bot:

- **Control-Plane (Railway):** Planning, monitoring, DB writes, event emission - NO browser automation
- **Executor-Plane (Mac Runner):** Browser automation (CDP/Playwright) for actual posting/replies

**Goal:** Stable autonomous system that plans, posts, replies, scrapes, and learns to optimize follower growth and content quality.

---

## Control-Plane (Railway)

### Services

**xBOT (Main Service):**
- **Role:** `main` (or inferred from `RAILWAY_SERVICE_NAME=xBOT`)
- **Mode:** `EXECUTION_MODE=control`
- **Functions:** Health server, monitoring, DB reads
- **Entrypoint:** `src/railwayEntrypoint.ts`
- **Start Command:** `pnpm tsx src/railwayEntrypoint.ts`

**serene-cat (Worker Service):**
- **Role:** `worker` (or inferred from `RAILWAY_SERVICE_NAME=serene-cat`)
- **Mode:** `EXECUTION_MODE=control`
- **Functions:** JobManager (plan, reply fetch, reply scheduler, posting queue ticks), DB writes
- **Entrypoint:** `src/railwayEntrypoint.ts`
- **Start Command:** `pnpm tsx src/railwayEntrypoint.ts`

**Service Role Resolution:**
- Priority 1: `SERVICE_ROLE` env var (explicit)
- Priority 2: Infer from `RAILWAY_SERVICE_NAME`:
  - `xBOT` → `main`
  - `serene-cat` → `worker`
- Priority 3: Default to `unknown` (blocks posting)

**Code:** `src/utils/serviceRoleResolver.ts`

### Job Schedules

**JobManager (`src/jobs/jobManager.ts`):**

| Job | Interval | Initial Delay | Function |
|-----|----------|---------------|----------|
| `posting` | 5 min | 0s (immediate) | `processPostingQueue()` - emits ticks, creates decisions |
| `plan` | 2 hours | 0s (if >2h since last) or 2min | `planContent()` - generates content decisions |
| `reply_v2_fetch` | 15 min | 30s | `replySystemV2Job()` - fetches candidates |
| `reply_v2_scheduler` | 15 min | 45s | `attemptScheduledReply()` - creates reply decisions |
| `metrics_scraper` | 30 min | 2min | Scrapes Twitter metrics |
| `learn` | 1 hour | 3min | `runLearningCycle()` - learns from outcomes |

**Staggered Scheduling:** Jobs start at different offsets to prevent resource stampede.

**Job Disabling:**
- `DISABLE_ALL_JOBS=true` - Disables all jobs (for non-worker services)
- `ENABLE_REPLIES=false` - Disables reply-related jobs

### Control-Plane Behavior

**Posting Queue (`src/jobs/postingQueue.ts`):**
- Checks `EXECUTION_MODE` and `RUNNER_MODE`
- If NOT executor mode:
  - Emits `POSTING_QUEUE_BLOCKED` with reason `NOT_EXECUTOR_MODE`
  - Sets `attempts_started=0` (never increments)
  - Still emits `POSTING_QUEUE_TICK` with ready/selected counts
- **Never starts browser automation** (Railway has no Playwright)

**Reply Queue (`src/jobs/replySystemV2/tieredScheduler.ts`):**
- Checks `EXECUTION_MODE` and `RUNNER_MODE`
- If NOT executor mode:
  - Emits `REPLY_QUEUE_BLOCKED` with reason `NOT_EXECUTOR_MODE`
  - Sets `attempts_started=0`
- Creates `reply_decisions` but doesn't execute

**Proof:** `docs/CONTROL_EXECUTOR_SPLIT_PROOF.md`

---

## Executor-Plane (Mac Runner)

### Mode Requirements

- `EXECUTION_MODE=executor` (required)
- `RUNNER_MODE=true` (required)
- `RUNNER_BROWSER=cdp` (CDP mode - reuse existing Chrome)
- `RUNNER_PROFILE_DIR=./.runner-profile` (profile directory)

### Entry Points

**One-Shot Scripts:**
- `scripts/runner/posting-queue-once.ts` - Process posting queue once
- `scripts/runner/reply-queue-once.ts` - Process reply queue once
- `scripts/runner/schedule-and-post.ts` - Schedule + post replies

**Daemon Scripts:**
- `scripts/runner/executor-daemon.ts` - Continuous executor (every 2 min)
- `scripts/runner/poll-and-post.ts` - Continuous polling (every 60s)
- `scripts/runner/daemon.ts` - Alternative daemon

**LaunchAgent:**
- `~/Library/LaunchAgents/com.xbot.executor.plist` - Auto-starts `executor-daemon.ts` on boot

### Executor Guardrails

**File:** `src/infra/executorGuard.ts` (legacy) + `scripts/executor/daemon.ts` (new)

**1. STOP Switch:**
- File: `${RUNNER_PROFILE_DIR}/STOP_EXECUTOR`
- Env: `STOP_EXECUTOR=true`
- **Works even in hot loops** (checked every iteration)
- **Must exit within 10 seconds**
- Immediate exit (no cleanup delay)

**2. Hard Page Cap:**
- Rule: If browser has > 3 pages → **HARD EXIT** (do not retry)
- Enforced in `closeExtraPages()` and `createPageWithGuard()`

**3. Hard Chrome Process Cap:**
- Rule: If > 1 Chrome instance → **HARD EXIT**
- Detects multiple Chrome PIDs via `ps -p`

**4. Hard Runtime Cap:**
- Rule: Any single tick max 60 seconds → **ABORT TICK**
- `createRuntimeCap(60000)` sets timeout per tick

**5. Single-Instance Lock:**
- File: `${RUNNER_PROFILE_DIR}/executor.pid`
- Only one executor can run at a time
- Stale locks auto-cleaned (dead process detection)

**6. Hard Page Cap:**
- Pages must remain <= 1
- If >1, close extras immediately
- If cannot close, exit with error

**7. Headless Enforcement:**
- `HEADLESS=true` by default (hard requirement)
- Hard fail if `HEADLESS=false` in daemon mode
- Uses `chromium.launch({ headless: true })` with dedicated userDataDir
- Never uses `connectOverCDP()` in daemon

**8. Auth Wall Detection:**
- Detects login/challenge walls
- Emits `EXECUTOR_AUTH_REQUIRED` event
- Writes `${RUNNER_PROFILE_DIR}/AUTH_REQUIRED` file
- Exits cleanly (no infinite loops)

**9. Backoff & Rate Limiting:**
- Exponential backoff: min 60s, max 10m
- Browser launches: max 1 per minute
- No tight retry loops
- `createPageWithGuard()` logs every page creation with stack trace

**7. Max Failures:**
- 5 consecutive failures → exit completely (don't keep looping)

**Proof:** `docs/EXECUTOR_TAB_EXPLOSION_ROOT_CAUSE.md`

---

## Data Flow

### Posting Flow

```
1. Railway (control) → planJob → Creates content_metadata rows (status='queued')
2. Railway (control) → postingQueue tick → Emits POSTING_QUEUE_TICK (attempts_started=0)
3. Mac Runner (executor) → posting-queue-once → Processes queue → Posts to Twitter
4. Mac Runner (executor) → Updates content_metadata (status='posted', tweet_id=...)
5. Mac Runner (executor) → Emits POST_SUCCESS event
6. Railway (control) → metrics_scraper → Updates actual_* columns
7. Dashboard → Reads actual_* columns
```

### Reply Flow

```
1. Railway (control) → reply_v2_fetch → Populates reply_candidate_queue
2. Railway (control) → reply_v2_scheduler → Creates reply_decisions (status='queued')
3. Railway (control) → Emits REPLY_QUEUE_TICK (attempts_started=0)
4. Mac Runner (executor) → reply-queue-once → Processes reply_decisions → Posts replies
5. Mac Runner (executor) → Updates reply_decisions (status='posted')
6. Mac Runner (executor) → Emits REPLY_SUCCESS event
7. Railway (control) → metrics_scraper → Updates actual_* columns
```

---

## Event Stream

**Key Events (`system_events` table):**

| Event Type | When | Data |
|------------|------|------|
| `POST_SUCCESS` | Successful post | `decision_id`, `tweet_id`, `posted_at` |
| `POST_FAILED` | Failed post | `decision_id`, `reason`, `error_details` |
| `POSTING_QUEUE_TICK` | Posting queue execution | `ready_candidates`, `selected_candidates`, `attempts_started` |
| `POSTING_QUEUE_BLOCKED` | Blocked attempt | `reason` (NOT_EXECUTOR_MODE, etc.) |
| `REPLY_QUEUE_TICK` | Reply queue execution | `ready_candidates`, `selected_candidates`, `attempts_started` |
| `REPLY_QUEUE_BLOCKED` | Blocked reply | `reason` (NOT_EXECUTOR_MODE, etc.) |
| `REPLY_SUCCESS` | Successful reply | `decision_id`, `tweet_id`, `target_tweet_id` |
| `timer_fired` | Job timer fired | `job_name`, `phase` (initial/recurring) |
| `timer_scheduled` | Job timer scheduled | `job_name`, `interval_ms`, `initial_delay_ms` |

**Event Queries:**

```sql
-- Last POST_SUCCESS
SELECT * FROM system_events 
WHERE event_type='POST_SUCCESS' 
ORDER BY created_at DESC LIMIT 1;

-- Posting queue activity (last 30 min)
SELECT event_data->>'ready_candidates' AS ready,
       event_data->>'attempts_started' AS attempts,
       created_at
FROM system_events
WHERE event_type='POSTING_QUEUE_TICK'
  AND created_at >= NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;
```

---

## Key Tables

**Primary Tables:**

1. **`content_metadata`** - Main table (decisions, content, metrics)
   - Columns: `decision_id`, `tweet_id`, `status`, `content`, `actual_*` metrics
   - See: `docs/DATABASE_REFERENCE.md`

2. **`system_events`** - Event stream
   - Columns: `event_type`, `event_data` (JSONB), `created_at`
   - Used for: Monitoring, debugging, proof

3. **`reply_candidate_queue`** - Reply candidates
   - Columns: `candidate_tweet_id`, `status`, `predicted_tier`, `overall_score`

4. **`reply_decisions`** - Scheduled replies
   - Columns: `decision_id`, `target_tweet_id`, `status`, `content`

5. **`outcomes`** - Engagement metrics
   - Columns: `decision_id`, `tweet_id`, `likes`, `retweets`, `views`, `engagement_rate`

**See:** `docs/DATABASE_REFERENCE.md` for complete schema

---

## Environment Variables

### Railway (Control-Plane)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXECUTION_MODE` | Yes | `control` | Must be `control` (fail-closed) |
| `SERVICE_ROLE` | No | inferred | `worker` or `main` |
| `RAILWAY_SERVICE_NAME` | Yes | - | `xBOT` or `serene-cat` |
| `DATABASE_URL` | Yes | - | Supabase PostgreSQL connection |
| `DISABLE_ALL_JOBS` | No | `false` | Set `true` to disable all jobs |
| `ENABLE_REPLIES` | No | `true` | Set `false` to disable reply jobs |
| `PORT` | No | `8080` | Health server port |
| `APP_COMMIT_SHA` | No | - | Git SHA (for deploy fingerprint) |
| `APP_BUILD_TIME` | No | - | Build timestamp |

### Mac Runner (Executor-Plane)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXECUTION_MODE` | Yes | - | Must be `executor` |
| `RUNNER_MODE` | Yes | - | Must be `true` |
| `RUNNER_BROWSER` | No | `cdp` | `cdp` or `direct` |
| `RUNNER_PROFILE_DIR` | No | `./.runner-profile` | Profile directory |
| `CDP_PORT` | No | `9222` | Chrome DevTools Protocol port |
| `DATABASE_URL` | Yes | - | Same as Railway |
| `STOP_EXECUTOR` | No | - | Set `true` to exit immediately |

---

## Failure Modes

### Control-Plane Failures

**JobManager Crash:**
- Jobs stop running
- No new decisions created
- Queue stops processing
- **Detection:** No `POSTING_QUEUE_TICK` events in last 10 min
- **Recovery:** Restart service, check logs

**Database Connection Loss:**
- Jobs fail with DB errors
- Events not written
- **Detection:** DB errors in logs
- **Recovery:** Check `DATABASE_URL`, verify Supabase status

**Service Role Mismatch:**
- Jobs disabled if `SERVICE_ROLE` incorrect
- **Detection:** `jobs_enabled=false` in boot log
- **Recovery:** Set `SERVICE_ROLE` correctly

### Executor-Plane Failures

**Tab Explosion:**
- Infinite Chrome tabs → Mac freeze
- **Detection:** Page count > 3 in logs
- **Recovery:** `touch ./.runner-profile/STOP_EXECUTOR`, kill Chrome

**CDP Connection Loss:**
- Cannot connect to Chrome
- **Detection:** `CDP not reachable` in logs
- **Recovery:** Start Chrome with CDP: `--remote-debugging-port=9222`

**Session Expired:**
- Not logged into Twitter
- **Detection:** `SESSION_EXPIRED` in logs
- **Recovery:** `pnpm run runner:login`

**Max Failures:**
- 5 consecutive failures → executor exits
- **Detection:** `MAX FAILURES REACHED` in logs
- **Recovery:** Fix root cause, restart executor

---

## Boot Fingerprint

**Boot Log Line:**
```
[BOOT] sha=<git_sha> build_time=<iso> execution_mode=<control|executor> runner_mode=<true|false> service_role=<role> railway_service=<name> jobs_enabled=<true|false>
```

**Health Endpoint (`/healthz`):**
```json
{
  "ok": true,
  "sha": "<git_sha>",
  "service": "<service_name>",
  "execution_mode": "control",
  "runner_mode": false,
  "service_role": "worker",
  "jobs_enabled": true
}
```

**Used For:** Deploy verification, SHA matching, service identification

---

**See [RUNBOOK.md](./RUNBOOK.md) for operational procedures.**
