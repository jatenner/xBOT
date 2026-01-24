# xBOT - Single Source of Truth

**Mission:** Autonomous Twitter bot that plans, posts, replies, scrapes, and learns to optimize follower growth and content quality.

**Status:** Operational - Control-plane (Railway) + Executor-plane (Mac Runner) split active  
**Last Updated:** 2026-01-23  
**Current SHA:** `2db22302785395a6c673809e15641143cdadc76c`

---

## Quick Start

### Run Locally (Mac Executor)

```bash
# 1. Sync env from Railway
pnpm run runner:autosync

# 2. Check session
pnpm run runner:session

# 3. Run posting queue once
pnpm run runner:posting-queue-once

# 4. Run reply queue once
pnpm run runner:reply-queue-once
```

### Deploy to Railway

```bash
# Deploy both services
pnpm run deploy:verify:both

# Check status
pnpm run ops:status
```

### Stop Executor (Emergency)

```bash
# Create STOP switch (works even in hot loops)
touch ./.runner-profile/STOP_EXECUTOR

# Or stop LaunchAgent
pnpm run executor:stop
```

---

## Architecture Overview

**Control-Plane (Railway):**
- **Services:** `xBOT` (main), `serene-cat` (worker)
- **Mode:** `EXECUTION_MODE=control` (NO browser automation)
- **Functions:** Plan generation, queue monitoring, DB writes, event emission
- **Entrypoint:** `src/railwayEntrypoint.ts`

**Executor-Plane (Mac Runner):**
- **Mode:** `EXECUTION_MODE=executor` + `RUNNER_MODE=true`
- **Functions:** Browser automation (CDP/Playwright), actual posting/replies
- **Guardrails:** STOP switch, page cap (max 3), runtime cap (60s/tick), single-instance lock
- **Scripts:** `scripts/runner/posting-queue-once.ts`, `scripts/runner/reply-queue-once.ts`

**Data Flow:**
```
Railway (control) → Creates decisions → content_metadata (queued)
Mac Runner (executor) → Processes queue → Posts to Twitter → Updates content_metadata (posted)
Scraper → Updates actual_* metrics → Dashboard reads
```

---

## Key Environment Variables

### Railway (Control-Plane)

- `EXECUTION_MODE=control` (required - fail-closed)
- `SERVICE_ROLE=worker|main` (or inferred from `RAILWAY_SERVICE_NAME`)
- `RAILWAY_SERVICE_NAME=xBOT|serene-cat`
- `DATABASE_URL` (Supabase PostgreSQL)
- `DISABLE_ALL_JOBS=true` (optional - disable jobs on non-worker)

### Mac Runner (Executor-Plane)

- `EXECUTION_MODE=executor` (required)
- `RUNNER_MODE=true` (required)
- `RUNNER_BROWSER=cdp` (CDP mode - reuse existing Chrome)
- `RUNNER_PROFILE_DIR=./.runner-profile` (profile directory)
- `CDP_PORT=9222` (Chrome DevTools Protocol port)
- `DATABASE_URL` (same as Railway)

---

## Documentation Structure

### Canonical Master Document
- **[README_MASTER.md](../README_MASTER.md)** - **Single source of truth**: Complete end-to-end description of xBOT system, architecture, pipelines, operational commands, and troubleshooting. **If you read only one document, read this one.**

### Detailed Documentation
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed system architecture, data flow, event stream
- **[RUNBOOK.md](./RUNBOOK.md)** - Operational procedures, deployment, health checks, incident response
- **[STATUS.md](./STATUS.md)** - Current state: SHAs, services, last events, known blockers
- **[TESTS_AND_PROOFS.md](./TESTS_AND_PROOFS.md)** - All proof scripts, what they verify, how to run
- **[TODO.md](./TODO.md)** - Prioritized backlog, next 10 items, definitions of done
- **[DECISION_LOG.md](./DECISION_LOG.md)** - Chronological design decisions and rationale
- **[TOC.md](./TOC.md)** - Table of contents with recommended reading order
- **[DATABASE_REFERENCE.md](./DATABASE_REFERENCE.md)** - Complete database schema reference

---

## Docs Update Policy

**Every code change MUST update:**

1. **docs/STATUS.md** - If changing SHAs, services, env vars, or operational state
2. **docs/DECISION_LOG.md** - If making architectural or design decisions
3. **docs/ARCHITECTURE.md** - If adding new services, env vars, or data flows
4. **docs/TESTS_AND_PROOFS.md** - If adding new proof/verification scripts

**Update commands:**

```bash
# Update status snapshot (queries DB for current state)
pnpm run docs:snapshot

# Manual updates (edit docs directly)
# Then commit with: "docs: update STATUS.md with latest SHA"
```

**Verification:**

- All env vars documented in `ARCHITECTURE.md` and `README.md`
- All proof scripts listed in `TESTS_AND_PROOFS.md`
- All design decisions logged in `DECISION_LOG.md`
- Current state reflected in `STATUS.md`

---

## Key Tables & Events

**Tables:**
- `content_metadata` - Primary table (decisions, content, metrics)
- `system_events` - Event stream (POST_SUCCESS, POST_FAILED, ticks, blocks)
- `reply_candidate_queue` - Reply candidates
- `reply_decisions` - Scheduled replies
- `outcomes` - Engagement metrics for learning

**Key Events:**
- `POST_SUCCESS` - Successful post (includes tweet_id, decision_id)
- `POST_FAILED` - Failed post (includes reason code)
- `POSTING_QUEUE_TICK` - Posting queue execution (ready, selected, attempts_started)
- `REPLY_QUEUE_TICK` - Reply queue execution
- `POSTING_QUEUE_BLOCKED` - Blocked attempt (reason: NOT_EXECUTOR_MODE, etc.)
- `REPLY_QUEUE_BLOCKED` - Blocked reply attempt

---

## Where to Look

**For deployment issues:** `docs/RUNBOOK.md` → "Deployment" section  
**For architecture questions:** `docs/ARCHITECTURE.md`  
**For current status:** `docs/STATUS.md`  
**For proof/verification:** `docs/TESTS_AND_PROOFS.md`  
**For database schema:** `docs/DATABASE_REFERENCE.md`  
**For design rationale:** `docs/DECISION_LOG.md`  

---

**See [TOC.md](./TOC.md) for complete documentation index.**
