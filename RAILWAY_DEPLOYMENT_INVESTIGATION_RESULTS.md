# Railway Deployment Investigation Results

**Date:** January 15, 2026  
**Investigation Type:** Railway Dashboard + CLI Deployment Verification

---

## Step 1: Domain Mapping Verification

**Status:** ⚠️ **REQUIRES DASHBOARD ACCESS**

**Action Required:**
1. Railway Dashboard → XBOT Project → Services
2. Find service with domain `xbot-production-844b.up.railway.app`
3. Confirm domain is bound to service "xBOT"

**CLI Evidence:**
- Status endpoint confirms `railway_service_name: "xBOT"` ✅
- Domain `xbot-production-844b.up.railway.app` responds ✅
- Service name matches expected ✅

**Screenshot Required:** Railway Dashboard → Services → Domain mapping

---

## Step 2: Deploy Source Verification

**Status:** ⚠️ **REQUIRES DASHBOARD ACCESS**

**Action Required:**
1. Railway Dashboard → xBOT Service → Settings → Source (or GitHub)
2. Verify deploy source is GitHub repo `jatenner/xBOT` and branch `main`
3. If not GitHub, change to GitHub → main

**CLI Evidence:**
- Cannot verify via CLI (requires dashboard)
- Recent deployments show SKIPPED status (suggests auto-deploy may be disabled)

**Screenshot Required:** Railway Dashboard → Settings → Source/GitHub showing repo and branch

---

## Step 3: Auto Deploy Status

**Status:** ⚠️ **REQUIRES DASHBOARD ACCESS**

**Action Required:**
1. Railway Dashboard → xBOT Service → Settings → GitHub
2. Verify Auto Deploy = **ENABLED**
3. If disabled: Enable → Save

**CLI Evidence:**
- Recent deployments: **ALL SKIPPED** (20+ deployments skipped on 2026-01-14)
- This strongly suggests Auto Deploy is **DISABLED** ❌
- No deployments created for commits `66949ad3` or `1218966f`

**Most Likely Root Cause:** Auto Deploy is DISABLED

**Screenshot Required:** Railway Dashboard → Settings → GitHub → Auto Deploy toggle

---

## Step 4: Manual Deployment Trigger

**Status:** ✅ **DEPLOYMENT TRIGGERED VIA CLI**

**Action Taken:**
```bash
railway up --service xBOT --detach
```

**Result:**
```
Indexing...
Uploading...
Build Logs: https://railway.com/project/c987ff2e-2bc7-4c65-9187-11c1a82d4ac1/service/21eb1b60-57f1-40fe-bd0e-d589345fc37f?id=70a9970d-3224-4088-8bd6-ec8bc81e830d&
```

**Build Logs URL:** https://railway.com/project/c987ff2e-2bc7-4c65-9187-11c1a82d4ac1/service/21eb1b60-57f1-40fe-bd0e-d589345fc37f?id=70a9970d-3224-4088-8bd6-ec8bc81e830d&

**Next:** Monitor build logs and verify deployment succeeds

---

## Step 5: Verify Swap

**Status:** 🔄 **MONITORING IN PROGRESS**

**Current Production Status (Before Deployment):**
```json
{
    "ok": true,
    "status": "healthy",
    "git_sha": "9b4d1e844ce4b69044fda876287649cb868a3607",
    "app_version": "9b4d1e844ce4b69044fda876287649cb868a3607",
    "railway_git_commit_sha": "fdf00f1e32b67fa399f668d836c0a737e73bc62a",
    "boot_time": "2026-01-13T23:22:39.375Z",
    "boot_id": "10c38e9a-136f-4eea-bf8e-1635b910e131"
}
```

**Expected After Deployment:**
- `railway_git_commit_sha` = `66949ad3...` or `1218966f...`
- `boot_time` = NEW timestamp (not `2026-01-13T23:22:39.375Z`)
- `boot_id` = NEW UUID

**Monitoring:** Polling `/status` endpoint...

---

## Step 6: Gate Verification (After Swap)

**Status:** ⏳ **PENDING DEPLOYMENT SUCCESS**

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

### Primary Root Cause: Auto-Deploy DISABLED

**Evidence:**
1. ✅ Commits `66949ad3` and `1218966f` exist on `origin/main`
2. ❌ No Railway deployments created for these commits
3. ❌ 20+ recent deployments show **SKIPPED** status
4. ❌ Production running old commit `fdf00f1e` for 2+ days
5. ❌ Boot time unchanged since `2026-01-13T23:22:39.375Z`

**SKIPPED Status Meaning:**
- Railway detected commits but did not deploy them
- Most common reason: Auto-Deploy is disabled
- Alternative: Build configuration issues (but no builds attempted)

**Probability:** 90% - Auto-Deploy disabled

---

## Single Fix Applied

**Fix:** Triggered manual deployment via Railway CLI

**Command:**
```bash
railway up --service xBOT --detach
```

**Result:**
- Deployment triggered ✅
- Build logs available at provided URL
- Monitoring status endpoint for swap

**Alternative Fix (If CLI deployment fails):**
- Railway Dashboard → xBOT Service → Click "Deploy" → GitHub → main → Deploy
- Enable Auto Deploy in Settings → GitHub

---

## Proof of Deployment (Pending)

**Status:** 🔄 **MONITORING**

**Current Status:**
```json
{
    "railway_git_commit_sha": "fdf00f1e32b67fa399f668d836c0a737e73bc62a",
    "boot_time": "2026-01-13T23:22:39.375Z"
}
```

**After Successful Deployment:**
- Will update with new SHA and boot_time
- Will run gate verification scripts
- Will provide full proof output

---

## Next Steps

1. ✅ Deployment triggered via CLI
2. ⏳ Monitor build logs for success/failure
3. ⏳ Poll `/status` endpoint until SHA changes
4. ⏳ Run gate verification scripts
5. ⏳ Provide final proof output

---

## Dashboard Actions Still Required

Even though CLI deployment was triggered, these dashboard checks are still needed:

1. **Verify Auto Deploy:** Railway Dashboard → Settings → GitHub → Enable Auto Deploy
2. **Verify Deploy Source:** Settings → Source → Confirm GitHub repo `jatenner/xBOT` branch `main`
3. **Verify Domain Mapping:** Services → Confirm domain `xbot-production-844b.up.railway.app` → xBOT service

These will prevent future deployment issues.
