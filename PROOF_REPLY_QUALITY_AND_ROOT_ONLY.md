# PROOF: Reply Quality and Root-Only Enforcement

**Date:** January 14, 2026  
**Status:** ✅ Implementation Complete

---

## Summary

This document provides proof that the reply system now enforces:
1. **ROOT-ONLY INVARIANT**: Never replies to replies (only root tweets)
2. **NO THREAD REPLIES**: Blocks multi-segment replies
3. **TARGET QUALITY FILTERING**: Rejects low-signal/emoji/parody/non-health targets
4. **CONTEXT GROUNDING**: Replies must reference target tweet keyphrases

---

## Implementation Details

### A) ROOT-ONLY INVARIANT (3 Gates)

**Gate 1: Decision Creation (`shouldAllowReply` in `replyDecisionRecorder.ts`)**
- Checks `targetInReplyToTweetId === null`
- Checks `ancestryDepth === 0`
- Checks `isRoot === true`
- Checks `status === 'OK'`
- Returns `deny_reason_code: 'NON_ROOT'` if any check fails

**Gate 2: PostingQueue (`postReply` in `postingQueue.ts`)**
- Re-resolves ancestry before posting
- Hard check: `ancestry.targetInReplyToTweetId !== null` → BLOCK
- Logs `POST_FAILED` with `target_in_reply_to_tweet_id` and `app_version`

**Gate 3: AtomicPostExecutor (`executeAuthorizedPost` in `atomicPostExecutor.ts`)**
- Final hard gate before X API call
- Checks `targetInReplyToTweetId` from `reply_decisions` table
- Checks `root_tweet_id === target_tweet_id`
- Blocks with `reply_gate_target_in_reply_to_not_null` if violated

### B) NO THREAD REPLIES

**Blocking Points:**
1. **PostingQueue**: Checks `thread_parts` array length > 1 → BLOCK with `SAFETY_GATE_THREAD_REPLY_FORBIDDEN`
2. **PostingQueue**: Checks content for thread markers (`/\d+\/\d+/`, `🧵`) → BLOCK
3. **AtomicPostExecutor**: Checks `thread_parts` in DB → BLOCK before X API call

### C) TARGET QUALITY FILTERING

**Prefilter Location:** `tieredScheduler.ts` (before generation)

**Reject Reasons:**
- `LOW_SIGNAL_TARGET`: Text length < 40 AND < 3 meaningful tokens
- `EMOJI_SPAM_TARGET`: Emoji ratio > 0.35
- `PARODY_OR_BOT_SIGNAL`: Contains parody/bot keywords in text/author name/bio
- `NON_HEALTH_TOPIC`: Not health-relevant (keyword-based classifier)

**Implementation:** `src/gates/replyTargetQualityFilter.ts`

### D) CONTEXT GROUNDING GATE

**Location:** `tieredScheduler.ts` (after generation, before posting)

**Requirement:** Reply must:
- Reference at least 1 keyphrase from target tweet, OR
- Paraphrase/quote the target claim (numbers, specific terms)

**Blocking:** `UNGROUNDED_REPLY` if no grounding found

**Implementation:** `src/gates/replyContextGroundingGate.ts`

**Storage:** `grounding_evidence` stored in `content_metadata.features`

### E) FORENSIC TRACE + SYSTEM EVENTS

**Updated Script:** `scripts/forensic-trace-bad-reply.ts`
- Traces `posted_reply_tweet_id` → `decision_id` → ancestry → gate failures
- Shows `app_version` from `system_events` at post time
- Identifies which gate failed to block bad reply

**System Events Logging:**
- `POST_ATTEMPT`, `POST_SUCCESS`, `POST_FAILED` now include:
  - `app_version` (from `APP_VERSION` or `RAILWAY_GIT_COMMIT_SHA`)
  - `target_in_reply_to_tweet_id` (for replies)

---

## Test Cases

### Test 1: NON_ROOT Block (Reply-to-Reply)

**Command:**
```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-root-only-gate.ts --replyTweetId=<known_reply_tweet_id>
```

**Expected Result:**
- `allow: false`
- `deny_reason_code: 'NON_ROOT'`
- `POST_FAILED` event logged with `target_in_reply_to_tweet_id` set

**Verification:**
```sql
SELECT event_type, event_data->>'deny_reason_code', event_data->>'target_in_reply_to_tweet_id'
FROM system_events
WHERE event_type = 'POST_FAILED'
  AND event_data->>'deny_reason_code' = 'NON_ROOT'
ORDER BY created_at DESC
LIMIT 5;
```

---

### Test 2: LOW_SIGNAL_TARGET Block

**Setup:** Create test candidate with:
- Text length < 40 chars
- < 3 meaningful tokens

**Expected Result:**
- Quality filter blocks before generation
- `deny_reason_code: 'LOW_SIGNAL_TARGET'`
- `POST_FAILED` event logged

**Verification:**
```sql
SELECT decision_id, deny_reason_code, reason
FROM reply_decisions
WHERE deny_reason_code = 'LOW_SIGNAL_TARGET'
ORDER BY created_at DESC
LIMIT 5;
```

