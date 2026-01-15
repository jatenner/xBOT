# Railway UI Deployment Checklist

**Latest Commit:** `66949ad3dd1af04a5094d712ff78932efb72713e` (includes TypeScript fixes)  
**Previous Commit:** `1218966f44b9a56ade7e91cfa165936090a44b73` (gates implementation)  
**Current Production:** `fdf00f1e32b67fa399f668d836c0a737e73bc62a` (OLD - needs update)

---

## ✅ What Was Done

1. **Fixed TypeScript Compilation Errors:**
   - Fixed emoji regex type inference in `replyTargetQualityFilter.ts`
   - Fixed `insertedRow` reference in `replyDecisionRecorder.ts`
   - Build now succeeds: `pnpm build` ✅

2. **Committed and Pushed:**
   - Commit: `66949ad3` (fixes)
   - Commit: `1218966f` (gates)
   - Both pushed to `origin/main` ✅

3. **Railway CLI Attempts:**
   - `railway redeploy --service xBOT` executed (no output)
   - `railway up --detach -s xBOT` timed out
   - Railway should auto-deploy from GitHub ⏳

---

## 🔍 Railway Dashboard Actions Required

### Step 1: Check Deployments Tab

**Navigate to:**
1. https://railway.app
2. Select **xBOT** project
3. Select **xBOT** service
4. Click **"Deployments"** tab (or "Activity")

**Check for:**
- [ ] Deployment for commit `66949ad3` or `1218966f`
- [ ] Status: Building / Deploying / Active / Failed

**If deployment EXISTS:**
- **Status = Building/Deploying:** Wait for completion
- **Status = Active:** Check if it's the active deployment (green checkmark)
- **Status = Failed:** Click on it → "Logs" tab → Copy error message

**If deployment DOES NOT EXIST:**
- Railway hasn't detected GitHub push
- Proceed to Step 2

---

### Step 2: Check GitHub Integration

**Navigate to:**
1. Railway → xBOT Project → xBOT Service → **"Settings"** tab
2. Scroll to **"GitHub"** section

**Verify:**
- [ ] **Repository:** `jatenner/xBOT` ✅/❌
- [ ] **Branch:** `main` ✅/❌
- [ ] **Auto Deploy:** **ENABLED** ✅/❌
- [ ] **Root Directory:** `/` (or correct path) ✅/❌

**If Auto-Deploy is DISABLED:**
1. Click **"Enable Auto Deploy"** or toggle switch
2. Select branch: `main`
3. Save settings
4. Railway should trigger deployment automatically

**If GitHub NOT CONNECTED:**
1. Click **"Connect GitHub"**
2. Authorize Railway
3. Select repository: `jatenner/xBOT`
4. Select branch: `main`
5. Enable auto-deploy
6. Save

---

### Step 3: Manual Deployment Trigger

**If Auto-Deploy Doesn't Work:**

**Option A: Redeploy Latest**
1. Deployments tab → Find latest deployment
2. Click **"Redeploy"** (three dots menu)
3. Monitor build logs

**Option B: Trigger New Deploy**
1. Click **"Deploy"** button (top right)
2. Select source: **"GitHub"**
3. Select branch: **"main"**
4. Click **"Deploy"**
5. Monitor build logs

**Option C: Check Build Logs**
1. If deployment exists but failed
2. Click on failed deployment
3. Open **"Logs"** tab
4. Look for errors:
   - Build timeout
   - TypeScript errors (should be fixed now)
   - Missing dependencies
   - Environment variable issues

---

## 📊 Verification After Deployment

### Step 1: Check Status Endpoint

```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool
```

**Success Criteria:**
- ✅ `git_sha` contains `66949ad3` or `1218966f`
- ✅ `app_version` contains `66949ad3` or `1218966f`
- ✅ `railway_git_commit_sha` contains `66949ad3` or `1218966f`
- ✅ `boot_time` changed (new timestamp)

**Expected Response:**
```json
{
  "git_sha": "66949ad3dd1af04a5094d712ff78932efb72713e",
  "app_version": "66949ad3dd1af04a5094d712ff78932efb72713e",
  "railway_git_commit_sha": "66949ad3dd1af04a5094d712ff78932efb72713e",
  "boot_time": "2026-01-15T00:XX:XX.XXXZ"  // NEW timestamp
}
```

---

### Step 2: Verify Gates Are Active

```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
```

**Expected Output:**
- POST_ATTEMPT events show `app_version: 66949ad3...` (not "unknown")
- Gate blocks show proper categorization
- Statistics show gate activity

---

### Step 3: Test Golden Reply

```bash
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=5
```

**Expected:**
- Finds valid root tweet
- Passes all gates
- Posts successfully
- Shows POST_SUCCESS event with correct app_version

---

## 🚨 Current Blocker

**Deployment:** Railway hasn't deployed latest commits yet.

**Root Cause:** Unknown - need to check Railway dashboard:
1. Are deployments being created?
2. Are they failing? (check logs)
3. Is auto-deploy enabled?
4. Is GitHub integration working?

**Action Required:** Check Railway dashboard and trigger deployment manually if needed.

---

## 📝 Next Single Fix

**Once Railway deploys `66949ad3` or `1218966f`:**
1. Verify status endpoint shows new SHA
2. Run gate verification scripts
3. Test golden reply
4. Monitor gate blocks for 24h
5. Document gate effectiveness

---

## 🔧 Monitoring Script

Use this to monitor deployment:

```bash
./scripts/monitor-deployment.sh
```

Or manually check:
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool | grep -E "git_sha|app_version|boot_time"
```
