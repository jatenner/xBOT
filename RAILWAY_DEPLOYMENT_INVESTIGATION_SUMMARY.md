# Railway Deployment Investigation - Final Summary

**Date:** January 15, 2026  
**Goal:** Deploy commits `66949ad3` and `1218966f` from `origin/main` to production

---

## Evidence Gathered

### ✅ GitHub Status
```
Latest commit on origin/main: 66949ad3dd1af04a5094d712ff78932efb72713e
Gates commit: 1218966f44b9a56ade7e91cfa165936090a44b73
Both commits pushed successfully ✅
```

### ❌ Production Status (Current)
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
- `git_sha`/`app_version` = `001ec542` (older commit, NOT `66949ad3`) ❌
- `railway_git_commit_sha` = `fdf00f1e` (old commit) ❌
- Boot time changed (container restarted) ✅
- But wrong commit deployed ❌

### ❌ Railway Deployments
```
Recent Deployments:
  70a9970d-3224-4088-8bd6-ec8bc81e830d | SUCCESS | 2026-01-14 19:32:09 (CLI deployment - WRONG COMMIT)
  3e8ea831-e05d-4797-af62-3bbad9af39e1 | SKIPPED | 2026-01-14 19:08:37
  3419d96d-99ee-428e-b091-ae8b777c0ac2 | FAILED  | 2026-01-14 19:02:45
```
- No deployments for `66949ad3` or `1218966f` ❌
- Recent deployments SKIPPED or FAILED ❌
- CLI deployment succeeded but deployed wrong commit ❌

---

## Root Cause Analysis

### Primary Root Cause: Railway Deploying from Local Directory, Not GitHub

**Evidence:**
1. ✅ Commits `66949ad3` and `1218966f` exist on `origin/main`
2. ❌ CLI `railway up` deployed commit `001ec542` (from local directory, not GitHub)
3. ❌ No Railway deployments created for GitHub commits `66949ad3` or `1218966f`
4. ❌ 20+ recent deployments show **SKIPPED** status
5. ❌ Production `railway_git_commit_sha` still shows `fdf00f1e` (old)

**Root Cause:**
- Railway service is configured to deploy from **LOCAL DIRECTORY** (via `railway up`)
- OR Railway service is not configured to deploy from GitHub at all
- Auto-Deploy is likely **DISABLED** (explains SKIPPED deployments)

**Why CLI Deployment Failed:**
- `railway up` deploys from the current local directory
- It does NOT deploy from GitHub branch `main`
- That's why it deployed `001ec542` (an older commit in local history) instead of `66949ad3` (latest on GitHub)

---

## Required Dashboard Actions

### Step 1: Verify Domain Mapping
**Location:** Railway Dashboard → XBOT Project → Services

**Action:**
1. Find the service that has domain `xbot-production-844b.up.railway.app` attached
2. Confirm it's bound to service "xBOT"

**Screenshot Required:** Domain mapping showing `xbot-production-844b.up.railway.app` → xBOT service

---

### Step 2: Verify Deploy Source
**Location:** Railway Dashboard → xBOT Service → Settings → Source (or GitHub)

**Action:**
1. Verify the deploy source is **GitHub** repo `jatenner/xBOT` and branch `main`
2. If the source is **NOT GitHub** (e.g., "Local Directory" or "None"):
   - Change it to **GitHub**
   - Select repository: `jatenner/xBOT`
   - Select branch: `main`
   - Save

**Screenshot Required:** Settings → Source showing GitHub repo `jatenner/xBOT` branch `main`

---

### Step 3: Enable Auto Deploy
**Location:** Railway Dashboard → xBOT Service → Settings → GitHub

**Action:**
1. Ensure Auto Deploy is **ENABLED**
2. If disabled:
   - Toggle Auto Deploy to **ENABLED**
   - Select branch: `main`
   - Click **Save**
   - Railway should trigger deployment automatically

