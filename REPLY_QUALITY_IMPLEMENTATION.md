# Reply Quality + Growth Implementation

## Summary

Implemented candidate scoring, template rotation, and engagement tracking for reply system V2.

## Changes

### 1. Database Schema (`supabase/migrations/20260112_reply_quality_tracking.sql`)

- **Extended `reply_decisions` table:**
  - `candidate_features` (jsonb) - Candidate scoring features
  - `candidate_score` (numeric) - Overall candidate score (0-100)
  - `template_id` (text) - Template used
  - `prompt_version` (text) - Prompt version
  - `engagement_24h_likes/replies/retweets/views` (int) - 24h engagement metrics
  - `engagement_fetched_at` (timestamptz) - When metrics were fetched

- **New `reply_templates` table:**
  - Stores 6 default templates: explanation, actionable, clarification, contrarian, question, story
  - Each template has priority_weight, exploration_rate, use_cases

- **New `reply_candidate_features` table:**
  - Detailed candidate scoring features for learning
  - Indexed by tweet_id, score, feed_run_id

### 2. Template Selection (`src/jobs/replySystemV2/replyTemplateSelector.ts`)

- Weighted selection based on:
  - Topic relevance score
  - Candidate score
  - Template priority weights
- Exploration mode (10% chance) for variety
- Exploitation mode (90%) for best-weighted template

### 3. Candidate Feature Logging (`src/jobs/replySystemV2/candidateFeatureLogger.ts`)

- Logs candidate features to `reply_candidate_features` table
- Integrated into orchestrator scoring flow

### 4. Engagement Tracking (`src/jobs/replySystemV2/engagementTracker.ts`)

- Fetches engagement metrics after 24h
- Updates `reply_decisions` with metrics
- Job: `fetchPendingEngagementMetrics()` processes 10 at a time

### 5. Integration Points

- **Orchestrator:** Logs candidate features after scoring
- **Scheduler:** Selects template, logs template_id/prompt_version
- **Posting Queue:** Updates posted_reply_tweet_id in reply_decisions
- **Reply Generator:** Accepts template_id/prompt_version (for future template-aware prompts)

## Proof

### Migration Success
```bash
✅ Migration completed
📊 Tables created:
  ✅ reply_candidate_features
  ✅ reply_templates
📊 Columns added to reply_decisions: 9 columns
📊 Templates loaded: 6
```

### Schema Verification
- All tables and columns created successfully
- Indexes added for performance
- Default templates inserted

## Next Steps

1. Deploy with APP_VERSION update
2. Monitor template selection distribution
3. Run engagement tracking job periodically (24h after posts)
4. Analyze template performance (which templates get best engagement)

## Files Changed

- `supabase/migrations/20260112_reply_quality_tracking.sql` (NEW)
- `src/jobs/replySystemV2/replyTemplateSelector.ts` (NEW)
- `src/jobs/replySystemV2/candidateFeatureLogger.ts` (NEW)
- `src/jobs/replySystemV2/engagementTracker.ts` (NEW)
- `src/jobs/replySystemV2/engagementTrackingJob.ts` (NEW)
- `src/jobs/replySystemV2/orchestrator.ts` (MODIFIED)
- `src/jobs/replySystemV2/tieredScheduler.ts` (MODIFIED)
- `src/jobs/replySystemV2/replyDecisionRecorder.ts` (MODIFIED)
- `src/jobs/postingQueue.ts` (MODIFIED)
- `src/ai/replyGeneratorAdapter.ts` (MODIFIED)
- `scripts/run-quality-migrations.ts` (NEW)
