# CONTEXT LOCK & SEMANTIC GATE - ROOT CAUSE FIX

## Executive Summary

**Root Cause:** Reply generation receives `opportunity.tweet_content` without verification that:
1. The text is non-empty (can be NULL → fallback to generic reply)
2. The text matches the target_tweet_id (stale data → wrong context)
3. The reply is semantically related to the text (no validation → unrelated replies)

**Result:** Bot posts replies like "turmeric/food as medicine" under "Grok/App Store" threads.

---

## Solution: 4-Layer Defense

### Layer 1: Context Lock (PREVENT SELECT/GENERATE/POST MISMATCH)
- **At decision creation:** Snapshot tweet text + compute SHA256 hash
- **At post time:** Re-fetch tweet text, verify hash or 80%+ similarity
- **On mismatch:** Block with `status='blocked'`, `skip_reason='context_mismatch'`

### Layer 2: Semantic Gate (BLOCK UNRELATED REPLIES)
- Compute cosine similarity between target text and reply content
- Block if similarity < 15% AND no topic overlap
- Configurable via `SEMANTIC_GATE_MIN_SIMILARITY` env var

### Layer 3: Anti-Spam (PREVENT DUPLICATE REPLIES)
- 1 reply per root_tweet_id per 24h (configurable)
- 1 reply per author per 12h (configurable)
- Never reply to our own tweets
- Enforce 4 replies/hour rate limit

### Layer 4: Enhanced ROOT-ONLY (STRUCTURAL VERIFICATION)
- Already implemented in previous phase
- Verifies `is_root_tweet` metadata from DB
- Blocks if content starts with `@`

---

## Code Changes Required

### A) Integration in replyJob.ts (Decision Creation)

```typescript
// At line ~1405 (where decision is created)
import { createContextSnapshot, storeContextSnapshot } from '../gates/contextLockGuard';
import { checkSemanticGate } from '../gates/semanticGate';
import { checkAntiSpam } from '../gates/antiSpamGuard';

// After strategicReply is generated (~line 1375)
const decision_id = uuidv4();

// 1) CREATE CONTEXT SNAPSHOT
const contextSnapshot = await createContextSnapshot(
  tweetIdFromUrl,
  target.tweet_content || '',
  target.account.username
);

// 2) RUN SEMANTIC GATE
const semanticResult = await checkSemanticGate(
  contextSnapshot.target_tweet_text,
  strategicReply.content
);

if (!semanticResult.pass) {
  console.log(`[SEMANTIC_GATE] ⛔ Blocked decision_id=${decision_id} reason=${semanticResult.reason} similarity=${(semanticResult.similarity * 100).toFixed(1)}%`);
  
  // Store blocked decision
  await supabaseClient.from('content_generation_metadata_comprehensive').insert({
    decision_id,
    decision_type: 'reply',
    content: strategicReply.content,
    target_tweet_id: tweetIdFromUrl,
    target_username: target.account.username,
    status: 'blocked',
    skip_reason: semanticResult.reason,
    semantic_similarity: semanticResult.similarity,
    created_at: new Date().toISOString()
  });
  
  continue; // Skip this opportunity
}

// 3) RUN ANTI-SPAM CHECKS
const antiSpamResult = await checkAntiSpam(
  reply.root_tweet_id || null,
  tweetIdFromUrl,
  target.account.username
);

if (!antiSpamResult.pass) {
  console.log(`[ANTI_SPAM] ⛔ Blocked decision_id=${decision_id} reason=${antiSpamResult.reason}`);
  
  // Store blocked decision
  await supabaseClient.from('content_generation_metadata_comprehensive').insert({
    decision_id,
    decision_type: 'reply',
    content: strategicReply.content,
    target_tweet_id: tweetIdFromUrl,
    target_username: target.account.username,
    status: 'blocked',
    skip_reason: antiSpamResult.reason,
    anti_spam_checks: antiSpamResult,
    created_at: new Date().toISOString()
  });
  
  continue; // Skip this opportunity
}

// 4) STORE CONTEXT SNAPSHOT
const reply = {
  decision_id,
  content: strategicReply.content,
  target_username: target.account.username,
  target_tweet_id: tweetIdFromUrl,
  target_tweet_content: target.tweet_content,
  target_tweet_content_snapshot: contextSnapshot.target_tweet_text,
  target_tweet_content_hash: contextSnapshot.target_tweet_text_hash,
  semantic_similarity: semanticResult.similarity,
  // ... rest of fields
};
```

