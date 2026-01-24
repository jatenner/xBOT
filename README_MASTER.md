# xBOT — Master README (Single Source of Truth)

> Purpose: This document is the complete, end-to-end description of the xBOT system, including architecture, runtime roles, Mac executor vs Railway control-plane, posting/reply pipelines, observability/proofs, and operational commands.
>
> If a new AI agent reads only ONE document, it should be this one.

---

## Table of Contents

1. [What xBOT is](#what-xbot-is)
2. [Non-negotiable objectives](#non-negotiable-objectives)
3. [Key principle: Control-plane vs Executor-plane](#key-principle-control-plane-vs-executor-plane)
4. [Current state summary](#current-state-summary)
5. [System architecture](#system-architecture)
6. [Core pipelines](#core-pipelines)
   - [Posting pipeline](#posting-pipeline)
   - [Reply pipeline](#reply-pipeline)
   - [Learning pipeline](#learning-pipeline)
7. [Execution modes and guardrails](#execution-modes-and-guardrails)
8. [Services: Railway](#services-railway)
9. [Mac Executor: Why it exists and how it must behave](#mac-executor-why-it-exists-and-how-it-must-behave)
10. [Operational commands](#operational-commands)
11. [Verification and proof strategy](#verification-and-proof-strategy)
12. [Troubleshooting](#troubleshooting)
13. [Roadmap: What's built vs what's left](#roadmap-whats-built-vs-whats-left)
14. [Quality + anti-bot constraints](#quality--anti-bot-constraints)
15. [Glossary](#glossary)

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

### Railway deploy (both services)
Use your preferred approach (CLI):
- `railway up --detach` for the currently selected service
- or explicitly:
  - `railway up --service xBOT --detach`
  - `railway up --service serene-cat --detach`

### Verify service SHA (logs)
Examples:
- `railway logs --service xBOT | grep BOOT`
- `railway logs --service serene-cat | grep BOOT`

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
- `touch ./.runner-profile/STOP_EXECUTOR`

Status:
- `pnpm run ops:executor:status` (if implemented)

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

We use a 15-minute automated proof test that prints PASS/FAIL and writes a report:
- `docs/EXECUTOR_15MIN_HEADLESS_PROOF.md` (example report path)

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
   - `touch ./.runner-profile/STOP_EXECUTOR`
2) Kill lingering executor processes.
3) Check LaunchAgent is not running old command.
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
  - README/ARCHITECTURE/RUNBOOK/STATUS/DECISION_LOG/TOC/TODO

### Built but must be proven stable
- Mac executor daemon + 15-min proof scripts
- STOP switch + PID lock + caps + headless-by-default architecture

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
   - ARCHITECTURE
   - RUNBOOK
   - STATUS snapshot
3) Any daemon must:
   - never seize the user's computer
   - have STOP switch and single-instance enforcement
   - run headless by default
4) Cadence is a learned policy bounded by safety rails, not pure hardcode.

---
