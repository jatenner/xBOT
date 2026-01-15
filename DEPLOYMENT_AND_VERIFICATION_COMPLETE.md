# Deployment and Verification - Complete Guide

**Date:** January 15, 2026  
**Goal:** Twitter-native reply gates + GitHub deployment + Proof

---

## PHASE 0: Hard Facts from Prod ✅

**Production Status:**
```json
{
    "git_sha": "001ec542c5e5af3592011c31f92b819423887ea3",
    "app_version": "001ec542c5e5af3592011c31f92b819423887ea3",
    "railway_git_commit_sha": "fdf00f1e32b67fa399f668d836c0a737e73bc62a",
    "boot_time": "2026-01-15T00:33:50.759Z",
    "service_name": "xBOT"
}
```

**Local Git State:**
- Local HEAD: `a798b70e` (latest with gates)
- origin/main HEAD: `66949ad3` (previous)

**Diagnosis:** Production running `001ec542` (local) vs `66949ad3` (GitHub) - **DEPLOYMENT MISMATCH CONFIRMED**

---

## PHASE 1-3: Implementation Complete ✅

### Target Quality Filter ✅
- **File:** `src/gates/replyTargetQualityFilter.ts`
- **Enhancements:**
  - Engagement bait detection (follow, DM, retweet, like if)
  - Claim/question detection
  - Enhanced parody/bot signals (RP, fan account)
  - Returns structured result: `{ pass, code, deny_reason_code, reason, detail, score }`
- **Integration:** `tieredScheduler.ts` line 273 (BEFORE generation)
- **Deny codes:** LOW_SIGNAL_TARGET, EMOJI_SPAM_TARGET, PARODY_OR_BOT_SIGNAL, NON_HEALTH_TOPIC, TARGET_QUALITY_BLOCK

### Context Grounding Gate ✅
- **File:** `src/gates/replyContextGroundingGate.ts`
- **Enhancements:**
  - Quoted snippets (6-12 words)
  - >=2 target keywords (excluding stopwords)
  - Author handle + paraphrase markers ("your point about X")
- **Integration:** `tieredScheduler.ts` line 694 (AFTER generation, BEFORE posting)
- **Deny code:** UNGROUNDED_REPLY

### Root-Only + No-Thread (3 Layers) ✅
- **Layer 1:** `replyDecisionRecorder.ts` line 679 - `targetInReplyToTweetId !== null` → NON_ROOT
- **Layer 2:** `postingQueue.ts` line 4775 - Hard check before posting
- **Layer 3:** `atomicPostExecutor.ts` line 260 - Final check before X API
- **Thread checks:** `thread_parts.length > 1` + thread markers (🧵, "1/", etc.)

### DB-First + Audit ✅
- **POST_ATTEMPT:** Includes app_version, decision_id, target_tweet_id, target_in_reply_to_tweet_id, gate_result, deny_reason_code
- **POST_SUCCESS:** Includes tweet_url format `https://x.com/i/status/<id>`
- **POST_FAILED:** Includes pipeline_error_reason + structured detail
- **Boot logging:** `[BOOT] git_sha=... railway_git_commit_sha=... app_version=...`

---

## PHASE 4: Railway Deployment Fix

**Railway CLI does NOT support source management** - requires dashboard clicks.

### 30-Second Click Path (REQUIRED)

**Railway Dashboard → Project XBOT → Service xBOT:**

1. **Settings → Domains** (5s)
   - Verify: `xbot-production-844b.up.railway.app` attached to xBOT
   - **Confirmation:** "Domain attached" ✅

2. **Settings → Source** (10s)
   - Change to GitHub: `jatenner/xBOT`, branch `main`
   - **Confirmation:** "Source: GitHub, repo jatenner/xBOT, branch main" ✅

3. **Settings → GitHub** (5s)
   - Enable Auto Deploy, branch `main`
   - **Confirmation:** "Auto Deploy: ENABLED" ✅

4. **Deployments → Deploy** (10s)
   - Click "Deploy" → GitHub → main → Deploy
   - **Confirmation:** "Deployment triggered" ✅

**Full details:** See `RAILWAY_DEPLOYMENT_FIX.md`

---

## PHASE 5: Deploy and Verify

### Step 1: Complete Click Path Above

### Step 2: Verify Deployment Swap

