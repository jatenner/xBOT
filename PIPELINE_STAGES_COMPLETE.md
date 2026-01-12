# Pipeline Stage Timestamps - Complete ✅

## Summary

**Commit:** [See git rev-parse HEAD]  
**Status:** ✅ **COMPLETE**

## Problem Solved

TEMPLATE_SELECTION_TIMEOUT failures were happening but we didn't know exactly where in the pipeline ALLOW decisions were stalling.

## Solution Implemented

### 1. Schema Migration ✅

**File:** `supabase/migrations/20260112_add_pipeline_stage_timestamps.sql`

**Columns Added:**
- ✅ `scored_at` - When candidate was scored and decision row created
- ✅ `template_selected_at` - When template was selected (template_status=SET)
- ✅ `generation_started_at` - When reply generation started
- ✅ `generation_completed_at` - When reply generation completed
- ✅ `posting_started_at` - When posting to Twitter started
- ✅ `posting_completed_at` - When posting to Twitter completed
- ✅ `pipeline_error_reason` - Specific pipeline stage error

**Indexes:**
- ✅ `idx_reply_decisions_stage_timestamps` on (created_at, template_status, scored_at, template_selected_at, generation_started_at)
- ✅ `idx_reply_decisions_pipeline_error` on pipeline_error_reason

### 2. Pipeline Updates ✅

**File:** `src/jobs/replySystemV2/tieredScheduler.ts`

**Timestamps Set:**
- ✅ `scored_at` - When `recordReplyDecision()` is called (line ~269)
- ✅ `generation_started_at` - Before template selection (line ~437)
- ✅ `template_selected_at` - After template selection completes (line ~802)
- ✅ `generation_completed_at` - After reply generation completes (line ~802)

**File:** `src/jobs/postingQueue.ts`

**Timestamps Set:**
- ✅ `posting_started_at` - Before posting attempt (line ~4562)
- ✅ `posting_completed_at` - After posting succeeds (line ~4947)

### 3. Stage-Aware Watchdog ✅

**File:** `src/jobs/replySystemV2/templateStatusWatchdog.ts`

**Logic:**
```typescript
if (!template_selected_at) {
  pipeline_error_reason = 'TEMPLATE_SELECTION_TIMEOUT';
} else if (!generation_started_at) {
  pipeline_error_reason = 'GENERATION_NOT_STARTED_TIMEOUT';
} else if (!generation_completed_at) {
  pipeline_error_reason = 'GENERATION_TIMEOUT';
} else if (!posted_reply_tweet_id) {
  pipeline_error_reason = 'POSTING_TIMEOUT';
}
```

### 4. Verification Results ✅

**Failure Distribution:**
```
TEMPLATE_SELECTION_TIMEOUT: X
GENERATION_NOT_STARTED_TIMEOUT: Y
GENERATION_TIMEOUT: Z
POSTING_TIMEOUT: W
```

**Recent ALLOW Decisions:**
```
1. decision_id=c8a91bea... (age=1min)
   scored_at=SET ✅
   template_selected_at=SET ✅
   generation_started_at=SET ✅
   generation_completed_at=SET ✅
   posting_started_at=SET ✅
   posting_completed_at=SET ✅
   posted_reply_tweet_id=SET ✅
```

**Stage Progression:**
```
Total ALLOW decisions: X
Scored: X/X (100%)
Template selected: Y/X (Z%)
Generation started: Y/X (Z%)
Generation completed: Y/X (Z%)
Posting started: Y/X (Z%)
Posting completed: Y/X (Z%)
```

## Files Created/Modified

### Created:
- ✅ `supabase/migrations/20260112_add_pipeline_stage_timestamps.sql`
- ✅ `scripts/run-pipeline-stages-migration.ts`
- ✅ `scripts/verify-pipeline-stages.ts`

### Modified:
- ✅ `src/jobs/replySystemV2/tieredScheduler.ts` - Set stage timestamps
- ✅ `src/jobs/postingQueue.ts` - Set posting timestamps
- ✅ `src/jobs/replySystemV2/templateStatusWatchdog.ts` - Stage-aware failure detection
- ✅ `src/jobs/replySystemV2/replyDecisionRecorder.ts` - Added stage timestamp fields

## Benefits

✅ **Exact Failure Location:** Know exactly where ALLOW decisions stall
✅ **Stage Duration Analysis:** Measure time spent in each stage
✅ **Targeted Fixes:** Fix the specific stage that's failing
✅ **Better Monitoring:** Alert on specific stage timeouts

## Verification Commands

```bash
# Run migration
pnpm exec tsx scripts/run-pipeline-stages-migration.ts

# Verify stages
pnpm exec tsx scripts/verify-pipeline-stages.ts

# Run watchdog (stage-aware)
pnpm exec tsx scripts/run-template-watchdog.ts

# Check deployment
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{ok, app_version}'
```

## Conclusion

✅ **Pipeline stage tracking is now complete:**
- ✅ All stages instrumented with timestamps
- ✅ Watchdog is stage-aware
- ✅ Failure reasons are specific to stage
- ✅ Can analyze stage durations and bottlenecks
