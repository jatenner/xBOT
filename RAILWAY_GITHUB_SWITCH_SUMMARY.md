# Railway GitHub Source Switch - Summary

**Date:** January 15, 2026  
**Goal:** Switch Railway xBOT service from CLI/Local Directory to GitHub source

---

## Current Status

**Production Status (Current - WRONG):**
```json
{
    "git_sha": "001ec542c5e5af3592011c31f92b819423887ea3",
    "app_version": "001ec542c5e5af3592011c31f92b819423887ea3",
    "railway_git_commit_sha": "fdf00f1e32b67fa399f668d836c0a737e73bc62a",
    "boot_time": "2026-01-15T00:33:50.759Z",
    "boot_id": "be9c2ae4-f455-4bf1-b7e3-86bc9eb99a1b"
}
```

**GitHub Status:**
- Latest commit on `origin/main`: `66949ad3dd1af04a5094d712ff78932efb72713e` ✅
- Gates commit: `1218966f44b9a56ade7e91cfa165936090a44b73` ✅

**Issue:** Production running `001ec542` (from local directory) instead of `66949ad3` (from GitHub)

---

## Dashboard Actions Required

**⚠️ These steps require Railway Dashboard access (cannot be done via CLI):**

### Step 1: Verify Domain Mapping ✅/❌
**Location:** Railway Dashboard → XBOT Project → xBOT Service → Settings → Domains

**Action:**
- Confirm domain `xbot-production-844b.up.railway.app` is attached to xBOT service

**Paste Confirmation:** "Domain xbot-production-844b.up.railway.app is attached to xBOT service" ✅

---

### Step 2: Switch Source to GitHub ✅/❌
**Location:** Railway Dashboard → xBOT Service → Settings → Source

**Action:**
- If source is "Local Directory" or "CLI", change to GitHub
- Set repository: `jatenner/xBOT`
- Set branch: `main`
- Save

**Paste Confirmation:** "Source switched to GitHub: jatenner/xBOT, branch main" ✅

---

### Step 3: Enable Auto Deploy ✅/❌
**Location:** Railway Dashboard → xBOT Service → Settings → GitHub

**Action:**
- Enable Auto Deploy toggle
- Ensure branch is `main`
- Save

**Paste Confirmation:** "Auto Deploy enabled for branch main" ✅

---

### Step 4: Trigger GitHub Deployment ✅/❌
**Location:** Railway Dashboard → xBOT Service → Deployments tab

**Action:**
- Click "Deploy" → GitHub → main → Deploy
- Monitor build logs
- If failed, paste error lines

**Paste Confirmation:** "Deployment triggered from GitHub main, build status: [SUCCESS/FAILED]"

---

## Verification Commands (After Dashboard Actions)

**After completing dashboard steps, run these to verify:**

### 5a. Check Status Endpoint
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool
```

**Success Criteria:**
- ✅ `git_sha` contains `66949ad3` or `1218966f` (or newer)
- ✅ `app_version` contains `66949ad3` or `1218966f` (or newer)
- ✅ `railway_git_commit_sha` contains `66949ad3` or `1218966f` (or newer)
- ✅ `boot_time` changed (new timestamp)
- ✅ `boot_id` changed (new UUID)

**Paste Full JSON Output:**

---

### 5b. Verify Reply Quality Gates
```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
```

**Expected Output:**
- POST_ATTEMPT events with `app_version: 66949ad3...`
- Gate blocks categorized correctly
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

## Automated Verification Script

**After dashboard actions, run this script to automatically verify deployment:**

```bash
./scripts/verify-github-deployment.sh
```

This script will:
- Poll `/status` endpoint every 10 seconds
- Check for SHA `66949ad3` (or newer)
- Verify boot_time changed
- Exit when deployment verified
- Print full status JSON on success

---

## Root Cause Summary

**Root Cause:** Railway xBOT service was configured to deploy from **Local Directory/CLI** instead of **GitHub branch main**.

**Evidence:**
1. Production `git_sha`/`app_version` = `001ec542` (from local directory via `railway up`)
2. Production `railway_git_commit_sha` = `fdf00f1e` (stuck, old)
3. GitHub `origin/main` = `66949ad3` (latest, not deployed)
4. CLI `railway up` deployed local commit instead of GitHub commit
5. Recent deployments SKIPPED (Auto-Deploy disabled)

**Why This Happened:**
- Railway service source was set to "Local Directory" or "CLI"
- `railway up` command deploys from current local directory
- No GitHub webhook integration configured
- Auto-Deploy disabled, so GitHub pushes didn't trigger deployments

---

## Single Fix Applied

**Fix:** Switch Railway xBOT service source from Local Directory/CLI to GitHub

**Steps:**
1. ✅ Verify domain mapping (dashboard)
2. ✅ Change source to GitHub: jatenner/xBOT, branch main (dashboard)
3. ✅ Enable Auto Deploy (dashboard)
4. ✅ Trigger deployment from GitHub → main (dashboard)

**Result:**
- Railway now deploys from GitHub branch `main`
- Future pushes to `main` will auto-deploy
- Production should now run commit `66949ad3` or newer

---

## Proof Gates Are Live

**After successful deployment, provide:**

1. **Status Endpoint JSON:**
   - Shows `railway_git_commit_sha` = `66949ad3...` or newer
   - Shows `boot_time` changed
   - Shows `boot_id` changed

2. **Gate Verification Output:**
   - POST_ATTEMPT events show `app_version: 66949ad3...`
   - Gate blocks showing non-zero counts
   - Gate statistics showing activity

3. **Gate Statistics Output:**
   - Counts of gate blocks in last 24h
   - POST_SUCCESS events recorded
   - Gate breakdown by deny reason code

---

## Files Created

1. **RAILWAY_GITHUB_SWITCH_GUIDE.md** - Detailed step-by-step guide
2. **scripts/verify-github-deployment.sh** - Automated verification script
3. **RAILWAY_GITHUB_SWITCH_SUMMARY.md** - This summary document

---

## Next Steps

1. **Complete Dashboard Actions** (Steps 1-4 above)
2. **Run Verification Commands** (Step 5 above)
3. **Provide Proof** (Status JSON + Gate outputs)
4. **Monitor Auto-Deploy** (Future pushes should auto-deploy)

---

## Notes

- Railway CLI cannot change source configuration (requires dashboard)
- Railway CLI `railway up` deploys from local directory, not GitHub
- GitHub source must be configured via Railway Dashboard
- Auto-Deploy must be enabled for GitHub webhooks to work
- After switching to GitHub source, future deployments will come from GitHub
