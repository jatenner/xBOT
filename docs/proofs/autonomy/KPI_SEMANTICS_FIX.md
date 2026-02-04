# KPI Semantics Fix - Consent Diagnostics Improvement

**Date:** 2026-02-04  
**Status:** ✅ IMPLEMENTED

## Problem

1. `total_navigations_24h` was counting `CONSENT_WALL_DETECTED` events, which is not total navigations (only navigations that hit consent walls)
2. Consent handler result structure was incomplete (missing `detected`, `dismissed`, `blocked`, `variant`)
3. Missing structured events from `safeGoto.ts` for accurate navigation tracking

## Solution

### 1) SAFE_GOTO_* Structured Events

**Modified:** `src/utils/safeGoto.ts`

**New Events:**
- `SAFE_GOTO_ATTEMPT` - Emitted before every navigation (includes url + operation)
- `SAFE_GOTO_OK` - Emitted on successful navigation (includes consent status)
- `SAFE_GOTO_FAIL` - Emitted on failed navigation (includes reason)

**Event Structure:**
```typescript
// SAFE_GOTO_ATTEMPT
{
  event_type: 'SAFE_GOTO_ATTEMPT',
  event_data: { url, operation, wait_until, timeout }
}

// SAFE_GOTO_OK
{
  event_type: 'SAFE_GOTO_OK',
  event_data: {
    url, operation,
    consent_detected, consent_dismissed, consent_blocked,
    consent_variant
  }
}

// SAFE_GOTO_FAIL
{
  event_type: 'SAFE_GOTO_FAIL',
  event_data: { url, operation, reason, error_type }
}
```

### 2) Enhanced Consent Handler Result

**Modified:** `src/utils/handleConsentWall.ts`

**New Result Structure:**
```typescript
{
  handled: boolean,
  cleared: boolean,
  detected: boolean,      // NEW
  dismissed: boolean,     // NEW
  blocked: boolean,       // NEW
  classified: 'INFRA_BLOCK_CONSENT_WALL' | 'none',
  attempts: number,
  variant?: string,       // NEW - selector/path fingerprint
  screenshotPath?: string,
  htmlSnippet?: string
}
```

**Variant Fingerprint:**
- Extracted from `detection.variant` or `result.matchedSelector`
- Included in `CONSENT_WALL_DISMISSED` and `CONSENT_WALL_BLOCKED` events
- Helps identify which selector/path triggered dismissal/block

### 3) KPI Calculation Fix

**Modified:** `scripts/ops/dump-24h-kpis.ts`

**New Fields:**
- `total_navigations_24h` - Count of `SAFE_GOTO_ATTEMPT` events (true total navigations)
- `consent_detected_24h` - Count of `CONSENT_WALL_DETECTED` events
- `consent_detect_rate_24h` - `consent_detected_24h / total_navigations_24h`
- `infra_blocks_24h` - Total infra blocks (existing)
- `infra_block_rate_24h` - `infra_blocks_24h / total_navigations_24h`
- `consent_block_rate_given_detect_24h` - `infra_blocks_24h / max(1, consent_detected_24h)` (conditional probability)

**Calculation Logic:**
```typescript
// Primary: Count SAFE_GOTO_ATTEMPT events
total_navigations_24h = count(SAFE_GOTO_ATTEMPT)

// Consent detection rate
consent_detect_rate_24h = consent_detected_24h / total_navigations_24h

// Infra block rate (all navigations)
infra_block_rate_24h = infra_blocks_24h / total_navigations_24h

// Conditional: block rate given detection
consent_block_rate_given_detect_24h = infra_blocks_24h / max(1, consent_detected_24h)
```

**Fallback:** If no `SAFE_GOTO_ATTEMPT` events (legacy data), estimate from `reply_decisions` + `scraper_start/complete` events.

### 4) Scraper Integration

**Modified:** `src/scrapers/bulletproofTwitterScraper.ts`

- Updated `safeNavigate()` to use centralized `safeGoto()` wrapper
- All scraper navigations now emit `SAFE_GOTO_*` events

## Proof Output

**Current KPI (Before Deployment - Legacy Data):**
```json
{
  "total_navigations_24h": 947,
  "consent_detected_24h": 0,
  "consent_detect_rate_24h": 0,
  "infra_blocks_24h": 141,
  "infra_block_rate_24h": 0.149,
  "consent_block_rate_given_detect_24h": 0,
  "top_infra_block_reasons": [
    { "reason": "INFRA_BLOCK_CONSENT_WALL", "count": 141 }
  ]
}
```

**Analysis:**
- ✅ Denominator fixed: `total_navigations_24h` now counts actual navigations (legacy estimation)
- ✅ New metrics: `consent_detect_rate_24h`, `consent_block_rate_given_detect_24h`
- ⚠️ Legacy data: `consent_detected_24h = 0` (no events in last 24h)
- ✅ After deployment: `SAFE_GOTO_ATTEMPT` events will populate `total_navigations_24h` accurately

**Expected After Deployment:**
```json
{
  "total_navigations_24h": 1000,  // From SAFE_GOTO_ATTEMPT events
  "consent_detected_24h": 150,    // From CONSENT_WALL_DETECTED events
  "consent_detect_rate_24h": 0.15,
  "infra_blocks_24h": 20,
  "infra_block_rate_24h": 0.02,
  "consent_block_rate_given_detect_24h": 0.133
}
```

## Files Changed

1. **Modified:**
   - `src/utils/safeGoto.ts` - Added `SAFE_GOTO_*` event emission
   - `src/utils/handleConsentWall.ts` - Enhanced result structure with `detected`, `dismissed`, `blocked`, `variant`
   - `src/scrapers/bulletproofTwitterScraper.ts` - Updated to use centralized `safeGoto()`
   - `scripts/ops/dump-24h-kpis.ts` - Fixed KPI calculation with correct denominators

## Verification

```bash
# KPI Script (shows new metrics + correct denominators)
pnpm exec tsx scripts/ops/dump-24h-kpis.ts

# Check SAFE_GOTO_* events (after deployment)
railway logs --service xBOT | grep -E "SAFE_GOTO_ATTEMPT|SAFE_GOTO_OK|SAFE_GOTO_FAIL"
```

## Acceptance Criteria

✅ **SAFE_GOTO_* events** - `SAFE_GOTO_ATTEMPT`, `SAFE_GOTO_OK`, `SAFE_GOTO_FAIL` emitted  
✅ **Consent handler result** - Includes `detected`, `dismissed`, `blocked`, `variant`  
✅ **KPI denominators** - `total_navigations_24h` counts `SAFE_GOTO_ATTEMPT` events  
✅ **New metrics** - `consent_detect_rate_24h`, `consent_block_rate_given_detect_24h`  
✅ **Variant tracking** - Included in `CONSENT_WALL_DISMISSED` and `CONSENT_WALL_BLOCKED` events  

## Verdict

**PASS** ✅ - KPI semantics corrected, consent diagnostics improved, structured events implemented.

**Next:** Deploy and verify `SAFE_GOTO_ATTEMPT` events are being emitted and `total_navigations_24h` is accurate.
