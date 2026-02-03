# Auth Persistence Fix - Lightweight Checks + Periodic Reload

**Date:** 2026-02-03
**Status:** ✅ Implemented

## Problem

Auth persistence was failing around ~29 minutes due to pattern detection from frequent `/home` navigation every tick.

## Solution Implemented

**Lightweight Checks + Periodic Reload Strategy:**

1. **Keep page open** between checks (no navigation every tick)
2. **Lightweight DOM checks** every `TICK_SECONDS` (default 60s)
   - Checks existing page DOM for logged-in indicators
   - No navigation, no network requests
   - Fast and doesn't trigger pattern detection
3. **Periodic reloads** every `RELOAD_INTERVAL_MINUTES` (default 7 min) with jitter
   - Full page reload/navigation only when needed
   - ±20% jitter when `HUMAN_JITTER=true`
   - Reduces navigation frequency from every tick to every 5-10 minutes

## Changes Made

### Code Changes

**File:** `scripts/executor/prove-auth-b64-persistence.ts`

1. Added `checkLoggedInLightweight()` function
   - DOM checks without navigation
   - Verifies logged-in state using existing page elements
   - Fast, no network overhead

2. Modified main loop
   - Initial navigation to `/home`
   - Lightweight checks every tick
   - Reload only when `RELOAD_INTERVAL_MINUTES` elapsed (with jitter)

3. Added environment variables
   - `TICK_SECONDS` - Check interval (default: 60)
   - `RELOAD_INTERVAL_MINUTES` - Reload interval (default: 7)
   - `HUMAN_JITTER` - Enable jitter (default: false)

### Documentation Changes

**File:** `README_MASTER.md`

1. Updated Gate 1 command with recommended settings
2. Updated persistence proof commands
3. Added "Recommended Cadence Settings" section
4. Explained why this works (avoids pattern detection)

## Commands

### Recommended (Lightweight Checks + Periodic Reload)

```bash
PROOF_DURATION_MINUTES=60 TICK_SECONDS=180 RELOAD_INTERVAL_MINUTES=7 HUMAN_JITTER=true pnpm run executor:prove:auth-b64-persistence
```

### Baseline (Navigates Every Tick)

```bash
PROOF_DURATION_MINUTES=60 pnpm run executor:prove:auth-b64-persistence
```

## Expected Behavior

**Before Fix:**
- Navigates to `/home` every tick (every 60s)
- Pattern detection triggers after ~29 minutes
- Auth fails with `login_redirect` or `unknown`

**After Fix:**
- Lightweight checks every tick (no navigation)
- Reloads every 7-10 minutes (with jitter)
- Reduces navigation frequency by ~85%
- Should persist ≥60 minutes

## Testing

**Readwrite Proof:** ✅ PASS
```bash
pnpm run executor:prove:auth-b64-readwrite
```

**Persistence Proof (with fix):** ⏳ Testing
```bash
PROOF_DURATION_MINUTES=30 TICK_SECONDS=60 RELOAD_INTERVAL_MINUTES=7 HUMAN_JITTER=true pnpm run executor:prove:auth-b64-persistence
```

## Next Steps

1. **Run full 60-minute test** with recommended settings
2. **Verify persistence** ≥60 minutes
3. **If PASS:** Update daemon to use same strategy
4. **If FAIL:** Check forensics snapshot for root cause

## Git Commits

- `3c85d19b` - Auth: implement lightweight checks + periodic reload strategy
- `ca24dc64` - Auth: update README with lightweight checks + periodic reload strategy
