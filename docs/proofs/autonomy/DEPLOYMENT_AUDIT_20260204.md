# Deployment Audit Report - Hourly Tick Fix

**Date:** 2026-02-04  
**Auditor:** Operator  
**Verdict:** ❌ **FAIL** (Deployment incomplete)

---

## Step 1 — Commit + Push

### Git Status
```
✅ src/jobs/jobManager.ts has uncommitted changes
```

### Diff (Hourly Tick Import Fix)
```diff
-            const { hourlyTickJob } = await import('./hourlyTickJob');
-            await hourlyTickJob();
+            const { executeHourlyTick } = await import('../rateController/hourlyTick');
+            await executeHourlyTick();
```

### Commit
```bash
git add src/jobs/jobManager.ts
git commit -m "fix: Correct hourly tick import path (executeHourlyTick)"
```
**Result:** ✅ Committed locally (`c841452d6336bd40360604e67ab5a67111ca3582`)

### Push
```bash
git push origin main
```
**Result:** ❌ **BLOCKED** - GitHub secret scanning detected secrets in historical commits
- Error: `GH013: Repository rule violations found`
- Reason: OpenAI API keys in `.env.control`, `.env.local` files in commit history
- **Impact:** Fix exists locally but NOT in GitHub repository

---

## Step 2 — Deploy to Railway

### Railway CLI Deploy
```bash
railway up --service xBOT --detach
railway up --service serene-cat --detach
```
**Result:** ✅ Deployments triggered
- xBOT: Build logs URL provided
- serene-cat: Build logs URL provided

**Note:** Railway `up` command deploys from **local working directory**, not GitHub. This means the fix SHOULD be deployed even though GitHub push failed.

---

## Step 3 — Verify Deploy

### Git SHA
**Local:** `c841452d6336bd40360604e67ab5a67111ca3582`

### BOOT Logs
```bash
railway logs --service xBOT --lines 200 | grep -E "BOOT|runtime_sha|RAILWAY_GIT_COMMIT_SHA"
```
**Result:** ❌ **NO BOOT logs found** in recent logs (may have rotated)

### Code Verification
**Local file check:** ✅ Fix present in `src/jobs/jobManager.ts` line 283
- Uses correct import: `import('../rateController/hourlyTick')`
- Calls correct function: `executeHourlyTick()`

**Railway logs check:** ❌ No evidence of hourly tick job scheduling logs

---

## Step 4 — Prove Hourly Tick Execution

### Database Query
```sql
SELECT * FROM rate_controller_state ORDER BY updated_at DESC LIMIT 3;
```
**Result:** ❌ **ZERO rows** - Table is empty

### Logs Query
```bash
railway logs --service xBOT --lines 400 | grep -E "HOURLY_TICK|executeHourlyTick|RATE_CONTROLLER"
```
**Result:** ❌ **ZERO matches** - No hourly tick logs

### Assertion
- ❌ **FAIL:** Latest `updated_at` within 90 minutes: **N/A (no rows)**
- ❌ **FAIL:** Hourly tick not executing

---

## Step 5 — Lock Configuration

### Railway Variables Command
**Attempted:**
```bash
railway variables --service xBOT MAX_REPLIES_PER_HOUR=2  # ❌ Wrong syntax
railway variables set --service xBOT MAX_REPLIES_PER_HOUR=2  # ❌ Wrong syntax
```

**Correct Syntax (needs verification):**
```bash
# Railway CLI may require different syntax - check with:
railway variables --help
```

### Current Variables
```
MAX_REPLIES_PER_HOUR=3                   ⚠️ NEEDS: 2
POSTS_PER_HOUR=2                         ⚠️ NEEDS: 0
MAX_POSTS_PER_HOUR=2                     ⚠️ NEEDS: 0
CANARY_MODE=<not found>                  ⚠️ NEEDS: false
DRY_RUN=false                            ✅ CORRECT
EXECUTION_MODE=control                   ✅ CORRECT
```

**Status:** ⚠️ Configuration NOT locked (CLI syntax issue)

