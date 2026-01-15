# Railway Dashboard Investigation Steps

**Objective:** Identify why Railway isn't deploying commits `66949ad3` or `1218966f`

---

## Current Evidence

### GitHub Status
- Latest commit on `origin/main`: `66949ad3dd1af04a5094d712ff78932efb72713e`
- Previous commit: `1218966f44b9a56ade7e91cfa165936090a44b73`
- Both pushed successfully ✅

### Production Status
```json
{
  "git_sha": "9b4d1e84...",
  "railway_git_commit_sha": "fdf00f1e...",
  "boot_time": "2026-01-13T23:22:39.375Z",
  "boot_id": "10c38e9a-136f-4eea-bf8e-1635b910e131"
}
```
- Running OLD commit `fdf00f1e`
- Boot time unchanged (container hasn't restarted in 2 days)

### Railway Deployments (CLI)
- Recent deployments: FAILED or SKIPPED
- No deployments found for `66949ad3` or `1218966f`
- Latest deployment: `3e8ea831` (SKIPPED, 2026-01-14)

---

## Step 1: Verify Service/Domain Mapping

**In Railway Dashboard:**

1. Navigate to: https://railway.app → xBOT Project → xBOT Service
2. Go to **Settings** tab → **Domains** or **Networking** section
3. Verify domain `xbot-production-844b.up.railway.app` is attached to **xBOT** service

**Expected:** Domain should show `xbot-production-844b.up.railway.app` → **xBOT** service

**If mismatch found:** Wrong service is serving the domain - this explains old code.

**Screenshot Required:** Domain/Networking settings showing service mapping

---

## Step 2: Check Deployments Tab

**In Railway Dashboard:**

1. Navigate to: Railway → xBOT Project → xBOT Service → **Deployments** tab
2. Search deployment list for commits: `66949ad3` or `1218966f`

### Scenario A: NO Deployment Found

**If deployments list doesn't show `66949ad3` or `1218966f`:**

**Root Cause:** Railway hasn't detected GitHub push

**Action:**
1. Go to **Settings** → **GitHub** section
2. Check:
   - Repository: `jatenner/xBOT` ✅/❌
   - Branch: `main` ✅/❌
   - **Auto Deploy: ENABLED** ✅/❌ ← **CRITICAL**
3. If Auto Deploy is **DISABLED:**
   - Toggle to **ENABLED**
   - Select branch: `main`
   - Click **Save**
   - Railway should trigger deployment
4. If Auto Deploy is **ENABLED** but no deployment:
   - Click **"Deploy"** button (top right)
   - Select **"GitHub"** → Branch **"main"**
   - Click **"Deploy"**
   - Monitor build logs

**Screenshot Required:** GitHub settings showing Auto Deploy status

---

### Scenario B: Deployment EXISTS but FAILED

**If deployment shows status FAILED:**

**Action:**
1. Click on failed deployment (e.g., `3419d96d-99ee-428e-b091-ae8b777c0ac2`)
2. Open **"Logs"** tab (or "Build Logs")
3. Scroll to bottom to find **first real error**
4. Look for error patterns:
   ```
   error TS2304: Cannot find name 'X'
   error TS2322: Type 'X' is not assignable
   Build timeout after X seconds
   npm ERR! / pnpm ERR!
   Healthcheck failed
   ```

**Copy Required:** First 20-30 lines of actual error (skip warnings, focus on errors)

**Note:** TypeScript errors should be fixed in commit `66949ad3` - if still present, there may be a different issue.

---

### Scenario C: Deployment SUCCESS but /status Still Old

**If deployment shows SUCCESS but status endpoint shows old SHA:**

**Possible Causes:**
1. Domain pointing to wrong service
2. Healthcheck failing → Railway rolled back
3. Service crash-looping

**Action:**
1. Check **Runtime Logs** tab (not Build Logs)
2. Look for:
   - Application crash errors
   - Healthcheck failures
   - Startup errors
   - Port binding errors
3. Check **Metrics** tab:
   - Is service running?
   - CPU/Memory spikes?
   - Request success rate?

**Copy Required:** Runtime error logs showing why new deployment isn't serving

---

## Step 3: Check GitHub Integration

**In Railway Dashboard:**

1. Railway → xBOT Service → **Settings** → **GitHub** section
2. Verify:
   - [ ] **Repository:** `jatenner/xBOT`
   - [ ] **Branch:** `main`
   - [ ] **Auto Deploy:** **ENABLED** ← **MOST LIKELY ISSUE**
   - [ ] **Root Directory:** `/` (or correct path)

**If Auto Deploy is DISABLED:**
- This is likely the root cause
- Enable it → Save → Railway should trigger deployment

**Screenshot Required:** GitHub settings showing Auto Deploy = ENABLED

---

## Step 4: Trigger Manual Deployment

**If no deployment exists:**

1. Railway dashboard → xBOT Service
2. Click **"Deploy"** button (top right, usually blue)
3. Select source: **"GitHub"**
4. Select branch: **"main"**
5. Click **"Deploy"**
6. Monitor **Build Logs** tab

**Expected:** Build should start, show progress, complete successfully

**If Build Fails:**
- Copy error from Build Logs
- Check for TypeScript errors (should be fixed in `66949ad3`)
- Check for timeout errors
- Check for dependency errors

**Screenshot Required:** Deployment triggered + build logs showing success/failure

---

## Step 5: Verify Deployment Swap

**After triggering deployment, poll status endpoint:**

```bash
# Run repeatedly until SHA changes
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool
```

**Success Criteria:**
- ✅ `git_sha` contains `66949ad3` or `1218966f`
- ✅ `boot_time` changed (new timestamp)
- ✅ `boot_id` changed (new UUID)

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

**Copy Required:** Full JSON output showing new SHA and new boot_time

---

## Most Likely Root Causes (Based on Evidence)

### 1. Auto-Deploy Disabled (MOST LIKELY)
**Evidence:** No deployments for target commits
**Fix:** Enable Auto Deploy in Settings → GitHub

### 2. Build Failures (POSSIBLE)
**Evidence:** Recent deployments show FAILED status
**Fix:** Check build logs for errors (TypeScript should be fixed)

### 3. GitHub Webhook Not Working (POSSIBLE)
**Evidence:** Auto-deploy enabled but no deployments triggered
**Fix:** Check GitHub → Settings → Webhooks for Railway webhook errors

### 4. Domain/Service Mismatch (LESS LIKELY)
**Evidence:** Status endpoint shows old code
**Fix:** Verify domain mapping in Settings → Domains

---

## Investigation Results Template

**Fill this out after checking Railway dashboard:**

```
Step 1 - Domain Mapping:
  Domain xbot-production-844b.up.railway.app → Service: __________
  Mismatch found? YES/NO

Step 2 - Deployments:
  Deployment for 66949ad3 exists? YES/NO
  Deployment for 1218966f exists? YES/NO
  Status: SUCCESS/FAILED/SKIPPED/NONE
  Error (if failed): __________

Step 3 - GitHub Integration:
  Repository: __________
  Branch: __________
  Auto Deploy: ENABLED/DISABLED ← CRITICAL

Step 4 - Manual Deployment:
  Triggered? YES/NO
  Build Status: SUCCESS/FAILED
  Error (if failed): __________

Step 5 - Verification:
  Status endpoint SHA: __________
  Boot time changed? YES/NO
```

---

## Next Single Fix

**After identifying root cause:**

1. **If Auto-Deploy Disabled:** Enable it → Wait for deployment → Verify
2. **If Build Failures:** Fix errors → Redeploy → Verify
3. **If Webhook Issues:** Reconnect GitHub → Trigger deployment → Verify
4. **If Domain Mismatch:** Fix mapping → Verify

---

## Proof Requirements

**After deployment succeeds, provide:**

1. **Status Endpoint:** Full JSON showing `66949ad3` or `1218966f`
2. **Boot Time Change:** Old `2026-01-13T23:22:39.375Z` → New timestamp
3. **Gate Verification:** Output from `scripts/verify-reply-quality-gates.ts`
4. **Golden Reply:** Output from `scripts/post-one-golden-reply.ts`
