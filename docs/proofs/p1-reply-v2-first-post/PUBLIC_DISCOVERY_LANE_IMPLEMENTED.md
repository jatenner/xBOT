# Public-Only Discovery Lane - Implementation Complete

**Date:** January 29, 2026  
**Status:** ✅ Code Complete, ⏳ Awaiting Fresh Harvest Cycle

## Summary

Implemented public-only discovery lane and author-level accessibility memory to improve candidate quality and complete P1 (first posted reply).

## A) Public-Only Discovery Lane ✅

### Implementation

**File:** `src/jobs/replyOpportunityHarvester.ts`

**New Queries (P1 Mode Only):**
```typescript
const tierPublicQueries = p1Mode ? [
  { tier: 'PUBLIC', label: 'PUBLIC_VERIFIED_HEALTH', minLikes: 2000, maxReplies: 200, maxAgeHours: 12,
    query: `${HEALTH_KEYWORDS} verified min_faves:2000 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}`,
    discovery_source: 'public_search_verified_health' },
  { tier: 'PUBLIC', label: 'PUBLIC_VERIFIED_FITNESS', minLikes: 2000, maxReplies: 200, maxAgeHours: 12,
    query: `(fitness OR workout OR exercise OR gym) verified min_faves:2000 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}`,
    discovery_source: 'public_search_verified_fitness' },
  { tier: 'PUBLIC', label: 'PUBLIC_HIGH_ENGAGEMENT', minLikes: 5000, maxReplies: 300, maxAgeHours: 24,
    query: `${HEALTH_KEYWORDS} min_faves:5000 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}`,
    discovery_source: 'public_search_high_engagement' },
] : [];
```

**Strategy:**
- Uses `verified` filter to target verified accounts (blue checkmark) - almost always public
- Targets high-engagement tweets (2K-5K+ likes) which are more likely to be public
- Prioritized FIRST in P1 mode: `[...tierPublicQueries, ...tierAQueries, ...]`
- Persists `discovery_source` as `public_search_verified_health`, `public_search_verified_fitness`, `public_search_high_engagement`

## B) Author-Level Accessibility Memory ✅

### Database Migration

**File:** `supabase/migrations/20260129_add_forbidden_authors.sql`

**Table:** `forbidden_authors`
- `author_handle` (TEXT PRIMARY KEY)
- `first_seen_at`, `last_seen_at` (TIMESTAMPTZ)
- `failure_count` (INTEGER)
- `failure_reasons` (TEXT[])
- `accessibility_status` (TEXT: 'forbidden'|'login_wall'|'deleted')

**Applied:** ✅ Migration executed successfully

### Scheduler Integration

**File:** `src/jobs/replySystemV2/tieredScheduler.ts`

**When probe fails as `forbidden`:**
- Persists author to `forbidden_authors` table
- Increments `failure_count` if author already exists
- Tracks `failure_reasons` array

**Code:**
```typescript
if (oppInfo?.target_username && accessibilityStatus === 'forbidden') {
  const authorHandle = oppInfo.target_username.toLowerCase();
  // Check if author already exists
  const { data: existing } = await supabase
    .from('forbidden_authors')
    .select('author_handle, failure_count')
    .eq('author_handle', authorHandle)
    .maybeSingle();
  
  if (existing) {
    // Update existing record - increment failure count
    await supabase
      .from('forbidden_authors')
      .update({
        failure_count: (existing.failure_count || 0) + 1,
        last_seen_at: new Date().toISOString(),
        failure_reasons: [...existingReasons, `Probe detected ${marker}`],
      })
      .eq('author_handle', authorHandle);
  } else {
    // Insert new record
    await supabase.from('forbidden_authors').insert({...});
  }
}
```

### Harvester Filtering

**File:** `src/jobs/replyOpportunityHarvester.ts`

**Before storing opportunities:**
- Queries `forbidden_authors` table for known forbidden authors
- Filters out opportunities from these authors in P1 mode
- Logs skipped opportunities: `[HARVEST_TIER] SKIP_FORBIDDEN_AUTHOR tweet_id=... author=@...`

