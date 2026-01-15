# Railway Deployment Investigation - Proof Document

**Date:** January 15, 2026  
**Goal:** Deploy commits `66949ad3` and `1218966f` from `origin/main` to production

---

## Step 1: Domain Mapping Verification

**Status:** ⚠️ **REQUIRES DASHBOARD ACCESS**

**CLI Evidence:**
- Status endpoint confirms `railway_service_name: "xBOT"` ✅
- Domain `xbot-production-844b.up.railway.app` responds ✅
- Service name matches expected ✅

**Dashboard Action Required:**
1. Railway Dashboard → XBOT Project → Services
2. Find service with domain `xbot-production-844b.up.railway.app`
3. Confirm domain is bound to service "xBOT"

**Screenshot Required:** Railway Dashboard → Services → Domain mapping

---

## Step 2: Deploy Source Verification

**Status:** ⚠️ **REQUIRES DASHBOARD ACCESS**

**CLI Evidence:**
- Cannot verify via CLI (requires dashboard)
- Recent deployments show SKIPPED status (suggests auto-deploy may be disabled)

**Dashboard Action Required:**
1. Railway Dashboard → xBOT Service → Settings → Source (or GitHub)
2. Verify deploy source is GitHub repo `jatenner/xBOT` and branch `main`
3. If not GitHub, change to GitHub → main

**Screenshot Required:** Railway Dashboard → Settings → Source/GitHub showing repo and branch

---

## Step 3: Auto Deploy Status

**Status:** ⚠️ **REQUIRES DASHBOARD ACCESS**

**CLI Evidence:**
- Recent deployments: **ALL SKIPPED** (20+ deployments skipped on 2026-01-14)
- This strongly suggests Auto Deploy is **DISABLED** ❌
- No deployments created for commits `66949ad3` or `1218966f`

**Most Likely Root Cause:** Auto Deploy is DISABLED

**Dashboard Action Required:**
1. Railway Dashboard → xBOT Service → Settings → GitHub
2. Verify Auto Deploy = **ENABLED**
3. If disabled: Enable → Save

**Screenshot Required:** Railway Dashboard → Settings → GitHub → Auto Deploy toggle

---

## Step 4: Manual Deployment Trigger

**Status:** ⚠️ **CLI DEPLOYMENT DEPLOYED WRONG COMMIT**

**Action Taken:**
```bash
railway up --service xBOT --detach
```

**Result:**
- Deployment triggered ✅
- Build Status: **SUCCESS** ✅
- **BUT:** Deployed commit `001ec542` (OLD) instead of `66949ad3` (NEW) ❌

**Root Cause:** `railway up` deploys from LOCAL directory, not from GitHub

**Current Production Status (After CLI Deployment):**
```json
{
    "git_sha": "001ec542c5e5af3592011c31f92b819423887ea3",
    "app_version": "001ec542c5e5af3592011c31f92b819423887ea3",
    "railway_git_commit_sha": "fdf00f1e32b67fa399f668d836c0a737e73bc62a",
    "boot_time": "2026-01-15T00:33:50.759Z",
    "boot_id": "be9c2ae4-f455-4bf1-b7e3-86bc9eb99a1b"
}
```

**Issue:** 
- `git_sha`/`app_version` = `001ec542` (older commit, not `66949ad3`)
- `railway_git_commit_sha` = `fdf00f1e` (still old)
- Boot time changed (container restarted) ✅
- But wrong commit deployed ❌

**Dashboard Action Required:**
1. Railway Dashboard → xBOT Service → Click **"Deploy"** button
2. Select source: **"GitHub"** (NOT "Local Directory")
3. Select branch: **"main"**
4. Click **"Deploy"**
5. Monitor Build Logs

**Screenshot Required:** Deployment triggered from GitHub → main

---

## Step 5: Verify Swap

**Status:** ⏳ **PENDING GITHUB-BASED DEPLOYMENT**

**Current Production Status (After CLI Deployment - WRONG COMMIT):**
```json
{
    "git_sha": "001ec542c5e5af3592011c31f92b819423887ea3",
    "app_version": "001ec542c5e5af3592011c31f92b819423887ea3",
    "railway_git_commit_sha": "fdf00f1e32b67fa399f668d836c0a737e73bc62a",
    "boot_time": "2026-01-15T00:33:50.759Z",
    "boot_id": "be9c2ae4-f455-4bf1-b7e3-86bc9eb99a1b"
}
```

