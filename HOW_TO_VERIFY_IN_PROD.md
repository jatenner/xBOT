# How to Verify Reply Quality System in Production

**Date:** January 15, 2026  
**System:** Twitter-native reply quality gates

---

## Quick Verification Commands

### 1. Prove Reply Quality (Last 50 Decisions)

```bash
railway run -s xBOT -- pnpm exec tsx scripts/prove-reply-quality.ts
```

**Expected Output:**
- Counts by deny_reason_code (LOW_SIGNAL_TARGET, EMOJI_SPAM_TARGET, PARODY_OR_BOT_SIGNAL, NON_HEALTH_TOPIC, UNGROUNDED_REPLY, etc.)
- 5 sample blocked targets for each major block reason
- 10 most recent generated replies with grounding pass/fail status

**Success Criteria:**
- ✅ Quality blocks present (LOW_SIGNAL_TARGET, EMOJI_SPAM_TARGET, etc.)
- ✅ Grounding blocks present (UNGROUNDED_REPLY)
- ✅ Recent replies show grounding PASS/FAIL correctly

---

### 2. Prove Posting Ready (Deployment + Gates Active)

```bash
railway run -s xBOT -- pnpm exec tsx scripts/prove-posting-ready.ts
```

**Expected Output:**
- Deployment integrity (git_sha/app_version match expected)
- POST_ATTEMPT events exist with app_version
- Non-zero blocks for quality/grounding (proves gates active)
- POST_SUCCESS/POST_FAILED counts

**Success Criteria:**
- ✅ Deployment version tracked (not "unknown")
- ✅ POST_ATTEMPT events exist (last 24h)
- ✅ Quality blocks > 0 OR Grounding blocks > 0 (gates active)
- ✅ POST_SUCCESS includes app_version

---

### 3. Check Status Endpoint

```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | python3 -m json.tool
```

**Verify:**
- `git_sha` matches expected commit
- `app_version` matches expected commit
- `boot_time` is recent (not stale)

---

### 4. Query Gate Statistics

```bash
railway run -s xBOT -- pnpm exec tsx scripts/query-gate-stats.ts
```

**Expected Output:**
- Counts of gate blocks in last 24h:
  - NON_ROOT
  - THREAD_REPLY_FORBIDDEN
  - LOW_SIGNAL_TARGET
  - EMOJI_SPAM_TARGET
  - PARODY_OR_BOT_SIGNAL
  - NON_HEALTH_TOPIC
  - UNGROUNDED_REPLY
  - POST_SUCCESS

---

### 5. Verify Reply Quality Gates

```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
```

**Expected Output:**
- Gate blocks categorized by reason code
- Recent gate blocks with app_version
- POST_SUCCESS count

---

## Database Queries (Direct Verification)

### Check Target Scoring Blocks

```sql
SELECT 
  deny_reason_code,
  COUNT(*) as count
FROM reply_decisions
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND decision = 'DENY'
  AND deny_reason_code IN (
    'LOW_SIGNAL_TARGET',
    'EMOJI_SPAM_TARGET',
    'PARODY_OR_BOT_SIGNAL',
    'NON_HEALTH_TOPIC',
    'TARGET_QUALITY_BLOCK'
  )
GROUP BY deny_reason_code
ORDER BY count DESC;
```

### Check Grounding Blocks

```sql
SELECT 
  deny_reason_code,
  COUNT(*) as count
FROM reply_decisions
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND decision = 'DENY'
  AND deny_reason_code = 'UNGROUNDED_REPLY'
GROUP BY deny_reason_code;
```

### Check POST_ATTEMPT Events

```sql
SELECT 
  COUNT(*) as count,
  COUNT(DISTINCT event_data->>'app_version') as unique_versions
FROM system_events
WHERE event_type = 'POST_ATTEMPT'
  AND created_at >= NOW() - INTERVAL '24 hours';
```

### Check POST_SUCCESS Events

```sql
SELECT 
  COUNT(*) as count,
  event_data->>'app_version' as app_version,
  event_data->>'posted_reply_tweet_id' as tweet_id
FROM system_events
WHERE event_type = 'POST_SUCCESS'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY app_version, tweet_id
ORDER BY created_at DESC
LIMIT 10;
```

---

## Three-Layer Invariant Verification

### Layer 1: Decision Stage (replyDecisionRecorder.ts)

**Check:** `shouldAllowReply` blocks if `targetInReplyToTweetId !== null`

```sql
SELECT 
  COUNT(*) as non_root_blocks
FROM reply_decisions
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND decision = 'DENY'
  AND deny_reason_code = 'NON_ROOT';
```

