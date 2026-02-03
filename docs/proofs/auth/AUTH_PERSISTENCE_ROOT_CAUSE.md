# Auth Persistence Root Cause Analysis

**Generated:** 2026-02-03T05:35:00.000Z

## Matrix Results

| Variant | Tick Seconds | Jitter | Duration | Pass | First Failure Minute | Reason |
|---------|--------------|--------|----------|------|---------------------|--------|
| A | 60 | No | 60 min | ⏳ | PENDING | RUNNING |

**Status:** Matrix testing in progress. Variant A (60s baseline) is currently running.

## Current Observations

Based on initial forensics instrumentation tests:

### Forensics Snapshot Analysis (from test runs)

**Minute 0 (Baseline):**
- Cookies (.x.com): 18
- Cookies (.twitter.com): 18
- auth_token: ✅ present (expiry: session/-1)
- ct0: ✅ present (expiry: session/-1)
- twid: ✅ present
- cf_clearance: ✅ present
- localStorage: 1 key
- sessionStorage: 0 keys
- IndexedDB: none (1 DB detected)

**Failure Pattern:**
- Cookies remain present throughout failure
- auth_token and ct0 do NOT disappear
- URL remains `https://x.com/home` (not redirect)
- Detection fails with reason "unknown" (logged-in check returns false)

### Interpretation

Current test runs show **immediate failure** (minute 0), suggesting:
1. Cookies may be expired/invalid from start
2. OR logged-in detection logic needs improvement
3. OR cookies present but X.com requires additional signals (storageState, IndexedDB, etc.)

**Note:** User reports indicate failures around ~29 minutes in successful runs, suggesting cookies may be valid initially but expire/rotate after ~29 minutes.

## Next Steps

1. **Complete Matrix Run:**
   ```bash
   pnpm run ops:auth:persistence:matrix
   ```
   This will run all 3 variants (A: 60s, B: 180s+jitter, C: 300s+jitter) and populate matrix results.

2. **After Matrix Completes:**
   ```bash
   tsx scripts/ops/analyze-auth-persistence-root-cause.ts
   ```
   This will generate the final determination and smallest fix recommendation.

3. **Check Status:**
   ```bash
   pnpm run ops:gate:status
   ```
   Shows latest persistence report and failure details.

## Expected Determinations

Based on matrix results, one of:

1. **EXPIRY/ROTATION:** Cookies expire/rotate → implement refresh strategy or migrate to storageState
2. **REVOCATION_BY_PATTERN:** Pattern detection → adjust cadence/jitter, stop aggressive polling
3. **COOKIE_ONLY_INSUFFICIENT:** Cookies present but auth fails → migrate to storageState/persistent profile

## Artifacts

- Reports: `docs/proofs/auth/b64-auth-persistence-<ts>.md`
- Forensics: `docs/proofs/auth/b64-auth-flip-snapshot-<reason>-<ts>.json`
- Screenshots: `docs/proofs/auth/b64-auth-persistence-fail-<reason>-<ts>.png`
- Matrix results: `docs/proofs/auth/auth-persistence-matrix.jsonl`
