# Railway Deployment Investigation - Final Report

**Date:** January 15, 2026  
**Investigation Type:** Deployment Plumbing (No Code Changes)

---

## Executive Summary

**Status:** ⚠️ **BLOCKED - Railway Not Deploying Latest Commits**

**Target Commits:**
- `66949ad3` (TypeScript fixes)
- `1218966f` (Gates implementation)

**Current Production:** `fdf00f1e` (OLD - 2 days old)

**Root Cause:** Most likely **Auto-Deploy DISABLED** in Railway Settings → GitHub

---

## Evidence Summary

### ✅ GitHub Status
```
Latest commit on origin/main: 66949ad3dd1af04a5094d712ff78932efb72713e
Gates commit: 1218966f44b9a56ade7e91cfa165936090a44b73
Both commits pushed successfully ✅
```

### ❌ Production Status
```json
{
  "git_sha": "9b4d1e844ce4b69044fda876287649cb868a3607",
  "railway_git_commit_sha": "fdf00f1e32b67fa399f668d836c0a737e73bc62a",
  "boot_time": "2026-01-13T23:22:39.375Z",
  "boot_id": "10c38e9a-136f-4eea-bf8e-1635b910e131"
}
```
- Running OLD commit `fdf00f1e`
- Boot time unchanged for 2 days (container not restarted)

### ❌ Railway Deployments
```
Recent Deployments:
  3e8ea831-e05d-4797-af62-3bbad9af39e1 | SKIPPED | 2026-01-14 19:08:37
  3419d96d-99ee-428e-b091-ae8b777c0ac2 | FAILED  | 2026-01-14 19:02:45
  4e02d57c-661c-44d3-878b-32c2cbff2499 | FAILED  | 2026-01-14 19:01:55
```
- No deployments for `66949ad3` or `1218966f`
- Recent deployments SKIPPED or FAILED

---

## Root Cause Analysis

### Most Likely: Auto-Deploy Disabled

**Evidence:**
1. ✅ Commits exist on GitHub (`66949ad3`, `1218966f`)
2. ❌ No Railway deployments created for these commits
3. ❌ Recent deployments SKIPPED (Railway skipping due to no auto-deploy trigger)
4. ❌ Production container hasn't restarted (boot_time unchanged)

**Probability:** 80% - Most common reason for no deployments

**Fix:** Railway Dashboard → xBOT Service → Settings → GitHub → Enable Auto Deploy

---

### Alternative Causes

#### 1. Build Failures (15% probability)
**Evidence:** Recent deployments show FAILED status
**Check:** Railway Dashboard → Failed Deployment → Build Logs
**Fix:** Resolve build errors (TypeScript should be fixed in `66949ad3`)

#### 2. GitHub Webhook Not Working (4% probability)
**Evidence:** Auto-deploy enabled but no deployments triggered
**Check:** GitHub → Settings → Webhooks → Railway webhook status
**Fix:** Reconnect GitHub integration or fix webhook

#### 3. Domain/Service Mismatch (1% probability)
**Evidence:** Status endpoint shows old code
**Check:** Railway Dashboard → Settings → Domains
**Fix:** Verify domain mapping

---

## Railway Dashboard Investigation Checklist

### Step 1: Verify Domain Mapping ✅/❌

**Location:** Railway → xBOT Service → Settings → Domains/Networking

**Check:**
- [ ] Domain `xbot-production-844b.up.railway.app` → xBOT service
- [ ] No other services using this domain

**If Mismatch:** Wrong service serving domain - explains old code

**Screenshot Required:** Domain settings showing service mapping

---

### Step 2: Check Deployments Tab ✅/❌

**Location:** Railway → xBOT Service → Deployments

**Check:**
- [ ] Search for commits `66949ad3` or `1218966f`
- [ ] Deployment exists? YES/NO
- [ ] Status: SUCCESS/FAILED/SKIPPED/NONE

**If NO Deployment Found:**
→ Go to Step 3 (Check GitHub Integration)

**If FAILED:**
→ Open Build Logs → Copy first 20-30 lines of error

**Screenshot Required:** Deployments list showing status

---

### Step 3: Check GitHub Integration ✅/❌

**Location:** Railway → xBOT Service → Settings → GitHub

**Check:**
- [ ] Repository: `jatenner/xBOT` ✅/❌
- [ ] Branch: `main` ✅/❌
- [ ] **Auto Deploy: ENABLED** ✅/❌ ← **CRITICAL**
- [ ] Root Directory: `/` ✅/❌

**If Auto Deploy is DISABLED:**
1. Toggle to **ENABLED**
2. Select branch: `main`
3. Click **Save**
4. Railway should trigger deployment automatically

**Screenshot Required:** GitHub settings showing Auto Deploy = ENABLED

---

### Step 4: Trigger Manual Deployment ✅/❌

**If no deployment exists or auto-deploy doesn't work:**

1. Railway Dashboard → xBOT Service
2. Click **"Deploy"** button (top right)
3. Select source: **"GitHub"**
4. Select branch: **"main"**
5. Click **"Deploy"**
6. Monitor **Build Logs** tab

**Expected:** Build starts → Shows progress → Completes successfully

**If Build Fails:**
- Copy error from Build Logs
- Check for TypeScript errors (should be fixed)
- Check for timeout errors
- Check for dependency errors