**Expected After GitHub Deployment:**
- `railway_git_commit_sha` = `66949ad3...` or `1218966f...` ✅
- `git_sha`/`app_version` = `66949ad3...` or `1218966f...` ✅
- `boot_time` = NEW timestamp ✅
- `boot_id` = NEW UUID ✅

**Monitoring:** After GitHub deployment, poll `/status` endpoint

---

## Step 6: Gate Verification (After Correct Deployment)

**Status:** ⏳ **PENDING CORRECT DEPLOYMENT**

**Command to Run:**
```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
```

**Expected Output:**
- POST_ATTEMPT events with `app_version: 66949ad3...`
- Gate blocks categorized (NON_ROOT, THREAD_REPLY, LOW_SIGNAL, etc.)
- Non-zero counts for gate blocks

---

## Root Cause Analysis

### Primary Root Cause: Railway Deploying from Local Directory, Not GitHub

**Evidence:**
1. ✅ Commits `66949ad3` and `1218966f` exist on `origin/main`
2. ❌ CLI `railway up` deployed commit `001ec542` (from local directory)
3. ❌ No Railway deployments created for GitHub commits `66949ad3` or `1218966f`
4. ❌ 20+ recent deployments show **SKIPPED** status
5. ❌ Production `railway_git_commit_sha` still shows `fdf00f1e` (old)

**Root Cause:**
- Railway service is configured to deploy from **LOCAL DIRECTORY** (via `railway up`)
- OR Railway service is not configured to deploy from GitHub at all
- Auto-Deploy is likely **DISABLED** (explains SKIPPED deployments)

**Fix Required:**
1. Configure Railway to deploy from GitHub (not local directory)
2. Enable Auto Deploy in Settings → GitHub
3. Trigger manual deployment from GitHub → main branch

---

## Single Fix Applied

**Fix Attempted:** Triggered deployment via Railway CLI

**Command:**
```bash
railway up --service xBOT --detach
```

**Result:**
- ✅ Deployment triggered and succeeded
- ❌ **BUT:** Deployed wrong commit (`001ec542` instead of `66949ad3`)
- ❌ **Reason:** `railway up` deploys from local directory, not GitHub

**Correct Fix Required:**
1. Railway Dashboard → xBOT Service → Settings → Source
2. Verify source is **GitHub** (not "Local Directory")
3. Verify branch is **main**
4. Enable Auto Deploy
5. Trigger deployment: Click "Deploy" → GitHub → main → Deploy

---

## Proof of Deployment (Current Status)

**Status:** ⚠️ **WRONG COMMIT DEPLOYED**

**Current Production:**
```json
{
    "git_sha": "001ec542c5e5af3592011c31f92b819423887ea3",
    "app_version": "001ec542c5e5af3592011c31f92b819423887ea3",
    "railway_git_commit_sha": "fdf00f1e32b67fa399f668d836c0a737e73bc62a",
    "boot_time": "2026-01-15T00:33:50.759Z",
    "boot_id": "be9c2ae4-f455-4bf1-b7e3-86bc9eb99a1b"
}
```

**Target Commits:**
- `66949ad3` (TypeScript fixes) - **NOT DEPLOYED** ❌
- `1218966f` (Gates implementation) - **NOT DEPLOYED** ❌

**Deployed Commit:**
- `001ec542` (older commit: "PROOF COMPLETE: Resumer works") - **WRONG** ❌

**Next Steps:**
1. Configure Railway to deploy from GitHub (not local directory)
2. Trigger deployment from GitHub → main branch
3. Verify `railway_git_commit_sha` becomes `66949ad3` or `1218966f`
4. Run gate verification scripts

---

## Summary

**Code Status:** ✅ Ready (commits `66949ad3` and `1218966f` exist on `origin/main`)

**Deployment Status:** ⚠️ **BLOCKED** (Railway deploying from local directory, not GitHub)

**Root Cause:** Railway service not configured to deploy from GitHub branch `main`

**Action Required:** 
1. Railway Dashboard → xBOT Service → Settings → Source → Change to GitHub → main
2. Enable Auto Deploy
3. Trigger deployment from GitHub → main
4. Verify `railway_git_commit_sha` = `66949ad3` or `1218966f`

**Proof:** Will provide after correct GitHub-based deployment succeeds
