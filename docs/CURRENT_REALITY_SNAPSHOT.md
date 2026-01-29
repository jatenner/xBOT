# xBOT Current Reality Snapshot

**Date:** 2026-01-29  
**Purpose:** Precise snapshot of what is PROVEN, what is IN PROGRESS, and what is FAILING

---

## PROVEN (With Proof Tags + Evidence)

### ✅ Phase 4: Control → Executor → X (POSTING)
- **Proof Tag:** `control-post-1769385308714`
- **Evidence:** [`docs/proofs/control-post/control-post-1769385308714.md`](docs/proofs/control-post/control-post-1769385308714.md)
- **Tweet:** `https://x.com/Signal_Synapse/status/2015574485135487461`
- **Status:** ✅ PASS - Full pipeline from control-plane decision → executor execution → verified tweet URL

### ✅ Phase 4: Control → Executor → X (REPLY)
- **Proof Tag:** `control-reply-1769440472369`
- **Evidence:** [`docs/proofs/control-reply/control-reply-1769440472369.md`](docs/proofs/control-reply/control-reply-1769440472369.md)
- **Reply:** `https://x.com/Signal_Synapse/status/2015805866801295663`
- **Status:** ✅ PASS - Full pipeline from control-plane decision → executor execution → verified reply URL
- **Decision ID:** `aa05774f-e0fd-494c-8ea1-48e91b8df55a`
- **Target Tweet ID:** `2015580329344446898`
- **Reply Tweet ID:** `2015805866801295663`
- **Success Event ID:** `39b6ce05-bc91-4f0c-af51-c106ddd05a32`
- **Attempt ID:** `663ef150-368a-4172-afd5-5eacd6c45423`

### ✅ Executor Safety (Headless Operation)
- **Proof:** `docs/EXECUTOR_5MIN_HEADLESS_PROOF.md`, `docs/EXECUTOR_15MIN_HEADLESS_PROOF.md`
- **Hard Assertions:** `windows_opened=0`, `chrome_cdp_processes=0`, `pages_max<=1`, `browser_launches<=1`
- **Status:** ✅ PASS - Executor runs headless, no visible windows

### ✅ Long-Running Executor Stability
- **Proof:** `docs/proofs/stability/stability-1769538319189.md`
- **Duration:** 2 hours under real load
- **Status:** ✅ PASS - Executor stable for extended periods

### ✅ STOP Switch Under Real Load
- **Proof:** `docs/proofs/stability/stop-switch-1769549639527.md`
- **Status:** ✅ PASS - STOP switch halts executor safely within 10 seconds

### ✅ Reply System V2: PLAN_ONLY Bridge (Generation)
- **Proof Tag:** `e2e-reply-v2-plan-only-grounding-fix-1769633000000`
- **Evidence:** [`docs/proofs/learning/e2e-reply-v2-plan-only-grounding-fix-1769633000000.md`](docs/proofs/learning/e2e-reply-v2-plan-only-grounding-fix-1769633000000.md)
- **Status:** ✅ PROVEN - Railway planner creates `reply_v2_planner` decisions, Mac Runner generates content with grounding check passing

### ✅ Railway Control-Plane Deployment
- Both services (`xBOT`, `serene-cat`) deploy via Railway GitHub Integration
- SHA verification via `/healthz` endpoints
- Both show `executionMode=control` (correct)

---

## IN PROGRESS

### 🔄 P1 Milestone: 1 Posted Reply + Reward (Reply V2)
- **Goal:** Get 1 `reply_v2_planner` decision to POST successfully with `runtime_preflight_status='ok'`
- **Current Blocker:** Runtime preflight OK-only gating + stale/deleted targets
- **Success Criteria:**
  - Decision transitions: `queued` → `runtime_preflight_status='ok'` → `posting_attempt` → `posted`
  - `features.tweet_id` populated
  - `features.reward` computed (after scraper runs)
- **Why Blocked:**
  - Runtime preflight check runs on Mac Runner before posting
  - Only `runtime_preflight_status='ok'` decisions proceed (proving phase)
  - Many decisions have `runtime_preflight_status='deleted'` or `'timeout'`
  - Targets may be stale by the time executor processes them
  - Need fresh opportunities from harvester (< 24 hours old)

---

## FAILING

### ❌ Reply System V2: Posting Blocked (Proving Phase)
- **Status:** Blocked by runtime preflight OK-only gating
- **Root Cause:** Stale targets + proving phase strict OK-only gating
- **What Needs to Happen:**
  - Fresh opportunities from harvester (< 24 hours old)
  - Runtime preflight must pass (`runtime_preflight_status='ok'`)
  - Target tweet must still exist and match snapshot

### ❌ Reply System V2: Queue Empty (Intermittent)
- **Status:** Planner sometimes finds no candidates
- **Possible Causes:**
  - Harvester not running or failing
  - Opportunities expired (freshness gates)
  - Filtering too strict

---

## PRIMARY BLOCKER (Single Sentence)

**Reply System V2 posting is blocked because runtime preflight checks are failing (targets deleted/stale/timeout) during the proving phase's OK-only gating, requiring fresh opportunities from the harvester and successful runtime preflight verification before any reply can post.**

---

## Verification Commands

### Check Control→Executor→X (REPLY) Proof
```bash
# View proof file
cat docs/proofs/control-reply/control-reply-1769440472369.md

# Verify reply exists
curl -s https://x.com/Signal_Synapse/status/2015805866801295663
```

### Check Current Reply V2 Status
```sql
-- Check for queued reply decisions
SELECT decision_id, status, pipeline_source, 
       features->>'runtime_preflight_status' as runtime_preflight_status,
       features->>'preflight_status' as preflight_status,
       created_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND pipeline_source IN ('reply_v2_planner', 'reply_v2_scheduler')
ORDER BY created_at DESC
LIMIT 10;

-- Check reply opportunities pool
SELECT COUNT(*) as pool_size,
       COUNT(*) FILTER (WHERE tweet_posted_at > NOW() - INTERVAL '24 hours') as fresh_count
FROM reply_opportunities
WHERE replied_to = false;
```

### Check Harvester Status
```bash
# Check if harvester is running (local, not Railway)
ps aux | grep replyOpportunityHarvester

# Check recent harvester runs
railway logs --service xBOT --lines 100 | grep HARVESTER
```
