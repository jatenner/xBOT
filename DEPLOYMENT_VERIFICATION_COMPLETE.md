# Railway GitHub Deployment + Gates Verification - Complete

**Date:** January 15, 2026  
**Progress:** 0% → Ready for Dashboard Actions

---

## TASK 1: Repo + Commit State ✅

**Summary:**
- **Local HEAD:** `66949ad3`
- **origin/main HEAD:** `66949ad3`
- **Gates commit present:** ✅ `1218966f`
- **TS fixes present:** ✅ `66949ad3`
- **Status:** Commits are present and synced

**Output:**
```
Local HEAD: 66949ad3
origin/main HEAD: 66949ad3
Commits on origin/main:
66949ad3 fix: Resolve TypeScript compilation errors blocking Railway deployment
1218966f feat: Add reply quality gates, POST_ATTEMPT logging, and verification scripts
1382c008 feat: Add root-only invariant hard gates

✅ Commits 66949ad3 and 1218966f present: 2 found
```

---

## TASK 2: Production Mismatch Confirmed ✅

**Key Fields:**
- `git_sha`: `001ec542` (WRONG - from local directory)
- `app_version`: `001ec542` (WRONG - from local directory)
- `railway_git_commit_sha`: `fdf00f1e` (WRONG - stuck, old)
- `boot_time`: `2026-01-15T00:33:50.759Z`
- `boot_id`: `be9c2ae4...`
- `railway_service_name`: `xBOT`

**Diagnosis:**
Production is running commit `001ec542` (older commit from local directory) while GitHub `origin/main` has `66949ad3` (latest with gates). The `railway_git_commit_sha` shows `fdf00f1e` (even older), confirming Railway is NOT deploying from GitHub. The boot_time changed recently (from `2026-01-13` to `2026-01-15T00:33:50.759Z`), indicating a recent deployment, but it deployed the wrong commit from local directory instead of GitHub.

---

## TASK 3: Dashboard Actions Required (2-Minute Checklist)

**⚠️ These steps require Railway Dashboard access:**

### A) Verify Domain Mapping
**Location:** Railway Dashboard → XBOT Project → xBOT Service → Settings → Domains

**Action:** Confirm `xbot-production-844b.up.railway.app` is attached to xBOT service

**Confirmation:** "Domain xbot-production-844b.up.railway.app is attached to xBOT service" ✅

---

### B) Switch Source to GitHub
**Location:** Railway Dashboard → xBOT Service → Settings → Source (or GitHub)

**Action:**
1. If source is "Local Directory" or "CLI", change to GitHub
2. Set repository: `jatenner/xBOT`
3. Set branch: `main`
4. Save

**Confirmation:** "Source switched to GitHub: jatenner/xBOT, branch main" ✅

---

### C) Enable Auto Deploy
**Location:** Railway Dashboard → xBOT Service → Settings → GitHub

**Action:**
1. Enable Auto Deploy toggle
2. Ensure branch is `main`
3. Save

**Confirmation:** "Auto Deploy enabled for branch main" ✅

---

### D) Trigger GitHub Deployment
**Location:** Railway Dashboard → xBOT Service → Deployments tab

**Action:**
1. Click "Deploy" → GitHub → main → Deploy
2. Monitor build logs
3. If failed, paste error lines

**Confirmation:** "Deployment triggered from GitHub main, build status: [SUCCESS/FAILED]"

---

### Success Proof Condition

After deployment, `/status` must show:
- ✅ `railway_git_commit_sha` = `66949ad3...` (or newer)
- ✅ `git_sha`/`app_version` = `66949ad3...` (or newer)
- ✅ `boot_time` changed (new timestamp)
- ✅ `boot_id` changed (new UUID)

---

## TASK 4: Post-Deploy Verification Bundle

**After dashboard actions complete, run these commands:**

### 4a. Verify Status Endpoint
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool
```

**Success Criteria:**
- `railway_git_commit_sha` contains `66949ad3` or `1218966f` (or newer)
- `boot_time` changed
- `boot_id` changed

**Paste Full JSON Output:**

---

### 4b. Verify Reply Quality Gates
```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
```

**What "Gates Live" Looks Like:**
- ✅ POST_ATTEMPT events exist in `system_events`
- ✅ Non-zero blocks for: NON_ROOT, THREAD_REPLY_FORBIDDEN, LOW_SIGNAL_TARGET, EMOJI_SPAM_TARGET, PARODY_OR_BOT_SIGNAL, NON_HEALTH_TOPIC, UNGROUNDED_REPLY
- ✅ Recent gate blocks show `app_version: 66949ad3...` (not "unknown")

**Paste Full Output:**

---

### 4c. Query Gate Statistics
```bash
railway run -s xBOT -- pnpm exec tsx scripts/query-gate-stats.ts
```

**Paste Full Output:**

---

## TASK 5: Prove Posting with Real-World Confirmation

**Once gates are verified live:**

### 5a. Post Golden Reply
```bash
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=15
```

**Paste Full Output:**

---

### 5b. Verify POST_SUCCESS
```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts
```

**If POST_SUCCESS appears:**
- Output tweet URL: `https://x.com/i/status/<posted_reply_tweet_id>`
- Tell user to check @SignalAndSynapse replies/timeline immediately

**Paste Full Output:**

---

## TASK 6: If No POST_SUCCESS, Return One Next Fix

**If posting fails:**
```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts --decisionId=<decision_id>
```

**Single Next Fix:**
- Identify top failure reason from POST_FAILED/system_events
- Recommend smallest change to unblock
- Example: "Top failure: CONSENT_WALL (5/10 attempts). Fix: Wait 24h or use --tweetId=<recent_root_tweet>"

---

## Root Cause Summary

**Root Cause:** Railway xBOT service was configured to deploy from **Local Directory/CLI** instead of **GitHub branch main**.

**Evidence:**
- Production `git_sha`/`app_version` = `001ec542` (from local directory via `railway up`)
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

4. **Golden Reply Test:**
   - POST_SUCCESS event recorded
   - Tweet URL: `https://x.com/i/status/<posted_reply_tweet_id>`
   - User can verify on timeline

---

## Progress: 0% → Ready for Dashboard Actions

**What's Deployed:**
- ✅ Code ready: Commits `66949ad3` and `1218966f` on `origin/main`
- ❌ Production: Running `001ec542` (local) instead of `66949ad3` (GitHub)
- ❌ Railway: Deploying from local directory, not GitHub

**What's Blocked:**
- ⏳ Waiting for dashboard actions (Steps A-D)
- ⏳ Waiting for deployment verification
- ⏳ Waiting for gate verification

**Next Single Action:**
1. Complete dashboard actions (Steps A-D)
2. Run verification commands (Task 4)
3. Run golden reply test (Task 5)
4. Provide proof outputs

---

## Quick Reference Commands

```bash
# Check status
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool

# Verify gates
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts

# Query gate stats
railway run -s xBOT -- pnpm exec tsx scripts/query-gate-stats.ts

# Post golden reply
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=15

# Verify post success
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts
```

---

## Expected Timeline

1. **Dashboard Actions:** 2 minutes
2. **Deployment:** 3-5 minutes
3. **Verification:** 2 minutes
4. **Golden Reply Test:** 2-5 minutes
5. **Total:** ~10-15 minutes
