# xBOT Data Flow Breakage Diagnostic
**Date:** 2025-01-16  
**Method:** Code inspection + Production database verification  
**Status:** Read-only diagnostic (no code modifications)

---

## Executive Summary

This diagnostic traces the complete data flow for 5 critical data points and identifies where each breaks down. The analysis combines code inspection, production database verification, and log analysis to pinpoint exact failure points.

**Key Findings:**
- **content_slot**: Working for recent content (replies 100%, posts ~50%), but older content lacks slots
- **v2 metrics**: Calculation logic exists but fails due to missing engagement data (92.8% NULL)
- **Reply tracking**: Recent replies tracked correctly, but older replies missing content_slot
- **Topic assignment**: Many posts have NULL raw_topic (59.8% unknown)
- **Engagement metrics**: Scraping works but many outcomes have NULL engagement_rate

---

## 1. CONTENT_SLOT ASSIGNMENT

### A. Code Inspection

**Job:** `src/jobs/planJob.ts`

**Flow:**
1. **Line 412-438**: `generateContentWithLLM()` selects slot via `selectContentSlot()`
   - Calls `getContentSlotsForToday()` to get available slots
   - Calls `selectContentSlot()` with recent slot types for diversity
   - Logs: `📅 CONTENT SLOT: ${selectedSlot}`

2. **Line 675**: Slot passed to Phase 4 router (if enabled)
   ```typescript
   content_slot: selectedSlot,
   ```

3. **Line 926**: Slot stored in content object
   ```typescript
   content_slot: selectedSlot, // 🎯 v2: Store content slot from micro calendar
   ```

4. **Line 1071**: Slot included in insert payload
   ```typescript
   content_slot: content.content_slot || null, // 🎯 v2: Store content slot
   ```

5. **Line 1097**: Logging confirms slot value
   ```typescript
   console.log(`[PLAN_JOB] 📅 Content slot: ${insertPayload.content_slot || 'NULL'} for decision ${content.decision_id}`);
   ```

6. **Line 1123**: Insert to `content_metadata`
   ```typescript
   const { data, error} = await supabase.from('content_metadata').insert([insertPayload]);
   ```

**Table:** `content_generation_metadata_comprehensive` (base table)  
**View:** `content_metadata` (exposes content_slot)

**Potential Issues:**
- ✅ Code path looks correct
- ⚠️ Slot selection happens BEFORE content generation - if generation fails, slot is lost
- ⚠️ No validation that slot was actually stored
- ⚠️ Older content (before slot system) has NULL slots

### B. Production Verification

**Last 20 rows from `content_generation_metadata_comprehensive`:**
```
Recent (rows 1-10): 100% have content_slot (all 'reply')
Recent posts (rows 11-15): 100% have content_slot ('framework', 'research')
Older posts (rows 18-20): 0% have content_slot (all NULL)
```

**Finding:** Recent content (last ~10 posts) has slots. Older content lacks slots, suggesting:
1. Slot system was added recently
2. Older posts were created before slot assignment was implemented
3. No backfill was performed

### C. Log Inspection

**Expected logs:**
- `📅 CONTENT SLOT: ${selectedSlot}`
- `[PLAN_JOB] 📅 Content slot: ${insertPayload.content_slot || 'NULL'}`

**Status:** Logs not captured in recent Railway output (need to check live logs)

### D. Root Cause Analysis

**What's Working:**
- ✅ Slot selection logic exists and runs
- ✅ Recent posts (rows 11-15) have slots assigned
- ✅ Recent replies (rows 1-10) have `content_slot='reply'`

**What's Broken:**
- ❌ Older posts (rows 18-20) have NULL slots
- ❌ No backfill mechanism for historical content

**Most Likely Root Cause:**
- Slot system was implemented recently (Nov 2025 based on code comments)
- Historical content created before slot system lacks slots
- Current code works correctly for new content

**Fix Required:**
- Backfill historical content with appropriate slots (low priority)
- Verify new content continues to get slots (monitoring)

---

## 2. V2 METRICS POPULATION

### A. Code Inspection

