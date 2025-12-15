# Data Plumbing Fix Summary
**Date:** 2025-01-16  
**Status:** Forward-looking fixes implemented  
**Deployment:** Ready for Railway auto-deployment

---

## Overview

This document summarizes the code changes made to fix data plumbing issues identified in `DATA_BREAKAGE_DIAGNOSTIC.md`. The focus is on **forward-looking correctness** - ensuring new content going forward has reliable data (v2 metrics, engagement, slots, topics, replies). Historical backfill can be done separately.

---

## Code Changes

### 1. Fixed v2 Metrics Calculation (`src/jobs/metricsScraperJob.ts`)

**Lines Modified:** 474-572

**Issue:** v2 metrics were only calculated when `hasEngagementData` was true (checking if values > 0), causing 60%+ of outcomes to skip v2 metrics entirely.

**Fix:**
- Changed condition from `viewsValue > 0 || likesValue > 0 || ...` to `viewsNullable !== null || likesNullable !== null || ...`
- Added check for `hasFollowerTracking` - calculate v2 metrics if we have follower tracking even without engagement data
- Now calculates v2 metrics when we have ANY engagement data OR follower tracking
- v2 fields are set to numeric values (0 or calculated) instead of NULL when engagement is zero
- Added structured logging: `[METRICS_JOB][V2] Calculated v2 metrics for ${tweet_id}`

**Before:**
```typescript
const hasEngagementData = viewsValue > 0 || likesValue > 0 || retweetsValue > 0 || repliesValue > 0;
if (hasEngagementData) {
  // calculate v2 metrics
} else {
  // skip - leaves v2 fields as NULL
}
```

**After:**
```typescript
const hasEngagementData = viewsNullable !== null || likesNullable !== null || retweetsNullable !== null || repliesNullable !== null;
const hasFollowerTracking = followersBefore !== undefined;
if (hasEngagementData || hasFollowerTracking) {
  // Always calculate v2 metrics
  // If engagement is zero, v2 metrics will be 0 (not NULL)
}
```

**Expected Impact:** v2 metrics should now be populated for almost all new outcomes (95%+ coverage instead of 40%).

---

### 2. Improved Engagement Scraping Robustness (`src/jobs/metricsScraperJob.ts`)

**Lines Modified:** 324-391, 418-422

**Issue:** ~40% of outcomes have NULL engagement_rate. Need to distinguish "no scrape" (NULL) vs "zero engagement" (0).

**Fixes:**

#### A. Engagement Rate Calculation (Lines 418-422)
- Changed from: `engagementRate = viewsValue > 0 ? ... : null`
- Changed to: Check if `viewsNullable !== null` (we successfully scraped)
  - If scraped: `engagementRate = viewsValue > 0 ? ... : 0` (zero engagement, not NULL)
  - If not scraped: `engagementRate = null` (scraping failed)

#### B. Content Verification Logging (Lines 324-391)
- Added `verificationFailed` flag and `verificationReason` tracking
- Structured logging for verification failures with tweet_id, decision_id, and reason
- Tracks verification failures separately from scrape failures

**Expected Impact:** Better distinction between "scraping failed" (NULL) and "zero engagement" (0). Improved debugging visibility.

---

### 3. Added Summary Logging (`src/jobs/metricsScraperJob.ts`)

**Lines Modified:** 161-163, 360, 564, 797-802

**Added Metrics Tracking:**
- `v2CalculatedCount` - tracks how many outcomes got v2 metrics calculated
- `verificationFailedCount` - tracks content verification failures
- `scrapeFailedCount` - tracks scraping failures

**Added Summary Log:**
```typescript
console.log(`[METRICS_JOB][SUMMARY]`, {
  totalProcessed: posts.length,
  updated,
  skipped,
  failed,
  v2CalculatedCount,
  verificationFailedCount,
  scrapeFailedCount
});
```

**Expected Impact:** Better visibility into metrics scraping health and v2 calculation coverage.

---

### 4. Topic Fallback Guard (`src/jobs/planJob.ts`)

**Lines Modified:** 1079-1080

**Issue:** Some posts have NULL raw_topic (59.8% unknown in diagnostic).

**Fix:**
- Added fallback chain: `content.raw_topic || content.topic || 'health_general'`
- Ensures raw_topic is never NULL when inserting into content_metadata
- Uses generic fallback 'health_general' if topic generation fails

**Before:**
```typescript
raw_topic: content.raw_topic,
```

**After:**
```typescript
raw_topic: content.raw_topic || (content as any).topic || 'health_general',
```

**Expected Impact:** All new content will have a topic (even if generic fallback). Reduces NULL topic rate from 59.8% to near 0%.

---

### 5. Created Backfill Inspector Script (`scripts/backfill-content-slot-and-topic.ts`)

**New File:** Read-only analysis script

**Purpose:**
- Analyzes how many historical rows are missing content_slot, raw_topic, and v2 metrics
- Provides breakdown by recent (last 7 days) vs historical
- Structured for easy conversion to write mode later

**Output:**
- Total rows and NULL counts for each field
- Percentage coverage
- Recent vs historical breakdown
- Recommendations for backfill strategy

