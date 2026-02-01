# Railway Harvest Verification - Public Discovery Lane

**Date:** January 29, 2026  
**Service:** Railway serene-cat

## A) Environment Variables Verified ✅

**Commands:**
```bash
railway variables --service serene-cat --set P1_MODE=true
railway variables --service serene-cat --set HARVESTING_ENABLED=true
railway variables --service serene-cat --set P1_TARGET_MAX_AGE_HOURS=1
railway variables --service serene-cat --set P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20
```

**Verification:**
```bash
railway variables --service serene-cat | grep -E "(P1_MODE|HARVESTING_ENABLED|REPLY_V2_ROOT_ONLY|P1_TARGET_MAX_AGE|P1_MAX_PREFLIGHT)"
```

**Result:**
```
║ HARVESTING_ENABLED                      │ true                               ║
║ P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK      │ 20                                 ║
║ P1_MODE                                 │ true                               ║
║ P1_TARGET_MAX_AGE_HOURS                 │ 1                                  ║
║ REPLY_V2_ROOT_ONLY                      │ true                               ║
```

✅ **All required env vars set correctly**

## B) Harvester Execution ✅

**Command:**
```bash
railway run --service serene-cat pnpm tsx scripts/ops/run-harvester-single-cycle.ts
```

**Logs Showing Public Queries Running:**
```
[HARVEST_TIER] tier=PUBLIC query="PUBLIC_VERIFIED_HEALTH" min_likes=2000
[REAL_DISCOVERY] 🔍 PUBLIC_VERIFIED_HEALTH search: 2000+ likes, <12h old (broad - all topics)...
[REAL_DISCOVERY] 🌐 Navigating to search: https://x.com/search?q=(health%20OR%20wellness%20OR%20fitness%20OR%20nutrition%20OR%20diet%20OR%20protein%20OR%20sleep%20OR%20exercise%20OR%20workout%20OR%20running%20OR%20lifting%20OR%20cardio%20OR%20metabolism%20OR%20longevity%20OR%20supplement%20OR%20creatine%20OR%20testosterone%20OR%20cortisol%20OR%20inflammation%20OR%20recovery%20OR%20fasting%20OR%20glucose%20OR%20insulin%20OR%20gut%20OR%20microbiome%20OR%20immune%20OR%20vitamin%20OR%20mineral%20OR%20hydration)%20verified%20min_faves%3A2000%20-filter%3Areplies%20lang%3Aen%20-airdrop%20-giveaway%20-crypto%20-nft%20-betting%20-casino%20-OnlyFans%20-porn%20-trump%20-biden%20-election%20-gaza%20-ukraine%20-war%20-breaking%20-celebrity%20-shooting%20-killed%20-died&src=typed_query&f=live

[HARVEST_TIER] tier=PUBLIC query="PUBLIC_VERIFIED_FITNESS" min_likes=2000
[REAL_DISCOVERY] 🔍 PUBLIC_VERIFIED_FITNESS search: 2000+ likes, <12h old (broad - all topics)...

[HARVEST_TIER] tier=PUBLIC query="PUBLIC_HIGH_ENGAGEMENT" min_likes=5000
[REAL_DISCOVERY] 🔍 PUBLIC_HIGH_ENGAGEMENT search: 5000+ likes, <24h old (broad - all topics)...
```

✅ **Public queries are executing correctly**

## C) Search Results ❌

**Issue:** All public queries returning 0 tweets

**Logs:**
```
[REAL_DISCOVERY] 📊 Page extraction complete: Found 0 tweets
[HARVEST_DEBUG] 🔢 DOM tweet cards found: 0
[REAL_DISCOVERY] ✅ Scraped 0 viral tweets (all topics)
[REAL_DISCOVERY] ⚠️ No viral tweets found in search
[HARVEST_TIER] tier=PUBLIC query="PUBLIC_VERIFIED_HEALTH" scraped=0
[HARVEST_TIER] tier=PUBLIC query="PUBLIC_VERIFIED_FITNESS" scraped=0
[HARVEST_TIER] tier=PUBLIC query="PUBLIC_HIGH_ENGAGEMENT" scraped=0
```