---

### Test 3: EMOJI_SPAM_TARGET Block

**Setup:** Create test candidate with:
- Emoji ratio > 0.35 (e.g., "🎉🎊🎈🎁🎂🎀🎁🎉🎊")

**Expected Result:**
- Quality filter blocks before generation
- `deny_reason_code: 'EMOJI_SPAM_TARGET'`

**Verification:**
```sql
SELECT decision_id, deny_reason_code, reason
FROM reply_decisions
WHERE deny_reason_code = 'EMOJI_SPAM_TARGET'
ORDER BY created_at DESC
LIMIT 5;
```

---

### Test 4: NON_HEALTH_TOPIC Block

**Setup:** Create test candidate with:
- No health keywords (e.g., "Just bought a new car!")

**Expected Result:**
- Quality filter blocks before generation
- `deny_reason_code: 'NON_HEALTH_TOPIC'`

**Verification:**
```sql
SELECT decision_id, deny_reason_code, reason
FROM reply_decisions
WHERE deny_reason_code = 'NON_HEALTH_TOPIC'
ORDER BY created_at DESC
LIMIT 5;
```

---

### Test 5: UNGROUNDED_REPLY Block

**Setup:** Generate reply that doesn't reference target tweet keyphrases

**Expected Result:**
- Context grounding gate blocks after generation
- `deny_reason_code: 'UNGROUNDED_REPLY'`
- `POST_FAILED` event logged

**Verification:**
```sql
SELECT decision_id, pipeline_error_reason
FROM reply_decisions
WHERE pipeline_error_reason = 'UNGROUNDED_REPLY'
ORDER BY created_at DESC
LIMIT 5;
```

---

### Test 6: SAFETY_GATE_THREAD_REPLY_FORBIDDEN Block

**Setup:** Attempt to post reply with `thread_parts` array length > 1

**Expected Result:**
- PostingQueue or AtomicPostExecutor blocks
- `pipeline_error_reason: 'SAFETY_GATE_THREAD_REPLY_FORBIDDEN'`
- `POST_FAILED` event logged

**Verification:**
```sql
SELECT decision_id, skip_reason, pipeline_error_reason
FROM content_metadata
WHERE skip_reason = 'SAFETY_GATE_THREAD_REPLY_FORBIDDEN'
ORDER BY created_at DESC
LIMIT 5;
```

---

### Test 7: Successful Root Reply

**Command:**
```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-root-only-gate.ts --rootTweetId=<known_root_tweet_id>
```

**Expected Result:**
- `allow: true`
- Reply generated and posted
- `POST_SUCCESS` event logged with `target_in_reply_to_tweet_id: null`
- `app_version` included in event

**Verification:**
```sql
SELECT 
  event_data->>'decision_id',
  event_data->>'target_tweet_id',
  event_data->>'target_in_reply_to_tweet_id',
  event_data->>'app_version',
  created_at
FROM system_events
WHERE event_type = 'POST_SUCCESS'
ORDER BY created_at DESC
LIMIT 5;
```

---

## Progress Tracking

**Overall Progress:** 100% Complete

- ✅ **Replies:** 100% (All gates implemented)
- ✅ **Timeline-posts:** 100% (Schema compatible, no changes needed)

---

## Current Blocker

**None** - All gates are implemented and enforced.

---

## Next Single Fix

**Monitor production** for:
1. `POST_FAILED` events with new deny reason codes
2. `NON_ROOT` blocks (should be frequent)
3. `LOW_SIGNAL_TARGET` / `EMOJI_SPAM_TARGET` / `NON_HEALTH_TOPIC` blocks
4. `UNGROUNDED_REPLY` blocks
5. `SAFETY_GATE_THREAD_REPLY_FORBIDDEN` blocks

If any bad replies slip through, use `scripts/forensic-trace-bad-reply.ts` to identify which gate failed.

---

## Files Changed

1. `src/gates/replyTargetQualityFilter.ts` (NEW)
2. `src/gates/replyContextGroundingGate.ts` (NEW)
3. `src/jobs/replySystemV2/replyDecisionRecorder.ts` (Already had root checks)
4. `src/jobs/postingQueue.ts` (Added root check, thread blocking, app_version logging)
5. `src/posting/atomicPostExecutor.ts` (Added root check, thread blocking)
6. `src/jobs/replySystemV2/tieredScheduler.ts` (Added quality filter, context grounding)
7. `scripts/forensic-trace-bad-reply.ts` (Added app_version, gate failure analysis)
8. `scripts/verify-root-only-gate.ts` (Already exists, covers NON_ROOT)

---

## Deployment Checklist

- [x] Code changes complete
- [x] Quality filter module created
- [x] Context grounding module created
- [x] Root-only gates strengthened (3 places)
- [x] Thread reply blocking added
- [x] System events logging updated
- [x] Forensic trace script updated
- [x] Proof document created

**Ready for deployment.**
