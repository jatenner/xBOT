# P1 Proof Commands

**Date:** 2026-02-01  
**Commit:** `77738300` (Architectural fix: Executor owns authenticated browsing)

## Proof Commands

### 1. Railway Public Harvest (No Auth Required)
```bash
railway run --service serene-cat pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts 2>&1 | grep -E "\[HARVESTER|public_search|SEED|logged_in" | head -20
```
**Expected:**
- `[HARVESTER_AUTH] logged_in=false` (warning, not blocker)
- `[HARVESTER] 📋 Running PUBLIC DISCOVERY ONLY`
- `public_search_*` opportunities stored

### 2. Verify Public Candidates
```bash
pnpm exec tsx scripts/ops/verify-public-candidates.ts
```
**Expected:**
- `public_search_health_low: N opportunities` (N > 0)
- `public_search_health_med: M opportunities` (M >= 0)

### 3. Railway Auth Diagnostic
```bash
railway run --service serene-cat pnpm exec tsx scripts/ops/diagnose-railway-x-home.ts
```
**Expected:**
- `[AUTH_DIAG] classification=<...> finalUrl=<...> title=<...>`
- Artifacts saved: `/tmp/x-home.html`, `/tmp/x-home.png`
- Exit code 1 (not ok_timeline) - this is OK, not a blocker

### 4. Executor Seed Harvest (Requires Auth)
```bash
EXECUTION_MODE=executor RUNNER_MODE=true pnpm exec tsx scripts/ops/executor-seed-harvest.ts
```
**Expected:**
- `[SEED_HARVEST_EXECUTOR] ✅ Executor mode verified`
- `[SEED_HARVEST_EXECUTOR] 🔐 Using local Chrome profile for authentication`
- `Stored: N opportunities` (N > 0)

### 5. Planner Plan-Only (Verify Candidates Pass Preflight)
```bash
railway run --service serene-cat \
  REPLY_V2_ROOT_ONLY=true \
  P1_MODE=true \
  P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20 \
  REPLY_V2_PLAN_ONLY=true \
  pnpm exec tsx scripts/ops/run-reply-v2-planner-once.ts 2>&1 | grep -E "P1_PROBE_SUMMARY|ok=" | head -5
```
**Expected:**
- `P1_PROBE_SUMMARY ok >= 1` (at least one candidate passes preflight)

### 6. Create Real Decisions
```bash
railway run --service serene-cat \
  REPLY_V2_ROOT_ONLY=true \
  P1_MODE=true \
  P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20 \
  pnpm exec tsx scripts/ops/run-reply-v2-planner-once.ts 2>&1 | grep -E "decision_id|status=queued" | head -5
```
**Expected:**
- Decisions created with `status=queued`
- `decision_id` UUIDs logged

### 7. Verify Executor Can Claim Decisions
```bash
# Check queued decisions
psql $DATABASE_URL -c "SELECT decision_id, status, target_tweet_id FROM content_metadata WHERE status='queued' AND decision_type='reply' ORDER BY created_at DESC LIMIT 5;"
```
**Expected:**
- Rows with `status='queued'`
- Executor can claim these

### 8. Executor Posting (Requires Executor Running)
```bash
# If executor daemon running, check logs:
tail -50 ./.runner-profile/logs/executor.log | grep -E "claim|post|REPLY_SUCCESS"

# Or start executor:
EXECUTION_MODE=executor RUNNER_MODE=true pnpm run executor:daemon
```
**Expected:**
- Decisions claimed
- Posts attempted
- `REPLY_SUCCESS` events logged

## Auth Source Verification

### Railway Auth Source
```bash
railway logs --service serene-cat --lines 10 | grep "AUTH_SOURCE"
```
**Expected:** `[AUTH_SOURCE] mode=control source=railway_cookie_blob`

### Executor Auth Source
```bash
tail -50 ./.runner-profile/logs/executor.log | grep "AUTH_SOURCE"
```
**Expected:** `[AUTH_SOURCE] mode=executor source=local_chrome_profile`
