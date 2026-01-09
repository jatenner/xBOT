# Railway Debugging Guide - January 9, 2026

## 🔍 PROOF COLLECTION STEPS

### Step 1: Check Railway Logs After Deployment

After Railway redeploys (wait 2-3 minutes), check Railway Dashboard → Logs tab.

**Look for these log lines**:

#### Good (Jobs Starting):
```
[BOOT] jobs_start attempt
[BOOT] JOBS_AUTOSTART env var: "true" (type: string)
[BOOT] JOBS_AUTOSTART === 'true': true
[BOOT] JOB_MANAGER starting...
🕒 JOB_MANAGER: startJobs() called
🕒 JOB_MANAGER: process.env.JOBS_AUTOSTART = "true"
🕒 JOB_MANAGER: process.env.JOBS_AUTOSTART === 'true' = true
🕒 JOB_MANAGER: config.JOBS_AUTOSTART = true
🕒 JOB_MANAGER: modeFlags.enableJobScheduling = true
🕒 JOB_MANAGER: Job scheduling ENABLED - proceeding to start jobs...
🕒 JOB_MANAGER: Starting job timers...
[BOOT] jobs_started ok
```

#### Bad (Jobs Not Starting - Variable Issue):
```
[BOOT] JOBS_AUTOSTART env var: "undefined" (type: undefined)
[BOOT] JOBS_AUTOSTART === 'true': false
🕒 JOB_MANAGER: process.env.JOBS_AUTOSTART = "undefined"
🕒 JOB_MANAGER: Job scheduling disabled (JOBS_AUTOSTART=false)
🕒 JOB_MANAGER: This means jobs will NOT run. Check Railway Variables: JOBS_AUTOSTART must be exactly "true"
```

#### Bad (Jobs Not Starting - Wrong Value):
```
[BOOT] JOBS_AUTOSTART env var: "True" (type: string)
[BOOT] JOBS_AUTOSTART === 'true': false
🕒 JOB_MANAGER: process.env.JOBS_AUTOSTART = "True"
🕒 JOB_MANAGER: Job scheduling disabled (JOBS_AUTOSTART=false)
```
→ Value must be lowercase `true`, not `True` or `TRUE`

### Step 2: Verify Entrypoint

**Confirmed**: Railway runs `npm start` which executes `tsx src/railwayEntrypoint.ts`

**Confirmed**: `railwayEntrypoint.ts` calls `jobManager.startJobs()` at line 289

**File**: `src/railwayEntrypoint.ts:289`

### Step 3: Run DB Proof Verification

After Railway redeploys and logs show jobs starting, wait 5-10 minutes, then run:

```bash
pnpm tsx scripts/verify_production_proof.ts
```

**Expected Results**:
- ✅ `reply_v2_fetch_job_started` events >= 1 in last 10 minutes
- ✅ `reply_slo_events` >= 1 in last 30 minutes (scheduler runs every 15 min)

### Step 4: If Jobs Still Not Starting

**Option A: Create Dedicated Worker Service**

1. Railway Dashboard → XBOT Project → Settings → Services
2. Click **"+ New Service"**
3. Select **"GitHub Repo"** → Select xBOT repo
4. In service settings:
   - **Start Command**: `tsx src/jobs/jobManagerWorker.ts`
   - **Environment**: Same as main service (copy all variables)
5. Deploy

**Option B: Fix Main Service**

If logs show `JOBS_AUTOSTART` is `undefined` or wrong value:
1. Railway Dashboard → Variables tab
2. Find `JOBS_AUTOSTART`
3. Ensure value is exactly `true` (lowercase, no quotes)
4. Save and wait for redeploy

---

## 📊 VERIFICATION CHECKLIST

After fixes, verify:

- [ ] Railway logs show `JOBS_AUTOSTART env var: "true"`
- [ ] Railway logs show `🕒 JOB_MANAGER: Job scheduling ENABLED`
- [ ] DB shows `reply_v2_fetch_job_started` events every 5 minutes
- [ ] DB shows `reply_slo_events` every 15 minutes
- [ ] `llm_usage_log` shows `target_judge` calls
- [ ] `candidate_evaluations` shows `ai_judge_decision` populated

---

## 🎯 ROOT CAUSE CHECKLIST

If jobs not starting, check in order:

1. **Variable Missing**: Railway Variables tab → `JOBS_AUTOSTART` doesn't exist
   - **Fix**: Add variable with value `true`

2. **Wrong Value**: Variable exists but value is not exactly `"true"`
   - **Fix**: Change to exactly `true` (lowercase, no quotes)

3. **Service Not Restarted**: Variable correct but no recent deployment
   - **Fix**: Trigger manual redeploy in Railway

4. **Wrong Service**: Variable set on wrong service/environment
   - **Fix**: Ensure variable is on production service

5. **Job Manager Error**: Logs show `[BOOT] jobs_start error: ...`
   - **Fix**: Check error message and fix underlying issue

