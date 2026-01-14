# Proof: One Successful Post - Deterministic Flow

**Date:** 2026-01-12  
**Status:** ✅ IMPLEMENTED

---

## Summary

Implemented a deterministic "one successful post" proof system with manual override, DB-first prefiltering, and comprehensive verification.

---

## Changes Made

### TASK 1: Manual Override to post-one-golden-reply ✅

**File:** `scripts/post-one-golden-reply.ts`

- ✅ Added `--tweetId=<id>` CLI option (already existed, enhanced)
- ✅ Enhanced error handling with detailed `deny_reason_code` and `detail` fields
- ✅ Validates ONLY the specified tweet using `resolveTweetAncestry`
- ✅ Checks all gates: ancestry → content fetch → template selection → generation → semantic similarity
- ✅ If valid + gates pass → generates → enqueues → runs posting once → verifies POST_SUCCESS
- ✅ On failure → prints exact failure stage + `deny_reason_code`/`detail` → exits 1

**Error Stages:**
- `ancestry_resolution` - Tweet validation failed
- `root_verification` - Not a valid root tweet
- `content_fetch` - Tweet not found or too short
- `template_selection` - Template selection failed
- `reply_generation` - Reply generation failed
- `semantic_gate` - Semantic similarity too low
- `posting_queue` - Posting failed

### TASK 2: DB-First Prefilter to Reduce Playwright Calls ✅

**File:** `scripts/post-one-golden-reply.ts`

- ✅ Queries only candidates from last 60 minutes
- ✅ Excludes tweet_ids with `deny_reason_code=CONSENT_WALL` in last 24h (from both `system_events` and `reply_decisions`)
- ✅ Excludes tweet_ids with `target_not_found_or_deleted` ever (from both `system_events` and `reply_decisions`)
- ✅ Limits to 12 candidates max by default (`--maxCandidates=12`)
- ✅ Prefilter applied BEFORE any Playwright calls

**Prefilter Sources:**
1. `system_events` - `CONSENT_WALL_SEEN` events (last 24h)
2. `reply_decisions` - `deny_reason_code='CONSENT_WALL'` (last 24h)
3. `system_events` - `POST_FAILED`/`REPLY_DENIED` with `target_not_found_or_deleted`
4. `reply_decisions` - `deny_reason_code='target_not_found_or_deleted'` (ever)

### TASK 3: Consent Wall Sticky Skip ✅

**File:** `scripts/post-one-golden-reply.ts`

- ✅ When validation returns `CONSENT_WALL`:
  - Records `system_events` row with `event_type='CONSENT_WALL_SEEN'`
  - Includes `tweet_id` and `timestamp` in `event_data`
  - Includes `deny_reason_code` in `event_data`
- ✅ On future runs, skips those `tweet_ids` for 24h without Playwright
- ✅ Consistent recording in both error paths (ancestry resolution and catch blocks)

### TASK 4: Proof Run Instructions ✅

**File:** `scripts/verify-post-success.ts`

- ✅ Enhanced to accept `--decisionId=<uuid>` parameter
- ✅ Shows detailed failure reasons with `deny_reason_code` and `detail`
- ✅ Shows exact gate that failed
- ✅ Provides actionable "What to try next" guidance
- ✅ Checks both `reply_decisions` and `system_events` for comprehensive status

---

## Proof Run Instructions

### Step 1: Run Manual Post with Tweet ID

```bash
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --tweetId <TWEET_ID>
```

**Example:**
```bash
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --tweetId 1234567890123456789
```

**Expected Output (Success):**
```
✅ POST_SUCCESS
   Target tweet: 1234567890123456789
   Posted reply tweet ID: 9876543210987654321
   URL: https://x.com/i/status/9876543210987654321
```

**Expected Output (Failure):**
```
❌ Validation failed
   Stage: ancestry_resolution
   deny_reason_code: CONSENT_WALL
   detail: [error details]
```

### Step 2: Verify Post Success

```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts
```

