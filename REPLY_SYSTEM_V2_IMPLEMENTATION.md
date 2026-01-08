# 🎼 REPLY SYSTEM V2 - IMPLEMENTATION COMPLETE

**Date:** January 8, 2026  
**Status:** ✅ **IMPLEMENTED**

---

## OBJECTIVE

Achieve 4 replies/hour while maintaining quality: >=1000 views within 24h target (ratcheting upward).

**Strategy:** Expand candidate funnel + implement queue + fallback tiers (DO NOT lower quality gates).

---

## IMPLEMENTATION SUMMARY

### ✅ 1. Multi-Feed Candidate Sources

**A) CuratedAccountsFeed** (`src/jobs/replySystemV2/curatedAccountsFeed.ts`)
- Maintains list of 200-500 high-signal health accounts
- Pulls latest tweets every 5-10 min
- Fetches from `curated_accounts` table

**B) KeywordFeed** (`src/jobs/replySystemV2/keywordFeed.ts`)
- Searches/scrapes for health keywords
- Keywords: creatine, protein, ozempic, cholesterol, zone 2, VO2 max, sleep, etc.
- Pulls every 5-10 min

**C) ViralWatcherFeed** (`src/jobs/replySystemV2/viralWatcherFeed.ts`)
- Detects trending/viral health tweets
- Filters for health keywords + viral threshold (100+ likes)
- Root-only detection
- Pulls every 5-10 min

---

### ✅ 2. Candidate Scoring + Filtering

**File:** `src/jobs/replySystemV2/candidateScorer.ts`

**Hard Filters:**
- ✅ Root only (via `resolveRootTweetId`)
- ✅ Non-parody (username + content check)
- ✅ Topic relevance >= 0.6
- ✅ Spam score < 0.7

**Scoring:**
- `topic_relevance_score`: 0-1 (keyword matches)
- `spam_score`: 0-1 (higher = more spam)
- `velocity_score`: 0-1 (engagement per minute)
- `recency_score`: 0-1 (newer = higher)
- `author_signal_score`: 0-1 (curated account check)

**Composite Score:**
- Weighted: topic (30%) + anti-spam (20%) + velocity (30%) + recency (10%) + author (10%)
- Scaled to 0-100

**Prediction:**
- `predicted_24h_views`: Based on current engagement + velocity
- `predicted_tier`: 1 (>=5000), 2 (>=1000), 3 (>=500), 4 (<500)

**Storage:**
- All evaluated candidates stored in `candidate_evaluations` with reason codes

---

### ✅ 3. Shortlist Queue

**File:** `src/jobs/replySystemV2/queueManager.ts`

**Table:** `reply_candidate_queue`

**Features:**
- Maintains top 25 candidates
- Refreshes every 5 min
- TTL based on age/velocity (15-60 min)
- Auto-expires stale candidates

**Queue Refresh:**
- Selects top candidates from `candidate_evaluations`
- Filters: `passed_hard_filters=true`, `predicted_tier >= 2`
- Orders by `overall_score DESC`
- Updates evaluation status to `queued`

---

### ✅ 4. Tiered Posting Scheduler

**File:** `src/jobs/replySystemV2/tieredScheduler.ts`

**Schedule:** Every 15 minutes

**Tiers:**
- **Tier 1:** >=5000 predicted views (always post)
- **Tier 2:** >=1000 predicted views (always post)
- **Tier 3:** >=500 predicted views (only if behind schedule)
- **Tier 4:** <500 predicted views (block always)

**Logic:**
1. Check if behind schedule (<4 replies/hour)
2. Try Tier 1 → Tier 2 → Tier 3 (if behind)
3. Generate reply using existing pipeline
4. Create decision → queue for posting
5. Track performance

**Integration:**
- Uses existing `routeContentGeneration` for reply generation
- Creates `reply_opportunities` entry
- Creates decision in `content_generation_metadata_comprehensive`
- `postingQueue` processes decisions (with permit system)

---

### ✅ 5. Performance Tracking

**File:** `src/jobs/replySystemV2/performanceTracker.ts`

**Table:** `reply_performance_metrics`

**Snapshots:**
- +30m: views, likes, replies, retweets
- +4h: views, likes, replies, retweets
- +24h: views, likes, replies, retweets

