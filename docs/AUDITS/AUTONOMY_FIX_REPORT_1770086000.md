# Autonomy Fix Report

**Generated:** 2026-02-03T02:33:20.000Z
**Timestamp:** 1770086000

## Audit Snapshot

### Top Blocker: AUTH_PERSISTENCE_FAILED

**Evidence:**
- AUTH_OK marker missing: `.runner-profile/AUTH_OK.json` does not exist
- Last auth persistence result: `no_report` (no persistence proof has been run)
- Auth events classification (last 20):
  - `EXECUTOR_AUTH_REQUIRED`: 1
  - `EXECUTOR_AUTH_INVALID`: 14
  - `EXECUTOR_AUTH_VERIFIED`: 5
- Auth-readwrite proof: FAILED (redirected to login flow)
- Browser profile exists with cookies, but session appears invalid

**Readiness Score Breakdown:**
- ✅ Control-plane ticks present: YES
- ❌ Auth persistence >= 60 min OR last 3 runs PASS: NO
- ❌ Execution success rate >= 70%: NO (0.0%)
- ✅ Outcomes collected in last 24h: YES (2 outcomes)

**Final Status:** `AUTONOMY_READY=NO reason=AUTH_PERSISTENCE_FAILED`

### Next 2 Blockers (Not Fixed)

1. **EXECUTION_SUCCESS_RATE_LOW**
   - Last 20 runs: 0
   - Success rate: 0.0%
   - No execution ledger entries found
   - Evidence: `docs/proofs/execution/execution-ledger.jsonl` empty or missing

2. **SUPPLY_HEALTH_ISSUE** (potential)
   - Reply opportunities total: 0
   - Passed hard filters: 0
   - Can self-supply: NO
   - Note: This is not currently blocking readiness score, but would block execution

---

## Fix Applied

### Bug Fix: `prove-auth-readwrite.ts` missing `paths` variable

**File Changed:** `scripts/executor/prove-auth-readwrite.ts`

**Change:**
- Added import for `getRunnerPaths` from `runnerProfile`
- Added `const paths = getRunnerPaths();` at start of `main()` function
- Fixed reference to `paths.runner_profile_dir_raw` on line 99

**Why:** Script was failing with `ReferenceError: paths is not defined`, preventing auth-readwrite proof from running.

**Commit:** Fixed in this session

---

## Proof Outputs

### Step 1: Auth Status Check
```bash
$ pnpm run ops:auth:status --one-line
AUTH=DOWN reason=AUTH_OK_marker_missing last_url=N/A next=pnpm run ops:recover:x-auth
```
**Result:** FAIL - AUTH_OK marker missing

### Step 2: Auth-Readwrite Proof
```bash
$ pnpm run executor:prove:auth-readwrite
[EXECUTOR_PROVE] ❌ FAIL: Redirected to login flow
[EXECUTOR_PROVE] ❌ EXECUTOR_AUTH_REQUIRED: Login required
```
**Result:** FAIL - Session invalid, redirected to login

### Step 3: Auth Persistence Proof
**Not Run** - Blocked by missing AUTH_OK marker and invalid session

### Step 4: ops:up:fast
**Not Run** - Blocked by auth failure

---

## Artifacts Created

1. **Audit Report:** `docs/AUDITS/AUTONOMY_AUDIT_LATEST.md`
   - Generated: 2026-02-03T02:32:40.655Z
   - Audit ID: 1770085967645

2. **This Fix Report:** `docs/AUDITS/AUTONOMY_FIX_REPORT_1770086000.md`

3. **Code Fix:** `scripts/executor/prove-auth-readwrite.ts`
   - Fixed missing `paths` variable definition

---

## Failure Classification

**Primary Failure:** `AUTH_SESSION_INVALID`
- **Reason:** Browser session cookies exist but are invalid/expired
- **Evidence:** Redirected to `/i/flow/login` when accessing `https://x.com/home`
- **Root Cause:** Session likely expired or revoked by X.com
- **Classification:** `login_redirect` (from auth failure classification system)

**Secondary Failure:** `AUTH_OK_MARKER_MISSING`
- **Reason:** No AUTH_OK.json marker file exists
- **Evidence:** File does not exist at `.runner-profile/AUTH_OK.json`
- **Root Cause:** Auth recovery workflow (`executor:auth`) has not been run successfully

---

## Next Action

**Single Command to Run:**
```bash
pnpm run ops:recover:x-auth
```

**Expected Flow:**
1. Stops executor daemon
2. Runs `executor:auth` (headed browser, requires operator to complete login manually)
3. Verifies auth-readwrite proof passes
4. Runs 10-minute auth persistence smoke test
5. Creates AUTH_OK.json marker

**After Recovery:**
1. Run: `PROOF_DURATION_MINUTES=30 pnpm run executor:prove:auth-persistence`
2. Run: `REQUIRE_EXECUTION_PROOF=true pnpm run ops:up:fast`
3. Re-run: `pnpm run ops:audit:autonomy`

---

## Summary

**Status:** ❌ FAIL

**Top Blocker:** AUTH_PERSISTENCE_FAILED
- Auth session is invalid (redirected to login)
- AUTH_OK marker missing
- No persistence proof exists

**Fix Applied:** Fixed bug in `prove-auth-readwrite.ts` (missing `paths` variable)

**Next Step:** Run `pnpm run ops:recover:x-auth` to establish valid auth session (requires operator interaction)

**Artifacts:**
- `docs/AUDITS/AUTONOMY_AUDIT_LATEST.md`
- `docs/AUDITS/AUTONOMY_FIX_REPORT_1770086000.md`
- Fixed: `scripts/executor/prove-auth-readwrite.ts`
