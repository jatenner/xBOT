# Auth Flip Observation - Latest

**Generated:** 2026-02-03T05:30:00.000Z

## Observed Failure

### Latest Run Analysis

**Report:** `docs/proofs/auth/b64-auth-persistence-1770095934123.md`
**Screenshot:** `docs/proofs/auth/b64-auth-persistence-fail-login_redirect-1770092337527.png`

### Failure Summary

- **First Failure Minute:** 0 (immediate failure)
- **Failure Reason:** `login_redirect`
- **Final URL Pattern:** `https://x.com/i/flow/login?redirect_after_login=%2Fhome`
- **Failure Rate:** 100% (58/58 ticks failed)
- **Duration:** 60 minutes attempted

### Pattern Analysis

**All ticks (0-59 minutes) showed:**
- ❌ `logged_in: false`
- ❌ `reason: login_redirect`
- ❌ URL: `https://x.com/i/flow/login?redirect_after_login=%2Fhome`

### Interpretation

This run shows **immediate failure** - cookies were invalid from the start. However, user reports indicate:
- "7/7 tests pass" briefly (likely readwrite proof)
- Failures occur around ~29 minutes in successful runs

**Hypothesis:** 
- Cookies may be valid initially but expire/rotate after ~29 minutes
- OR cookies are being invalidated by X.com due to detection patterns (too frequent navigation, automation signals)

### Next Steps

1. Add forensics instrumentation to capture:
   - Cookie presence/expiry at each tick
   - Storage state (localStorage, sessionStorage, IndexedDB)
   - Navigation timing and patterns
   - Redirect chain analysis

2. Run controlled matrix with different tick intervals:
   - Baseline: 60s ticks
   - Human-ish: 180s ticks with jitter
   - More human: 300s ticks with jitter

3. Compare forensics at minute 0 vs failure minute to identify root cause