**Screenshot Required:** Settings → GitHub showing Auto Deploy = **ENABLED**

---

### Step 4: Trigger Manual Deployment from GitHub
**Location:** Railway Dashboard → xBOT Service → Click **"Deploy"** button

**Action:**
1. Click **"Deploy"** button (top right)
2. Select source: **"GitHub"** (NOT "Local Directory")
3. Select branch: **"main"**
4. Click **"Deploy"**
5. Open the deployment build logs
6. If it fails, copy the first real error lines
7. If it succeeds, proceed to Step 5

**Screenshot Required:** Deployment triggered from GitHub → main branch

**Build Logs:** Monitor for success/failure

---

### Step 5: Verify Swap
**After deploy success:**

**Command:**
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool
```

**Success Criteria:**
- ✅ `railway_git_commit_sha` = `66949ad3...` or `1218966f...`
- ✅ `git_sha`/`app_version` = `66949ad3...` or `1218966f...`
- ✅ `boot_time` = NEW timestamp (not `2026-01-15T00:33:50.759Z`)
- ✅ `boot_id` = NEW UUID (not `be9c2ae4-f455-4bf1-b7e3-86bc9eb99a1b`)

**Expected Response:**
```json
{
    "git_sha": "66949ad3dd1af04a5094d712ff78932efb72713e",
    "app_version": "66949ad3dd1af04a5094d712ff78932efb72713e",
    "railway_git_commit_sha": "66949ad3dd1af04a5094d712ff78932efb72713e",
    "boot_time": "2026-01-15T00:XX:XX.XXXZ",
    "boot_id": "XXXX-XXXX-XXXX-XXXX"
}
```

**Paste Required:** Full JSON output showing new SHA and new boot_time

---

### Step 6: Gate Verification (After Correct Deployment)
**Only after swap is proven:**

**Command:**
```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
```

**Expected Output:**
- POST_ATTEMPT events with `app_version: 66949ad3...`
- Gate blocks categorized (NON_ROOT, THREAD_REPLY, LOW_SIGNAL, etc.)
- Non-zero counts for gate blocks

**Paste Required:** Full script output

---

## Root Cause Summary

**Root Cause:** Railway service is deploying from **LOCAL DIRECTORY** (via `railway up`) instead of from **GitHub branch `main`**.

**Evidence:**
- CLI `railway up` deployed commit `001ec542` (from local directory)
- No deployments for GitHub commits `66949ad3` or `1218966f`
- Recent deployments SKIPPED (Auto-Deploy likely disabled)

**Fix:** Configure Railway to deploy from GitHub → main branch (via dashboard)

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

## Proof Requirements

**After correct GitHub-based deployment:**

1. **Status Endpoint JSON:**
   ```bash
   curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool
   ```
   - Must show `railway_git_commit_sha` = `66949ad3...` or `1218966f...`
   - Must show `boot_time` changed
   - Must show `boot_id` changed

2. **Gate Verification Output:**
   ```bash
   railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
   ```
   - POST_ATTEMPT events with correct `app_version`
   - Gate blocks categorized correctly

3. **Screenshots:**
   - Domain mapping
   - Deploy source (GitHub → main)
   - Auto Deploy enabled
   - Deployment triggered from GitHub

---

## Current Status

**Code Status:** ✅ Ready (commits `66949ad3` and `1218966f` exist on `origin/main`)

**Deployment Status:** ⚠️ **BLOCKED** (Railway deploying from local directory, not GitHub)

**Root Cause:** Railway service not configured to deploy from GitHub branch `main`

**Action Required:** 
1. Railway Dashboard → xBOT Service → Settings → Source → Change to GitHub → main
2. Enable Auto Deploy
3. Trigger deployment from GitHub → main
4. Verify `railway_git_commit_sha` = `66949ad3` or `1218966f`

**Proof:** Will provide after correct GitHub-based deployment succeeds