**Analysis:**
- ✅ Queries are executing
- ✅ Pages are loading (238KB HTML saved)
- ❌ No tweet cards found in DOM
- ❌ 0 tweets extracted

**Possible Causes:**
1. `verified` keyword might not be a valid Twitter search operator
2. Search query too complex/restrictive
3. Twitter/X rate limiting or blocking
4. Page structure changed (tweet cards not detected)

## D) Database Verification ❌

**Query:**
```sql
SELECT discovery_source, COUNT(*) as count
FROM reply_opportunities
WHERE discovery_source LIKE 'public_search_%'
AND replied_to = false
GROUP BY discovery_source;
```

**Result:**
```
❌ No public_search_* opportunities found
```

**Recent Opportunities (last 60 min):**
```
Recent opportunities (last 60 min): 1
Counts by discovery_source:
  unknown: 1
Public candidates: 0
```

## E) Scheduler Execution ✅

**Command:**
```bash
railway run --service serene-cat pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
```

**Results:**
```
[SCHEDULER] 📊 Collected 9 candidates to try (P1 mode: true, max attempts: 20)
[SCHEDULER] 🎯 P1_PROBE_SUMMARY: attempted=9 ok=0 forbidden=9 login_wall=0 deleted=0 timeout=0
[SCHEDULER] ⚠️ No candidate passed preflight: attempted=9 ok=0 timeout=0 deleted=0
```

**Analysis:**
- ✅ Scheduler attempting candidates (limited by queue: 9 available)
- ✅ Fast probe working correctly
- ❌ All candidates `forbidden` (from seed harvester, not public lane)
- ❌ No `public_search_*` candidates available to test

## F) Root Cause

**Primary Issue:** Public queries are executing but returning 0 tweets.

**Evidence:**
1. Queries are running (logs show `tier=PUBLIC`)
2. Search URLs are correct (include `verified` keyword)
3. Pages load successfully (HTML saved)
4. No tweet cards found in DOM (`DOM tweet cards found: 0`)

**Likely Cause:** The `verified` keyword in Twitter search may not be a valid operator, or Twitter/X search structure has changed.

## G) Next Steps

### Option 1: Verify `verified` Operator
Test if `verified` works in Twitter search manually:
- Navigate to: `https://x.com/search?q=health verified min_faves:2000 -filter:replies lang:en`
- Check if results appear

### Option 2: Remove `verified` Filter
If `verified` doesn't work, remove it and rely on:
- High engagement threshold (2K-5K+ likes)
- Public accounts by default (high engagement = public)
- Author-level filtering (skip known forbidden authors)

### Option 3: Alternative Public Strategy
- Use `from:verified_account` instead of `verified` keyword
- Target specific verified health accounts
- Use follower count filters if available

## H) Commands Executed

```bash
# 1. Set env vars
railway variables --service serene-cat --set P1_MODE=true
railway variables --service serene-cat --set HARVESTING_ENABLED=true
railway variables --service serene-cat --set P1_TARGET_MAX_AGE_HOURS=1
railway variables --service serene-cat --set P1_MAX_PREFLIGHT_ATTEMPTS_PER_TICK=20

# 2. Verify env vars
railway variables --service serene-cat | grep -E "(P1_MODE|HARVESTING_ENABLED|REPLY_V2_ROOT_ONLY|P1_TARGET_MAX_AGE|P1_MAX_PREFLIGHT)"

# 3. Run harvest
railway run --service serene-cat pnpm tsx scripts/ops/run-harvester-single-cycle.ts

# 4. Verify database
pnpm tsx scripts/ops/verify-public-candidates.ts

# 5. Run scheduler
railway run --service serene-cat pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
```

## I) Summary

✅ **Code Working:** Public discovery lane queries are executing  
✅ **Env Vars Set:** All required variables configured on Railway  
✅ **Scheduler Ready:** P1 mode working, attempting up to 20 candidates  
❌ **Search Issue:** Public queries returning 0 tweets (likely `verified` operator invalid)  
❌ **No Candidates:** Zero `public_search_*` opportunities in database  

**Blocker:** Twitter search queries with `verified` keyword returning 0 results. Need to verify if `verified` is a valid search operator or adjust query strategy.
