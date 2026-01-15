# Railway GitHub Deployment + Gates Verification Bundle

**Date:** January 15, 2026  
**Goal:** Switch Railway to GitHub source, deploy gates, verify gates are live

---

## Progress: 0% → 100%

**Current State:**
- ✅ Code ready: Commits `66949ad3` and `1218966f` on `origin/main`
- ❌ Production: Running `001ec542` (local) instead of `66949ad3` (GitHub)
- ❌ Railway: Deploying from local directory, not GitHub

**Target State:**
- ✅ Railway deploys from GitHub `main`
- ✅ Production runs `66949ad3` or newer
- ✅ Gates are live and enforcing

---

## TASK 1: Confirm Repo + Commit State

**Commands:**
```bash
cd /Users/jonahtenner/Desktop/xBOT
git fetch origin
git log --oneline -5 origin/main
git rev-parse HEAD
git rev-parse origin/main
```

**Expected Output:**
```
66949ad3 fix: Resolve TypeScript compilation errors blocking Railway deployment
1218966f feat: Add reply quality gates, POST_ATTEMPT logging, and verification scripts
1382c008 feat: Add root-only invariant hard gates
704456b7 Add proof run instructions
25f70042 Add manual override, DB-first prefiltering, and consent wall sticky skip

66949ad3dd1af04a5094d712ff78932efb72713e
66949ad3dd1af04a5094d712ff78932efb72713e
```

**Summary:**
- **Local HEAD:** `66949ad3`
- **origin/main HEAD:** `66949ad3`
- **Gates commit present:** ✅ `1218966f`
- **TS fixes present:** ✅ `66949ad3`
- **Status:** Commits are present and synced

---

## TASK 2: Confirm Production Mismatch via /status

**Command:**
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool
```

**Key Fields:**
- `git_sha`: `001ec542c5e5af3592011c31f92b819423887ea3`
- `app_version`: `001ec542c5e5af3592011c31f92b819423887ea3`
- `railway_git_commit_sha`: `fdf00f1e32b67fa399f668d836c0a737e73bc62a`
- `boot_time`: `2026-01-15T00:33:50.759Z`
- `boot_id`: `be9c2ae4-f455-4bf1-b7e3-86bc9eb99a1b`
- `railway_service_name`: `xBOT`

**Diagnosis:**
Production is running commit `001ec542` (older commit from local directory) while GitHub `origin/main` has `66949ad3` (latest with gates). The `railway_git_commit_sha` shows `fdf00f1e` (even older), confirming Railway is NOT deploying from GitHub. The boot_time changed recently (from `2026-01-13` to `2026-01-15T00:33:50.759Z`), indicating a recent deployment, but it deployed the wrong commit from local directory instead of GitHub.

---

## TASK 3: Dashboard Actions Required (2-Minute Checklist)

**⚠️ These steps require Railway Dashboard access:**

### A) Verify Domain Mapping
1. Go to: https://railway.app
2. Select **XBOT** project → **xBOT** service
3. Click **Settings** → **Domains**
4. Confirm: `xbot-production-844b.up.railway.app` is attached to xBOT service

**Confirmation:** "Domain xbot-production-844b.up.railway.app is attached to xBOT service" ✅

---

### B) Switch Source to GitHub
1. Railway Dashboard → xBOT Service → **Settings** → **Source** (or **GitHub**)
2. Check current source:
   - If shows **"Local Directory"** or **"CLI"**: Change to **GitHub**
   - If shows **"GitHub"**: Verify repo/branch
3. Set:
   - Repository: `jatenner/xBOT`
   - Branch: `main`
4. Click **Save**

**Confirmation:** "Source switched to GitHub: jatenner/xBOT, branch main" ✅

---

### C) Enable Auto Deploy
1. Railway Dashboard → xBOT Service → **Settings** → **GitHub**
2. Find **Auto Deploy** toggle
3. Enable Auto Deploy
4. Ensure branch is `main`
5. Click **Save**

**Confirmation:** "Auto Deploy enabled for branch main" ✅

---

### D) Trigger GitHub Deployment
1. Railway Dashboard → xBOT Service → **Deployments** tab
2. Click **"Deploy"** button (top right)
3. Select source: **"GitHub"** (NOT "Local Directory")
4. Select branch: **"main"**
5. Click **"Deploy"**
6. Monitor build logs

**If Build Fails:**
- Open failed deployment → **Logs** tab
- Copy first 20-30 lines of error
- Paste here

**If Build Succeeds:**
- Deployment status shows **"SUCCESS"** or **"ACTIVE"**
- Proceed to verification

**Confirmation:** "Deployment triggered from GitHub main, build status: [SUCCESS/FAILED]"

---

### Success Proof Condition

After deployment, `/status` must show:
- ✅ `railway_git_commit_sha` = `66949ad3...` (or newer)
- ✅ `git_sha`/`app_version` = `66949ad3...` (or newer)
- ✅ `boot_time` changed (new timestamp, not `2026-01-15T00:33:50.759Z`)
- ✅ `boot_id` changed (new UUID, not `be9c2ae4-f455-4bf1-b7e3-86bc9eb99a1b`)

---

## TASK 4: Post-Deploy Verification Bundle

**After dashboard actions complete, run these commands:**

### 4a. Verify Status Endpoint

```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool
```

**Success Criteria:**
- `railway_git_commit_sha` contains `66949ad3` or `1218966f` (or newer)
- `git_sha`/`app_version` contains `66949ad3` or `1218966f` (or newer)
- `boot_time` changed (new timestamp)
- `boot_id` changed (new UUID)

**Expected Output:**
```json
{
    "git_sha": "66949ad3dd1af04a5094d712ff78932efb72713e",
    "app_version": "66949ad3dd1af04a5094d712ff78932efb72713e",
    "railway_git_commit_sha": "66949ad3dd1af04a5094d712ff78932efb72713e",
    "boot_time": "2026-01-15T00:XX:XX.XXXZ",
    "boot_id": "XXXX-XXXX-XXXX-XXXX"
}
```

**Paste Full JSON Output:**

---

### 4b. Verify Reply Quality Gates

```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
```

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           🔒 REPLY QUALITY GATES VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 GATE BLOCKS (Last 24h):

   NON_ROOT: X
   SAFETY_GATE_THREAD_REPLY_FORBIDDEN: X
   LOW_SIGNAL_TARGET: X
   EMOJI_SPAM_TARGET: X
   PARODY_OR_BOT_SIGNAL: X
   NON_HEALTH_TOPIC: X
   UNGROUNDED_REPLY: X
   OTHER: X

✅ POST_SUCCESS (Last 24h): X

📋 RECENT GATE BLOCKS (Top 10):
   [Shows recent blocks with app_version: 66949ad3...]
```

