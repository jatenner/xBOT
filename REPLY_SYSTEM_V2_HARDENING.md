# 🔒 REPLY SYSTEM V2 HARDENING - COMPLETE

**Date:** January 8, 2026  
**Status:** ✅ **COMPLETE**

---

## OBJECTIVE

Harden Reply System V2 for:
1. **End-to-end traceability** (feed_run_id → posted_tweet_id)
2. **4 replies/hour SLO tracking** (with reason codes)
3. **Supply + quality summary reports** (hourly + daily)
4. **Reconciliation timing hardening** (grace window for new posts)

---

## ✅ 1. END-TO-END TRACEABILITY

### Database Schema Changes

**Migration:** `supabase/migrations/20260108_reply_system_v2_hardening.sql`

**Added Columns:**
- `candidate_evaluations.feed_run_id` - Links to feed fetch run
- `reply_candidate_queue.scheduler_run_id` - Links to scheduler run
- `content_generation_metadata_comprehensive.candidate_evaluation_id` - Links to evaluation
- `content_generation_metadata_comprehensive.queue_id` - Links to queue entry
- `content_generation_metadata_comprehensive.scheduler_run_id` - Links to scheduler run

**Trace Chain:**
```
feed_run_id → candidate_evaluation_id → queue_id → scheduler_run_id → decision_id → permit_id → posted_tweet_id
```

### Trace Script

**File:** `scripts/trace-reply.ts`

**Usage:**
```bash
pnpm exec tsx scripts/trace-reply.ts <tweet_id>
```

**Output:**
- Full lineage from feed to posted tweet
- Scores and reasons at each stage
- Performance metrics (if available)
- SLO event status

**Example:**
```bash
pnpm exec tsx scripts/trace-reply.ts 2009296730974515446
```

---

## ✅ 2. SLO TRACKING (4 REPLIES/HOUR)

### Database Schema

**Table:** `reply_slo_events`

**Columns:**
- `scheduler_run_id` - Unique ID for each scheduler run
- `slot_time` - The 15-min slot this represents
- `posted` - true/false
- `reason` - Reason code if false (queue_empty, all_blocked, posting_failed, etc.)
- `candidate_tweet_id`, `candidate_evaluation_id`, `queue_id` - Candidate info
- `decision_id`, `permit_id`, `posted_tweet_id` - Posting info
- `queue_size`, `tier_1_count`, `tier_2_count`, `tier_3_count` - Supply metrics
- `slo_hit` - true if posted, false if missed
- `slo_target` - Target (default: 4 replies/hour)

### Implementation

**File:** `src/jobs/replySystemV2/tieredScheduler.ts`

**Features:**
- Logs SLO event for every scheduler run
- Tracks reason codes for misses
- Triggers immediate refill if queue empty
- Updates SLO event after posting completes

**File:** `src/jobs/replySystemV2/sloTracker.ts`

**Functions:**
- `updateSloEventAfterPosting()` - Updates with permit_id and tweet_id
- `updateSloEventOnFailure()` - Updates on posting failure

**Integration:**
- Called from `postingQueue.ts` after successful posting
- Called from `performanceTracker.ts` when tracking starts

---

## ✅ 3. SUPPLY + QUALITY SUMMARY REPORTS

### Hourly Summary

**Table:** `reply_system_summary_hourly`

**Metrics:**
- `candidates_evaluated` - Total candidates evaluated
- `candidates_passed_filters` - Passed hard filters
- `candidates_blocked` - Blocked by filters
- `block_reasons` - JSON breakdown of block reasons
- `queue_size` - Current queue size
- `tier_distribution` - Tier breakdown (tier_1, tier_2, tier_3)
- `slo_hits` - SLO hits this hour
- `slo_misses` - SLO misses this hour
- `slo_reasons` - JSON breakdown of miss reasons
- `replies_posted` - Replies posted this hour
- `replies_tier_1/2/3` - Tier breakdown of posted replies

**Job:** `reply_v2_hourly_summary` - Runs every hour

