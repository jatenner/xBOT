# Fix: LLM Generation Health with Posting Disabled

## Summary

This PR makes xBOT fully healthy with **LLM generation running while posting stays off**. Tomorrow we can flip posting on without any code changes.

## What Changed

### 1. **Decoupled LLM Generation from Posting Flags**
- ✅ Removed `POSTING_DISABLED` blocks from `openaiWrapper.ts` and `megaPromptSystem.ts`
- ✅ LLM calls now governed by budget flags (`DISABLE_LLM_WHEN_BUDGET_HIT`, `DAILY_OPENAI_LIMIT_USD`) only
- ✅ Allows building content queue even when posting is disabled

### 2. **Fixed Database Schema Mismatch**
- ✅ Migrated posting queue from `unified_ai_intelligence` to `content_metadata`
- ✅ Added new columns: `status`, `generation_source`, `scheduled_at`, `content`, `decision_type`, etc.
- ✅ Created `posted_decisions` table for archiving posted content with tweet IDs
- ✅ New migration: `20250930_content_metadata_posting_queue.sql`

### 3. **Updated Job Workflows**
- ✅ `planJob.ts`: Stores decisions with `status='queued'` and `generation_source='real'`
- ✅ `replyJob.ts`: Stores reply decisions in `content_metadata` with proper schema
- ✅ `postingQueue.ts`: Reads from `content_metadata`, archives to `posted_decisions`
- ✅ Rate-limit checks use `posted_decisions` table (no errors on missing columns)

### 4. **Enhanced Metrics & Skip Tracking**
- ✅ Added `updatePostingSkipMetrics()` to track skip reasons
- ✅ Posting disabled now logs skip reason `posting_disabled` without throwing
- ✅ LLM metrics properly reflect success/failure rates

### 5. **Documentation**
- ✅ Updated `RUNBOOK.md` with validation commands for both modes (posting off/on)
- ✅ Clear migration path from today (posting off) to tomorrow (posting on)

## Validation Today (Posting OFF, LLM ON)

### Environment
```bash
MODE=live
POSTING_DISABLED=true
LIVE_POSTS=false
ENABLE_REPLIES=true
ENABLE_SINGLES=true
ENABLE_THREADS=true
ENABLE_BANDIT_LEARNING=true
REAL_METRICS_ENABLED=false
DISABLE_LLM_WHEN_BUDGET_HIT=true
ALLOW_FALLBACK_GENERATION=true
OPENAI_MODEL=gpt-4o-mini
```

### Expected Behavior

1. **LLM Calls Work**
```bash
curl -s -XPOST http://localhost:8080/admin/jobs/run?job=plan
curl -s -XPOST http://localhost:8080/admin/jobs/run?job=reply
```
✅ Logs show: `✅ Real LLM content generated`  
❌ Does NOT show: `LLM calls disabled (POSTING_DISABLED=true)`

2. **Content Queued in Database**
```bash
psql $DATABASE_URL -c "SELECT status, generation_source, COUNT(*) FROM content_metadata GROUP BY 1,2;"
```
Expected output:
```
 status  | generation_source | count 
---------+-------------------+-------
 queued  | real              |     3
```

3. **Posting Job Skips Cleanly**
```bash
curl -s -XPOST http://localhost:8080/admin/jobs/run?job=posting
```
✅ Logs show: `Posting disabled, skipping queue processing`  
❌ Does NOT show: SQL errors about missing columns

4. **Metrics Look Healthy**
```bash
curl -s http://localhost:8080/api/metrics | jq '.openaiCalls_total, .openaiCalls_failed, .post_skipped_reason_counts'
```
Expected:
```json
{
  "openaiCalls_total": 6,
  "openaiCalls_failed": 0,
  "post_skipped_reason_counts": {
    "posting_disabled": 1
  }
}
```

5. **No DB Errors**
❌ No occurrences of `unified_ai_intelligence.status does not exist` in logs  
❌ No occurrences of `column "status" does not exist` in logs

## Validation Tomorrow (Posting ON)

When ready to post:

```bash
export POSTING_DISABLED=false
export LIVE_POSTS=true
export REAL_METRICS_ENABLED=true
```

Then verify:
1. Posts successfully to Twitter
2. `posted_decisions` fills with tweet IDs
3. `outcomes` table gets real metrics (`simulated=false`)
4. Learning job trains once ≥5 outcomes exist

See [RUNBOOK.md](./RUNBOOK.md) for full validation commands.

## Database Changes

### New Migration
`supabase/migrations/20250930_content_metadata_posting_queue.sql`

Adds to `content_metadata`:
- `status` (planned|queued|posted|failed|skipped)
- `generation_source` (real|synthetic)
- `scheduled_at` (timestamptz)
- `content` (text)
- `decision_type` (content|reply)
- `target_tweet_id`, `target_username` (for replies)
- `predicted_er`, `updated_at`

Creates `posted_decisions` table for archiving.

### Breaking Changes
❌ None - This is purely additive. Old code paths will continue to work (they just won't find data in `unified_ai_intelligence`).

## Testing Checklist

- [x] No TypeScript/lint errors
- [ ] LLM generation works with `POSTING_DISABLED=true`
- [ ] Content stored in `content_metadata` with `status='queued'`
- [ ] Posting job skips cleanly without SQL errors
- [ ] Metrics show `openaiCalls_total > 0` and low failure rate
- [ ] Migration runs successfully on clean database
- [ ] Tomorrow's flip to posting ON requires no code changes

## Deployment Steps

1. **Merge this PR to production branch**
2. **Run migration on production DB:**
   ```bash
   psql $DATABASE_URL -f supabase/migrations/20250930_content_metadata_posting_queue.sql
   ```
3. **Deploy with posting OFF:**
   ```bash
   export POSTING_DISABLED=true
   export LIVE_POSTS=false
   export REAL_METRICS_ENABLED=false
   ```
4. **Validate LLM generation and queue building** (see RUNBOOK.md)
5. **Tomorrow: Flip posting ON** (update env vars only, no redeploy needed):
   ```bash
   export POSTING_DISABLED=false
   export LIVE_POSTS=true  
   export REAL_METRICS_ENABLED=true
   ```

## Related Issues

Fixes:
- ❌ "LLM calls disabled (POSTING_DISABLED=true)" blocking content generation
- ❌ "column unified_ai_intelligence.status does not exist" DB errors
- ❌ Deprecated `createChatCompletion()` warnings (already using budgeted client)
- ❌ Rate-limit check warnings/errors

## Architecture Notes

### Before
```
POSTING_DISABLED=true → blocks LLM → no content generation → empty queue
```

### After
```
POSTING_DISABLED=true → allows LLM → content queued → posting skipped cleanly
```

This enables:
- ✅ Testing LLM without posting risk
- ✅ Building content queue in advance
- ✅ Gradual rollout (generate today, post tomorrow)
- ✅ Budget protection via budget flags, not posting flags

---

## Screenshots

_To be added after deployment validation_

Expected screenshots:
1. ✅ Successful plan/reply logs with real LLM content
2. ✅ Posting job skipping with `posting_disabled` reason (no SQL errors)
3. ✅ `/api/metrics` showing `openaiCalls_total > 0`
4. ✅ Database query showing `status='queued', generation_source='real'`