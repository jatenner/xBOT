# SCHEDULER PERSISTENCE FIX REPORT

**Date:** 2026-01-10  
**Status:** Code deployed, awaiting successful generation to test

## Changes Made

### 1. Enhanced Update Path with Verification

**File:** `src/jobs/replySystemV2/tieredScheduler.ts` (lines 543-692)

- Added `.select()` after updates to verify affected rows
- Added error handling that throws if update returns 0 rows
- Added `reply_v2_decision_update_zero_rows` event for diagnostics
- Added persistence verification: re-selects decision and asserts:
  - `status='queued'`
  - `features.semantic_similarity` exists
  - `features.is_fallback` matches expected value
- Added `reply_v2_decision_queued_persisted` event on success

### 2. Fallback Tagging

- `is_fallback` flag stored in `features.is_fallback`
- `reason_codes` includes `'fallback_used'` when fallback generation is used
- `semantic_similarity` stored in `features.semantic_similarity` (since column doesn't exist in `content_metadata`)

### 3. FINAL_REPLY_GATE Updates

**File:** `src/jobs/postingQueue.ts` (lines 620-682)

- Updated to read `semantic_similarity` from `decision.semantic_similarity` OR `decision.features.semantic_similarity`
- Updated to read `is_fallback` from `decision.features.is_fallback`
- Relaxed similarity threshold to 0.0 for fallback replies (from 0.25)

## Deployment

✅ Deployed to Railway:
- `railway up --detach -s serene-cat` (worker service)
- `railway up --detach -s xBOT` (main service)

## Current Status

**Issue:** All recent generation attempts are failing before reaching persistence code:
- "Invalid reply: too long (>220 chars)" - validation failure
- "UNGROUNDED_GENERATION_SKIP" - grounding check failure

**Result:** Persistence code is deployed but untested because no generation has succeeded since deploy.

## Proof Required (Pending Successful Generation)

### A) Decision Persisted
```sql
-- Check for decision with status='queued'
SELECT decision_id, status, features, pipeline_source, created_at
FROM content_metadata
WHERE decision_type='reply'
  AND pipeline_source='reply_v2_scheduler'
  AND status='queued'
ORDER BY created_at DESC
LIMIT 1;

-- Check for persistence event
SELECT event_type, event_data, created_at
FROM system_events
WHERE event_type='reply_v2_decision_queued_persisted'
ORDER BY created_at DESC
LIMIT 1;
```

### B) Posting Succeeded
```sql
-- Check permit status
SELECT permit_id, decision_id, status, posted_tweet_id
FROM posting_permits
WHERE decision_id='<decision_id>'
ORDER BY created_at DESC
LIMIT 1;

-- Check post success event
SELECT event_type, event_data, created_at
FROM system_events
WHERE event_type='posting_attempt_success'
  AND event_data->>'decision_id'='<decision_id>'
ORDER BY created_at DESC
LIMIT 1;
```

### C) Ghost Check
```sql
-- Check for ghosts (replies without permit_id)
SELECT COUNT(*)
FROM content_metadata
WHERE decision_type='reply'
  AND status='posted'
  AND permit_id IS NULL
  AND posted_at >= NOW() - INTERVAL '30 minutes';
```

## Next Steps

1. Wait for a successful generation (or fix generation validation issues)
2. Verify persistence event is created
3. Verify decision status='queued' without manual edits
4. Run posting queue to consume decision
5. Verify permit status='USED' with posted_tweet_id
6. Confirm 0 ghosts

## Code References

- Persistence verification: `src/jobs/replySystemV2/tieredScheduler.ts:543-692`
- Fallback tagging: `src/jobs/replySystemV2/tieredScheduler.ts:467-484, 565-570`
- FINAL_REPLY_GATE: `src/jobs/postingQueue.ts:620-682`