**Metrics:**
- `passed_target`: `views_24h >= target_24h_views`
- `actual_tier`: Based on actual performance
- `predicted_tier`: From candidate evaluation

**Job:** Runs every 30 minutes to update metrics

---

### ✅ 6. Weekly Ratchet Controller

**File:** `src/jobs/replySystemV2/ratchetController.ts`

**Table:** `reply_ratchet_controller`

**Logic:**
- Weekly analysis (every Monday)
- Calculate success rate: `passed_threshold / total_replies * 100`
- If `success_rate >= 60%` AND `total_replies >= 10`:
  - Increase threshold by 10%
  - Update `current_24h_views_threshold`

**Job:** Runs weekly (checks if Monday)

---

## DATABASE SCHEMA

### Tables Created:

1. **`candidate_sources`** - Feed source configuration
2. **`candidate_evaluations`** - All evaluated candidates with scores
3. **`reply_candidate_queue`** - Shortlist queue
4. **`reply_performance_metrics`** - Performance tracking
5. **`reply_ratchet_controller`** - Weekly ratchet state
6. **`curated_accounts`** - Curated account list

**Migration:** `supabase/migrations/20260108_reply_system_v2.sql`

---

## JOBS SCHEDULED

**Added to `jobManager.ts`:**

1. **`reply_v2_fetch`** - Every 5 min
   - Fetches from all feeds
   - Evaluates candidates
   - Refreshes queue

2. **`reply_v2_scheduler`** - Every 15 min
   - Attempts ONE reply from queue
   - Tier-based selection

3. **`reply_v2_performance`** - Every 30 min
   - Updates performance metrics

4. **`reply_v2_ratchet`** - Weekly
   - Runs ratchet analysis

---

## VERIFICATION

**Script:** `scripts/verify-reply-system-v2.ts`

**Tests:**
- ✅ Candidate rate: >=100/hour
- ✅ Queue population: >=10 candidates
- ✅ Parody exclusion: 0 parodies pass filters
- ✅ Tier distribution: Shows tier breakdown

**Run:** `pnpm exec tsx scripts/verify-reply-system-v2.ts`

---

## INITIALIZATION

**Script:** `scripts/init-reply-system-v2.ts`

**Sets up:**
- Candidate sources (3 feeds)
- Curated accounts (5 sample accounts)
- Ratchet controller (current week)

**Run:** `pnpm exec tsx scripts/init-reply-system-v2.ts`

---

## INTEGRATION WITH EXISTING SYSTEM

**Permit System:** ✅ Integrated
- All replies go through `atomicPostExecutor`
- Requires permit before posting
- Tracks origin stamping

**Reply Generation:** ✅ Uses existing pipeline
- `routeContentGeneration` for LLM generation
- `buildReplyContext` for context
- Quality gates enforced

**Posting Queue:** ✅ Processes decisions
- Decisions created with `status='ready'`
- `postingQueue` picks them up
- Permit system active

---

## NEXT STEPS

1. **Seed More Curated Accounts:**
   - Expand `curated_accounts` to 200-500 accounts
   - Focus on high-signal health accounts

2. **Tune Scoring:**
   - Adjust weights based on performance
   - Refine spam detection
   - Improve view prediction

3. **Monitor Performance:**
   - Track success rate vs target
   - Watch for ratchet triggers
   - Adjust tiers if needed

4. **Scale Feeds:**
   - Increase fetch frequency if needed
   - Add more keywords
   - Enhance viral detection

---

## FILES CREATED

```
supabase/migrations/20260108_reply_system_v2.sql
src/jobs/replySystemV2/
  ├── curatedAccountsFeed.ts
  ├── keywordFeed.ts
  ├── viralWatcherFeed.ts
  ├── candidateScorer.ts
  ├── queueManager.ts
  ├── tieredScheduler.ts
  ├── orchestrator.ts
  ├── performanceTracker.ts
  ├── ratchetController.ts
  └── main.ts
scripts/
  ├── init-reply-system-v2.ts
  └── verify-reply-system-v2.ts
src/jobs/jobManager.ts (modified)
```

---

**Status:** ✅ **READY FOR TESTING**

Run verification script to test dry-run, then enable jobs in production.

