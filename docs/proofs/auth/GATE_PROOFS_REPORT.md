# Gate Proofs Report

**Date:** ${new Date().toISOString()}
**Sequence:** Two-Gate Proof (Cookie Auth)

## Status

**Gate 1:** ⏳ **RUNNING** (60-minute persistence proof in progress)
**Gate 2:** ⏸️ **PENDING** (waits for Gate 1)

## Gate 1: 60-Minute B64 Auth Persistence Proof

**Command:**
```bash
PROOF_DURATION_MINUTES=60 pnpm run executor:prove:auth-b64-persistence
```

**Status:** Currently running (started ~11:18 PM)
**Expected Completion:** ~12:18 AM (60 minutes from start)

**What PASS means:**
- ✅ Auth persisted for full 60 minutes
- ✅ No login redirects detected
- ✅ No challenge URLs detected  
- ✅ Logged-in state verified every 60 seconds
- ✅ Report: `docs/proofs/auth/b64-auth-persistence-<ts>.md`

**What FAIL means:**
- ❌ Login redirect detected → cookies expired/invalid
- ❌ Challenge detected → X.com verification required
- ❌ Consent wall → check report for details
- **Classification:** Check report for failure fingerprint
- **Screenshots:** `docs/proofs/auth/b64-auth-persistence-fail-<reason>-<ts>.png`
- **Report Path:** `docs/proofs/auth/b64-auth-persistence-<ts>.md`

**If FAIL:** Stop here. Review report, check screenshots, refresh cookies if needed.

## Gate 2: System Bring-Up with Execution Proof

**Command:** (Only runs if Gate 1 PASSES)
```bash
COOKIE_AUTH_MODE=true REQUIRE_EXECUTION_PROOF=true SOAK_MINUTES=20 pnpm run ops:up:fast
```

**What PASS means:**
- ✅ All preflight checks passed
- ✅ B64 auth readwrite proof passed
- ✅ B64 auth persistence proof passed (20 minutes)
- ✅ Execution proof passed (real reply posted)
- ✅ **Reply URL:** Available in execution ledger
- ✅ Output: `OPS_UP_FAST=PASS minutes_ok=<n>`

**What FAIL means:**
- ❌ Preflight failed → check OpenAI key sync
- ❌ Auth readwrite failed → cookies invalid
- ❌ Auth persistence failed → cookies expired during soak
- ❌ Execution proof failed → check execution ledger

**Execution Ledger Entry:**
- Location: `docs/proofs/execution/execution-ledger.jsonl`
- Fields: `ts`, `proof_type`, `target_tweet_id`, `decision_id`, `passed`, `failure_classification`, `reply_url`, `time_to_success_seconds`, `report_path`

## Quick Command

**Run both gates sequentially:**
```bash
pnpm run ops:gate:proofs
```

**Check status:**
```bash
pnpm run ops:gate:status
```

## Monitoring

While Gate 1 is running:
1. Check process: `ps aux | grep prove-auth-b64-persistence`
2. Check status: `pnpm run ops:gate:status`
3. Wait for completion (~60 minutes)
4. Check report when complete: `ls -lt docs/proofs/auth/b64-auth-persistence-*.md | head -1`

## Artifacts

**Gate 1 Artifacts:**
- Report: `docs/proofs/auth/b64-auth-persistence-<ts>.md`
- Screenshots (if fail): `docs/proofs/auth/b64-auth-persistence-fail-<reason>-<ts>.png`

**Gate 2 Artifacts:**
- Execution Ledger: `docs/proofs/execution/execution-ledger.jsonl`
- Execution Report: Path in ledger entry
- Reply URL: In ledger entry if successful

## Next Update

Check back after Gate 1 completes (~60 minutes) for final PASS/FAIL verdict and Gate 2 results.