**File:** `src/jobs/replySystemV2/summaryReporter.ts`

### Daily Summary

**Table:** `reply_system_summary_daily`

**Metrics:**
- `total_replies` - Total replies posted
- `replies_with_24h_metrics` - Replies with completed 24h metrics
- `views_24h_distribution` - JSON distribution (0-100, 100-500, 500-1000, 1000-5000, 5000+)
- `views_24h_median`, `views_24h_mean`, `views_24h_p25`, `views_24h_p75` - Statistics
- `success_rate_1000` - % with >=1000 views
- `success_rate_5000` - % with >=5000 views
- `tier_1/2/3_actual_performance` - JSON with count, median, mean per tier

**Job:** `reply_v2_daily_summary` - Runs daily

**File:** `src/jobs/replySystemV2/summaryReporter.ts`

---

## ✅ 4. RECONCILIATION TIMING HARDENING

### Grace Window Implementation

**File:** `src/jobs/ghostReconciliationJob.ts`

**Changes:**
- Added 3-minute grace window for newly posted tweets
- Checks `post_attempts` table for pending/approved permits
- Checks `content_generation_metadata_comprehensive` for decisions in posting state
- Excludes tweets in grace window from ghost detection

**Logic:**
```typescript
// Check pending permits (may be posting now)
const graceWindowStart = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago

// Check pending permits
const { data: pendingPermits } = await supabase
  .from('post_attempts')
  .select('actual_tweet_id')
  .in('status', ['PENDING', 'APPROVED'])
  .gte('created_at', graceWindowStart.toISOString());

// Check decisions in posting state
const { data: postingDecisions } = await supabase
  .from('content_generation_metadata_comprehensive')
  .select('tweet_id')
  .in('status', ['posting_attempt', 'queued'])
  .gte('created_at', graceWindowStart.toISOString());
```

---

## VERIFICATION

### Script: `scripts/verify-reply-hardening.ts`

**Tests:**
- ✅ Traceability columns exist
- ✅ SLO events table exists
- ✅ Summary tables exist
- ✅ Trace script exists
- ✅ Recent reply traceability

**Run:**
```bash
pnpm exec tsx scripts/verify-reply-hardening.ts
```

---

## INTEGRATION

### Updated Files

1. **`src/jobs/replySystemV2/orchestrator.ts`**
   - Adds `feed_run_id` to evaluations

2. **`src/jobs/replySystemV2/tieredScheduler.ts`**
   - Adds `scheduler_run_id` to queue entries
   - Logs SLO events
   - Triggers refill on queue empty

3. **`src/jobs/replySystemV2/sloTracker.ts`** (NEW)
   - Updates SLO events after posting

4. **`src/jobs/replySystemV2/summaryReporter.ts`** (NEW)
   - Generates hourly and daily summaries

5. **`src/jobs/replySystemV2/performanceTracker.ts`**
   - Updates SLO events when tracking starts

6. **`src/jobs/postingQueue.ts`**
   - Calls SLO tracker after posting
   - Calls performance tracker for replies

7. **`src/jobs/ghostReconciliationJob.ts`**
   - Adds grace window for new posts

8. **`src/jobs/jobManager.ts`**
   - Schedules hourly and daily summary jobs

---

## DELIVERABLES

✅ **Migration:** `supabase/migrations/20260108_reply_system_v2_hardening.sql`  
✅ **Trace Script:** `scripts/trace-reply.ts`  
✅ **SLO Tracker:** `src/jobs/replySystemV2/sloTracker.ts`  
✅ **Summary Reporter:** `src/jobs/replySystemV2/summaryReporter.ts`  
✅ **Updated Jobs:** All integration points updated  
✅ **Verification Script:** `scripts/verify-reply-hardening.ts`  

---

## STATUS

✅ **COMPLETE** - All hardening features implemented and integrated.

**Next Steps:**
1. Run verification script to confirm traceability
2. Monitor SLO events to ensure 4/hour target
3. Review hourly/daily summaries for insights
4. Verify grace window prevents false ghost detections

