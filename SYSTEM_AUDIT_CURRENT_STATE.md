# xBOT System Audit: Current State (2026-01-29)

**Purpose:** Descriptive audit of what EXISTS in the codebase, what is PROVEN, what is FAILING, and what documentation is OUT OF SYNC.

**Audit Date:** 2026-01-29  
**Audit Scope:** Codebase analysis, recent commits, proof files, system status docs  
**Audit Method:** Code reading, proof verification, documentation comparison

---

## 1. System Overview (Current Reality)

### What xBOT Is

xBOT is an **autonomous Twitter/X growth system** that:

1. **Generates content** using OpenAI (GPT-4o-mini) for posts and replies
2. **Posts via browser automation** using Playwright on a Mac executor (headless)
3. **Splits control-plane (Railway) and executor-plane (Mac)** via `EXECUTION_MODE` enforcement
4. **Stores everything in Supabase PostgreSQL** (decisions, attempts, outcomes, learning signals)
5. **Has two parallel reply systems:**
   - **Reply System V1** (`replyJob.ts`) - Legacy, still exists
   - **Reply System V2** (`replySystemV2/`) - New architecture with planner/scheduler split

### Architecture Split

- **Railway (Control-Plane):**
  - `EXECUTION_MODE=control` (enforced)
  - Creates decisions, schedules, evaluates candidates
  - **MUST NOT** execute browser automation
  - Two services: `xBOT` and `serene-cat` (can drift if not deployed together)

- **Mac (Executor-Plane):**
  - `EXECUTION_MODE=executor` (enforced)
  - `RUNNER_MODE=true` required
  - Claims decisions from DB (`queued` → `posting`)
  - Executes browser automation (headless, `HEADLESS=true` enforced)
  - Posts replies via `UltimateTwitterPoster.postReply()`

### Current Operational State

- **Harvesting:** Runs locally (not on Railway), `HARVESTING_ENABLED` flag controls
- **Posting:** Controlled by `POSTING_ENABLED` flag (Railway env var)
- **Reply V2:** In "proving phase" with OK-only runtime preflight gating
- **Executor:** Headless daemon with strict safety invariants (proven)

---

## 2. What Is Fully Implemented and Proven

### ✅ Phase 4: Control → Executor → X (PROVEN)

**Posting Pipeline:**
- **Proof Tag:** `control-post-1769385308714`
- **Evidence:** `docs/proofs/control-post/control-post-1769385308714.md`
- **Tweet:** `https://x.com/Signal_Synapse/status/2015574485135487461`
- **Status:** ✅ PASS - Full pipeline from control-plane decision → executor execution → verified tweet URL

**Reply Pipeline:**
- **Proof Tag:** `control-reply-1769440472369`
- **Evidence:** `docs/proofs/control-reply/control-reply-1769440472369.md`
- **Reply:** `https://x.com/Signal_Synapse/status/2015805866801295663`
- **Status:** ✅ PASS - Full pipeline from control-plane decision → executor execution → verified reply URL

### ✅ Executor Safety (PROVEN)

**Headless Operation:**
- **Proof:** `docs/EXECUTOR_5MIN_HEADLESS_PROOF.md`, `docs/EXECUTOR_15MIN_HEADLESS_PROOF.md`
- **Hard Assertions:** `windows_opened=0`, `chrome_cdp_processes=0`, `pages_max<=1`, `browser_launches<=1`
- **Status:** ✅ PASS - Executor runs headless, no visible windows

**Long-Running Stability:**
- **Proof:** `docs/proofs/stability/stability-1769538319189.md`
- **Duration:** 2 hours under real load
- **Status:** ✅ PASS - Executor stable for extended periods

**STOP Switch:**
- **Proof:** `docs/proofs/stability/stop-switch-1769549639527.md`
- **Status:** ✅ PASS - STOP switch halts executor safely within 10 seconds

### ✅ Reply System V2: PLAN_ONLY Bridge (PROVEN)

**Generation Works:**
- **Proof Tag:** `e2e-reply-v2-plan-only-grounding-fix-1769633000000`
- **Evidence:** `docs/proofs/learning/e2e-reply-v2-plan-only-grounding-fix-1769633000000.md`
- **Status:** ✅ PROVEN - Railway planner creates `reply_v2_planner` decisions, Mac Runner generates content with grounding check passing
- **Note:** Posting blocked by stale targets (expected behavior, not a code issue)

