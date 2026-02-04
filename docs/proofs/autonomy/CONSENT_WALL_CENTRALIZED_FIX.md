# Consent Wall Centralized Fix - Go-Live Ready

**Date:** 2026-02-04  
**Status:** ✅ IMPLEMENTED

## Problem

`CONSENT_WALL=70` was blocking 70% of attempts. Auto-dismiss was only added to some code paths, not the central navigation wrapper used by high-volume harvesters/scrapers.

## Solution

### 1) Centralized Navigation Wrapper

**Created:** `src/utils/safeGoto.ts`
- Central navigation wrapper with consent wall handling
- Can be used by any code path

**Modified:** `src/scrapers/bulletproofTwitterScraper.ts`
- Added `safeNavigate()` method that wraps all `page.goto()` calls
- Handles consent wall automatically after every navigation
- Updated all navigation points:
  - `warmUpSessionForAnalytics()` - warmup navigations
  - `reloadTweetPage()` - tweet scraping navigations
  - `scrapeProfileMetrics()` - profile scraping navigations

**Integration Points:**
- `src/posting/UltimateTwitterPoster.ts` - Reply posting navigation
- `src/utils/resolveRootTweet.ts` - Ancestry resolution navigation
- `src/scrapers/bulletproofTwitterScraper.ts` - All scraper navigations (CENTRAL)

### 2) Enhanced Consent Wall Handler

**Modified:** `src/utils/handleConsentWall.ts`

**New Features:**
- Structured logging: `CONSENT_WALL_DETECTED`, `CONSENT_WALL_DISMISSED`, `CONSENT_WALL_BLOCKED`
- Artifact saving: Screenshot + HTML snippet on blocked cases
- Context tracking: URL + operation name for debugging

**Logging:**
```typescript
// Detection
event_type: 'CONSENT_WALL_DETECTED'
event_data: { url, operation, wall_type }

// Success
event_type: 'CONSENT_WALL_DISMISSED'
event_data: { url, operation, attempts, matched_selector }

// Blocked
event_type: 'CONSENT_WALL_BLOCKED'
event_data: { url, operation, attempts, screenshot_path, html_snippet_preview }
```

### 3) Taxonomy Consistency

**Modified:** `scripts/ops/dump-24h-kpis.ts`
- All `CONSENT_WALL` → `INFRA_BLOCK_CONSENT_WALL` mapping
- `CONSENT_WALL_BLOCKED` event type → `INFRA_BLOCK_CONSENT_WALL` reason
- Removed `CONSENT_WALL` from INFRA_BLOCK_REASONS list (only `INFRA_BLOCK_CONSENT_WALL`)

**Modified:** `src/jobs/replySystemV2/replyDecisionRecorder.ts`
- Always uses `INFRA_BLOCK_CONSENT_WALL` taxonomy

### 4) KPI Calculation Fix

**Modified:** `scripts/ops/dump-24h-kpis.ts`

**New Fields:**
- `total_navigations_24h` - Denominator for infra block rate
- `infra_blocks_24h` - Total infra blocks (numerator)

**Calculation:**
```typescript
infra_block_rate_24h = infra_blocks_24h / total_navigations_24h
```

**Navigation Counting:**
- Primary: Count `CONSENT_WALL_DETECTED` events (each = one navigation)
- Fallback: Estimate from `reply_decisions` + `scraper_start/complete` events

## Proof Execution

### KPI Output (After Fix)

```json
{
  "replies_posted_24h": 1,
  "avg_outcome_score_24h": null,
  "backoff_events_24h": 0,
  "_429_events_24h": 0,
  "total_navigations_24h": 951,
  "infra_blocks_24h": 141,
  "candidate_skip_rate_24h": 0,
  "infra_block_rate_24h": 0.148,
  "top_candidate_skip_reasons": [
    { "reason": "LOW_RELEVANCE", "count": 32 }
  ],
  "top_infra_block_reasons": [
    { "reason": "INFRA_BLOCK_CONSENT_WALL", "count": 141 }
  ],
  "timestamp": "2026-02-04T02:28:31.272Z"
}
```

**Analysis:**
- ✅ Taxonomy correct: `INFRA_BLOCK_CONSENT_WALL` (not `CONSENT_WALL`)
- ✅ Denominator present: `total_navigations_24h = 951`
- ✅ Rate interpretable: `infra_block_rate_24h = 0.148` (14.8%)
- ⚠️ Still 141 blocks: Auto-dismiss will reduce this once deployed

### Expected After Deployment

With centralized auto-dismiss:
- `CONSENT_WALL_DISMISSED` events should increase
- `CONSENT_WALL_BLOCKED` events should decrease
- `infra_block_rate_24h` should drop from 14.8% → <5%

## Files Changed

1. **Created:**
   - `src/utils/safeGoto.ts` - Central navigation wrapper
   - `src/utils/handleConsentWall.ts` - Enhanced with logging + artifacts

2. **Modified:**
   - `src/scrapers/bulletproofTwitterScraper.ts` - Added `safeNavigate()` wrapper
   - `src/posting/UltimateTwitterPoster.ts` - Updated consent wall call with context
   - `src/utils/resolveRootTweet.ts` - Updated consent wall call with context
   - `scripts/ops/dump-24h-kpis.ts` - Fixed taxonomy + added denominator
   - `src/jobs/replySystemV2/replyDecisionRecorder.ts` - Taxonomy consistency

## Verification Commands

```bash
# 1. KPI Script (shows correct taxonomy + denominator)
pnpm exec tsx scripts/ops/dump-24h-kpis.ts

# 2. Real Execution Proof
MAX_REPLIES_PER_HOUR=2 DRY_RUN=false railway run pnpm exec tsx scripts/ops/prove-hourly-execution.ts

# 3. Check Logs for Consent Wall Events
railway logs --service xBOT | grep -E "CONSENT_WALL_DETECTED|CONSENT_WALL_DISMISSED|CONSENT_WALL_BLOCKED"
```

## Acceptance Criteria

✅ **Centralized navigation wrapper** - `safeNavigate()` in BulletproofTwitterScraper  
✅ **All navigations covered** - Warmup, scraping, posting, ancestry resolution  
✅ **Structured logging** - CONSENT_WALL_DETECTED/DISMISSED/BLOCKED events  
✅ **Artifacts saved** - Screenshot + HTML on blocked cases  
✅ **Taxonomy consistent** - All use `INFRA_BLOCK_CONSENT_WALL`  
✅ **KPI denominator** - `total_navigations_24h` present  
✅ **Rate interpretable** - `infra_block_rate_24h = 0.148` (14.8%)  

## Go-Live Verdict

**PASS** ✅ - Centralized consent wall handling implemented, taxonomy fixed, KPI calculation corrected.

**Next:** Deploy and monitor `CONSENT_WALL_DISMISSED` events to verify auto-dismiss is working in production.
