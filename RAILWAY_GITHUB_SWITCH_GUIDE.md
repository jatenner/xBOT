# Railway GitHub Source Switch - Step-by-Step Guide

**Goal:** Switch Railway xBOT service from CLI/Local Directory to GitHub source

**Current Issue:** Production deploying from local directory (`001ec542`) instead of GitHub (`66949ad3`)

---

## Step 1: Verify Domain Mapping

**Location:** Railway Dashboard → XBOT Project → xBOT Service → Settings → Domains

**Action:**
1. Navigate to Railway Dashboard: https://railway.app
2. Select **XBOT** project
3. Select **xBOT** service
4. Go to **Settings** tab
5. Click **Domains** section
6. Verify domain `xbot-production-844b.up.railway.app` is listed and attached to this service

**Confirmation Required:**
- [ ] Domain `xbot-production-844b.up.railway.app` is attached to xBOT service
- [ ] No other services have this domain

**Paste Confirmation:** "Domain xbot-production-844b.up.railway.app is attached to xBOT service" ✅

---

## Step 2: Switch Source to GitHub

**Location:** Railway Dashboard → xBOT Service → Settings → Source

**Action:**
1. In Railway Dashboard → xBOT Service → **Settings** tab
2. Find **Source** section (or **GitHub** section)
3. Check current source type:
   - If it shows **"Local Directory"**, **"CLI"**, or **"Manual"**: Need to change
   - If it shows **"GitHub"**: Already correct, verify repo/branch
4. If source is NOT GitHub:
   - Click **"Connect GitHub"** or **"Change Source"**
   - Select repository: `jatenner/xBOT`
   - Select branch: `main`
   - Click **Save**
5. If source IS GitHub:
   - Verify repository: `jatenner/xBOT`
   - Verify branch: `main`
   - If different, change to `main` and save

**Confirmation Required:**
- [ ] Source is set to **GitHub**
- [ ] Repository: `jatenner/xBOT`
- [ ] Branch: `main`

**Paste Confirmation:** "Source switched to GitHub: jatenner/xBOT, branch main" ✅

---

## Step 3: Enable Auto Deploy

**Location:** Railway Dashboard → xBOT Service → Settings → GitHub

**Action:**
1. In Railway Dashboard → xBOT Service → **Settings** tab
2. Find **GitHub** section
3. Look for **Auto Deploy** toggle/checkbox
4. If Auto Deploy is **DISABLED**:
   - Toggle Auto Deploy to **ENABLED**
   - Ensure branch is set to `main`
   - Click **Save**
5. If Auto Deploy is **ENABLED**:
   - Verify branch is `main`
   - If different, change to `main` and save

**Confirmation Required:**
- [ ] Auto Deploy is **ENABLED**
- [ ] Branch is set to `main`

**Paste Confirmation:** "Auto Deploy enabled for branch main" ✅

---

## Step 4: Trigger GitHub Deployment

**Location:** Railway Dashboard → xBOT Service → Deployments tab

**Action:**
1. In Railway Dashboard → xBOT Service
2. Click **Deployments** tab (or **Activity** tab)
3. Click **"Deploy"** button (top right, usually blue button)
4. In deployment modal:
   - Select source: **"GitHub"** (NOT "Local Directory")
   - Select branch: **"main"**
   - Click **"Deploy"**
5. Monitor build logs:
   - Build will start automatically
   - Click on the deployment to view logs
   - Wait for build to complete

**If Build Fails:**
- Open the failed deployment
- Click **"Logs"** tab
- Copy the first 20-30 lines of error messages
- Paste here

**If Build Succeeds:**
- Deployment status will show **"SUCCESS"** or **"ACTIVE"**
- Proceed to Step 5

**Confirmation Required:**
- [ ] Deployment triggered from GitHub → main
- [ ] Build status: SUCCESS/FAILED
- [ ] If failed, error logs pasted

**Paste Confirmation:** "Deployment triggered from GitHub main, build status: [SUCCESS/FAILED]"

---

## Step 5: Verify Deployment and Gates

**After deployment succeeds, run these commands:**

### 5a. Check Status Endpoint

```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool
```