---

## Step 6 — Prove Real Execution

### SAFE_GOTO Events (Last 3 Hours)
```sql
SELECT event_type, COUNT(*) 
FROM system_events
WHERE created_at > NOW() - INTERVAL '3 hours'
  AND event_type IN ('SAFE_GOTO_ATTEMPT', 'SAFE_GOTO_OK', 'SAFE_GOTO_FAIL')
GROUP BY event_type;
```
**Result:** ❌ **ZERO events**

### Posted Replies (Last 3 Hours)
```sql
SELECT COUNT(*) FROM content_metadata
WHERE decision_type='reply' AND status='posted'
AND posted_at > NOW() - INTERVAL '3 hours';
```
**Result:** ❌ **0 replies**

### Skip/Infra Reasons
**Skip Reasons:** ❌ **ZERO events**
**Infra Blocks:** ❌ **ZERO events**

**Explanation:** No execution attempts happening. System is idle.

---

## Root Cause Analysis

### Why Hourly Tick Not Executing

**Possible Causes:**

1. **Deployment Source Mismatch:**
   - Railway may be configured to deploy from GitHub (not local)
   - GitHub push failed → old code deployed
   - Need to verify Railway deployment source

2. **Job Manager Not Starting Hourly Tick:**
   - No logs showing "Rate controller hourly tick enabled"
   - No logs showing hourly tick scheduling
   - May indicate `flags.postingEnabled=false` or job scheduling disabled

3. **Import Error (Silent Failure):**
   - No error logs for import failure
   - Job may be failing silently in `safeExecute` wrapper

4. **Schema Preflight Failure:**
   - Logs show: `[POSTING_QUEUE] ❌ FAIL-CLOSED: Migration health check failed`
   - May prevent hourly tick execution

---

## Final Verdict

### ❌ **FAIL**

**Summary:**
- ✅ Fix committed locally
- ❌ Fix NOT in GitHub (push blocked)
- ⚠️ Railway deployment status unclear
- ❌ Hourly tick NOT executing (no DB rows, no logs)
- ❌ No execution evidence (no SAFE_GOTO events, no replies)
- ⚠️ Configuration NOT locked (CLI syntax issue)

---

## Corrective Actions (Max 3)

1. **Verify Railway Deployment Source:**
   ```bash
   # Check Railway dashboard or CLI for deployment source
   # If deploying from GitHub, need to resolve secret scanning issue
   # If deploying from local, verify deployment completed successfully
   ```

2. **Check Job Manager Startup Logs:**
   ```bash
   railway logs --service xBOT --lines 10000 | grep -E "JOB_MANAGER.*startJobs|Posting.*ENABLED|Rate controller hourly tick|scheduleStaggeredJob.*hourly"
   ```
   - Verify hourly tick is scheduled
   - Check for import errors or silent failures

3. **Fix Configuration Lock (Railway CLI):**
   ```bash
   # Find correct Railway CLI syntax for setting variables
   railway variables --help
   # Then set:
   # MAX_REPLIES_PER_HOUR=2
   # POSTS_PER_HOUR=0
   # MAX_POSTS_PER_HOUR=0
   # CANARY_MODE=false
   ```

---

## Evidence Summary

### Git
- **Local SHA:** `c841452d6336bd40360604e67ab5a67111ca3582`
- **Push Status:** ❌ Blocked (GitHub secret scanning)

### Database
- **rate_controller_state:** ❌ Empty (0 rows)
- **SAFE_GOTO events:** ❌ Zero (last 3h)
- **Posted replies:** ❌ Zero (last 3h)

### Logs
- **Hourly tick logs:** ❌ Zero matches
- **Job manager logs:** ⚠️ No hourly tick scheduling evidence
- **Error logs:** ⚠️ Migration health check failing

---

**Report Generated:** 2026-02-04  
**Status:** ❌ FAIL - Deployment incomplete, hourly tick not executing  
**Next Steps:** Verify Railway deployment source, check job manager startup, fix configuration lock
