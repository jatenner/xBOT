# Railway Deployment Proof Template

**Date:** January 15, 2026  
**Target Commit:** `1218966f44b9a56ade7e91cfa165936090a44b73`

---

## Step 1: Railway Dashboard Check

### Deployments Tab

**Screenshot/Notes:**
- [ ] Navigate to: Railway Dashboard → xBOT Project → xBOT Service → Deployments
- [ ] Check if deployment for commit `1218966f` exists
- [ ] Status: [Building/Deploying/Active/Failed]
- [ ] If Failed: Copy error from logs

**Findings:**
```
[Paste deployment status here]
```

### GitHub Integration Check

**Settings Tab:**
- [ ] Repository: `jatenner/xBOT` ✅/❌
- [ ] Branch: `main` ✅/❌
- [ ] Auto Deploy: Enabled ✅/❌
- [ ] Root Directory: `/` ✅/❌

**Findings:**
```
[Paste settings here]
```

---

## Step 2: Status Endpoint Verification

### Before Deployment

```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool
```

**Result:**
```json
{
  "git_sha": "9b4d1e84...",
  "app_version": "9b4d1e84...",
  "railway_git_commit_sha": "fdf00f1e...",
  "boot_time": "2026-01-13T23:22:39.375Z"
}
```

### After Deployment (Expected)

```json
{
  "git_sha": "1218966f44b9a56ade7e91cfa165936090a44b73",
  "app_version": "1218966f44b9a56ade7e91cfa165936090a44b73",
  "railway_git_commit_sha": "1218966f44b9a56ade7e91cfa165936090a44b73",
  "boot_time": "2026-01-15T00:XX:XX.XXXZ"  // NEW timestamp
}
```

**Proof:**
- ✅ `git_sha` contains `1218966f`
- ✅ `boot_time` changed (new container)
- ✅ `railway_git_commit_sha` matches expected

---

## Step 3: Gate Verification

### Run Gate Statistics

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

**Actual Output:**
```
[Paste output here]
```

### Check POST_ATTEMPT Events

```bash
railway run -s xBOT -- pnpm exec tsx scripts/query-gate-stats.ts
```

**Expected:**
- Events show `app_version: 1218966f...` (not "unknown")
- Events show `gate_result: PASS` or `BLOCK`
- Events show `deny_reason_code` if blocked

**Actual:**
```
[Paste output here]
```

---

## Step 4: Golden Reply Test

```bash
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=5
```

**Expected:**
- Finds valid root tweet
- Passes all gates
- Posts reply successfully
- Shows `POST_SUCCESS` event

**Actual:**
```
[Paste output here]
```

---

## Summary

### Deployment Status
- [ ] Commit `1218966f` deployed ✅/❌
- [ ] Status endpoint shows new SHA ✅/❌
- [ ] Boot time changed ✅/❌

### Gate Activity
- [ ] POST_ATTEMPT events logged ✅/❌
- [ ] Gate blocks detected ✅/❌
- [ ] app_version set correctly ✅/❌

### Current Blocker
```
[Describe any blockers here]
```

### Next Single Fix
```
[Describe next action]
```
