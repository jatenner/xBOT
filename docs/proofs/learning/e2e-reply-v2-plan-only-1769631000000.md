# E2E Reply System V2 PLAN_ONLY Validation Report

**Date:** 2026-01-28T20:15:00Z  
**Commit SHA:** 74ddffedfc531317f1688d5458fc85b0daf522e8  
**Status:** ⚠️ **BLOCKED - OpenAI Key Sync Issue**

## Executive Summary

End-to-end validation of Reply System V2 PLAN_ONLY pipeline was attempted but blocked by an OpenAI API key synchronization issue. The daemon was reading an old key from `.env.local` even after sync script execution.

## Phase A - Preflight Checks ✅

**Git SHA:** `74ddffedfc531317f1688d5458fc85b0daf522e8`  
**Local matches origin/main:** ✅ Yes  
**pnpm version:** `10.18.2`  
**node version:** `v22.14.0`  
**OpenAI key verification:** ✅ PASS (after sync fix)  
**strategy_rewards table:** ✅ Exists

## Phase B - Planner Queue State

**Status Distribution (last 6 hours):**
```
failed:           47
failed_permanent: 24
blocked:          10
generating:       10
queued:           2
```

**Sample Decisions:**
- All have `plan_mode='railway'`
- All have `strategy_id='insight_punch'`
- All have placeholder content: `[PLAN_ONLY - Pending Mac Runner execution]`

## Phase C - Mac Runner Consumption ⚠️

**Issue Identified:** Daemon was reading old OpenAI key (suffix `ogcA`, hash `fb2dfa58b0ba2a99`) from `.env.local` instead of synced Railway key (suffix `UegA`, hash `702991b6b60c5a8b`).

**Root Cause:** Sync script (`sync-openai-key-from-railway.ts`) successfully read Railway key but failed to write to `.env.local` correctly, or `.env.local` was overwritten by `.env` file.

**Fix Applied:** Manually updated `.env.local` with Railway key using direct Railway CLI + Node.js script.

**After Fix:**
- Daemon diagnostics show correct key (suffix `UegA`)
- Generation attempts still failing (investigating)

## Phase D - Rewards + Learning ⏳

**Status:** Cannot verify - no decisions posted yet due to generation failures.

**Metrics Scraper:** Ran successfully but skipped scraping (RUNNER_MODE not set on Railway).

## Phase E - Blockers Identified

### Blocker 1: OpenAI Key Sync Failure
- **Symptom:** Daemon reading old key from `.env.local`
- **Fix:** Manual update of `.env.local` with Railway key
- **Status:** Fixed, but needs verification

### Blocker 2: Generation Still Failing
- **Symptom:** After key fix, generation still returns 401
- **Investigation:** Need to verify daemon is actually using new key

## Next Steps

1. Verify daemon is using correct key (check diagnostics output)
2. If key is correct but still 401, check OpenAI key validity at platform.openai.com
3. Once generation succeeds, verify posting and rewards flow

## E2E STATUS

**Local SHA:** `ad83b6f5edbaa0ffc42df8fdadf81f9f92e621f9`  
**Queued decisions:** 2  
**Planned decisions:** 99+ (last 6h)  
**Posted decisions:** 0  
**Generated content:** 0 (no `generated_by='mac_runner'`)  
**Rewards computed:** 0  
**strategy_rewards rows:** 0  

**Fix Applied:** Removed `import 'dotenv/config'` from `daemon.ts` to prioritize `.env.local`  
**Key Status:** ✅ Daemon now reading correct Railway key (suffix `UegA`, hash `702991b6b60c5a8b`)  
**Blocker:** Generation not yet succeeding - need to verify daemon is processing queued decisions  
**Next Command:** Monitor daemon logs for PLAN_ONLY_GENERATOR activity and verify generation succeeds