### ✅ Railway Deployment (PROVEN)

- Both services (`xBOT`, `serene-cat`) deploy via Railway GitHub Integration
- SHA verification via `/healthz` endpoints
- Both show `executionMode=control` (correct)

---

## 3. What Is Implemented but Still Failing

### ⚠️ Reply System V2: Posting Blocked (Proving Phase)

**Current State:**
- **Generation:** ✅ Working (PLAN_ONLY bridge proven)
- **Posting:** ❌ Blocked by runtime preflight OK-only gating

**Why Posting Is Blocked:**

1. **Runtime Preflight Check (JIT Verification):**
   - Runs on Mac Runner before posting
   - Verifies target tweet still exists and matches snapshot
   - **Proving Phase:** Only `runtime_preflight_status='ok'` decisions proceed
   - **Current Issue:** Many decisions have `runtime_preflight_status='deleted'` or `'timeout'`

2. **Stale Targets:**
   - Harvester finds opportunities and stores in `reply_opportunities`
   - Planner creates decisions from opportunities
   - **Problem:** By the time executor tries to post, targets may be:
     - Deleted by author
     - Changed content (snapshot mismatch)
     - Too old (freshness gate)

3. **Freshness Window:**
   - Default: 48 hours max age (`REPLY_MAX_TWEET_AGE_HOURS`)
   - High-engagement tweets get longer windows (72h for 100K+ likes)
   - **Current Issue:** Opportunities may expire before executor processes them

**Evidence from Code:**
- `src/jobs/postingQueue.ts:4656-4766` - Runtime preflight check with OK-only gating
- `src/jobs/postingQueue.ts:3104-3127` - Decision prioritization by `runtime_preflight_status`
- `docs/SYSTEM_STATUS.md:20` - "Posting currently blocked by stale targets (expected behavior)"

**What Needs to Happen:**
- Fresh opportunities from harvester (< 24 hours old)
- Runtime preflight must pass (`runtime_preflight_status='ok'`)
- Target tweet must still exist and match snapshot

### ⚠️ Reply System V2: Queue Empty (Intermittent)

**Current State:**
- Planner sometimes finds no candidates (`queue_empty`)
- Scheduler logs: "No candidates available in queue"

**Why Queue Is Empty:**

1. **Harvester Not Running:**
   - `HARVESTING_ENABLED=false` on Railway (correct, harvesting runs locally)
   - Local harvester may not be running or may be failing

2. **Opportunities Expired:**
   - Freshness gates purge old opportunities
   - Pool may drop below minimum threshold

3. **Filtering Too Strict:**
   - Planner filters candidates by tier
   - May exclude all candidates if filters too strict

**Evidence from Code:**
- `src/jobs/replySystemV2/tieredScheduler.ts:448` - "No candidates available in queue"
- `src/jobs/replySystemV2/queueManager.ts:77` - "No candidates available for queue"

---

## 4. Primary Blocking Issue (Single Sentence)

**Reply System V2 posting is blocked because runtime preflight checks are failing (targets deleted/stale/timeout) during the proving phase's OK-only gating, requiring fresh opportunities from the harvester and successful runtime preflight verification before any reply can post.**

---

## 5. What Should Be Updated in README Right Now

### `docs/SYSTEM_STATUS.md` - OUT OF SYNC

**Current Claims vs Reality:**

1. **Line 20:** "Posting currently blocked by stale targets (expected behavior). Need fresh opportunities from harvester."
   - ✅ **ACCURATE** - This is correct

2. **Line 162:** "Control→Executor→X (Replying) | 🚧 IN PROGRESS"
   - ❌ **OUTDATED** - Should be ✅ PROVEN (proof exists: `control-reply-1769440472369`)

3. **Line 707-714:** "P1: 1 Posted Reply + Reward — IN PROGRESS"
   - ✅ **ACCURATE** - This is the current milestone

**What to Update:**

```markdown
✅ **Proof Level 4: Control → Executor → X (REPLY)** — PROVEN

**Proof Tag:** `control-reply-1769440472369`  
**Evidence:** [`docs/proofs/control-reply/control-reply-1769440472369.md`](docs/proofs/control-reply/control-reply-1769440472369.md)  
**Reply:** `https://x.com/Signal_Synapse/status/2015805866801295663`

