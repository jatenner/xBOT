# Hourly Tick Execution Diagnosis

**Date:** 2026-02-04  
**SHA:** 1e7b0d6903023365039bde35f138078e8d8a8870  
**Status:** IN PROGRESS

## Problem Statement

Hourly tick (`executeHourlyTick`) is not executing in production. No evidence of:
- `rate_controller_state` table updates
- `HOURLY_TICK_START` / `HOURLY_TICK_DONE` logs
- Reply execution via hourly tick path

## Changes Made

### 1. Boot SHA Logging (`src/jobs/jobManager.ts`)
- Added `[JOB_MANAGER_BOOT]` log line with runtime SHA (first 8 chars)
- Checks multiple env var sources: `APP_COMMIT_SHA`, `DEPLOY_SHA`, `GIT_SHA`, `RAILWAY_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_SHA`

### 2. Explicit Scheduling Logs (`src/jobs/jobManager.ts`)
- Added log before checking `flags.postingEnabled`: `[JOB_MANAGER] 🔍 Checking postingEnabled flag`
- Added log before scheduling: `[JOB_MANAGER] 📅 Scheduling hourly_tick job`
- Added log after scheduling: `[JOB_MANAGER] ✅ hourly_tick job scheduled successfully`
- Added warning if posting disabled: `[JOB_MANAGER] ⚠️ Posting disabled - hourly_tick will NOT be scheduled`
- Added log in `scheduleStaggeredJob` for hourly_tick: `[SCHEDULE_STAGGERED_JOB] 📅 hourly_tick registered`

### 3. Execution Entry/Exit Logs (`src/rateController/hourlyTick.ts`)
- Changed `[HOURLY_TICK] 🕐 Starting hourly tick...` to `[HOURLY_TICK_START] 🕐 Starting hourly tick execution...`
- Added `[HOURLY_TICK_DONE] ✅ Hourly tick complete (duration: Xs, executed: replies=X, posts=Y)`

## Current Production State

### Railway Configuration
- `MODE=live` ✅
- `JOBS_AUTOSTART=true` ✅
- `EXECUTION_MODE=control` ✅
- `DISABLE_POSTING` not set (defaults to enabled) ✅

### Deployment Status
- **GitHub Push:** BLOCKED (secret scanning - `.env.control` contains OpenAI key in history)
- **Railway Deploy:** `railway up --service xBOT --detach` completed, but new code may not be live
- **SHA Verification:** Pending (no `[JOB_MANAGER_BOOT]` logs found in production)

### Evidence from Production
- No `[JOB_MANAGER_BOOT]` logs → suggests old code still running
- No `[SCHEDULE_STAGGERED_JOB]` logs for hourly_tick → suggests scheduling not happening
- No `[HOURLY_TICK_START]` logs → confirms execution not happening
- `rate_controller_state` table: **0 rows** (no updates)
- `SAFE_GOTO_ATTEMPT` events: **0** (no navigation)
- Posted replies (last 3h): **0**

### Other Jobs Running
- `JOB_MEGA_VIRAL_HARVESTER` ✅
- `JOB_POSTING` ✅
- `JOB_REPLY_V2_FETCH` ✅
- `JOB_DB_RETRY_QUEUE` ✅

This suggests:
- Job manager IS running
- Other jobs ARE scheduled
- Hourly tick specifically is NOT scheduled or NOT executing

## Root Cause Hypothesis

**Most Likely:** New code not deployed due to GitHub push blocker. Railway may be deploying from GitHub (not local CLI), so `railway up` may not have applied the fix.

**Alternative:** `flags.postingEnabled` is false despite `MODE=live`, or `startStaggeredJobs` is not being called for hourly tick.

## Next Steps

1. **Resolve GitHub Push Blocker**
   - Rotate OpenAI API key
   - Remove `.env.control` from git history using `git filter-repo`
   - Force push cleaned history
   - Verify Railway redeploys from GitHub

2. **Verify Deployment**
   - Check Railway logs for `[JOB_MANAGER_BOOT]` with SHA `1e7b0d69`
   - Check for `[SCHEDULE_STAGGERED_JOB]` logs
   - Check for `[HOURLY_TICK_START]` logs

3. **If Still Not Executing**
   - Check logs for `flags.postingEnabled` value
   - Check if `startStaggeredJobs` is called
   - Check if `scheduleStaggeredJob('hourly_tick', ...)` is invoked
   - Check if initial timer fires (should fire immediately with delay=0)

## Files Changed

- `src/jobs/jobManager.ts` (lines 163-164, 263, 280, 294, 315-317, 1379-1390)
- `src/rateController/hourlyTick.ts` (lines 28-29, 160)

## Commands Run

```bash
git add src/jobs/jobManager.ts src/rateController/hourlyTick.ts
git commit -m "fix: Add boot SHA logging and explicit hourly tick scheduling logs"
git rev-parse HEAD  # 1e7b0d6903023365039bde35f138078e8d8a8870
railway up --service xBOT --detach
```

## Verification Commands

```bash
# Check for boot logs
railway logs --service xBOT -n 2000 | grep -E "JOB_MANAGER_BOOT|SCHEDULE_STAGGERED_JOB.*hourly|HOURLY_TICK_START|HOURLY_TICK_DONE|SHA:"

# Check rate controller state
railway run --service xBOT pnpm exec tsx scripts/ops/verify-production-execution.ts

# Check DB directly
railway run --service xBOT pnpm exec tsx -e "import('dotenv/config').then(async()=>{const{Client}=await import('pg');const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();const r=await c.query('select * from rate_controller_state order by updated_at desc limit 3');console.log(JSON.stringify(r.rows,null,2));await c.end();});"
```
