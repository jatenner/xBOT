# Railway Deployment Fix - Exact Click Path

**Current Issue:** Railway deploying from local directory instead of GitHub main

**Evidence:**
- Production `git_sha`/`app_version`: `001ec542` (local)
- Production `railway_git_commit_sha`: `fdf00f1e` (old)
- GitHub `origin/main`: `66949ad3` (latest)

---

## 30-Second Click Path (REQUIRED - Cannot be automated)

**Railway Dashboard → Project XBOT → Service xBOT:**

### Step 1: Verify Domain Mapping (5 seconds)
1. Click **Settings** tab (left sidebar)
2. Click **Domains** section
3. Verify: `xbot-production-844b.up.railway.app` is listed
4. Verify: Service name shows "xBOT"

**Confirmation:** "Domain xbot-production-844b.up.railway.app attached to xBOT service" ✅

---

### Step 2: Switch Source to GitHub (10 seconds)
1. In **Settings** tab, find **Source** section (or **GitHub** section)
2. If source shows **"Local Directory"** or **"CLI"**:
   - Click **"Connect GitHub"** or **"Change Source"** button
   - Select repository: `jatenner/xBOT`
   - Select branch: `main`
   - Click **Save**
3. If source already shows **"GitHub"**:
   - Verify repository: `jatenner/xBOT`
   - Verify branch: `main`
   - If different, change to `main` and **Save**

**Confirmation:** "Source: GitHub, repo jatenner/xBOT, branch main" ✅

---

### Step 3: Enable Auto Deploy (5 seconds)
1. In **Settings** tab, find **GitHub** section
2. Find **Auto Deploy** toggle/checkbox
3. If **DISABLED**: Toggle to **ENABLED**
4. Ensure branch is set to `main`
5. Click **Save**

**Confirmation:** "Auto Deploy: ENABLED, branch main" ✅

---

### Step 4: Trigger GitHub Deployment (10 seconds)
1. Click **Deployments** tab (left sidebar)
2. Click **"Deploy"** button (top right, blue button)
3. In deployment modal:
   - Select source: **"GitHub"** (NOT "Local Directory")
   - Select branch: **"main"**
   - Click **"Deploy"**
4. Monitor build logs (will open automatically)

**Confirmation:** "Deployment triggered from GitHub main" ✅

---

## Proof Commands (Run After Click Path)

**After completing steps 1-4, run these commands:**

```bash
# 1. Verify deployment swap (poll until SHA changes)
./scripts/poll-deployment-status.sh

# OR manually:
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool | grep -E "(git_sha|app_version|railway_git_commit_sha|boot_time)"

# 2. Verify gates are live
railway run -s xBOT -- pnpm exec tsx scripts/prove-gates-live.ts

# 3. Verify reply quality gates
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
```

**Success Criteria:**
- ✅ `railway_git_commit_sha` = `66949ad3...` (or newer)
- ✅ `boot_time` changed (new timestamp)
- ✅ POST_ATTEMPT events exist
- ✅ Gate blocks detected

---

## If Railway CLI Supports Source Management

**Try this first (may not work):**

```bash
# Check if Railway CLI can show source info
railway service --help

# If source commands exist, try:
railway source --help
railway github --help
```

**If CLI doesn't support source management, use click path above.**

---

## Expected Timeline

- **Click path:** 30 seconds
- **Deployment:** 3-5 minutes
- **Verification:** 2 minutes
- **Total:** ~5-7 minutes