### B) Integration in postingQueue.ts (Pre-Post Verification)

```typescript
// In checkReplyInvariantsPrePost() function (~line 50)
import { verifyContextLock, ContextSnapshot } from '../gates/contextLockGuard';

// Add context lock check BEFORE posting
async function checkReplyInvariantsPrePost(decision: any): Promise<InvariantCheckPrePost> {
  // ... existing checks ...
  
  // 5) CONTEXT LOCK VERIFICATION
  try {
    // Fetch snapshot from decision metadata
    const { data: decisionData } = await supabase
      .from('content_metadata')
      .select('target_tweet_content_snapshot, target_tweet_content_hash, target_tweet_id, target_username')
      .eq('decision_id', decision.id)
      .single();
    
    if (decisionData && decisionData.target_tweet_content_hash) {
      const snapshot: ContextSnapshot = {
        target_tweet_id: decisionData.target_tweet_id,
        target_tweet_text: decisionData.target_tweet_content_snapshot,
        target_tweet_text_hash: decisionData.target_tweet_content_hash,
        target_author: decisionData.target_username,
        snapshot_at: new Date().toISOString()
      };
      
      const lockResult = await verifyContextLock(snapshot);
      
      if (!lockResult.pass) {
        guardResults.context_lock = { 
          pass: false, 
          reason: lockResult.reason,
          similarity: lockResult.similarity 
        };
        console.log(`[CONTEXT_LOCK] decision_id=${decisionId} pass=false reason=${lockResult.reason} similarity=${lockResult.similarity}`);
        return { pass: false, reason: lockResult.reason, guard_results: guardResults };
      }
      
      guardResults.context_lock = { pass: true, similarity: lockResult.similarity };
      console.log(`[CONTEXT_LOCK] decision_id=${decisionId} pass=true similarity=${lockResult.similarity}`);
    }
  } catch (lockError: any) {
    console.warn(`[CONTEXT_LOCK] ⚠️ Verification failed: ${lockError.message}`);
    // Fail open on transient errors (allow posting)
  }
  
  return { pass: true, reason: 'ok', guard_results: guardResults };
}
```

### C) Update status.ts (Monitoring Metrics)

```typescript
// Add to reply_metrics interface
reply_metrics?: {
  // ... existing fields ...
  context_mismatch_blocked_60m: number;
  low_similarity_blocked_60m: number;
  root_cooldown_blocked_60m: number;
  author_cooldown_blocked_60m: number;
  self_reply_blocked_60m: number;
  hourly_rate_blocked_60m: number;
};

// In getReplyMetrics() function
const blockedByReasonResult = await pgPool.query(`
  SELECT 
    COUNT(*) FILTER (WHERE skip_reason = 'context_mismatch') as context_mismatch,
    COUNT(*) FILTER (WHERE skip_reason LIKE '%similarity%') as low_similarity,
    COUNT(*) FILTER (WHERE skip_reason = 'root_tweet_cooldown') as root_cooldown,
    COUNT(*) FILTER (WHERE skip_reason = 'author_cooldown') as author_cooldown,
    COUNT(*) FILTER (WHERE skip_reason = 'self_reply_blocked') as self_reply,
    COUNT(*) FILTER (WHERE skip_reason = 'hourly_rate_limit_reached') as hourly_rate
  FROM content_generation_metadata_comprehensive
  WHERE decision_type = 'reply'
    AND status = 'blocked'
    AND created_at >= $1
`, [sixtyMinutesAgo]);
```

---

## Testing Strategy

### Unit Tests (Create `src/gates/__tests__/contextLock.test.ts`)

```typescript
import { hashTweetText, computeTextSimilarity, createContextSnapshot } from '../contextLockGuard';

describe('Context Lock Guard', () => {
  test('hash is deterministic', () => {
    const text = 'Breaking: Grok AI launches on App Store';
    const hash1 = hashTweetText(text);
    const hash2 = hashTweetText(text);
    expect(hash1).toBe(hash2);
  });
  
  test('similarity detects identical text', () => {
    const text = 'Health benefits of turmeric';
    const sim = computeTextSimilarity(text, text);
    expect(sim).toBeGreaterThan(0.9);
  });
  
  test('similarity detects unrelated text', () => {
    const target = 'Grok AI launches on App Store';
    const reply = 'Turmeric has anti-inflammatory properties';
    const sim = computeTextSimilarity(target, reply);
    expect(sim).toBeLessThan(0.2);
  });
});
```

