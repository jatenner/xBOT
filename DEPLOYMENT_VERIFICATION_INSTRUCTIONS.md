# Deployment Verification Instructions

**Latest Commit:** `1218966f44b9a56ade7e91cfa165936090a44b73`  
**Status:** ✅ Committed and pushed to `main`  
**Railway Status:** ⏳ Waiting for auto-deploy (CLI timed out)

---

## What Was Done

1. ✅ **Committed all gate code:**
   - Reply quality filters
   - Context grounding gate
   - Root-only invariant hard checks
   - Thread reply blocking
   - POST_ATTEMPT logging
   - Verification scripts

2. ✅ **Pushed to GitHub:**
   ```bash
   git push origin main
   # Pushed: 704456b7..1218966f
   ```

3. ⚠️ **Railway CLI timed out:**
   - `railway up --detach -s xBOT` timed out
   - Railway should auto-deploy from GitHub push
   - May take 2-5 minutes for Railway to detect and deploy

---

## Verification Steps (Run After Railway Deploys)

### Step 1: Check Deployment Status
```bash
# Check /status endpoint
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool | grep -E "git_sha|app_version"

# Expected: Should show 1218966f or similar (matches latest commit)
```

### Step 2: Verify Runtime Environment
```bash
railway run -s xBOT -- node -e "console.log('SHA: ' + process.env.RAILWAY_GIT_COMMIT_SHA)"
# Expected: 1218966f44b9a56ade7e91cfa165936090a44b73
```

### Step 3: Check POST_ATTEMPT Logging
```bash
railway run -s xBOT -- pnpm exec tsx scripts/query-gate-stats.ts
# Should show POST_ATTEMPT events if gates are active
```

### Step 4: Verify Gate Blocks
```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
# Should show gate blocks (may be 0 if no bad attempts, but gates should be active)
```

### Step 5: Test Golden Reply
```bash
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=5
# Should post a reply and show POST_SUCCESS event
```

---

## Expected Outputs After Deployment

### /status Endpoint
```json
{
  "git_sha": "1218966f44b9a56ade7e91cfa165936090a44b73",
  "app_version": "1218966f44b9a56ade7e91cfa165936090a44b73",
  "railway_git_commit_sha": "1218966f44b9a56ade7e91cfa165936090a44b73"
}
```

### Gate Statistics (After Some Activity)
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

### POST_ATTEMPT Events
Should see events with:
- `app_version`: `1218966f...` or matches Railway SHA
- `gate_result`: `PASS` or `BLOCK`
- `deny_reason_code`: Reason if blocked

---

## Manual Railway Deployment (If Auto-Deploy Fails)

1. Go to Railway Dashboard: https://railway.app
2. Select xBOT project
3. Go to xBOT service
4. Click "Deploy" or "Redeploy"
5. Wait for deployment to complete
6. Run verification steps above

---

## Current Status

- ✅ Code: Committed and pushed
- ⏳ Railway: Waiting for deployment
- ⏳ Verification: Pending deployment

**Next Action:** Wait 2-5 minutes, then run verification steps.