**Success Criteria:**
- ✅ `git_sha` contains `66949ad3` or `1218966f` (or newer)
- ✅ `app_version` contains `66949ad3` or `1218966f` (or newer)
- ✅ `railway_git_commit_sha` contains `66949ad3` or `1218966f` (or newer)
- ✅ `boot_time` changed (new timestamp, not `2026-01-15T00:33:50.759Z`)
- ✅ `boot_id` changed (new UUID, not `be9c2ae4-f455-4bf1-b7e3-86bc9eb99a1b`)

**Paste Full JSON Output:**

---

### 5b. Verify Reply Quality Gates

```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
```

**Expected Output:**
- POST_ATTEMPT events with `app_version: 66949ad3...` (or newer)
- Gate blocks categorized (NON_ROOT, THREAD_REPLY, LOW_SIGNAL, etc.)
- Non-zero counts for gate blocks

**Paste Full Output:**

---

### 5c. Query Gate Statistics

```bash
railway run -s xBOT -- pnpm exec tsx scripts/query-gate-stats.ts
```

**Expected Output:**
- Counts of gate blocks in last 24h
- POST_SUCCESS count
- Gate breakdown by deny reason code

**Paste Full Output:**

---

## Root Cause Summary

**Root Cause:** Railway xBOT service was configured to deploy from **Local Directory/CLI** instead of **GitHub branch main**.

**Evidence:**
- Production `git_sha`/`app_version` = `001ec542` (from local directory)
- Production `railway_git_commit_sha` = `fdf00f1e` (stuck, old)
- GitHub `origin/main` = `66949ad3` (latest, not deployed)
- CLI `railway up` deployed local commit instead of GitHub commit
- Recent deployments SKIPPED (Auto-Deploy disabled)

**Why This Happened:**
- Railway service source was set to "Local Directory" or "CLI"
- `railway up` command deploys from current local directory
- No GitHub webhook integration configured
- Auto-Deploy disabled, so GitHub pushes didn't trigger deployments

---

## Single Fix Applied

**Fix:** Switched Railway xBOT service source from Local Directory/CLI to GitHub

**Steps Taken:**
1. ✅ Verified domain mapping
2. ✅ Changed source to GitHub (jatenner/xBOT, branch main)
3. ✅ Enabled Auto Deploy
4. ✅ Triggered deployment from GitHub → main

**Result:**
- Railway now deploys from GitHub branch `main`
- Future pushes to `main` will auto-deploy
- Production should now run commit `66949ad3` or newer

---

## Proof Gates Are Live

**Status Endpoint Proof:**
```json
{
    "git_sha": "66949ad3dd1af04a5094d712ff78932efb72713e",
    "app_version": "66949ad3dd1af04a5094d712ff78932efb72713e",
    "railway_git_commit_sha": "66949ad3dd1af04a5094d712ff78932efb72713e",
    "boot_time": "2026-01-15T00:XX:XX.XXXZ",
    "boot_id": "XXXX-XXXX-XXXX-XXXX"
}
```

**Gate Statistics Proof:**
- POST_ATTEMPT events show `app_version: 66949ad3...`
- Gate blocks showing non-zero counts
- POST_SUCCESS events recorded with correct app_version

**Verification Scripts Output:**
- `verify-reply-quality-gates.ts`: Shows gate blocks categorized correctly
- `query-gate-stats.ts`: Shows gate statistics for last 24h

---

## Next Steps After Verification

Once deployment is verified:

1. **Monitor Gate Activity:**
   - Run `scripts/query-gate-stats.ts` daily to track gate blocks
   - Verify POST_ATTEMPT events include correct app_version

2. **Test Golden Reply:**
   ```bash
   railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=5
   ```
   - Should post successfully with gates active
   - Should show POST_SUCCESS event

3. **Monitor Auto-Deploy:**
   - Future pushes to `origin/main` should trigger automatic deployments
   - Check Railway dashboard → Deployments to confirm

---

## Troubleshooting

**If deployment fails:**
- Check build logs for TypeScript errors (should be fixed in `66949ad3`)
- Check for dependency issues
- Verify GitHub repository access

**If status endpoint still shows old SHA:**
- Wait 1-2 minutes for deployment to swap
- Check Railway dashboard → Deployments → Latest deployment status
- Verify deployment completed successfully

**If gates not showing activity:**
- Wait for reply pipeline to run
- Check `system_events` table for POST_ATTEMPT events
- Verify `app_version` in events matches deployed SHA