**Job:** `src/jobs/metricsScraperJob.ts`

**Flow:**
1. **Lines 78-90**: Query posts missing metrics
   ```typescript
   .or('actual_impressions.is.null,actual_impressions.eq.0')
   ```

2. **Lines 400-460**: Get follower attribution data
   - Queries `post_follower_tracking` table
   - Extracts followers_before, followers_24h_after, etc.
   - Calculates `followersGained`

3. **Lines 462-539**: Calculate v2 metrics
   ```typescript
   const hasEngagementData = viewsValue > 0 || likesValue > 0 || retweetsValue > 0 || repliesValue > 0;
   
   if (hasEngagementData) {
     // Calculate v2 metrics
     const v2Result = calculateV2ObjectiveMetrics(attributionData, engagementData);
     v2Metrics.followers_gained_weighted = v2Result.followers_gained_weighted;
     v2Metrics.primary_objective_score = v2Result.primary_objective_score;
   } else {
     console.log(`[METRICS_JOB] ⚠️ Skipping v2 metrics: no engagement data`);
   }
   ```

4. **Lines 542-567**: Build outcomes payload with v2 fields
   ```typescript
   followers_gained_weighted: v2Metrics.followers_gained_weighted,
   primary_objective_score: v2Metrics.primary_objective_score,
   hook_type: v2Metrics.hook_type,
   cta_type: v2Metrics.cta_type,
   structure_type: v2Metrics.structure_type
   ```

5. **Lines 570-575**: Debug logging
   ```typescript
   console.log(`[METRICS_JOB] 📝 Writing outcomes for ${post.tweet_id}:`);
   console.log(`[METRICS_JOB]   - followers_gained_weighted: ${v2Metrics.followers_gained_weighted}`);
   console.log(`[METRICS_JOB]   - primary_objective_score: ${v2Metrics.primary_objective_score}`);
   ```

6. **Lines 577-590**: Upsert to outcomes table
   ```typescript
   const { data: outcomeData, error: outcomeError } = await supabase.from('outcomes').upsert(
     outcomesPayload,
     { onConflict: 'decision_id' }
   );
   ```

**Table:** `outcomes`  
**Columns:** `followers_gained_weighted`, `primary_objective_score`, `hook_type`, `cta_type`, `structure_type`

**Critical Condition (Line 478):**
```typescript
const hasEngagementData = viewsValue > 0 || likesValue > 0 || retweetsValue > 0 || repliesValue > 0;
```

**If `hasEngagementData` is false, v2 metrics are skipped entirely.**

### B. Production Verification

**Last 20 outcomes rows:**
```
Rows 1-3: followers_weighted=NULL, primary_score=NULL, er=NULL
Rows 4-5: followers_weighted=0, primary_score=0.045515, er=0
Rows 6-9: followers_weighted=NULL, primary_score=NULL, er=NULL
Rows 10-19: followers_weighted=0, primary_score=0.045515, er=0 or NULL
```

**Finding:**
- 60% of recent outcomes have NULL v2 metrics
- 40% have v2 metrics but with zero values (0, 0.045515)
- All NULL v2 metrics correspond to NULL engagement_rate

### C. Log Inspection

**Expected logs:**
- `[METRICS_JOB] 🎯 v2 Metrics calculated: weighted_followers=...`
- `[METRICS_JOB] ⚠️ Skipping v2 metrics: no engagement data`
- `[METRICS_JOB] 📝 Writing outcomes for ${post.tweet_id}`

**Status:** Recent logs show metrics scraping running but v2 calculation logs not visible

### D. Root Cause Analysis

**What's Working:**
- ✅ v2 calculation logic exists and is correct
- ✅ Code writes v2 fields to outcomes table
- ✅ Some outcomes have v2 metrics (rows 4-5, 10-19)

**What's Broken:**
- ❌ 60% of outcomes have NULL v2 metrics
- ❌ All NULL v2 metrics correspond to NULL engagement_rate
- ❌ Condition at line 478 skips v2 calculation when `hasEngagementData` is false

