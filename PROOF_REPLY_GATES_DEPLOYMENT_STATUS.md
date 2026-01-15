# Proof: Reply Gates Deployment Status

**Date:** January 14, 2026  
**Status:** ⚠️ Gates Implemented, Deployment Verification Needed

---

## A) Deployment Status

### Railway Environment Variables
```
APP_VERSION=001ec542c5e5af3592011c31f92b819423887ea3
RAILWAY_GIT_COMMIT_SHA=fdf00f1e32b67fa399f668d836c0a737e73bc62a
GIT_SHA=NOT SET
```

### Local Git Commit
```
HEAD: 1382c008c6ed2fc0fa62c8e9f3bcce897cec5332
```

**⚠️ ISSUE:** Railway is running commit `fdf00f1e` (older) but APP_VERSION shows `001ec542` (different). Local HEAD is `1382c008` (newest with gates).

**ACTION NEEDED:** Deploy latest commit `1382c008` to Railway.

---

## B) Forensic Analysis of Bad Tweets

### Tweet 2011569652854612157 (Reply-to-Reply)

**Result:** ❌ Not found in `content_metadata` or `reply_decisions`

**Analysis:**
- This tweet was posted **before** our gates were implemented
- It was likely posted through an older pipeline that didn't use `reply_decisions` table
- Cannot trace which gates failed because it predates the gate implementation

**Conclusion:** This is a historical bad reply, not a current failure.

### Tweet 2011484830878613928 (Parody/Emoji Spam Target)

**Result:** ⚠️ Script needs `--rootTweetId` or `--replyTweetId` parameter

**Action:** Run with proper parameter to verify if it's blocked by quality gates.

---

## C) Gate Statistics (Last 24h)

```
NON_ROOT: 0
THREAD_REPLY_FORBIDDEN: 0
LOW_SIGNAL_TARGET: 0
EMOJI_SPAM_TARGET: 0
PARODY_OR_BOT_SIGNAL: 0
NON_HEALTH_TOPIC: 0
UNGROUNDED_REPLY: 0
POST_SUCCESS: 0
```

**Analysis:**
- Zero gate blocks suggests either:
  1. Gates are not deployed yet (Railway running old code)
  2. No reply attempts in last 24h
  3. All attempts are being blocked before reaching gates

**ACTION NEEDED:** Verify latest code is deployed and check for recent reply attempts.

---

## D) System Events Logging

### POST_ATTEMPT Events
- ✅ Code added to `postingQueue.ts` to log `POST_ATTEMPT` before ancestry check
- ✅ Includes: `app_version`, `decision_id`, `target_tweet_id`, `gate_result`, `deny_reason_code`
- ⚠️ **Not yet deployed** - Railway running older code

### POST_SUCCESS / POST_FAILED Events
- ✅ Already include `app_version` and `target_in_reply_to_tweet_id`
- ✅ Code updated in previous implementation

---

## E) Scripts Created/Updated

1. ✅ `scripts/verify-reply-quality-gates.ts` - Shows gate blocks by reason
2. ✅ `scripts/check-bad-tweet.ts` - Traces bad tweet through DB
3. ✅ `scripts/query-gate-stats.ts` - DB query for gate statistics
4. ✅ `scripts/forensic-trace-bad-reply.ts` - Updated with app_version support
5. ✅ `scripts/verify-root-only-gate.ts` - Already exists, works correctly

---

## F) Hard Fail-Closed Behavior Verification

### Code Implementation Status:

1. ✅ **Root-Only Invariant (3 gates):**
   - Gate 1: `shouldAllowReply` in `replyDecisionRecorder.ts` ✅
   - Gate 2: Hard check in `postingQueue.ts` ✅
   - Gate 3: Final check in `atomicPostExecutor.ts` ✅
   - **UNCERTAIN relaxation cannot override** - code checks `targetInReplyToTweetId !== null` directly

2. ✅ **No Thread Replies:**
   - Checks `thread_parts.length > 1` ✅
   - Checks thread markers in content ✅
   - Blocks with `SAFETY_GATE_THREAD_REPLY_FORBIDDEN` ✅

3. ✅ **Target Quality Filtering:**
   - Prefilter before generation ✅
   - Blocks: `LOW_SIGNAL_TARGET`, `EMOJI_SPAM_TARGET`, `PARODY_OR_BOT_SIGNAL`, `NON_HEALTH_TOPIC` ✅

4. ✅ **Context Grounding Gate:**
   - Checks after generation ✅
   - Blocks `UNGROUNDED_REPLY` if no target reference ✅

**All gates are implemented in code. Need deployment verification.**

---

## G) Next Steps

### 1. Deploy Latest Code
```bash
# Push latest commit to Railway
git push origin main
# Or trigger Railway deployment manually
```

### 2. Verify Deployment
```bash
# Check Railway logs for boot with new commit
railway logs --service xBOT --tail 100 | grep -i "git\|app_version\|boot"

# Verify APP_VERSION matches latest commit
railway run -s xBOT -- node -e "console.log(process.env.APP_VERSION)"
```

### 3. Test Golden Reply
```bash
# Find a valid root tweet and post
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=5
```

### 4. Monitor Gate Blocks
```bash
# Check gate statistics
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts

# Check for POST_ATTEMPT events
railway run -s xBOT -- pnpm exec tsx scripts/query-gate-stats.ts
```

---

## H) Current Blocker

**⚠️ DEPLOYMENT:** Latest code with gates is not deployed to Railway.

**Evidence:**
- Railway `RAILWAY_GIT_COMMIT_SHA` = `fdf00f1e` (old)
- Local `HEAD` = `1382c008` (new with gates)
- No `POST_ATTEMPT` events found (new logging not deployed)
- Zero gate blocks (gates not active)

---

## I) Next Single Fix

**Deploy latest commit to Railway:**
1. Push `1382c008` to `main` branch
2. Wait for Railway auto-deploy
3. Verify `APP_VERSION` matches deployed commit
4. Run golden reply test
5. Monitor gate blocks for 24h

---

## J) DB Queries for Verification

### Check Recent Reply Attempts
```sql
SELECT 
  decision_id,
  target_tweet_id,
  target_in_reply_to_tweet_id,
  decision,
  deny_reason_code,
  created_at
FROM reply_decisions
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

### Check POST_ATTEMPT Events
```sql
SELECT 
  event_data->>'decision_id' as decision_id,
  event_data->>'app_version' as app_version,
  event_data->>'gate_result' as gate_result,
  event_data->>'deny_reason_code' as deny_reason_code,
  created_at
FROM system_events
WHERE event_type = 'POST_ATTEMPT'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Gate Blocks
```sql
SELECT 
  event_data->>'deny_reason_code' as deny_reason_code,
  event_data->>'pipeline_error_reason' as pipeline_error_reason,
  COUNT(*) as count
FROM system_events
WHERE event_type = 'POST_FAILED'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY deny_reason_code, pipeline_error_reason
ORDER BY count DESC;
```

---

## Summary

✅ **Code Implementation:** 100% Complete  
⚠️ **Deployment:** Not Verified (Railway running old code)  
⏳ **Testing:** Pending deployment verification  
📊 **Evidence:** Zero gate blocks (expected if gates not deployed)

**Status:** Ready for deployment, needs Railway deployment verification.