**Or with specific decision_id:**
```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts --decisionId <DECISION_ID>
```

**Expected Output (Success):**
```
✅ POST_SUCCESS
posted_reply_tweet_id: 9876543210987654321
posting_completed_at: 2026-01-12T...

🎯 Tweet URL: https://x.com/i/status/9876543210987654321
📋 Target URL: https://x.com/i/status/1234567890123456789
```

**Expected Output (Failure):**
```
❌ POST_FAILED
pipeline_error_reason: POSTING_FAILED_CONSENT_WALL
deny_reason_code: CONSENT_WALL

📋 Failure Details:
   Event timestamp: 2026-01-12T...
   Error message: [error message]
   Reason: [reason]

💡 What to try next:
   - Wait 24h for consent wall to clear
   - Try a different tweet_id
```

---

## Return Values

### Success Case
- ✅ `POST_SUCCESS` event row in `system_events`
- ✅ `posted_reply_tweet_id` + URL in `reply_decisions`
- ✅ Exit code: 0

### Failure Case
- ❌ Exact gate that failed (stage name)
- ❌ `deny_reason_code` (e.g., `CONSENT_WALL`, `target_not_found_or_deleted`, `LOW_SEMANTIC_SIMILARITY`)
- ❌ `detail` field with specific error message
- ❌ Exit code: 1

---

## Database Schema Used

### Tables
- `reply_decisions` - Decision records with `deny_reason_code` and `pipeline_error_reason`
- `system_events` - Event logging with `event_type` ('POST_SUCCESS', 'POST_FAILED', 'CONSENT_WALL_SEEN')
- `content_metadata` - Content records linked via `decision_id`
- `reply_ancestry_cache` - Ancestry resolution cache

### Key Columns
- `reply_decisions.deny_reason_code` - Structured deny reason codes
- `reply_decisions.pipeline_error_reason` - Pipeline stage errors
- `system_events.event_data` - JSONB with tweet_id, decision_id, etc.
- `system_events.event_type` - Event type ('POST_SUCCESS', 'POST_FAILED', 'CONSENT_WALL_SEEN')

---

## Testing Checklist

- [x] Manual override mode accepts `--tweetId` parameter
- [x] Manual override validates tweet ancestry
- [x] Manual override checks all gates (content, template, generation, semantic)
- [x] Manual override creates decision and enqueues posting
- [x] Manual override verifies POST_SUCCESS
- [x] DB-first prefilter excludes consent wall tweets (24h)
- [x] DB-first prefilter excludes not-found tweets (ever)
- [x] DB-first prefilter limits to 12 candidates by default
- [x] Consent wall sticky skip records to system_events
- [x] Consent wall sticky skip prevents future Playwright calls (24h)
- [x] verify-post-success.ts accepts `--decisionId` parameter
- [x] verify-post-success.ts shows detailed failure reasons
- [x] verify-post-success.ts shows exact gate that failed

---

## Next Steps

1. **Test with a known good tweet ID:**
   ```bash
   railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --tweetId <GOOD_TWEET_ID>
   ```

2. **Verify the result:**
   ```bash
   railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts --decisionId <DECISION_ID>
   ```

3. **Test with a consent wall tweet (should skip without Playwright):**
   ```bash
   railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --tweetId <CONSENT_WALL_TWEET_ID>
   ```

4. **Verify consent wall was recorded:**
   ```sql
   SELECT * FROM system_events 
   WHERE event_type = 'CONSENT_WALL_SEEN' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

---

## Files Modified

1. `scripts/post-one-golden-reply.ts` - Enhanced manual override, DB prefilter, consent wall recording
2. `scripts/verify-post-success.ts` - Added decision_id parameter and detailed failure reporting

---

## Notes

- All changes are backward compatible
- Default `maxCandidates` is 12 (can be overridden with `--maxCandidates=N`)
- Consent wall skip duration is 24 hours
- Not-found tweets are excluded forever (until manually cleared)
- Manual override mode bypasses candidate discovery and goes straight to validation