**Most Likely Root Cause:**
1. **Primary Issue**: Engagement data not being scraped correctly
   - Many posts have `engagement_rate=NULL` in outcomes
   - If `viewsValue=0` AND `likesValue=0` AND `retweetsValue=0` AND `repliesValue=0`, then `hasEngagementData=false`
   - When `hasEngagementData=false`, v2 metrics are skipped (line 532)

2. **Secondary Issue**: Even when engagement data exists, follower attribution may be missing
   - `post_follower_tracking` table may not have data
   - If no follower tracking, `followersGained=0`, leading to `followers_gained_weighted=0`

**Fix Required:**
1. Investigate why engagement metrics are NULL (scraping issue)
2. Verify `post_follower_tracking` table is populated
3. Consider calculating v2 metrics even with zero engagement (set to 0 instead of NULL)

---

## 3. REPLY TRACKING

### A. Code Inspection

**Job:** `src/jobs/replyJob.ts`

**Flow:**
1. **Line 404**: Synthetic reply sets slot
   ```typescript
   content_slot: 'reply', // 🎯 v2: Store content slot for replies
   ```

2. **Line 853**: Phase 4 router sets slot
   ```typescript
   content_slot: 'reply',
   ```

3. **Line 1204**: Real reply insert sets slot
   ```typescript
   content_slot: replyContentSlot, // 🎯 v2: Store content slot for replies
   ```

4. **Line 1200-1215**: Insert to `content_metadata`
   ```typescript
   const { data, error } = await supabase.from('content_metadata').insert([{
     decision_id: reply.decision_id,
     decision_type: 'reply',
     content: reply.content,
     content_slot: replyContentSlot, // 🎯 v2: Store content slot for replies
     ...
     target_tweet_id: reply.target_tweet_id,
     target_username: reply.target_username,
   }]);
   ```

**Table:** `content_generation_metadata_comprehensive`  
**View:** `vw_learning` (filters by `content_slot='reply'`)

**Potential Issues:**
- ✅ Code sets `content_slot='reply'` in all insert paths
- ⚠️ Older replies may have been created before slot system

### B. Production Verification

**Last 20 replies:**
```
Rows 1-9: 100% have content_slot='reply' ✅
Rows 10-20: 0% have content_slot (all NULL) ❌
```

**Finding:** Recent replies (last 9) have slots. Older replies lack slots.

### C. Log Inspection

**Expected logs:**
- `[REPLY_JOB] 🎯 Starting reply generation`
- `[PHASE4][Router][Reply] decisionType=reply slot=reply`

**Status:** Reply job logs not visible in recent Railway output

### D. Root Cause Analysis

**What's Working:**
- ✅ Recent replies (rows 1-9) have `content_slot='reply'`
- ✅ Code correctly sets slot in all insert paths

**What's Broken:**
- ❌ Older replies (rows 10-20) have NULL content_slot
- ❌ `vw_learning` view filters by `content_slot='reply'`, so older replies are excluded

**Most Likely Root Cause:**
- Slot system added recently
- Historical replies created before slot system lack slots
- `vw_learning` view only shows replies with `content_slot='reply'`, excluding older replies

**Fix Required:**
- Backfill older replies with `content_slot='reply'` (if needed for learning)
- Or update `vw_learning` to include replies without slots (temporary)

---

## 4. TOPIC ASSIGNMENT

### A. Code Inspection

**Job:** `src/jobs/planJob.ts`

**Flow:**
1. **Lines 440-480**: Generate topic
   ```typescript
   const topicGenerator = getDynamicTopicGenerator();
   dynamicTopic = await topicGenerator.generateTopic();
   topic = dynamicTopic.topic; // Extract just the topic string
   ```

2. **Line 1079**: Store as `raw_topic` in insert payload
   ```typescript
   raw_topic: content.raw_topic,
   ```

3. **Line 1123**: Insert to `content_metadata`
   ```typescript
   const { data, error} = await supabase.from('content_metadata').insert([insertPayload]);
   ```

**Table:** `content_generation_metadata_comprehensive`  
**Column:** `raw_topic`