- Decision ID: `aa05774f-e0fd-494c-8ea1-48e91b8df55a`
- Target Tweet ID: `2015580329344446898`
- Reply Tweet ID: `2015805866801295663`
- Success Event ID: `39b6ce05-bc91-4f0c-af51-c106ddd05a32`
- Attempt ID: `663ef150-368a-4172-afd5-5eacd6c45423`
```

### `README_MASTER.md` - MOSTLY ACCURATE

**Current Claims vs Reality:**

1. **Line 666-670:** Claims REPLY is PROVEN
   - ✅ **ACCURATE** - Proof exists

2. **Line 719:** "⚠️ Status (2026-01-24): ❌ FAILED - Real execution attempt failed"
   - ⚠️ **POTENTIALLY OUTDATED** - This may be from an older proof attempt, but newer proof (1769440472369) succeeded

3. **Line 751:** "⚠️ Status (2026-01-24): ❌ FAILED - Real execution attempt failed"
   - ⚠️ **POTENTIALLY OUTDATED** - Same as above

**What to Verify:**

- Check if these failure statuses are from older proof attempts
- If newer proof (1769440472369) succeeded, these should reference the successful proof

### Documentation Gaps

**Missing Documentation:**

1. **Reply System V2 Architecture:**
   - No single document explaining planner → scheduler → executor flow
   - Scattered across multiple files (`planner.ts`, `tieredScheduler.ts`, `queueManager.ts`)

2. **Runtime Preflight Gating:**
   - Proving phase OK-only gating not well documented
   - Should explain why posting is blocked and what needs to happen

3. **Harvester Status:**
   - No clear documentation on harvester operational status
   - Should document: Is it running? Where? How often?

---

## 6. What Should NOT Be Touched Yet

### ✅ Do NOT Modify (Stable & Proven)

1. **Executor Safety Invariants:**
   - Headless enforcement (`HEADLESS=true` check)
   - CDP mode blocking (`RUNNER_BROWSER=cdp` fail-fast)
   - Page cap (`pages_max<=1`)
   - STOP switch logic

2. **Phase 4 Proof Infrastructure:**
   - Proof scripts (`executor:prove:e2e-control-post`, `executor:prove:e2e-control-reply`)
   - Proof report format
   - Immutable proof files

3. **Control-Plane Guardrails:**
   - `EXECUTION_MODE=control` enforcement
   - `POSTING_QUEUE_BLOCKED` / `REPLY_QUEUE_BLOCKED` events
   - Railway service role checks

### ⚠️ Do NOT Modify (In Proving Phase)

1. **Runtime Preflight OK-Only Gating:**
   - Currently in proving phase (strict OK-only)
   - Do not add timeout fallback yet (Phase 2 milestone)
   - Wait for P1 milestone (1 posted reply + reward)

2. **Reply V2 Planner Logic:**
   - Currently working (generation proven)
   - Do not refactor until posting proven stable

3. **Freshness Gates:**
   - Currently configured correctly
   - Do not widen windows until posting proven stable

---

## 7. How the Reply System Actually Works End-to-End (Current State)

### Reply System V2 Flow (Current Implementation)

```
1. HARVESTER (Local, not Railway)
   ├─ Seed account harvester: Scrapes seed accounts for tweets
   ├─ Tweet-based harvester: Searches Twitter for viral tweets
   └─ Stores opportunities in `reply_opportunities` table
      ├─ Filters: <24h old, has engagement, not replied to
      └─ Tiers: golden/good/acceptable

2. PLANNER (Railway, `reply_v2_planner`)
   ├─ Queries `reply_opportunities` for candidates
   ├─ Soft preflight check (verifies target exists)
   ├─ Creates `reply_v2_planner` decisions in `content_metadata`
   ├─ Sets `preflight_status='ok'` or `'timeout'` or `'deleted'`
   └─ Status: `queued`, `pipeline_source='reply_v2_planner'`

3. SCHEDULER (Railway, `reply_v2_scheduler`)
   ├─ Queries `content_metadata` for `reply_v2_planner` decisions
   ├─ Prioritizes by `preflight_status` (ok > timeout > deleted)
   ├─ Selects top candidate
   └─ Updates `pipeline_source='reply_v2_scheduler'` (for posting permit)

