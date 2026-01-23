# Decision Log

**Last Updated:** 2026-01-23  
**Purpose:** Chronological record of design decisions and rationale

---

## 2026-01-23 - Control/Executor Split

**Decision:** Split system into control-plane (Railway) and executor-plane (Mac Runner)

**Why:**
- Railway was attempting browser automation but couldn't complete (no Playwright access)
- Created misleading metrics (`attempts_started > 0` but no posts)
- Wasted resources on failed attempts

**Implementation:**
- Railway: `EXECUTION_MODE=control` (default, fail-closed)
- Mac Runner: `EXECUTION_MODE=executor` + `RUNNER_MODE=true`
- Railway blocks attempts, emits `POSTING_QUEUE_BLOCKED` with `NOT_EXECUTOR_MODE`
- Mac executor actually executes browser automation

**Files Changed:**
- `src/jobs/postingQueue.ts` - Added `EXECUTION_MODE` guard
- `src/jobs/replySystemV2/tieredScheduler.ts` - Added `EXECUTION_MODE` guard
- `src/railwayEntrypoint.ts` - Added `execution_mode` to boot log

**Proof:** `docs/CONTROL_EXECUTOR_SPLIT_PROOF.md`

---

## 2026-01-23 - Executor Guardrails

**Decision:** Implement hard caps and emergency stops for Mac executor

**Why:**
- Executor was spawning infinite Chrome tabs, freezing Mac
- No way to stop runaway loops
- No limits on page count, Chrome processes, or runtime

**Implementation:**
- STOP switch: `./.runner-profile/STOP_EXECUTOR` file or `STOP_EXECUTOR=true` env
- Hard page cap: >3 pages → immediate exit
- Hard Chrome process cap: >1 instance → immediate exit
- Hard runtime cap: 60s max per tick → abort tick
- Single-instance lock: PID file prevents duplicates
- Page reuse: Reuse existing page instead of creating new
- Max failures: 5 consecutive failures → exit completely

**Files Changed:**
- `src/infra/executorGuard.ts` - All guardrails
- `scripts/runner/executor-daemon.ts` - Integrated guards
- `scripts/runner/poll-and-post.ts` - Integrated guards
- `scripts/runner/schedule-and-post.ts` - Integrated guards
- `src/infra/playwright/runnerLauncher.ts` - Guard checks
- `src/posting/UltimateTwitterPoster.ts` - Page reuse + guarded creation

**Proof:** `docs/EXECUTOR_TAB_EXPLOSION_ROOT_CAUSE.md`

---

## 2026-01-23 - Deploy Fingerprint

**Decision:** Add boot fingerprint with SHA, execution mode, service role

**Why:**
- Need to verify deployed SHA matches local
- Need to identify service role and execution mode
- Need to track deploy integrity

**Implementation:**
- Boot log: `[BOOT] sha=... execution_mode=... runner_mode=... service_role=... railway_service=... jobs_enabled=...`
- Health endpoint: `/healthz` returns SHA, service, execution_mode, etc.
- Used for deploy verification

**Files Changed:**
- `src/railwayEntrypoint.ts` - Boot log enhancement

**Proof:** `docs/FINAL_DEPLOY_AND_REPLY_SUMMARY.md`

---

## 2026-01-23 - Service Role Resolution

**Decision:** Resolve service role from `SERVICE_ROLE` env var or infer from `RAILWAY_SERVICE_NAME`

**Why:**
- Need to identify which service is worker vs main
- Worker service runs JobManager, main service is monitoring only
- Current production: xBOT=main, serene-cat=worker

**Implementation:**
- Priority 1: `SERVICE_ROLE` env var (explicit)
- Priority 2: Infer from `RAILWAY_SERVICE_NAME`:
  - `xBOT` → `main`
  - `serene-cat` → `worker`
- Priority 3: Default to `unknown` (blocks posting)

**Files Changed:**
- `src/utils/serviceRoleResolver.ts`

**Proof:** `docs/FINAL_DEPLOY_AND_REPLY_SUMMARY.md`

---

## 2026-01-23 - Posting Queue Blocked Events

**Decision:** Emit `POSTING_QUEUE_BLOCKED` events when attempts are blocked

**Why:**
- Need visibility into why attempts aren't starting
- Helps debug control-plane vs executor-plane issues
- Provides audit trail

**Implementation:**
- Emit `POSTING_QUEUE_BLOCKED` with reason code (`NOT_EXECUTOR_MODE`, etc.)
- Store in `system_events` table
- Queryable for monitoring

**Files Changed:**
- `src/jobs/postingQueue.ts` - Block event emission

**Proof:** `docs/CONTROL_EXECUTOR_SPLIT_PROOF.md`

---

## 2026-01-23 - Reply Queue Blocked Events

**Decision:** Emit `REPLY_QUEUE_BLOCKED` events when reply attempts are blocked

**Why:**
- Same as posting queue blocked events
- Visibility into reply system behavior

**Implementation:**
- Emit `REPLY_QUEUE_BLOCKED` with reason code
- Store in `system_events` table

**Files Changed:**
- `src/jobs/replySystemV2/tieredScheduler.ts` - Block event emission

**Proof:** `docs/CONTROL_EXECUTOR_SPLIT_PROOF.md`

---

## Historical Decisions (Pre-2026-01-23)

**Note:** These are inferred from code/docs but not explicitly documented:

- **4-Table System:** `content_metadata`, `outcomes`, `learning_posts`, `tweet_metrics` (see `docs/DATABASE_REFERENCE.md`)
- **5-Dimensional Content Generation:** raw_topic, angle, tone, generator_name, format_strategy
- **Staggered Job Scheduling:** Jobs start at different offsets to prevent resource stampede
- **CDP Mode:** Mac runner uses Chrome DevTools Protocol to reuse existing Chrome instance

---

**See [ARCHITECTURE.md](./ARCHITECTURE.md) for system details.**