**Code:**
```typescript
if (p1Mode) {
  const { data: forbiddenAuthors } = await supabase
    .from('forbidden_authors')
    .select('author_handle')
    .in('accessibility_status', ['forbidden', 'login_wall']);
  
  const forbiddenSet = new Set((forbiddenAuthors || []).map(a => a.author_handle.toLowerCase()));
  
  if (forbiddenSet.size > 0) {
    filteredOpps = filteredOpps.filter((opp: any) => {
      const author = (opp.tweet_author || opp.target_username || '').toLowerCase();
      return !forbiddenSet.has(author);
    });
  }
}
```

## C) Code Changes Summary

### Files Modified

1. **`src/jobs/replyOpportunityHarvester.ts`**
   - Added `tierPublicQueries` with verified account searches
   - Prioritized public queries first in P1 mode
   - Added forbidden author filtering before storing opportunities
   - Updated `discovery_source` assignment to use `public_search_*` format

2. **`src/jobs/replySystemV2/tieredScheduler.ts`**
   - Added author tracking when probe fails as `forbidden`
   - Persists to `forbidden_authors` table with failure counts

3. **`supabase/migrations/20260129_add_forbidden_authors.sql`**
   - New migration creating `forbidden_authors` table
   - Indexes for fast lookups

### Statistics

```
3 files changed
- src/jobs/replyOpportunityHarvester.ts: +50 lines
- src/jobs/replySystemV2/tieredScheduler.ts: +30 lines  
- supabase/migrations/20260129_add_forbidden_authors.sql: +30 lines (new)
```

## D) Expected Behavior

### After Fresh Harvest Cycle

1. **Public Queries Run First:**
   ```
   [HARVEST_TIER] tier=PUBLIC query="PUBLIC_VERIFIED_HEALTH" min_likes=2000
   [HARVEST_TIER] tier=PUBLIC query="PUBLIC_VERIFIED_FITNESS" min_likes=2000
   [HARVEST_TIER] tier=PUBLIC query="PUBLIC_HIGH_ENGAGEMENT" min_likes=5000
   ```

2. **Opportunities Stored with Public Discovery Source:**
   ```
   [HARVEST_STORE] tweet_id=... discovery_source=public_search_verified_health
   ```

3. **Forbidden Authors Filtered:**
   ```
   [HARVEST_TIER] SKIP_FORBIDDEN_AUTHOR tweet_id=... author=@RightScopee
   [HARVEST_TIER] Filtered 3 opportunities from 5 forbidden authors
   ```

4. **Scheduler Shows Public Candidates:**
   ```
   [SCHEDULER] 📊 Candidate source: tweet_id=... discovery=public_search_verified_health
   [SCHEDULER] 🎯 P1_PROBE_SUMMARY: attempted=20 ok=5 forbidden=10 login_wall=2 deleted=3 timeout=0
   ```

## E) Next Steps

1. ✅ **Code Complete:** All changes implemented
2. ✅ **Migration Applied:** `forbidden_authors` table created
3. ⏳ **Fresh Harvest:** Run harvester cycle with P1_MODE=true to get public candidates
4. ⏳ **Verify:** Check scheduler logs for `discovery_source=public_search_*`
5. ⏳ **Prove P1:** Confirm `ok >= 1` in P1_PROBE_SUMMARY

## F) Verification Commands

```bash
# 1. Run harvester with P1 mode
REPLY_V2_ROOT_ONLY=true P1_MODE=true P1_TARGET_MAX_AGE_HOURS=1 \
pnpm tsx scripts/ops/run-harvester-single-cycle.ts

# 2. Check for public_search_* opportunities
psql $DATABASE_URL -c "SELECT discovery_source, COUNT(*) FROM reply_opportunities WHERE discovery_source LIKE 'public_search_%' GROUP BY discovery_source;"

# 3. Check forbidden authors
psql $DATABASE_URL -c "SELECT author_handle, failure_count, accessibility_status FROM forbidden_authors ORDER BY failure_count DESC LIMIT 10;"

# 4. Run scheduler
REPLY_V2_ROOT_ONLY=true P1_MODE=true P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20 REPLY_V2_PLAN_ONLY=true \
pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
```

## Notes

- Public queries use `verified` filter which targets verified accounts (almost always public)
- Forbidden author filtering only applies in P1 mode to avoid over-filtering
- Author tracking happens automatically when probe fails - no manual intervention needed
- Public queries are prioritized FIRST in P1 mode for maximum accessibility
