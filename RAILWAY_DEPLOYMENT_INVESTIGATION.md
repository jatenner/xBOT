# Railway Deployment Investigation

**Date:** January 15, 2026  
**Target Commits:** `66949ad3` (fixes) or `1218966f` (gates)  
**Current Production:** `fdf00f1e` (OLD)  
**Status URL:** https://xbot-production-844b.up.railway.app/status

---

## Current Status Evidence

### Production Status Endpoint
```json
{
  "git_sha": "9b4d1e844ce4b69044fda876287649cb868a3607",
  "app_version": "9b4d1e844ce4b69044fda876287649cb868a3607",
  "railway_git_commit_sha": "fdf00f1e32b67fa399f668d836c0a737e73bc62a",
  "boot_time": "2026-01-13T23:22:39.375Z",
  "boot_id": "10c38e9a-136f-4eea-bf8e-1635b910e131"
}
```

**Analysis:**
- Running commit `fdf00f1e` (OLD)
- Boot time: 2026-01-13 (2 days old - container hasn't restarted)
- No deployments detected for `66949ad3` or `1218966f`

### Railway Deployment List (CLI)
```
Recent Deployments:
  3e8ea831-e05d-4797-af62-3bbad9af39e1 | SKIPPED | 2026-01-14 19:08:37
  3419d96d-99ee-428e-b091-ae8b777c0ac2 | FAILED  | 2026-01-14 19:02:45
  4e02d57c-661c-44d3-878b-32c2cbff2499 | FAILED  | 2026-01-14 19:01:55
```

**Analysis:**
- Recent deployments are FAILED or SKIPPED
- No deployments for target commits
- Railway may be skipping deployments due to no changes detected OR build failures

---

## Step-by-Step Railway Dashboard Investigation

### Step 1: Verify Service/Domain Mapping

**Navigate to:**
1. https://railway.app
2. Select **xBOT** project
3. Select **xBOT** service
4. Go to **"Settings"** tab
5. Scroll to **"Domains"** or **"Networking"** section

**Verify:**
- [ ] Domain `xbot-production-844b.up.railway.app` is attached to **xBOT** service
- [ ] No other services are using this domain
- [ ] Domain is pointing to correct service

**Expected:** Domain should show `xbot-production-844b.up.railway.app` → **xBOT** service

**If mismatch:** This explains why /status shows old code - wrong service is serving the domain.

---

### Step 2: Check Deployments Tab

**Navigate to:**
1. Railway → xBOT Project → xBOT Service
2. Click **"Deployments"** tab (or "Activity")

**Search for:**
- Commits: `66949ad3` or `1218966f`
- Look in deployment list for these commit hashes

**Possible Scenarios:**

#### Scenario A: NO Deployments Found for Target Commits

**Evidence:** Deployment list doesn't show `66949ad3` or `1218966f`

**Root Cause:** Railway hasn't detected GitHub push or auto-deploy is disabled

**Action:**
1. Go to **Settings** → **GitHub** section
2. Verify:
   - Repository: `jatenner/xBOT` ✅/❌
   - Branch: `main` ✅/❌
   - Auto Deploy: **ENABLED** ✅/❌
3. If Auto Deploy is **DISABLED:**
   - Enable it
   - Save settings
   - Railway should trigger deployment
4. If Auto Deploy is **ENABLED** but no deployment:
   - Click **"Deploy"** button (top right)
   - Select **"GitHub"** source
   - Select branch **"main"**
   - Click **"Deploy"**
   - Monitor build logs

**Capture:** Screenshot of GitHub settings showing Auto Deploy status

---

#### Scenario B: Deployment EXISTS but FAILED

**Evidence:** Deployment shows status **FAILED** for commit `66949ad3` or `1218966f`

**Action:**
1. Click on the failed deployment
2. Open **"Logs"** tab (or "Build Logs")
3. Scroll to bottom to find error
4. Look for:
   - Build timeout errors
   - TypeScript compilation errors (should be fixed now)
   - Missing dependencies
   - Environment variable errors
   - Healthcheck failures

**Common Error Patterns:**
```
error TS2304: Cannot find name 'X'
error TS2322: Type 'X' is not assignable to type 'Y'
Build timeout after X seconds
npm ERR! / pnpm ERR!
Healthcheck failed
```

**Capture:** Copy first 20-30 lines of actual error (skip warnings, focus on errors)

---

#### Scenario C: Deployment SUCCESS but /status Still Old

**Evidence:** Deployment shows **SUCCESS** but status endpoint shows old SHA

**Possible Causes:**
1. **Domain/Service Mismatch:** Domain pointing to wrong service
2. **Healthcheck Failing:** New deployment crashes on startup
3. **Rollback:** Railway rolled back due to healthcheck failures
4. **Multiple Services:** Wrong service is serving the domain

**Action:**
1. Check **Runtime Logs** tab (not Build Logs)
2. Look for:
   - Application crash errors
   - Healthcheck failures
   - Startup errors
   - Port binding errors
3. Check **Metrics** tab:
   - Is service running?
   - CPU/Memory usage?
   - Request success rate?

**Capture:** Copy runtime error logs showing why new deployment isn't serving traffic

---

### Step 3: Check GitHub Integration

**Navigate to:**
1. Railway → xBOT Service → **Settings** tab
2. Scroll to **"GitHub"** section

**Verify:**
- [ ] **Repository:** `jatenner/xBOT`
- [ ] **Branch:** `main`
- [ ] **Auto Deploy:** **ENABLED** (toggle should be ON)
- [ ] **Root Directory:** `/` (or correct path)

**If Auto Deploy is DISABLED:**
1. Toggle **Auto Deploy** to **ON**
2. Select branch: `main`
3. Click **Save**
4. Railway should trigger new deployment

**Capture:** Screenshot showing Auto Deploy = ENABLED

---

### Step 4: Trigger Manual Deployment

**If no deployment exists or auto-deploy is disabled:**

1. In Railway dashboard → xBOT Service
2. Click **"Deploy"** button (top right, usually blue)
3. Select source: **"GitHub"**
4. Select branch: **"main"**
5. Click **"Deploy"**
6. Monitor **Build Logs** tab

**Expected:** Build should start, show progress, complete successfully

**If Build Fails:**
- Copy error from Build Logs
- Check for TypeScript errors (should be fixed)
- Check for timeout errors
- Check for dependency errors

**Capture:** Screenshot of deployment triggered + build logs showing success/failure

---

### Step 5: Verify Deployment Swap

**After triggering deployment:**

**Poll Status Endpoint:**
```bash
# Run this command repeatedly until SHA changes
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool
```

**Success Criteria:**
- ✅ `git_sha` contains `66949ad3` or `1218966f`
- ✅ `app_version` contains `66949ad3` or `1218966f`
- ✅ `railway_git_commit_sha` contains `66949ad3` or `1218966f`
- ✅ `boot_time` changed (new timestamp, not `2026-01-13T23:22:39.375Z`)
- ✅ `boot_id` changed (new UUID)

**Expected Response (After Deployment):**
```json
{
  "git_sha": "66949ad3dd1af04a5094d712ff78932efb72713e",
  "app_version": "66949ad3dd1af04a5094d712ff78932efb72713e",
  "railway_git_commit_sha": "66949ad3dd1af04a5094d712ff78932efb72713e",
  "boot_time": "2026-01-15T00:XX:XX.XXXZ",  // NEW timestamp
  "boot_id": "XXXX-XXXX-XXXX-XXXX"  // NEW UUID
}
```

**Capture:** Full JSON output showing new SHA and new boot_time

---

## Common Deployment Failure Reasons

### 1. Build Timeout
**Symptom:** Build logs show "Build timeout after X seconds"
**Fix:** Increase build timeout in Railway settings

### 2. TypeScript Errors
**Symptom:** Build logs show `error TSXXXX`
**Status:** ✅ Should be fixed in commit `66949ad3`
**Fix:** Verify build succeeds locally: `pnpm build`

### 3. Missing Dependencies
**Symptom:** Build logs show `npm ERR!` or `pnpm ERR!`
**Fix:** Check `package.json` and `pnpm-lock.yaml` are committed

### 4. Healthcheck Failure
**Symptom:** Deployment succeeds but service crashes on startup
**Fix:** Check runtime logs for startup errors

### 5. Auto-Deploy Disabled
**Symptom:** No deployments created for new commits
**Fix:** Enable Auto Deploy in Settings → GitHub

### 6. GitHub Webhook Not Working
**Symptom:** Auto-deploy enabled but no deployments triggered
**Fix:** Check GitHub → Settings → Webhooks for Railway webhook errors

---

## Investigation Checklist

**Complete these steps and document findings:**

- [ ] **Step 1:** Verified domain `xbot-production-844b.up.railway.app` → xBOT service
- [ ] **Step 2:** Checked Deployments tab for `66949ad3` or `1218966f`
  - [ ] Found deployment? Status: __________
  - [ ] No deployment found? → Check GitHub integration
- [ ] **Step 3:** Checked GitHub integration
  - [ ] Repository: `jatenner/xBOT` ✅/❌
  - [ ] Branch: `main` ✅/❌
  - [ ] Auto Deploy: ENABLED ✅/❌
- [ ] **Step 4:** Triggered manual deployment (if needed)
  - [ ] Deployment triggered? ✅/❌
  - [ ] Build status: SUCCESS/FAILED
  - [ ] Error (if failed): __________
- [ ] **Step 5:** Verified deployment swap
  - [ ] Status endpoint shows new SHA? ✅/❌
  - [ ] Boot time changed? ✅/❌

---

## Expected Findings

Based on CLI evidence:

**Most Likely Issue:**
- **Auto-Deploy Disabled** OR
- **GitHub Webhook Not Triggering** OR
- **Build Failures** (TypeScript errors - should be fixed now)

**Evidence:**
- No deployments for target commits
- Recent deployments are FAILED/SKIPPED
- Production still running old commit

---

## Next Steps After Investigation

1. **If Auto-Deploy Disabled:** Enable it → Trigger deployment → Verify
2. **If Build Failures:** Check logs → Fix errors → Redeploy → Verify
3. **If Domain Mismatch:** Fix domain mapping → Verify
4. **If Healthcheck Failing:** Check runtime logs → Fix startup errors → Redeploy

---

## Proof Requirements

After deployment succeeds, provide:

1. **Status Endpoint JSON:** Full output showing `66949ad3` or `1218966f`
2. **Boot Time Change:** Old vs new boot_time timestamps
3. **Gate Verification:** Output from `scripts/verify-reply-quality-gates.ts`
4. **Golden Reply Test:** Output from `scripts/post-one-golden-reply.ts`
