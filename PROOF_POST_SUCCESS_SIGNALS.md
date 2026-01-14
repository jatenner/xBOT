# POST_SUCCESS and POST_FAILED Proof Signals

## Implementation Summary

### Code Changes

**1. POST_SUCCESS Signal (in `src/jobs/postingQueue.ts`):**
- Added structured log: `[POST_SUCCESS] decision_id=... target_tweet_id=... posted_reply_tweet_id=... template_id=... prompt_version=...`
- Added `system_events` entry with `event_type='POST_SUCCESS'` and full metadata including:
  - `decision_id`
  - `target_tweet_id`
  - `posted_reply_tweet_id`
  - `template_id`
  - `prompt_version`
  - `posted_at` timestamp

**2. POST_FAILED Signal (in multiple failure paths):**
- Added structured log: `[POST_FAILED] decision_id=... target_tweet_id=... pipeline_error_reason=...`
- Added `system_events` entry with `event_type='POST_FAILED'` and error details
- Covers failure scenarios:
  - `NO_CONTENT_METADATA`: No content_metadata row found
  - `INVALID_STATUS_*`: Status not 'queued' when claiming
  - `SAFETY_GATE_*`: Blocked by safety gates (e.g., `SAFETY_GATE_target_not_found_or_deleted`, `SAFETY_GATE_low_semantic_similarity`)
  - `POSTING_FAILED_*`: Actual posting failure (API errors, etc.)

**3. Verifier Script (`scripts/verify-post-success.ts`):**
- Queries last 24h `POST_SUCCESS` and `POST_FAILED` events from `system_events`
- Prints newest 5 successes with tweet URLs
- Prints failure counts by error reason
- Shows success rate summary

## Verification

### Test Run 1: POST_FAILED Signal (INVALID_STATUS_blocked)

**Decision:** `c8a91bea-e085-4fda-a4b2-dad5c51759f1`
**Target Tweet:** `2009911696165351799`
**Status:** `blocked` (safety gate blocked it previously)

**Result:**
```
📊 POST_FAILED Events (Last 24h): 1

Top error reasons:
  1. INVALID_STATUS_blocked: 1 failures

Newest 5 POST_FAILED events:
1. 2026-01-14T14:49:34.503Z
   decision_id: c8a91bea-e085-4fda-a4b2-dad5c51759f1
   target_tweet_id: 2009911696165351799
   pipeline_error_reason: INVALID_STATUS_blocked
```

**✅ Confirmed:** POST_FAILED signal works correctly - decision with `status='blocked'` was correctly identified and logged.

### Test Run 2: Reset and Retry

**Action:** Reset decision status to `queued` and retry posting

**Expected:** Either POST_SUCCESS (if safety gates pass) or POST_FAILED with specific safety gate reason

**Status:** (See verification output below)

## Usage

### Check for Successful Posts

```bash
# Run verifier script
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts

# Or query directly
psql "$DATABASE_URL" -c "
SELECT event_type, created_at, 
       event_data->>'posted_reply_tweet_id' as posted_tweet_id,
       event_data->>'decision_id' as decision_id
FROM system_events 
WHERE event_type='POST_SUCCESS' 
ORDER BY created_at DESC LIMIT 5;
"
```

### Check Logs for POST_SUCCESS/POST_FAILED

```bash
railway logs -s xBOT --tail 10000 | grep -E "\[POST_SUCCESS\]|\[POST_FAILED\]"
```

### Tweet URL Format

When `posted_reply_tweet_id` is available:
```
https://x.com/i/status/{posted_reply_tweet_id}
```

## Next Steps

To prove full end-to-end posting:
1. Find a decision with a valid root target tweet
2. Ensure semantic_similarity >= 0.25
3. Ensure all safety gate data is present
4. Run posting queue
5. Check for POST_SUCCESS event and verify tweet on timeline

## Status

**POST_SUCCESS/POST_FAILED Signals:** ✅ **IMPLEMENTED**
- Code changes committed: `99c1e8c9`
- Verifier script created: `scripts/verify-post-success.ts`
- POST_FAILED signal verified: ✅ (1 event logged)
- POST_SUCCESS signal: ⏳ Waiting for successful post after code deployment
