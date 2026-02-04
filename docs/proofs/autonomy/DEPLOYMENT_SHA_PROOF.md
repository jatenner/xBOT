# Production Deployment Source & Runtime SHA Proof

**Date:** 2026-02-04  
**Time:** 15:15 UTC

## Step 1: Repo Root State

**Working Directory:** `/Users/jonahtenner/Desktop/xBOT` ✅  
**Local HEAD SHA:** `cf0e6ce5`  
**Git Status:** Modified files present (unstaged changes from stash pop)  
**Railway Status:** Connected to project XBOT, service xBOT, environment production ✅  
**Railway Link:** Failed (non-TTY, but status confirms connection)

## Step 2: Runtime SHA Environment Variables

**Inside xBOT Container:**
```json
{
  "RAILWAY_GIT_COMMIT_SHA": "fdf00f1e32b67fa399f668d836c0a737e73bc62a",
  "APP_COMMIT_SHA": "cd408377554b0dbbf25d75357e199cdc0f04b736",
  "DEPLOY_SHA": "687f33059cf4670e56c3deeee7fd37bce07d20f7",
  "GIT_SHA": "687f33059cf4670e56c3deeee7fd37bce07d20f7"
}
```

**Analysis:**
- All SHA env vars show **OLD commits** (not `cf0e6ce5` or `158e945a`)
- `RAILWAY_GIT_COMMIT_SHA`: `fdf00f1e` (very old)
- `DEPLOY_SHA`/`GIT_SHA`: `687f3305` (old)
- `APP_COMMIT_SHA`: `cd408377` (old)

## Step 3: Code Content Verification

**File Check:** `src/jobs/jobManager.ts`
- **Exists:** ✅ `true`
- **Contains `JOB_MANAGER_BOOT`:** ✅ `true`
- **Contains `executeHourlyTick`:** ✅ `true`

**Analysis:**
- Code file **DOES contain** the new logging fixes
- This suggests code was deployed, but SHA env vars are stale
- OR code was manually injected/patched

## Step 4: Redeploy Attempt

**Action:** Triggered `railway up --service xBOT --detach`  
**Result:** Deployment initiated  
**Re-check After 2 Minutes:**
- Code still contains `JOB_MANAGER_BOOT`: ✅ `true`
- Code still contains `executeHourlyTick`: ✅ `true`
- SHA env vars unchanged (still old commits)

## Step 5: Log Analysis

**Search Pattern:** `JOB_MANAGER_BOOT|HOURLY_TICK_START|HOURLY_TICK_DONE|hourly_tick|scheduleStaggeredJob|executeHourlyTick`

**Result:** **NO MATCHES FOUND**

**Analysis:**
- Despite code containing `JOB_MANAGER_BOOT`, no log lines appear
- No hourly tick execution logs found
- No scheduling logs found

## Step 6: Production Execution Verification

**Results:**
- `rate_controller_state` rows: **0** (no updates)
- `SAFE_GOTO_ATTEMPT` events: **0** (no navigation)
- Posted replies (last 3h): **0**
- Skip reasons: **0**
- Infra blocks: **0**

## Final Verdict

### RUNNING NEW CODE: **PARTIAL - CODE PRESENT BUT NOT EXECUTING**

**Evidence:**

1. ✅ **Code File Contains Fixes:**
   - `JOB_MANAGER_BOOT` present in `src/jobs/jobManager.ts`
   - `executeHourlyTick` present in code

2. ❌ **SHA Env Vars Show Old Commits:**
   - `RAILWAY_GIT_COMMIT_SHA`: `fdf00f1e` (not `cf0e6ce5`)
   - All SHA env vars point to old commits

3. ❌ **No Execution Logs:**
   - No `[JOB_MANAGER_BOOT]` log lines in production
   - No `HOURLY_TICK_START` / `HOURLY_TICK_DONE` logs
   - No hourly tick scheduling logs

4. ❌ **No Execution Activity:**
   - `rate_controller_state` table empty
   - No `SAFE_GOTO` events
   - No posted replies

**Conclusion:**

The new code **exists in the container filesystem** but is **NOT being executed**. Possible reasons:

1. **Service Not Restarted:** Code deployed but process not restarted with new code
2. **Cached Build:** Railway using cached build artifacts
3. **Wrong Entrypoint:** Service running old code from different path
4. **Job Manager Not Starting:** `startJobs()` not being called, so new logs never appear

**Critical Issue:** Even though the code file contains the fixes, the job manager is not executing (or not logging), preventing hourly tick from running.

**Next Steps:**
1. Force service restart (not just redeploy)
2. Verify job manager is actually calling `startJobs()`
3. Check if there are startup errors preventing job manager initialization
4. Verify Railway is using the correct entrypoint/start command