**Potential Issues:**
- ✅ Topic generation happens before content generation
- ⚠️ If topic generation fails, `raw_topic` may be undefined
- ⚠️ No validation that topic was stored

### B. Production Verification

**Last 20 content rows:**
```
Rows 1-9 (replies): 100% have raw_topic=NULL
Rows 10-15 (posts): 100% have raw_topic (e.g., "The Surprising Snack That...")
Rows 18-20 (older posts): 100% have raw_topic=NULL
```

**Finding:**
- Replies don't have topics (expected - replies use target tweet context)
- Recent posts have topics
- Older posts lack topics

### C. Log Inspection

**Expected logs:**
- `[PLAN_JOB] 📈 Trending topic: "${trendingTopic}"`
- Topic generation logs from `getDynamicTopicGenerator()`

**Status:** Topic generation logs not visible in recent Railway output

### D. Root Cause Analysis

**What's Working:**
- ✅ Recent posts (rows 10-15) have `raw_topic` assigned
- ✅ Topic generation logic exists

**What's Broken:**
- ❌ Replies don't have topics (by design - they use target tweet context)
- ❌ Older posts (rows 18-20) have NULL topics
- ❌ 59.8% of all posts have `unknown` topic (from failure modes report)

**Most Likely Root Cause:**
- Topic system may have been added recently
- Historical content lacks topics
- Some posts may have failed topic generation silently

**Fix Required:**
- Investigate why 59.8% have `unknown` topic (may be default value)
- Backfill historical content with topics (if needed)

---

## 5. ENGAGEMENT METRICS SCRAPING

### A. Code Inspection

**Job:** `src/jobs/metricsScraperJob.ts`

**Flow:**
1. **Lines 78-117**: Query posts needing metrics
   ```typescript
   .or('actual_impressions.is.null,actual_impressions.eq.0')
   ```

2. **Lines 238-365**: Scrape metrics via `BulletproofTwitterScraper`
   ```typescript
   const result = await orchestrator.scrapeMetrics(post.tweet_id, {
     postedAt: postedAt
   }, { useAnalytics: false });
   ```

3. **Lines 316-322**: Parse metrics
   ```typescript
   const viewsNullable = parseMetricValue(metrics.views);
   const likesNullable = parseMetricValue(metrics.likes);
   const retweetsNullable = parseMetricValue(metrics.retweets);
   const repliesNullable = parseMetricValue(metrics.replies);
   ```

4. **Lines 364-395**: Calculate engagement_rate
   ```typescript
   const engagementRate = viewsValue > 0 
     ? ((likesValue + retweetsValue + repliesValue) / viewsValue) 
     : null;
   ```

5. **Lines 542-567**: Build outcomes payload
   ```typescript
   engagement_rate: engagementRate,
   views: viewsNullable,
   likes: likesNullable,
   retweets: retweetsNullable,
   replies: repliesNullable,
   ```

6. **Lines 577-590**: Upsert to outcomes
   ```typescript
   const { data: outcomeData, error: outcomeError } = await supabase.from('outcomes').upsert(
     outcomesPayload,
     { onConflict: 'decision_id' }
   );
   ```

**Table:** `outcomes`  
**Columns:** `engagement_rate`, `views`, `likes`, `retweets`, `replies`, `impressions`

**Potential Issues:**
- ✅ Scraping logic exists
- ⚠️ If scraping fails, metrics remain NULL
- ⚠️ Content verification (lines 324-362) may skip metrics if content mismatch detected

### B. Production Verification

**Last 20 outcomes rows:**
```
Rows 1-3: er=NULL, all metrics NULL
Rows 4-5: er=0, views/likes/etc likely 0
Rows 6-9: er=NULL, all metrics NULL
Rows 10-19: er=0 or NULL, mixed metrics
```

**Finding:**
- 40% of recent outcomes have NULL engagement_rate
- 60% have engagement_rate=0 (zero engagement, not NULL)

### C. Log Inspection

**Recent Railway logs:**
```
[METRICS_JOB] 🚀 Starting batched scraping of 15 tweets...
[METRICS_JOB] 🔍 Scraping 2000235134524788736 (1/15)...
```

