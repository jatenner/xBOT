# ROOT CAUSE ANALYSIS & FIX SUMMARY

## Executive Summary

**Problem:** Bot posts unrelated replies (e.g., "turmeric/food" under "Grok/App Store" thread).

**Root Cause:** 
1. `opportunity.tweet_content` can be NULL/empty → LLM generates generic reply
2. No verification that tweet_content matches target_tweet_id → stale data causes mismatch
3. No semantic validation → unrelated replies pass all gates
4. No cooldown enforcement → duplicate replies to same accounts

**Solution:** 4-layer defense system with full observability.

---

## Root Cause Details

### Where Context is Lost (Line-by-Line Trace)

**Step 1: Harvesting (`replyOpportunityHarvester.ts`)**
- Playwright scrapes tweets, stores in `reply_opportunities` table
- ✅ tweet_content is captured
- ⚠️ If scraping fails partially, tweet_content can be NULL

**Step 2: Selection (`replyJob.ts:625-945`)**
- Queries `reply_opportunities` table
- Maps to `opportunity` object at line 945: `tweet_content: String(opp.target_tweet_content || '')`
- ⚠️ If `target_tweet_content` is NULL → empty string is passed to LLM

**Step 3: Generation (`replyJob.ts:1084-1142`)**
- Line 1084: `tweet_content: opportunity.tweet_content || ''`
- Line 1136: `const parentText = target.tweet_content || '';`
- ⚠️ If empty, context validation at line 1139 should skip, BUT:
  - Validation was added recently, older queued decisions bypass it
  - Phase 4 routing may have different code path

**Step 4: Posting (`postingQueue.ts`)**
- No re-validation of tweet content before posting
- Posts whatever was generated, even if context was empty/wrong

### Critical Gap

**NO HASH/SIMILARITY CHECK** between:
- Tweet text at decision creation time
- Tweet text at posting time

This allows:
1. Stale opportunities (tweet deleted/edited)
2. Wrong tweet ID selected (race condition)
3. Empty tweet content (scraping failure)

---

## Solution Architecture

### Layer 1: Context Lock (PREVENT MISMATCH)

**What:** Cryptographic snapshot of tweet text at decision creation.

**How:**
1. At decision creation: Compute SHA256 hash of tweet text
2. Store hash + full text snapshot in `content_metadata`
3. At post time: Re-fetch tweet from DB, recompute hash
4. If hash mismatch: Compute similarity (Jaccard)
5. Block if similarity < 80%

**Files:**
- `src/gates/contextLockGuard.ts` (NEW)
- `src/jobs/replyJob.ts` (lines 1383-1422)
- `src/jobs/postingQueue.ts` (lines after freshness check)

**DB Columns:**
- `target_tweet_content_snapshot TEXT`
- `target_tweet_content_hash VARCHAR(64)`
- `context_lock_verified BOOLEAN`
- `context_lock_similarity NUMERIC(3,2)`

---

### Layer 2: Semantic Gate (BLOCK UNRELATED)

**What:** Verify reply is topically related to target tweet.

**How:**
1. Compute word-level cosine similarity
2. Extract topic keywords (health vs tech vs other)
3. Pass if: similarity >= 15% OR topic overlap
4. Block otherwise with detailed logging

**Files:**
- `src/gates/semanticGate.ts` (NEW)
- `src/jobs/replyJob.ts` (lines 1428-1463)

**DB Columns:**
- `semantic_similarity NUMERIC(3,2)`
- `skip_reason` (e.g., `low_similarity_no_topic_overlap`)

**Config:**
- `SEMANTIC_GATE_MIN_SIMILARITY=0.15` (env var)

---

### Layer 3: Anti-Spam (PREVENT DUPLICATES)

**What:** Enforce cooldowns to prevent spamming same accounts/tweets.

**Rules:**
1. 1 reply per root_tweet_id per 24h
2. 1 reply per author per 12h
3. Never reply to our own tweets
4. Max 4 replies/hour (already enforced, re-check here)

**Files:**
- `src/gates/antiSpamGuard.ts` (NEW)
- `src/jobs/replyJob.ts` (lines 1468-1503)

**DB Columns:**
- `anti_spam_checks JSONB`
- `skip_reason` (e.g., `author_cooldown`, `root_tweet_cooldown`)

**Config:**
- `REPLY_ROOT_TWEET_COOLDOWN_HOURS=24`
- `REPLY_AUTHOR_COOLDOWN_HOURS=12`
- `MAX_REPLIES_PER_HOUR=4`

---

### Layer 4: Enhanced ROOT-ONLY

**What:** Already implemented, but strengthened with anti-spam.

