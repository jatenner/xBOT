# P1 Orchestration Plan

**Date:** 2026-02-01  
**Status:** IN PROGRESS  
**Current Phase:** Phase A - Candidate Supply

---

## PHASE A — Candidate Supply

### What We're Proving
Railway can harvest ≥25 `public_search_*` candidates without authentication.

### Why It Might Fail
- Public search queries return few results (queries too restrictive)
- Twitter rate limiting
- Search queries not executing (code path issue)

### Harvest Strategy Analysis

**P1 Mode Public Queries (3 total):**
1. `PUBLIC_HEALTH_LOW`: 300+ likes, max 150 results, 12h window
2. `PUBLIC_FITNESS_LOW`: 300+ likes, max 150 results, 12h window  
3. `PUBLIC_HEALTH_MED`: 1000+ likes, max 200 results, 24h window

**Default Behavior:**
- Max 3 searches per cycle (unless pool critical)
- Each query can return 5-15 candidates typically
- Expected: 3 cycles → 15-25 candidates

### Exact Commands

**Batch 1: Run 3 harvest cycles**

**Cycle 1:**
```bash
railway run --service serene-cat P1_MODE=true pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts > /tmp/harvest-cycle-1.log 2>&1
```

**After Cycle 1, paste back:**
```bash
pnpm exec tsx scripts/ops/check-public-count.ts
```
Paste the single output line.

**Cycle 2:**
```bash
railway run --service serene-cat P1_MODE=true pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts > /tmp/harvest-cycle-2.log 2>&1
```

**After Cycle 2, paste back:**
```bash
pnpm exec tsx scripts/ops/check-public-count.ts
```

**Cycle 3:**
```bash
railway run --service serene-cat P1_MODE=true pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts > /tmp/harvest-cycle-3.log 2>&1
```

**After Cycle 3, paste back:**
1. Public candidate count:
   ```bash
   pnpm exec tsx scripts/ops/check-public-count.ts
   ```

2. Last harvest log snippet (10-20 lines):
   ```bash
   tail -20 /tmp/harvest-cycle-3.log | grep -E "\[HARVESTER|public_search|stored|opportunities|PUBLIC|tier="
   ```

### What I'll Do After You Paste
- Analyze count progression (1 → X → Y → Z)
- Verify `public_search_*` queries are executing
- Check if candidates are being stored with correct `discovery_source`
- Decide: proceed to Phase B if ≥25, or run 2 more cycles if <25

---

## PHASE B — Probe Readiness

### What We're Proving
At least 1 candidate passes preflight probe (`ok >= 1`).

### Why It Might Fail
- All candidates are `forbidden` (protected accounts)
- All candidates are `login_wall` (consent required)
- All candidates are `deleted` (tweets removed)
- Scheduler logic issue (probe not running)

### Exact Commands

**Once candidates ≥25, run plan-only:**

```bash
railway run --service serene-cat \
  REPLY_V2_ROOT_ONLY=true \
  P1_MODE=true \
  P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20 \
  REPLY_V2_PLAN_ONLY=true \
  pnpm exec tsx scripts/ops/run-reply-v2-planner-once.ts 2>&1 | tee /tmp/planner-plan-only.log
```

### Exact Outputs to Paste Back

**1. P1_PROBE_SUMMARY line:**
```bash
grep "P1_PROBE_SUMMARY" /tmp/planner-plan-only.log
```
Paste the single line containing `P1_PROBE_SUMMARY`.

**2. If ok==0, also paste probe reasons:**
```bash
pnpm exec tsx scripts/ops/p1-probe-reasons.ts
```
Paste the full output.

### What I'll Do After You Paste
- If `ok >= 1`: ✅ Proceed to Phase C
- If `ok == 0`: Analyze probe reasons and decide:
  - **Discovery issue:** Queries finding wrong accounts → widen queries
  - **Accessibility issue:** All `forbidden` → adjust filters
  - **Scheduler issue:** Probe not running → fix logic

---

## PHASE C — Posting

### What We're Proving
Executor can claim a decision and post a reply, resulting in a tweet URL in DB.

### Why It Might Fail
- Executor not running
- Executor auth invalid
- Posting logic error
- Rate limiting

### Exact Commands

**Step 1: Create real decisions (no PLAN_ONLY):**
```bash
railway run --service serene-cat \
  REPLY_V2_ROOT_ONLY=true \
  P1_MODE=true \
  P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20 \
  pnpm exec tsx scripts/ops/run-reply-v2-planner-once.ts 2>&1 | tee /tmp/planner-real.log
```

**After Step 1, paste back:**
```bash
grep -E "decision_id|status=queued" /tmp/planner-real.log | head -5
```
Paste lines showing decision creation.

**Step 2: Start executor daemon (if not running):**
```bash
EXECUTION_MODE=executor RUNNER_MODE=true pnpm run executor:daemon > /tmp/executor.log 2>&1 &
```

**Step 3: Wait and verify posted reply:**
```bash
# Wait 60 seconds, then check status
sleep 60
pnpm exec tsx scripts/p1-status.ts
```

### Exact Outputs to Paste Back

**1. Decision creation:**
Paste lines showing `decision_id` and `status=queued`.

**2. Final status check:**
```bash
pnpm exec tsx scripts/p1-status.ts
```
Paste the full output, especially:
- Section 4 (Last decision)
- Section 5 (Last posted reply) - should show URL ✅

**3. If reply posted, also paste:**
```bash
grep -E "REPLY_SUCCESS|posted|tweet_id" /tmp/executor.log | tail -10
```

### What I'll Do After You Paste
- Verify `tweet_id` exists in `content_metadata`
- Verify `status='posted'` 
- Extract reply URL: `https://x.com/i/web/status/{tweet_id}`
- Create `P1_FIRST_REPLY_POSTED.md` proof doc
- Proceed to Phase D

---

## PHASE D — Reporting

### What We're Proving
P1 is complete with all evidence documented.

### Exact Commands

**Update trackers:**
```bash
# I'll update these files automatically after reply URL confirmed
```

### What I'll Do
- Update `docs/TRACKER.md`: Mark Phase 5 complete, Phase 6 complete
- Update `docs/SYSTEM_STATUS.md`: Mark P1 status as PASS
- Create `docs/proofs/p1-reply-v2-first-post/P1_FIRST_REPLY_POSTED.md` with:
  - `decision_id`
  - `tweet_id`
  - Reply URL
  - Timestamp
  - Commands run
  - P1_PROBE_SUMMARY line

---

## Current Status

- **Phase A:** IN PROGRESS (1 candidate, need 25)
- **Phase B:** PENDING
- **Phase C:** PENDING  
- **Phase D:** PENDING

**Next Action:** Run Cycle 1 harvest and paste back count.