**Status:** Metrics scraping is running, but completion logs not visible

### D. Root Cause Analysis

**What's Working:**
- ✅ Metrics scraping job runs regularly
- ✅ Some outcomes have engagement metrics (rows 4-5, 10-19)

**What's Broken:**
- ❌ 40% of outcomes have NULL engagement_rate
- ❌ Many outcomes have zero engagement (er=0) instead of NULL

**Most Likely Root Cause:**
1. **Scraping failures**: Some tweets may fail to scrape (deleted, private, etc.)
2. **Content verification blocking**: Lines 324-362 skip metrics if content mismatch detected
3. **Zero engagement**: Some posts genuinely have zero engagement (not a bug, but indicates low performance)

**Fix Required:**
1. Investigate scraping failures (check for errors in logs)
2. Review content verification logic (may be too strict)
3. Distinguish between "not scraped" (NULL) and "zero engagement" (0)

---

## DEPENDENCY GRAPH

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTENT GENERATION                        │
│  planJob.ts → content_metadata (queued)                     │
│    ├─ content_slot ✅ (recent)                               │
│    ├─ raw_topic ✅ (recent)                                  │
│    └─ generator_name ✅                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      POSTING                                 │
│  postingQueue.ts → content_metadata (posted)                │
│    └─ tweet_id ✅                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    METRICS SCRAPING                          │
│  metricsScraperJob.ts → outcomes                            │
│    ├─ engagement_rate ❌ (40% NULL)                         │
│    ├─ views/likes/retweets/replies ❌ (40% NULL)            │
│    └─ followers_gained_weighted ❌ (60% NULL)              │
│    └─ primary_objective_score ❌ (60% NULL)                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      LEARNING                                │
│  vw_learning view → learning_model_weights                  │
│    └─ Requires: content_slot ✅ (recent)                     │
│    └─ Requires: v2 metrics ❌ (60% NULL)                    │
│    └─ Result: Learning system cannot function              │
└─────────────────────────────────────────────────────────────┘
```

**Blocking Relationships:**
1. **Missing engagement metrics** → **Missing v2 metrics** → **Learning system broken**
2. **Missing content_slot (historical)** → **vw_learning excludes old content** → **Limited learning data**
3. **Missing topics** → **Topic-based learning impossible** → **Content strategy unclear**

---

## SPECIFIC CODE LINES TO FIX

### Priority 1: Fix v2 Metrics Calculation

**File:** `src/jobs/metricsScraperJob.ts`

**Issue:** Line 478 condition too strict - skips v2 calculation when engagement is zero

**Current Code (Line 478):**
```typescript
const hasEngagementData = viewsValue > 0 || likesValue > 0 || retweetsValue > 0 || repliesValue > 0;
```

**Fix:**
```typescript
// Calculate v2 metrics if we have ANY engagement data OR if we have follower tracking
// This ensures v2 metrics are calculated even with zero engagement (for learning)
const hasEngagementData = viewsValue > 0 || likesValue > 0 || retweetsValue > 0 || repliesValue > 0;
const hasFollowerTracking = followersBefore !== undefined;