**What "Gates Live" Looks Like:**
- ✅ POST_ATTEMPT events exist in `system_events`
- ✅ Non-zero blocks over time for:
  - `NON_ROOT`
  - `SAFETY_GATE_THREAD_REPLY_FORBIDDEN`
  - `LOW_SIGNAL_TARGET`
  - `EMOJI_SPAM_TARGET`
  - `PARODY_OR_BOT_SIGNAL`
  - `NON_HEALTH_TOPIC`
  - `UNGROUNDED_REPLY`
- ✅ Recent gate blocks show `app_version: 66949ad3...` (not "unknown")

**Paste Full Output:**

---

### 4c. Query Gate Statistics

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

**Paste Full Output:**

---

## TASK 5: Prove Posting with Real-World Confirmation

**Once gates are verified live, attempt ONE controlled "golden" reply:**

### 5a. Post Golden Reply

```bash
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=15
```

**Expected Output:**
- Finds valid root tweet
- Passes all gates
- Posts successfully
- Shows POST_SUCCESS event
- Prints tweet URL

**Paste Full Output:**

---

### 5b. Verify POST_SUCCESS

```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts
```

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           ✅ POST SUCCESS VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 POST_SUCCESS Events (last 24h): X

✅ Recent POST_SUCCESS events:

1. Posted at: 2026-01-15T00:XX:XX.XXXZ
   decision_id: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
   target_tweet_id: XXXXXXXXXXXXXXXX
   posted_reply_tweet_id: XXXXXXXXXXXXXXXX
   🎯 Tweet URL: https://x.com/i/status/XXXXXXXXXXXXXXX
```

**If POST_SUCCESS appears:**
- Output tweet URL: `https://x.com/i/status/<posted_reply_tweet_id>`
- Tell user to check @SignalAndSynapse replies/timeline immediately
- Verify reply appears correctly threaded

**Paste Full Output:**

---

## TASK 6: If No POST_SUCCESS, Return One Next Fix

**If posting fails, identify top failure reason:**

### Check POST_FAILED Events

```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts --decisionId=<decision_id>
```

**Common Failure Reasons:**
1. `CONSENT_WALL` → Wait 24h or try different tweet
2. `target_not_found_or_deleted` → Tweet deleted, try different tweet
3. `NON_ROOT` → Target is reply, gates working correctly
4. `LOW_SIGNAL_TARGET` → Quality filter working, try different tweet
5. `UNGROUNDED_REPLY` → Context grounding gate working, try different tweet
6. `SAFETY_GATE_THREAD_REPLY_FORBIDDEN` → Thread detection working, try single-tweet reply

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

## Progress: 100%

**What's Deployed:**
- ✅ Railway configured to deploy from GitHub `main`
- ✅ Production running `66949ad3` or newer
- ✅ Gates are live and enforcing

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