### Layer 2: PostingQueue Stage (postingQueue.ts)

**Check:** Hard block if `targetInReplyToTweetId !== null` OR `thread_parts.length > 1`

```sql
SELECT 
  COUNT(*) as posting_queue_blocks
FROM system_events
WHERE event_type = 'POST_FAILED'
  AND created_at >= NOW() - INTERVAL '24 hours'
  AND (
    event_data->>'pipeline_error_reason' LIKE '%NON_ROOT%' OR
    event_data->>'pipeline_error_reason' LIKE '%THREAD_REPLY%'
  );
```

### Layer 3: AtomicPostExecutor Stage (atomicPostExecutor.ts)

**Check:** Final hard block before X API call

```sql
SELECT 
  COUNT(*) as atomic_executor_blocks
FROM system_events
WHERE event_type = 'reply_gate_blocked'
  AND created_at >= NOW() - INTERVAL '24 hours';
```

---

## Expected Behavior

### Target Scoring (Pre-Generation)

- **Score < 60:** Hard deny with `TARGET_QUALITY_BLOCK` or specific reason code
- **Reasons:** LOW_SIGNAL_TARGET, EMOJI_SPAM_TARGET, PARODY_OR_BOT_SIGNAL, NON_HEALTH_TOPIC
- **Location:** `tieredScheduler.ts` BEFORE generation

### Grounding Guarantee (Post-Generation)

- **Pass if:** Contains quoted snippet (6-12 words) OR >=2 target keywords OR author handle + paraphrase
- **Fail:** `UNGROUNDED_REPLY` deny_reason_code
- **Location:** `tieredScheduler.ts` AFTER generation, BEFORE posting

### Root-Only Invariant

- **Layer 1:** `replyDecisionRecorder.ts` - `shouldAllowReply` blocks non-root
- **Layer 2:** `postingQueue.ts` - Hard check before posting
- **Layer 3:** `atomicPostExecutor.ts` - Final hard check before X API

### No-Thread Invariant

- **Layer 2:** `postingQueue.ts` - Blocks `thread_parts.length > 1` or thread markers
- **Layer 3:** `atomicPostExecutor.ts` - Final hard check for thread patterns

---

## Troubleshooting

### No Quality Blocks Detected

**Possible Causes:**
- Gates not active (check deployment)
- No candidates attempted (check scheduler logs)
- All candidates passed quality filters (unlikely)

**Fix:**
- Verify deployment: `curl /status`
- Check scheduler logs: `railway logs --service xBOT`
- Run `prove-posting-ready.ts` to verify gates active

### No Grounding Blocks Detected

**Possible Causes:**
- All replies are grounded (good!)
- Grounding gate not integrated (check code)
- No replies generated (check generation logs)

**Fix:**
- Check `tieredScheduler.ts` line 688 for grounding check
- Verify `verifyContextGrounding` is called after generation
- Check generation logs for UNGROUNDED_REPLY blocks

### POST_ATTEMPT Missing app_version

**Possible Causes:**
- Environment variable not set
- Code not updated

**Fix:**
- Check `postingQueue.ts` line 4659: `appVersion` should be set
- Verify `APP_VERSION` or `RAILWAY_GIT_COMMIT_SHA` env var
- Redeploy if needed

---

## Success Indicators

✅ **Target Scoring Active:**
- `prove-reply-quality.ts` shows quality blocks (LOW_SIGNAL_TARGET, etc.)
- `query-gate-stats.ts` shows non-zero quality blocks

✅ **Grounding Active:**
- `prove-reply-quality.ts` shows UNGROUNDED_REPLY blocks
- Recent replies show grounding PASS/FAIL correctly

✅ **Root-Only Enforced:**
- All three layers show NON_ROOT blocks
- No replies to replies in production

✅ **No-Thread Enforced:**
- THREAD_REPLY_FORBIDDEN blocks present
- No multi-tweet replies posted

✅ **Audit Complete:**
- POST_ATTEMPT events include app_version
- POST_SUCCESS/POST_FAILED events include app_version
- All events include decision_id, target_tweet_id, target_in_reply_to_tweet_id

---

## Next Steps After Verification

1. **Monitor Gate Activity:**
   - Run `prove-reply-quality.ts` daily
   - Track quality/grounding block trends

2. **Review Blocked Targets:**
   - Check sample blocked targets for false positives
   - Adjust scoring thresholds if needed

3. **Review Grounding:**
   - Check recent replies for grounding quality
   - Adjust grounding criteria if needed

4. **Scale Volume:**
   - Once gates proven, increase reply volume gradually
   - Monitor gate blocks vs. POST_SUCCESS ratio
