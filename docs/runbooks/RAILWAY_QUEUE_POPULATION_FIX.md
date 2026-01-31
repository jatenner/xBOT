# Railway Queue Population Fix

## Problem
Scheduler shows `attempted=0` because `reply_candidate_queue` is empty. Root opportunities exist but don't have `candidate_evaluations`, so the ROOT_EVAL bridge needs to create them.

## Solution
The ROOT_EVAL bridge in `refreshCandidateQueue()` creates evaluations for root opportunities that don't have them yet. It runs automatically when:
- `REPLY_V2_ROOT_ONLY=true` (default)
- Queue refresh is called (via orchestrator every 5 min or manually)

## Verification

### 1. Check Current State
```bash
pnpm tsx scripts/ops/diagnose-queue-pipeline.ts
```

Expected output shows:
- Opportunities: unclaimed roots count
- Evaluations: "For root opportunities" should be > 0 after bridge runs
- Queue: should have rows after refresh
- Decisions: should be created by scheduler

### 2. Force Queue Refresh (Local)
```bash
REPLY_V2_ROOT_ONLY=true P1_TARGET_MAX_AGE_HOURS=6 pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
```

Look for logs:
- `[ROOT_EVAL] 🔗 Evaluating X root opportunities without evaluations...`
- `[ROOT_EVAL] created candidate_evaluation for root opportunity`
- `[QUEUE_MANAGER] candidates_considered=X queued_count=Y`

### 3. Force Pipeline (One Command)
```bash
REPLY_V2_PLAN_ONLY=true REPLY_V2_ROOT_ONLY=true P1_TARGET_MAX_AGE_HOURS=6 pnpm tsx scripts/ops/force-reply-v2-pipeline.ts
```

### 4. Railway Verification
After deploy, check Railway logs:
```bash
railway logs --service serene-cat --lines 200 | grep -E "QUEUE_MANAGER|ROOT_EVAL|candidates_considered|queued_count"
```

## Environment Variables (Railway)
Ensure these are set on `serene-cat`:
- `REPLY_V2_ROOT_ONLY=true` (default, but verify)
- `P1_TARGET_MAX_AGE_HOURS=3` (or 6 for P1 proving)
- `SCHEDULER_PREFLIGHT_TIMEOUT_MS=20000`
- `REPLY_V2_PLAN_ONLY=true` (for PLAN_ONLY mode)

## Troubleshooting

### Bridge Not Creating Evaluations
- Check if opportunities exist: `SELECT COUNT(*) FROM reply_opportunities WHERE is_root_tweet=true AND replied_to=false;`
- Check if evaluations already exist: `SELECT COUNT(*) FROM candidate_evaluations WHERE candidate_tweet_id IN (SELECT target_tweet_id FROM reply_opportunities WHERE is_root_tweet=true);`
- Check freshness filter: Bridge falls back to 24h if no opportunities < P1_TARGET_MAX_AGE_HOURS

### Queue Not Populating
- Check queue refresh logs for `candidates_considered` and `queued_count`
- Check if evaluations passed hard filters: `SELECT COUNT(*) FROM candidate_evaluations WHERE passed_hard_filters=true AND predicted_tier<=3;`
- Check ROOT_ONLY filter: `join_found` should match opportunities

### Decisions Not Created
- Check scheduler logs for `preflight` status
- Check soft preflight mode: `SCHEDULER_PREFLIGHT_SOFT_MODE=true` (default when PLAN_ONLY=true)
- Check preflight timeout: Should be 20s, not 6s