**Usage:**
```bash
pnpm tsx scripts/backfill-content-slot-and-topic.ts
```

**Expected Impact:** Provides visibility into backfill needs without modifying data. Ready to convert to backfill script when needed.

---

## Before vs After Expectations

### v2 Metrics Coverage

**Before:**
- 40% of outcomes have v2 metrics
- 60% have NULL v2 metrics
- Condition too strict (requires engagement > 0)

**After:**
- Expected: 95%+ of outcomes have v2 metrics
- Only NULL when truly no data (no scrape AND no follower tracking)
- Calculates even with zero engagement (sets to 0, not NULL)

### Engagement Rate

**Before:**
- 40% NULL engagement_rate
- Cannot distinguish "scraping failed" vs "zero engagement"

**After:**
- NULL only means "scraping failed"
- 0 means "zero engagement" (successfully scraped but no engagement)
- Better visibility into scraping health

### Topic Assignment

**Before:**
- 59.8% have 'unknown' or NULL topic
- No fallback mechanism

**After:**
- All new content will have a topic
- Fallback to 'health_general' if generation fails
- Expected: <1% NULL topic rate

### Content Slot

**Before:**
- Recent content: 100% coverage (working correctly)
- Historical: 0% coverage (expected - before slot system)

**After:**
- Recent content: Still 100% coverage (no change)
- Historical: Still 0% (backfill needed separately)

---

## What We Still Need to Wait For

### Immediate (Next 24-72 Hours)

1. **New posts** to see improved v2 metrics coverage
   - Metrics scraping runs every 10 minutes
   - New posts posted in last 24h will get scraped
   - Check `outcomes` table for `followers_gained_weighted` and `primary_objective_score` coverage

2. **New content** to verify topic fallback works
   - Check `content_metadata` table for `raw_topic` coverage
   - Should see 'health_general' as fallback if topic generation fails

3. **Metrics scraping logs** to verify summary logging
   - Check Railway logs for `[METRICS_JOB][SUMMARY]` output
   - Verify `v2CalculatedCount` is high (>90% of processed posts)

### Medium Term (Next Week)

1. **Learning system health** to improve
   - `vw_learning` view should have more rows with v2 metrics
   - `learning_model_weights` should update with better data
   - Reply priorities should improve as reply metrics populate

2. **Backfill analysis** to inform backfill strategy
   - Run `scripts/backfill-content-slot-and-topic.ts` to see current state
   - Decide if historical backfill is needed for learning system

---

## TODOs for Future Backfill Work

### High Priority

1. **Backfill historical content_slot**
   - Script: `scripts/backfill-content-slot-and-topic.ts` (convert to write mode)
   - Strategy:
     - Replies: `UPDATE content_metadata SET content_slot = 'reply' WHERE decision_type = 'reply' AND content_slot IS NULL`
     - Posts: Infer from `generator_name` or use default slot
   - Impact: Enables historical content to appear in `vw_learning`

2. **Backfill historical raw_topic**
   - Extract topics from existing content using AI or keyword matching
   - Or set to 'health_general' as safe default
   - Impact: Enables topic-based learning on historical data

### Medium Priority

3. **Recalculate v2 metrics for historical outcomes**
   - Use existing engagement data to recalculate v2 metrics
   - Only for outcomes that have engagement data but NULL v2 metrics
   - Impact: Improves learning system data quality

4. **Investigate scraping failures**
   - Review `verificationFailedCount` and `scrapeFailedCount` from summary logs
   - Determine if content verification thresholds are too strict
   - Impact: Reduces NULL engagement_rate rate

### Low Priority

5. **Backfill experiment metadata** (if Phase 4 experiments are enabled)
   - Assign `experiment_group` and `hook_variant` to historical content
   - Only needed if experiments are being analyzed historically

---

## Files Changed

1. `src/jobs/metricsScraperJob.ts`
   - Lines 161-163: Added tracking variables
   - Lines 324-391: Improved verification logging
   - Lines 418-422: Fixed engagement_rate calculation
   - Lines 474-572: Fixed v2 metrics calculation condition
   - Lines 360, 564: Added failure tracking
   - Lines 797-802: Added summary logging

2. `src/jobs/planJob.ts`
   - Lines 1079-1080: Added topic fallback guard

3. `scripts/backfill-content-slot-and-topic.ts`
   - New file: Read-only backfill inspector

---

## Deployment Status

- ✅ Build passed (`pnpm build`)
- ✅ TypeScript compilation successful
- ✅ No linting errors
- ✅ Ready for Railway auto-deployment

**Next Steps:**
1. Commit and push changes
2. Railway will auto-deploy
3. Monitor logs for `[METRICS_JOB][SUMMARY]` output
4. Check database after 24-72 hours for improved coverage

---

## Verification Commands

After deployment, verify fixes are working:

```bash
# Check v2 metrics coverage (should be >90%)
pnpm tsx scripts/learning-health-report.ts

# Check topic coverage (should be >99%)
pnpm tsx scripts/backfill-content-slot-and-topic.ts

# Check metrics scraping health
railway logs | grep "METRICS_JOB\[SUMMARY\]"
```

---

*Fix summary complete. All changes are forward-looking and backward-compatible.*

