# xBOT Discovery/Reply Quality Improvements

**Date:** January 8, 2026  
**Goal:** Improve discovery/harvest quality + reply selection to consistently target "good tweets" (fresh, high-engagement, health-relevant, replyable) and avoid generic/brand-announcement spam replies.

## Implementation Status

### ✅ Completed
1. **Seed Account Stats Migration** (`supabase/migrations/20260108_seed_account_stats.sql`)
   - Created `seed_account_stats` table with fields: `handle`, `scraped_count`, `stored_count`, `avg_score`, `last_success_at`, `last_failure_reason`, `rolling_7d_success_rate`

### 🚧 In Progress
2. **Seed Quality Tracking** - Track per-seed stats and implement weighted sampling (epsilon-greedy 80/20)
3. **Health Relevance Scoring** - Add `relevance_score` and `replyability_score` to opportunities
4. **Tier Consistency** - Fix tier logging to show `tier_raw`, `tier_norm`, `tier_saved`
5. **Do-Not-Reply Rules** - Same tweet_id check, author limits, corporate/promo/tragedy filters
6. **Improved Opportunity Picking** - Add `health_niche_weight`, update score formula
7. **Reply Generation Improvements** - Replace generic congrats, add `reply_intent` classifier

### 📋 Pending
8. **Scripts** - `seed-stats-top.ts`, update `opportunity-top.ts`
9. **Package.json** - Add `seed:stats` script

## Key Changes

### A) Harvest/Discovery Improvements

#### 1. Seed Quality Model
- Track per-seed performance metrics in `seed_account_stats`
- Weighted sampling: favor high success rate seeds (80%) but keep exploration (20%)
- Update stats after each harvest run

#### 2. Tweet Extraction Reliability
- Detect error containers ("something went wrong", "enable JavaScript")
- Retry logic: network idle + scroll + alternative selectors
- Fallback to "UserTweets" timeline region extraction

#### 3. "Good Tweet" Definition
- **Health Relevance:** Keyword/topic check (fitness, nutrition, sleep, recovery, longevity, training, labs, habits)
- **Health Authority Allowlist:** Broader topics allowed for known health accounts
- **Replyability:** Question OR controversial claim OR advice request OR "what do you think" OR poll OR "hot take"
- **Penalties:** Link-only posts, generic announcements, promo/corporate PR
- **Scores:** `relevance_score` (0-1), `replyability_score` (0-1)

#### 4. Tier Consistency
- Fix logging: show `tier_raw`, `tier_norm`, `tier_saved` explicitly
- Ensure DB writes match logs

### B) Reply Selection + Generation Guardrails

#### 5. Do-Not-Reply Rules
- Same `tweet_id` check (never reply twice)
- Same author limit: N times/day (configurable)
- Block corporate announcements / partnership PR
- Block giveaway / promo / ads
- Block tragedy / death / sensitive disasters (keyword filter)
- Skip image-only tweets (unless OCR available)

#### 6. Improved Opportunity Picking
- Add `health_niche_weight` (penalize off-niche mega tweets)
- Score formula: `(engagement_velocity * tier_weight) * (relevance_score * replyability_score) - penalties`
- Minimum thresholds: `relevance_score >= X`, `replyability_score >= Y`

#### 7. Reply Content Quality
- Replace generic congrats with value-add replies
- Add `reply_intent` classifier: `{question, add_insight, disagree, agree+expand}`
- Style constraints: no corporate voice, no forced health tie-ins, 1-2 sentences max, specific, non-cringe, no emojis by default

### C) Verification Scripts

#### 8. Scripts
- `scripts/seed-stats-top.ts`: Top 20 seeds by 7d stored_count and success rate
- `scripts/opportunity-top.ts`: Add `relevance_score`, `replyability_score`, `why_selected`

#### 9. Package.json
- `seed:stats` → `tsx scripts/seed-stats-top.ts`

## Testing Plan

1. **Harvest Test:** `pnpm harvest:once`
   - Should store >0 opportunities
   - Should show `relevance_score`/`replyability_score` in logs

2. **Opportunity Top:** `pnpm exec tsx scripts/opportunity-top.ts 10`
   - Shows additional fields + reasons

3. **Reply Dry Run:** `pnpm reply:live`
   - Does NOT pick off-niche PR tweets if relevance is low
   - Generated reply is specific and not "we're excited"

## Next Steps

1. Implement seed quality tracking in `harvestSeedAccounts`
2. Add relevance/replyability scoring functions
3. Update `storeOpportunity` to include new scores
4. Add do-not-reply checks in `replyJob`
5. Improve reply generation prompt
6. Create verification scripts

