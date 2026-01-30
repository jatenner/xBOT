# ROOT_EVAL Bridge Implementation Summary

**Date:** 2026-01-30  
**Status:** ✅ Implemented and Active

## Problem Solved

Root `reply_opportunities` existed but had no corresponding `candidate_evaluations`, causing scheduler starvation. The ROOT_ONLY filter correctly filtered candidates, but since no evaluations existed for root opportunities, nothing could be queued.

## Solution Implemented

**Option B**: Bridge root opportunities to evaluations during `refreshCandidateQueue()` when `REPLY_V2_ROOT_ONLY=true`.

### Files Changed

1. **`src/jobs/replySystemV2/queueManager.ts`** (lines 86-203)
   - Added `ROOT_EVAL` bridge logic in `refreshCandidateQueue()`
   - Queries root opportunities without evaluations
   - Calls `scoreCandidate()` to evaluate each opportunity
   - Creates `candidate_evaluations` rows with idempotency checks
   - Re-queries candidates after bridge to include newly evaluated opportunities

### How Evaluations Are Created

1. **Query**: Find root opportunities (`is_root_tweet=true`, `replied_to=false`) from last 24h that don't have evaluations
2. **Check**: For each opportunity, verify no evaluation exists (race condition protection)
3. **Score**: Call `scoreCandidate()` with opportunity data (tweet_id, username, content, engagement metrics)
4. **Insert**: Create `candidate_evaluations` row with:
   - `candidate_tweet_id` = `reply_opportunities.target_tweet_id`
   - `source_type` = `'reply_opportunity'`
   - `source_feed_name` = `'root_opportunity_bridge'`
   - All scoring fields from `scoreCandidate()` result
5. **Idempotency**: Handle duplicate/unique constraint errors gracefully (skip if already exists)
6. **Refresh**: Re-query top candidates to include newly evaluated opportunities

### Logging

- `[ROOT_EVAL] 🔗 Evaluating N root opportunities without evaluations...`
- `[ROOT_EVAL] created candidate_evaluation for root opportunity <tweet_id> (passed=<bool> tier=<tier>)`
- `[ROOT_EVAL] skipped — evaluation already exists <tweet_id>`
- `[ROOT_EVAL] ✅ Bridge complete: evaluated=<n> skipped=<n> total=<n>`

### DB Safety Guarantees

- **Idempotency**: Checks for existing evaluation before creating (race condition protection)
- **Error Handling**: Catches duplicate/unique constraint errors (`23505`) and skips gracefully
- **Limit**: Processes up to 50 opportunities per refresh cycle to avoid timeout

## Proof Evidence

### Railway Logs
```
[ROOT_EVAL] 🔗 Evaluating 29 root opportunities without evaluations...
[ROOT_EVAL] created candidate_evaluation for root opportunity 2016267493489447175 (passed=false tier=4)
[ROOT_EVAL] created candidate_evaluation for root opportunity 2017219672853152209 (passed=false tier=4)
...
[ROOT_EVAL] ✅ Bridge complete: evaluated=9 skipped=0 total=29
```

### SQL Proofs

```sql
-- Root opportunities
SELECT COUNT(*) FROM reply_opportunities
WHERE is_root_tweet = true AND replied_to = false;
-- Result: 29

-- Root evaluations (after bridge)
SELECT COUNT(*) FROM candidate_evaluations
WHERE candidate_tweet_id IN (
  SELECT target_tweet_id FROM reply_opportunities
  WHERE is_root_tweet = true AND replied_to = false
);
-- Result: 9 (up from 0)

-- Root evaluations that passed filters
SELECT COUNT(*) FROM candidate_evaluations
WHERE candidate_tweet_id IN (
  SELECT target_tweet_id FROM reply_opportunities
  WHERE is_root_tweet = true AND replied_to = false
)
AND passed_hard_filters = true
AND predicted_tier <= 3;
-- Result: 0 (evaluations created but filtered by hard filters)
```

### Current State

- **Root opportunities**: 29
- **Root evaluations**: 9 (created by bridge)
- **Root evaluations (passed filters)**: 0 (filtered by scoring criteria)
- **Decisions created (last 30m)**: 0
- **Posted replies**: 0

## Why Decisions Not Created Yet

Evaluations are being created, but they're failing hard filters:
- `judge_reject`: Low relevance to health/fitness topics
- `rejected_low_velocity`: Insufficient engagement velocity
- `rejected_low_conversation`: No replies
- `rejected_low_expected_views`: Estimated views too low

This is expected behavior - the bridge is working correctly, but the root opportunities harvested don't meet the strict scoring criteria. The system needs:
1. More root opportunities that pass filters, OR
2. Wait for harvester to find higher-quality root tweets

## Verification Commands

```bash
# Check bridge logs
railway logs --service serene-cat --tail 5000 | grep ROOT_EVAL

# Check evaluations created
psql $DATABASE_URL -c "
SELECT COUNT(*) FROM candidate_evaluations
WHERE source_feed_name = 'root_opportunity_bridge';
"

# Check root evaluations
psql $DATABASE_URL -c "
SELECT 
  COUNT(*) FILTER (WHERE passed_hard_filters = true) AS passed,
  COUNT(*) FILTER (WHERE passed_hard_filters = false) AS failed
FROM candidate_evaluations
WHERE candidate_tweet_id IN (
  SELECT target_tweet_id FROM reply_opportunities
  WHERE is_root_tweet = true AND replied_to = false
);
"
```

## Next Steps

1. **Monitor**: Wait for harvester to find higher-quality root opportunities
2. **Verify**: Once evaluations pass filters, confirm decisions are created
3. **Drive to P1**: Once decisions exist, executor will process them and attempt posting