```bash
# Automated polling (recommended)
./scripts/poll-deployment-status.sh

# OR manual check
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool | grep -E "(git_sha|app_version|railway_git_commit_sha|boot_time)"
```

**Success Criteria:**
- ✅ `railway_git_commit_sha` = `a798b70e...` (or newer)
- ✅ `boot_time` changed (new timestamp)

### Step 3: Verify Gates Are Live

```bash
railway run -s xBOT -- pnpm exec tsx scripts/prove-gates-live.ts
```

**Expected Output:**
```
✅ GATES ARE LIVE
   - POST_ATTEMPT events: X (last 2h)
   - Gate blocks: X (last 24h)
```

### Step 4: Verify Reply Quality Gates

```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
```

**Expected Output:**
- Gate blocks by deny_reason_code
- 5 example tweet_ids for each major block

---

## PHASE 6: Prove Real Post

### Run Golden Reply Test

```bash
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=15
```

**Expected Output:**
- Finds valid root tweet
- Passes quality filter
- Generates grounded reply
- Posts successfully
- **Outputs:** `🎯 TWEET URL: https://x.com/i/status/<posted_reply_tweet_id>`

**If POST_SUCCESS:**
- Open URL in browser
- Check @SignalAndSynapse replies tab
- Verify reply appears correctly threaded

**If POST_FAILED:**
- Script prints top failure reason
- Check `verify-post-success.ts --decisionId=<id>` for details

---

## Final Output Summary

After completing all phases, provide:

### (1) Current Prod SHA + Boot Time

```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool | grep -E "(git_sha|app_version|railway_git_commit_sha|boot_time)"
```

**Expected:**
- `railway_git_commit_sha`: `a798b70e...` (or newer)
- `boot_time`: NEW timestamp (not `2026-01-15T00:33:50.759Z`)

---

### (2) Are Gates Live? Yes/No with Proof

```bash
railway run -s xBOT -- pnpm exec tsx scripts/prove-gates-live.ts
```

**Proof:**
- POST_ATTEMPT events exist (last 2h)
- Gate blocks detected (last 24h)
- Quality blocks: LOW_SIGNAL_TARGET, EMOJI_SPAM_TARGET, etc.
- Grounding blocks: UNGROUNDED_REPLY

---

### (3) Latest POST_SUCCESS URL (or Why Not)

```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts
```

**If POST_SUCCESS exists:**
- Output: `🎯 Tweet URL: https://x.com/i/status/<id>`
- User can open and verify on X

**If no POST_SUCCESS:**
- Run: `railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=15`
- Check failure reason

---

### (4) If No Success: Next Single Fix

**If posting fails, identify top failure reason:**

```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts --decisionId=<decision_id>
```

**Common failures:**
- CONSENT_WALL → Wait 24h or try different tweet
- NON_ROOT → Gates working correctly
- TARGET_QUALITY_BLOCK → Try different tweet
- UNGROUNDED_REPLY → Generation issue, try different tweet

**Single Fix:** Identify top reason and recommend smallest change

---

## Commands Reference

```bash
# Check prod status
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool

# Verify gates live
railway run -s xBOT -- pnpm exec tsx scripts/prove-gates-live.ts

# Verify quality gates
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts

# Verify post success
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts

# Post golden reply
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=15

# Poll deployment status
./scripts/poll-deployment-status.sh
```

---

## Files Changed

**New Files:**
- `scripts/prove-gates-live.ts` - Gate activity proof
- `scripts/verify-reply-quality-gates.ts` - Quality gate verification
- `RAILWAY_DEPLOYMENT_FIX.md` - Deployment click path

**Modified Files:**
- `src/gates/replyTargetQualityFilter.ts` - Enhanced quality filter
- `src/jobs/replySystemV2/tieredScheduler.ts` - Integrated filters
- `src/jobs/postingQueue.ts` - POST_SUCCESS includes tweet_url
- `src/railwayEntrypoint.ts` - Boot logging

**Committed:** Latest commit includes all changes

---

## Next Steps

1. **Complete Railway click path** (30 seconds)
2. **Wait for deployment** (3-5 minutes)
3. **Run verification scripts** (2 minutes)
4. **Run golden reply test** (2-5 minutes)
5. **Provide proof outputs**

All code is ready. Deployment requires dashboard clicks (cannot be automated via CLI).