4. EXECUTOR (Mac Runner)
   ├─ Claims decision: `queued` → `posting`
   ├─ Runtime preflight check (JIT verification):
   │  ├─ Fetches target tweet from Twitter
   │  ├─ Verifies still exists and matches snapshot
   │  └─ Sets `runtime_preflight_status='ok'` or `'deleted'` or `'timeout'`
   ├─ PROVING PHASE: Only `runtime_preflight_status='ok'` proceeds
   ├─ Generates reply content (if PLAN_ONLY mode)
   ├─ Grounding check (content includes 2+ terms from tweet)
   ├─ Posts via `UltimateTwitterPoster.postReply()`
   └─ Updates status: `posting` → `posted` or `failed`

5. TRACKING
   ├─ Records attempt in `outcomes` table
   ├─ Records result in `outcomes` table
   ├─ Emits `REPLY_SUCCESS` or `REPLY_FAILED` event
   └─ Updates `strategy_rewards` table (learning loop)
```

### Key Files (Current Implementation)

- **Harvester:** `src/jobs/replyOpportunityHarvester.ts`
- **Planner:** `src/jobs/replySystemV2/plannerFinalize.ts` (likely, need to verify exact file)
- **Scheduler:** `src/jobs/replySystemV2/tieredScheduler.ts`
- **Queue Manager:** `src/jobs/replySystemV2/queueManager.ts`
- **Runtime Preflight:** `src/jobs/postingQueue.ts:4656-4766`
- **Posting:** `src/jobs/postingQueue.ts:6509-7399` (`postReply()` function)
- **Poster:** `src/posting/UltimateTwitterPoster.ts:2155` (`postReply()` method)

---

## 8. What the System Is Waiting On Right Now

### Immediate Blockers

1. **Fresh Reply Opportunities:**
   - Harvester needs to run and find fresh tweets (<24h old)
   - Opportunities must pass freshness gates
   - Pool needs to maintain 150-250 opportunities

2. **Runtime Preflight Success:**
   - Target tweets must still exist when executor tries to post
   - Target content must match snapshot (semantic similarity check)
   - Preflight must complete within timeout (default 10s, clamped 3-20s)

3. **P1 Milestone: 1 Posted Reply + Reward:**
   - Need 1 successful reply post with `runtime_preflight_status='ok'`
   - Need reward computation after metrics scraper runs
   - Need `strategy_rewards` table updated

### Current Milestones (from `docs/SYSTEM_STATUS.md`)

**P1: 1 Posted Reply + Reward** — IN PROGRESS
- Goal: Get 1 `reply_v2_planner` decision to POST successfully
- Success criteria:
  - Decision transitions: `queued` → `runtime_preflight_status='ok'` → `posting_attempt` → `posted`
  - `features.tweet_id` populated
  - `features.reward` computed (after scraper runs)

**P2: 5 Posted Replies + Strategy Rewards Updated**
- Goal: Prove learning loop is functioning
- Success criteria:
  - At least 5 posted replies with `runtime_preflight_status='ok'`
  - `strategy_rewards` table updated (sample_count incremented)
  - Mean reward values computed

**P3: Enable Timeout Fallback (Phase 2)**
- Goal: Allow timeout decisions to proceed with guardrails
- Success criteria:
  - Timeout fallback enabled with strict conditions
  - Success rate maintained
  - No increase in deleted target failures

---

## 9. Summary: Documentation Sync Status

### ✅ Accurate Documentation

- `docs/SYSTEM_STATUS.md` - Mostly accurate, minor updates needed
- `README_MASTER.md` - Mostly accurate, verify failure statuses
- Proof files - Immutable, accurate

### ❌ Out-of-Sync Documentation

- `docs/SYSTEM_STATUS.md:162` - Claims REPLY is "IN PROGRESS" but proof exists
- `README_MASTER.md:719,751` - May reference old failed proofs, need to verify

### 📝 Missing Documentation

- Reply System V2 architecture overview (planner → scheduler → executor)
- Runtime preflight gating explanation (proving phase)
- Harvester operational status and configuration

---

## 10. Unclear Areas (Need Investigation)

1. **Harvester Operational Status:**
   - Is harvester running? Where? How often?
   - What is current pool size?
   - Are opportunities being created?

2. **Reply System V1 vs V2:**
   - Is V1 still active?
   - Are both systems creating decisions?
   - Which system is primary?

3. **Recent Commit Impact:**
   - Latest commits focus on reply-v2 fixes
   - Need to verify if these fixes resolved blocking issues
   - Need to check if runtime preflight timeout was adjusted

---

**End of Audit Report**
