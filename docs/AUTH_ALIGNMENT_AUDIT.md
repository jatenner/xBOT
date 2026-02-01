# Auth Alignment Audit

**Date:** 2026-02-01  
**Status:** ✅ Complete

## Executive Summary

This audit ensures all xBOT systems use the correct authentication source:
- **Railway (control-plane):** Uses `TWITTER_SESSION_B64` environment variable
- **Executor (Mac Runner):** Uses ONLY local Chrome profile (must NOT use `TWITTER_SESSION_B64`)

## Auth Sources Inventory

### Table: File → Auth Source → Expected Behavior

| File | Reads | Expects | Mode | Notes |
|------|-------|---------|------|-------|
| `src/utils/sessionLoader.ts` | `TWITTER_SESSION_B64` env → `twitter_session.json` file | Railway: env var<br>Executor: file (fallback) | Both | **ISSUE:** Should refuse env var in executor mode |
| `src/utils/twitterSessionState.ts` | `SessionLoader.load()` → `TWITTER_SESSION_B64` env | Railway: env var | Control | ✅ Correct |
| `src/browser/UnifiedBrowserPool.ts` | `loadTwitterStorageState()` | Railway: env var | Control | ✅ Correct |
| `scripts/executor/daemon.ts` | `TWITTER_SESSION_B64` env → applies to browser | **WRONG:** Should use local Chrome profile only | Executor | **CRITICAL:** Must be fixed |
| `scripts/harvester/daemon.ts` | `TWITTER_SESSION_B64` env | Railway: env var | Control | ✅ Correct |
| `src/jobs/replyOpportunityHarvester.ts` | Via `UnifiedBrowserPool` | Railway: env var | Control | ✅ Correct |
| `scripts/ops/push-twitter-session-to-railway.ts` | `twitter_session.json` file | Reads file, pushes to Railway | N/A | ✅ Correct |

## Railway Services

### Service: `serene-cat`
- **Role:** Worker (harvesting, scheduling)
- **EXECUTION_MODE:** `control`
- **Auth Source:** `TWITTER_SESSION_B64` (required)
- **Jobs:** Harvesting, Reply V2 Scheduler
- **Browser Usage:** Yes (harvesting, planning)

### Service: `xBOT`
- **Role:** Main (planning, monitoring)
- **EXECUTION_MODE:** `control`
- **Auth Source:** `TWITTER_SESSION_B64` (required)
- **Jobs:** Reply V2 Planner
- **Browser Usage:** Yes (planning)

## Executor (Mac Runner)

### Current State (WRONG)
- **EXECUTION_MODE:** `executor`
- **RUNNER_MODE:** `true`
- **Auth Source:** `TWITTER_SESSION_B64` ❌ **WRONG**
- **Expected:** Local Chrome profile only

### Required State
- **EXECUTION_MODE:** `executor`
- **RUNNER_MODE:** `true`
- **Auth Source:** Local Chrome profile (`RUNNER_PROFILE_DIR/.chrome-cdp-profile` or persistent context)
- **Must NOT use:** `TWITTER_SESSION_B64`

## Guardrails Added

### 1. Control-Plane Guardrail
**Location:** `src/utils/sessionLoader.ts`

**Behavior:**
- If `EXECUTION_MODE=control` (Railway): Requires `TWITTER_SESSION_B64`
- Fails fast if missing: throws error with clear message
- Logs: `AUTH_SOURCE=railway_cookie_blob`

### 2. Executor Guardrail
**Location:** `scripts/executor/daemon.ts`

**Behavior:**
- If `EXECUTION_MODE=executor` AND `RUNNER_MODE=true`: Refuses to read `TWITTER_SESSION_B64`
- Uses ONLY local Chrome profile (`launchPersistentContext` with `RUNNER_PROFILE_DIR`)
- Fails fast if `TWITTER_SESSION_B64` is set: throws error with clear message
- Logs: `AUTH_SOURCE=local_chrome_profile`

### 3. Startup Logging
**Location:** Both `src/railwayEntrypoint.ts` and `scripts/executor/daemon.ts`

**Format:**
```
[AUTH_SOURCE] mode=<control|executor> source=<railway_cookie_blob|local_chrome_profile>
```

## Canonical Auth Flow

### Step 1: Refresh Session (Executor)
```bash
# On Mac Runner
pnpm tsx scripts/refresh-x-session.ts
```
- Reads from local Chrome profile
- Saves to `./twitter_session.json`

### Step 2: Push to Railway
```bash
RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json \
  pnpm tsx scripts/ops/push-twitter-session-to-railway.ts
```
- Reads `twitter_session.json`
- Base64 encodes
- Sets `TWITTER_SESSION_B64` on Railway service

### Step 3: Verify
```bash
railway run --service serene-cat pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts | grep "\[HARVESTER_AUTH\]"
```
- Expected: `[HARVESTER_AUTH] logged_in=true handle=@SignalAndSynapse url=https://x.com/home reason=ok`

## Validation Commands

### 1. Check Railway Variables
```bash
railway variables --service serene-cat | grep TWITTER_SESSION_B64
railway variables --service xBOT | grep TWITTER_SESSION_B64
```
**Expected:** Both services have `TWITTER_SESSION_B64` set

### 2. Verify Railway Auth
```bash
railway run --service serene-cat pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts | grep "\[HARVESTER_AUTH\]"
```
**Expected:** `[HARVESTER_AUTH] logged_in=true`

### 3. Verify Executor Auth Source
```bash
# Check executor logs
tail -50 ./.runner-profile/logs/executor.log | grep "AUTH_SOURCE"
```
**Expected:** `AUTH_SOURCE=local_chrome_profile`

### 4. Verify Executor Refuses TWITTER_SESSION_B64
```bash
# Set TWITTER_SESSION_B64 (should fail)
TWITTER_SESSION_B64=test EXECUTION_MODE=executor RUNNER_MODE=true \
  pnpm run executor:start
```
**Expected:** Error message refusing `TWITTER_SESSION_B64` in executor mode

## Issues Found

### Critical Issue #1: Executor Uses TWITTER_SESSION_B64
**File:** `scripts/executor/daemon.ts`  
**Line:** ~378-450  
**Problem:** Executor daemon loads `TWITTER_SESSION_B64` and applies cookies to browser context  
**Fix:** Remove `loadTwitterSessionFromEnv()` call, use only persistent Chrome profile

### Issue #2: SessionLoader Doesn't Check Mode
**File:** `src/utils/sessionLoader.ts`  
**Line:** ~28-65  
**Problem:** Loads from env var regardless of execution mode  
**Fix:** Add mode check - refuse env var in executor mode, require it in control mode

## Changes Made

1. ✅ Added `getExecutionMode()` and `isExecutor()` helpers
2. ✅ Added control-plane guardrail (requires `TWITTER_SESSION_B64`)
3. ✅ Added executor guardrail (refuses `TWITTER_SESSION_B64`)
4. ✅ Added `AUTH_SOURCE` logging at startup
5. ✅ Updated `OPS_AUTH.md` with canonical flow

## Testing Checklist

- [ ] Railway `serene-cat` has `TWITTER_SESSION_B64` set
- [ ] Railway `xBOT` has `TWITTER_SESSION_B64` set
- [ ] Railway harvester shows `[HARVESTER_AUTH] logged_in=true`
- [ ] Executor logs show `AUTH_SOURCE=local_chrome_profile`
- [ ] Executor refuses `TWITTER_SESSION_B64` (throws error)
- [ ] Executor uses local Chrome profile successfully
- [ ] Session push workflow works end-to-end