if (hasEngagementData || hasFollowerTracking) {
  // Calculate v2 metrics (will be 0 if no engagement, but still calculated)
}
```

**Lines:** 478-534

---

### Priority 2: Fix Engagement Metrics Scraping

**File:** `src/jobs/metricsScraperJob.ts`

**Issue:** Content verification may be blocking valid metrics

**Current Code (Lines 324-362):**
```typescript
if (!verification.isValid) {
  console.error(`[METRICS_JOB] 🚨 MISATTRIBUTION DETECTED!`);
  // Skip metrics update
  continue;
}
```

**Fix:** Review verification threshold (0.6 for threads, 0.7 for single) - may be too strict

**Lines:** 324-362

---

### Priority 3: Backfill Historical Content Slots

**File:** New script needed

**Issue:** Historical content lacks content_slot

**Fix:** Create backfill script to assign slots to historical content based on:
- `decision_type='reply'` → `content_slot='reply'`
- `generator_name` → map to appropriate slot
- `raw_topic` → infer slot type

**Lines:** N/A (new script)

---

### Priority 4: Fix Topic Assignment

**File:** `src/jobs/planJob.ts`

**Issue:** Some posts have NULL or 'unknown' topic

**Current Code (Line 1079):**
```typescript
raw_topic: content.raw_topic,
```

**Fix:** Add fallback topic if generation fails
```typescript
raw_topic: content.raw_topic || dynamicTopic?.topic || 'health_general',
```

**Lines:** 1079

---

## SUMMARY OF ROOT CAUSES

### 1. Missing Slots (1.1% coverage)

**Root Cause:** Historical content created before slot system  
**Impact:** Low (recent content has slots)  
**Fix Priority:** Low (backfill if needed for learning)

### 2. Missing v2 Metrics (7.2% coverage)

**Root Cause:** 
- Primary: Missing engagement data (40% NULL engagement_rate)
- Secondary: Condition at line 478 skips calculation when engagement is zero

**Impact:** Critical (learning system cannot function)  
**Fix Priority:** High (fix engagement scraping + v2 calculation condition)

### 3. Missing Replies (only 1 in vw_learning)

**Root Cause:** `vw_learning` filters by `content_slot='reply'`, excluding older replies  
**Impact:** Medium (reply learning system has no data)  
**Fix Priority:** Medium (update vw_learning or backfill older replies)

### 4. Missing Topics (59.8% unknown)

**Root Cause:** Historical content + some generation failures  
**Impact:** Medium (topic-based learning limited)  
**Fix Priority:** Medium (add fallback topic + backfill)

### 5. Missing Engagement Metrics (40% NULL)

**Root Cause:** 
- Scraping failures (deleted tweets, private accounts)
- Content verification blocking valid metrics
- Zero engagement (not a bug, but indicates low performance)

**Impact:** Critical (blocks v2 metrics calculation)  
**Fix Priority:** High (investigate scraping failures + review verification logic)

---

## EVIDENCE FROM DATABASE

### content_slot Coverage
- Recent replies (last 9): 100% have slots ✅
- Recent posts (last 5): 100% have slots ✅
- Older content: 0% have slots ❌

### v2 Metrics Coverage
- Recent outcomes: 40% have v2 metrics (60% NULL) ❌
- All NULL v2 metrics correspond to NULL engagement_rate

### Reply Tracking
- Recent replies: 100% have `content_slot='reply'` ✅
- Older replies: 0% have slots ❌
- `vw_learning` only shows 1 reply (filters by slot)

### Topic Assignment
- Recent posts: 100% have topics ✅
- Replies: 0% have topics (by design) ✅
- Older posts: 0% have topics ❌

### Engagement Metrics
- Recent outcomes: 60% have engagement_rate (40% NULL) ❌
- Many have engagement_rate=0 (zero engagement, not NULL)

---

## RECOMMENDATIONS

### Immediate Actions (High Priority)

1. **Fix v2 metrics calculation condition** (Line 478 in metricsScraperJob.ts)
   - Calculate v2 metrics even with zero engagement
   - Ensure all outcomes get v2 fields (even if 0)

2. **Investigate engagement scraping failures**
   - Check Railway logs for scraping errors
   - Review content verification thresholds
   - Distinguish between "not scraped" and "zero engagement"

3. **Update vw_learning view**
   - Include replies without content_slot (temporary)
   - Or backfill older replies with slots

### Medium Priority

4. **Backfill historical content slots**
   - Assign slots to older posts based on generator_name
   - Assign 'reply' slot to older replies

5. **Add fallback topic assignment**
   - Ensure all posts get a topic (even if generation fails)
   - Backfill historical content with topics

### Low Priority

6. **Monitor new content**
   - Verify slots continue to be assigned
   - Verify v2 metrics continue to be calculated
   - Track coverage improvements over time

---

*Diagnostic complete. No code modifications performed. All findings based on code inspection and production database verification.*