### Regression Test (Create `src/gates/__tests__/regression.test.ts`)

```typescript
import { checkSemanticGate } from '../semanticGate';

describe('Regression: Turmeric under Grok thread', () => {
  test('blocks unrelated reply', async () => {
    const targetText = 'Breaking news: Grok AI is now available on the App Store. Download and try the new conversational AI assistant.';
    const replyText = 'Did you know turmeric has powerful anti-inflammatory properties? Adding it to your diet can improve joint health and reduce chronic pain.';
    
    const result = await checkSemanticGate(targetText, replyText);
    
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('low_similarity');
  });
  
  test('allows related reply', async () => {
    const targetText = 'Breaking news: Grok AI is now available on the App Store.';
    const replyText = 'Exciting development! AI assistants like Grok are making conversational tech more accessible. Looking forward to seeing how it compares to other platforms.';
    
    const result = await checkSemanticGate(targetText, replyText);
    
    expect(result.pass).toBe(true);
  });
});
```

---

## Runbook: Verification

### 1. Deploy Changes

```bash
# Run migration
cd /Users/jonahtenner/Desktop/xBOT
source .env
psql "$DATABASE_URL" < migrations/20260104_context_lock_antispa.sql

# Deploy code
git add -A
git commit -m "feat: context lock + semantic gate to prevent unrelated replies"
railway up --detach
```

### 2. Monitor Logs

```bash
railway logs --lines 200 | grep -E "(CONTEXT_LOCK|SEMANTIC_GATE|ANTI_SPAM)"

# Expected output:
# [CONTEXT_LOCK] ✅ Hash match (exact) for 2007841160015081774
# [SEMANTIC_GATE] similarity=45.2% min=15% pass=true
# [ANTI_SPAM] ✅ all_anti_spam_checks_passed
```

### 3. Check Database

```sql
-- Recently blocked decisions
SELECT 
  decision_id,
  LEFT(content, 50) as content_preview,
  target_tweet_id,
  status,
  skip_reason,
  semantic_similarity,
  context_lock_similarity,
  created_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'blocked'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;

-- Recently posted replies (should all have high similarity)
SELECT 
  decision_id,
  LEFT(content, 50) as content_preview,
  target_username,
  semantic_similarity,
  context_lock_verified,
  posted_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'posted'
  AND posted_at > NOW() - INTERVAL '1 hour'
ORDER BY posted_at DESC;
```

### 4. Verify `/status/reply` Endpoint

```bash
curl -s https://xbot-production-844b.up.railway.app/status/reply | jq '.reply_metrics | {
  context_mismatch_blocked_60m,
  low_similarity_blocked_60m,
  root_cooldown_blocked_60m,
  author_cooldown_blocked_60m
}'

# Expected: All counters should be 0 or low (no false positives)
```

### 5. Trigger Test Reply

```bash
# Trigger reply job
curl -X POST "https://xbot-production-844b.up.railway.app/admin/run/replyJob" \
  -H "x-admin-token: $ADMIN_TOKEN"

# Check logs for guard activity
railway logs --lines 50 | tail -20
```

---

## Environment Variables

Add to `.env`:

```bash
# Context Lock
CONTEXT_LOCK_MIN_SIMILARITY=0.8

# Semantic Gate
SEMANTIC_GATE_MIN_SIMILARITY=0.15

# Anti-Spam
REPLY_ROOT_TWEET_COOLDOWN_HOURS=24
REPLY_AUTHOR_COOLDOWN_HOURS=12
MAX_REPLIES_PER_HOUR=4
```

---

## Success Criteria

✅ **Context Lock:** All posted replies have `context_lock_verified=true` and `context_lock_similarity >= 0.8`

✅ **Semantic Gate:** No replies with `semantic_similarity < 0.15` are posted

✅ **Anti-Spam:** No duplicate replies to same root_tweet_id within 24h

✅ **Observability:** `/status/reply` shows block counters for each gate

✅ **Regression Test:** "Turmeric under Grok" scenario is blocked with `skip_reason='low_similarity_no_topic_overlap'`

---

## Rollback Plan

If gates cause false positives:

1. Lower thresholds:
   - `SEMANTIC_GATE_MIN_SIMILARITY=0.10`
   - `CONTEXT_LOCK_MIN_SIMILARITY=0.7`

2. Disable semantic gate temporarily:
   - Comment out semantic check in replyJob.ts
   - Context lock will still prevent mismatches

3. Full rollback:
   ```bash
   git revert HEAD
   railway up --detach
   ```