**How:**
- Verify `is_root_tweet` metadata
- Block content starting with `@`
- Anti-spam ensures we don't reply to same thread twice

---

## Observability

### New Metrics in `/status/reply`

```json
{
  "reply_metrics": {
    "context_mismatch_blocked_60m": 0,
    "low_similarity_blocked_60m": 2,
    "root_cooldown_blocked_60m": 1,
    "author_cooldown_blocked_60m": 3,
    "self_reply_blocked_60m": 0,
    "hourly_rate_blocked_60m": 0
  }
}
```

### Log Patterns

```
[CONTEXT_LOCK] ✅ Snapshot created for 2007841160015081774 hash=a3f2b8c1...
[SEMANTIC_GATE] ✅ Pass decision_id=8daaf5cd similarity=42.3%
[ANTI_SPAM] ✅ Pass decision_id=8daaf5cd reason=all_anti_spam_checks_passed

[CONTEXT_LOCK] decision_id=9cf94639 pass=false reason=context_mismatch similarity=0.23
[SEMANTIC_GATE] ⛔ Blocked decision_id=817af77d reason=low_similarity_no_topic_overlap similarity=8.2%
[ANTI_SPAM] ⛔ Blocked decision_id=46a20cd7 reason=author_cooldown cooldown=315min remaining
```

---

## Testing

### Unit Tests

```bash
pnpm test src/gates/__tests__/contextLock.test.ts
pnpm test src/gates/__tests__/semanticGate.test.ts
pnpm test src/gates/__tests__/regression.test.ts
```

### Manual Testing

1. **Turmeric/Grok Regression Test:**
   - Target: "Grok AI launches on App Store"
   - Reply: "Turmeric anti-inflammatory properties"
   - Expected: `skip_reason='low_similarity_no_topic_overlap'`

2. **Context Mismatch Test:**
   - Delete opportunity after decision creation
   - Expected: `skip_reason='opportunity_missing'`

3. **Cooldown Test:**
   - Reply to same author twice within 12h
   - Expected: Second reply blocked with `skip_reason='author_cooldown'`

---

## Deployment Checklist

- [x] Run migration: `migrations/20260104_context_lock_antispa.sql`
- [x] Add env vars to `.env`:
  ```
  CONTEXT_LOCK_MIN_SIMILARITY=0.8
  SEMANTIC_GATE_MIN_SIMILARITY=0.15
  REPLY_ROOT_TWEET_COOLDOWN_HOURS=24
  REPLY_AUTHOR_COOLDOWN_HOURS=12
  MAX_REPLIES_PER_HOUR=4
  ```
- [x] Deploy code: `railway up --detach`
- [x] Monitor logs for 1 hour
- [x] Check `/status/reply` for block counters
- [x] Verify no false positives (all posted replies are related)

---

## Success Metrics (After 24h)

| Metric | Target | Reason |
|--------|--------|--------|
| `context_mismatch_blocked_60m` | 0-2 | Should be rare (only if opportunity deleted/modified) |
| `low_similarity_blocked_60m` | 5-15% of attempts | Filters unrelated replies |
| `root_cooldown_blocked_60m` | 10-20% of attempts | Prevents duplicate replies |
| `author_cooldown_blocked_60m` | 20-30% of attempts | Prevents spamming same accounts |
| Posted replies with similarity < 0.15 | 0 | No unrelated replies |
| Posted replies to same root_tweet_id | 0 (within 24h) | No duplicates |

---

## Rollback Plan

If false positives are high (>20% of valid replies blocked):

1. **Lower thresholds (1 hour test):**
   ```bash
   export SEMANTIC_GATE_MIN_SIMILARITY=0.10
   railway up --detach
   ```

2. **Disable semantic gate (2 hour test):**
   - Comment out semantic check in `replyJob.ts:1428-1463`
   - Keep context lock + anti-spam

3. **Full rollback:**
   ```bash
   git revert HEAD
   railway up --detach
   ```

---

## Files Changed

### New Files
- `src/gates/contextLockGuard.ts` (139 lines)
- `src/gates/semanticGate.ts` (136 lines)
- `src/gates/antiSpamGuard.ts` (194 lines)
- `migrations/20260104_context_lock_antispa.sql` (72 lines)
- `CONTEXT_LOCK_IMPLEMENTATION.md` (documentation)

### Modified Files
- `src/jobs/replyJob.ts` (+150 lines, context lock + semantic + anti-spam integration)
- `src/jobs/postingQueue.ts` (+35 lines, context lock verification)
- `src/api/status.ts` (+50 lines, new metrics)

### Total Impact
- **+746 lines** of defense code
- **4 new DB columns** for observability
- **6 new metrics** in `/status/reply`
- **0 breaking changes** (all guards fail-open on errors)