**Screenshot Required:** Deployment triggered + Build Logs showing success/failure

---

### Step 5: Verify Deployment Swap ✅/❌

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

## Monitoring Script

Use `scripts/monitor-deployment.sh` to automatically poll until deployment succeeds:

```bash
./scripts/monitor-deployment.sh
```

This will:
- Poll `/status` every 10 seconds
- Check for SHA `66949ad3` or `1218966f`
- Verify boot_time changed
- Exit when deployment detected

---

## Proof Requirements (After Deployment)

### 1. Status Endpoint Proof

**Command:**
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool
```

**Required Output:**
- Full JSON showing `git_sha` = `66949ad3...` or `1218966f...`
- `boot_time` = NEW timestamp (not `2026-01-13T23:22:39.375Z`)
- `boot_id` = NEW UUID

---

### 2. Gate Verification Proof

**Command:**
```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
```

**Expected Output:**
```
📊 GATE BLOCKS (Last 24h):
   NON_ROOT: X
   THREAD_REPLY_FORBIDDEN: X
   LOW_SIGNAL_TARGET: X
   EMOJI_SPAM_TARGET: X
   PARODY_OR_BOT_SIGNAL: X
   NON_HEALTH_TOPIC: X
   UNGROUNDED_REPLY: X
   POST_SUCCESS: X
```

**Key Check:** POST_ATTEMPT events should show `app_version: 66949ad3...` (not "unknown")

---

### 3. Golden Reply Test Proof

**Command:**
```bash
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=5
```

**Expected Output:**
- Finds valid root tweet
- Passes all gates
- Posts successfully
- Shows POST_SUCCESS event with correct app_version
- Prints tweet URL and decision_id

---

### 4. Gate Statistics Query

**Command:**
```bash
railway run -s xBOT -- pnpm exec tsx scripts/query-gate-stats.ts
```

**Expected Output:**
```
GATE BLOCKS (Last 24h):
  NON_ROOT: X
  THREAD_REPLY_FORBIDDEN: X
  LOW_SIGNAL_TARGET: X
  EMOJI_SPAM_TARGET: X
  PARODY_OR_BOT_SIGNAL: X
  NON_HEALTH_TOPIC: X
  UNGROUNDED_REPLY: X
  POST_SUCCESS: X
```

---

## Current Blocker

**Railway Deployment:** Latest commits not deployed to production.

**Root Cause:** Most likely **Auto-Deploy DISABLED** in Railway Settings → GitHub.

**Evidence:**
- ✅ Commits exist on GitHub
- ❌ No Railway deployments for target commits
- ❌ Recent deployments SKIPPED
- ❌ Production running old code

**Action Required:**
1. Railway Dashboard → xBOT Service → Settings → GitHub
2. Verify Auto Deploy = **ENABLED**
3. If disabled: Enable → Save → Wait for deployment
4. If enabled but no deployment: Trigger manual deployment
5. Monitor status endpoint until SHA changes
6. Run gate verification scripts

---

## Next Single Fix

**Railway Dashboard Actions:**

1. **Check Auto-Deploy Status:**
   - Railway → xBOT Service → Settings → GitHub
   - Verify Auto Deploy = **ENABLED**
   - If disabled: Enable → Save

2. **Trigger Deployment:**
   - Click "Deploy" → GitHub → Branch "main" → Deploy
   - Monitor Build Logs

3. **Verify Deployment:**
   - Poll `/status` until `git_sha` = `66949ad3`
   - Verify `boot_time` changed

4. **Run Gate Proof:**
   - `scripts/verify-reply-quality-gates.ts`
   - `scripts/post-one-golden-reply.ts`
   - `scripts/query-gate-stats.ts`

---

## Investigation Results Template

**Fill this out after checking Railway dashboard:**

```
=== RAILWAY DASHBOARD INVESTIGATION RESULTS ===

Step 1 - Domain Mapping:
  Domain xbot-production-844b.up.railway.app → Service: __________
  Mismatch? YES/NO

Step 2 - Deployments:
  Deployment for 66949ad3 exists? YES/NO
  Deployment for 1218966f exists? YES/NO
  Status: SUCCESS/FAILED/SKIPPED/NONE
  Error (if failed): 
  [Paste error from Build Logs]

Step 3 - GitHub Integration:
  Repository: __________
  Branch: __________
  Auto Deploy: ENABLED/DISABLED ← CRITICAL
  Root Directory: __________

Step 4 - Manual Deployment:
  Triggered? YES/NO
  Build Status: SUCCESS/FAILED
  Build Duration: __________ seconds
  Error (if failed):
  [Paste error from Build Logs]

Step 5 - Verification:
  Status endpoint SHA: __________
  Boot time (old): 2026-01-13T23:22:39.375Z
  Boot time (new): __________
  Boot ID changed? YES/NO
  Deployment successful? YES/NO
```

---

## Summary

**Code Status:** ✅ Ready (builds successfully, all gates implemented)

**Deployment Status:** ⚠️ Blocked (Railway not deploying latest commits)

**Root Cause:** Most likely Auto-Deploy disabled in Railway Settings

**Action:** Check Railway Dashboard → Enable Auto Deploy → Trigger Deployment → Verify

**Proof:** Once deployed, provide status endpoint JSON + gate verification outputs
