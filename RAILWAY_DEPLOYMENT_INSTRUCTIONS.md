# Railway Deployment Instructions

**Current Status:** Railway running commit `fdf00f1e` (OLD)  
**Target:** Deploy commit `1218966f` (NEW with gates)  
**Status Endpoint:** https://xbot-production-844b.up.railway.app/status

---

## Current Production Status

```json
{
  "git_sha": "9b4d1e844ce4b69044fda876287649cb868a3607",
  "app_version": "9b4d1e844ce4b69044fda876287649cb868a3607",
  "railway_git_commit_sha": "fdf00f1e32b67fa399f668d836c0a737e73bc62a",
  "boot_time": "2026-01-13T23:22:39.375Z"
}
```

**Issue:** Railway is running old commit `fdf00f1e`, not latest `1218966f`.

---

## Step 1: Check Railway Dashboard

### Navigate to Deployments Tab

1. Go to: https://railway.app
2. Select **xBOT** project
3. Select **xBOT** service
4. Click **"Deployments"** tab (or "Activity" tab)

### Check for Commit 1218966f

Look for a deployment with commit hash starting with `1218966f`:

- ✅ **If deployment EXISTS:**
  - Check status: "Building", "Deploying", "Active", or "Failed"
  - If "Failed": Click on it → Check "Logs" tab → Copy error message
  - If "Active": Verify it's the active deployment (green checkmark)
  - If "Building/Deploying": Wait for completion

- ❌ **If deployment DOES NOT EXIST:**
  - Railway hasn't detected the GitHub push
  - Proceed to Step 2

---

## Step 2: Check GitHub Integration

### Verify Auto-Deploy Settings

1. In Railway dashboard → **xBOT** service
2. Go to **"Settings"** tab
3. Check **"GitHub"** section:
   - ✅ **Repository connected?** Should show `jatenner/xBOT`
   - ✅ **Branch:** Should be `main`
   - ✅ **Auto Deploy:** Should be **ENABLED**
   - ✅ **Root Directory:** Should be `/` (or correct path)

### If Auto-Deploy is Disabled

1. Click **"Enable Auto Deploy"** or toggle switch
2. Select branch: `main`
3. Save settings
4. Railway should trigger deployment automatically

### If GitHub Not Connected

1. Click **"Connect GitHub"**
2. Authorize Railway
3. Select repository: `jatenner/xBOT`
4. Select branch: `main`
5. Enable auto-deploy
6. Save

---

## Step 3: Manual Deployment Trigger

### Option A: Redeploy Latest

1. In Railway dashboard → **xBOT** service
2. Go to **"Deployments"** tab
3. Find the latest deployment (even if old)
4. Click **"Redeploy"** button (three dots menu)
5. Wait for build/deploy to complete

### Option B: Trigger New Deploy

1. In Railway dashboard → **xBOT** service
2. Click **"Deploy"** button (top right)
3. Select source: **"GitHub"**
4. Select branch: **"main"**
5. Click **"Deploy"**
6. Monitor build logs

### Option C: Force Push (if needed)

If Railway still doesn't detect the commit:

```bash
# Create empty commit to trigger webhook
git commit --allow-empty -m "trigger: Force Railway deployment"
git push origin main
```

---

## Step 4: Monitor Deployment

### Poll Status Endpoint

Run this command to monitor deployment:

```bash
# Monitor script (polls every 10 seconds)
./scripts/monitor-deployment.sh

# Or manual check:
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool | grep -E "git_sha|app_version|boot_time"
```

### Success Criteria

Deployment is successful when:

1. ✅ `git_sha` or `app_version` contains `1218966f`
2. ✅ `railway_git_commit_sha` contains `1218966f`
3. ✅ `boot_time` changed (new container started)

Example successful response:
```json
{
  "git_sha": "1218966f44b9a56ade7e91cfa165936090a44b73",
  "app_version": "1218966f44b9a56ade7e91cfa165936090a44b73",
  "railway_git_commit_sha": "1218966f44b9a56ade7e91cfa165936090a44b73",
  "boot_time": "2026-01-15T00:XX:XX.XXXZ"  // NEW timestamp
}
```

---

## Step 5: Verify Gates Are Active

### After Deployment Confirmed

1. **Check Gate Statistics:**
   ```bash
   railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
   ```

2. **Check POST_ATTEMPT Events:**
   ```bash
   railway run -s xBOT -- pnpm exec tsx scripts/query-gate-stats.ts
   ```

3. **Test Golden Reply:**
   ```bash
   railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=5
   ```

### Expected Outputs

**Gate Statistics (after activity):**
```
NON_ROOT: X
THREAD_REPLY_FORBIDDEN: X
LOW_SIGNAL_TARGET: X
EMOJI_SPAM_TARGET: X
PARODY_OR_BOT_SIGNAL: X
NON_HEALTH_TOPIC: X
UNGROUNDED_REPLY: X
POST_SUCCESS: X
```

**POST_ATTEMPT Events:**
- Should show `app_version: 1218966f...` (not "unknown")
- Should show `gate_result: PASS` or `BLOCK`
- Should show `deny_reason_code` if blocked

---

## Troubleshooting

### If Deployment Fails

1. **Check Build Logs:**
   - Railway dashboard → Deployment → "Logs" tab
   - Look for errors: build failures, dependency issues, etc.

2. **Common Issues:**
   - Build timeout: Increase build timeout in Railway settings
   - Dependency errors: Check `package.json` and `pnpm-lock.yaml`
   - TypeScript errors: Run `pnpm build` locally first
   - Environment variables: Ensure all required vars are set

3. **Check Railway Status:**
   - Visit: https://status.railway.app
   - Check for Railway service outages

### If Auto-Deploy Doesn't Trigger

1. **Verify GitHub Webhook:**
   - GitHub repo → Settings → Webhooks
   - Look for Railway webhook
   - Check recent deliveries for errors

2. **Manual Trigger:**
   - Use Railway dashboard "Deploy" button
   - Or create empty commit to trigger webhook

---

## Current Blocker

**Deployment:** Railway hasn't deployed commit `1218966f` yet.

**Action Required:**
1. Check Railway dashboard for deployment status
2. Verify GitHub integration and auto-deploy settings
3. Manually trigger deployment if needed
4. Monitor status endpoint until `1218966f` is live

---

## Next Single Fix

**Once `1218966f` is deployed:**
1. Verify gates are active (run verification scripts)
2. Test golden reply
3. Monitor gate blocks for 24h
4. Document gate effectiveness
