# Auth Flip Investigation Summary

**Date:** 2026-02-03
**Status:** Instrumentation Complete, Matrix Testing In Progress

## What We've Done

### Step 1: Inspected Current Failing Run ✅

- **Latest Report:** `docs/proofs/auth/b64-auth-persistence-1770095934123.md`
- **Observation:** Immediate failure (minute 0) with `login_redirect` in previous run
- **Current Run:** Showing "unknown" failures with cookies present (auth_token:true, ct0:true)
- **Summary Written:** `docs/proofs/auth/AUTH_FLIP_OBSERVATION_LATEST.md`

### Step 2: Added Forensics Instrumentation ✅

**Modified:** `scripts/executor/prove-auth-b64-persistence.ts`

**Added:**
- `ForensicsSnapshot` interface (safe, no cookie values)
- Cookie presence tracking (auth_token, ct0, twid, cf_clearance)
- Cookie expiry tracking (timestamps only)
- Storage state tracking (localStorage/sessionStorage/IndexedDB counts)
- Redirect chain capture on login_redirect
- Forensics snapshot JSON on first failure
- `TICK_SECONDS` and `HUMAN_JITTER` env vars for matrix testing

**Forensics Captured:**
- Cookie counts per domain (.x.com, .twitter.com)
- Cookie presence flags (no values)
- Cookie expiries (timestamps only)
- Storage key counts
- IndexedDB existence/count
- Redirect chains (URLs only)

**Commits:**
- `6270e5b8` - Auth: add flip forensics to b64 persistence proof
- `37075036` - Auth: fix snapshot variable reference bug
- `8a882953` - Auth: fix supabase event write error handling

### Step 3: Created Persistence Matrix Runner ✅

**Created:** `scripts/ops/run-auth-persistence-matrix.ts`

**Variants:**
- **A:** 60s ticks, no jitter (baseline)
- **B:** 180s ticks, ±20% jitter (human-ish)
- **C:** 300s ticks, ±20% jitter (more human)

**Features:**
- Stops on first PASS
- Writes results to `auth-persistence-matrix.jsonl`
- Reports per-variant status

**Package Script:** `pnpm run ops:auth:persistence:matrix`

**Commit:** Included in `6270e5b8`

### Step 4: Root Cause Analyzer ✅

**Created:** `scripts/ops/analyze-auth-persistence-root-cause.ts`

**Determinations:**
1. **EXPIRY/ROTATION:** Cookies expire/rotate → refresh strategy or storageState
2. **REVOCATION_BY_PATTERN:** Pattern detection → adjust cadence/jitter
3. **COOKIE_ONLY_INSUFFICIENT:** Cookies present but auth fails → migrate to storageState

**Output:** `docs/proofs/auth/AUTH_PERSISTENCE_ROOT_CAUSE.md`

### Step 5: README Update ✅

**Updated:** `README_MASTER.md`

**Added Section:** "Auth Persistence (Cookie Mode) — Current Status"
- How to run matrix
- Artifact locations
- What PASS/FAIL means
- Next actions based on determination

**Commit:** `0cbbf902`

## Current Status

### Matrix Testing

**Variant A (60s baseline)** is currently running (started ~12:31 AM).

**Expected Duration:** ~60 minutes per variant
- If A fails: B will run (~60 min)
- If B fails: C will run (~60 min)
- Total: Up to 3 hours if all variants fail

**Current Observation:**
- Cookies present (auth_token:true, ct0:true)
- But detection failing with "unknown" reason
- Suggests cookies may be invalid OR detection logic needs improvement

### Artifacts Generated

- ✅ `AUTH_FLIP_OBSERVATION_LATEST.md` - Initial observation
- ✅ `AUTH_PERSISTENCE_ROOT_CAUSE.md` - Template (will be populated after matrix)
- ✅ Forensics snapshots: `b64-auth-flip-snapshot-*.json`
- ✅ Screenshots: `b64-auth-persistence-fail-*.png`
- ⏳ Matrix results: `auth-persistence-matrix.jsonl` (populating)

## Next Steps

### Immediate (While Matrix Runs)

1. **Monitor Progress:**
   ```bash
   pnpm run ops:gate:status
   ```

2. **Check Logs:**
   ```bash
   tail -f /tmp/auth-matrix-variant-a.log
   ```

### After Matrix Completes

1. **Generate Root Cause Analysis:**
   ```bash
   tsx scripts/ops/analyze-auth-persistence-root-cause.ts
   ```

2. **Review Determination:**
   - Check `docs/proofs/auth/AUTH_PERSISTENCE_ROOT_CAUSE.md`
   - Follow "Smallest Fix" recommendation

3. **Implement Fix:**
   - If EXPIRY/ROTATION: Implement refresh or migrate to storageState
   - If REVOCATION_BY_PATTERN: Adjust daemon cadence to 180s+ with jitter
   - If COOKIE_ONLY_INSUFFICIENT: Migrate to Playwright storageState/persistent profile

## Commands Reference

```bash
# Run full matrix (A/B/C)
pnpm run ops:auth:persistence:matrix

# Check latest persistence report
pnpm run ops:gate:status

# Analyze matrix results
tsx scripts/ops/analyze-auth-persistence-root-cause.ts

# Run single variant manually
PROOF_DURATION_MINUTES=60 TICK_SECONDS=60 HUMAN_JITTER=false pnpm run executor:prove:auth-b64-persistence
PROOF_DURATION_MINUTES=60 TICK_SECONDS=180 HUMAN_JITTER=true pnpm run executor:prove:auth-b64-persistence
PROOF_DURATION_MINUTES=60 TICK_SECONDS=300 HUMAN_JITTER=true pnpm run executor:prove:auth-b64-persistence
```

## Notes

- All forensics snapshots are safe (no cookie values, no secrets)
- Screenshots captured on first failure occurrence
- Reports include forensics comparison (minute 0 vs failure minute)
- Matrix stops on first PASS to save time
