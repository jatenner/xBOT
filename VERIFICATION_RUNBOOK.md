# VERIFICATION RUNBOOK - Context Lock & Semantic Gate

## Deployment Status

✅ **Migration Applied:** `20260104_context_lock_antispa.sql`  
✅ **Code Deployed:** Commit `3eaff3c0` - Railway build live  
✅ **Uptime:** <1 min (fresh deployment)

---

## Immediate Verification (Next 10 minutes)

### 1. Check New Status Endpoint

```bash
curl -s https://xbot-production-844b.up.railway.app/status/reply | jq '.reply_metrics | {
  context_mismatch_blocked_60m,
  low_similarity_blocked_60m,
  root_cooldown_blocked_60m,
  author_cooldown_blocked_60m,
  self_reply_blocked_60m,
  hourly_rate_blocked_60m
}'
```

**Expected:** All counters should be `0` initially (no activity yet).

---

### 2. Trigger Test Reply Cycle

```bash
source .env
curl -X POST "https://xbot-production-844b.up.railway.app/admin/run/replyJob" \
  -H "x-admin-token: $ADMIN_TOKEN"
```

---

### 3. Monitor Logs for New Guards

```bash
railway logs --lines 100 | grep -E "(CONTEXT_LOCK|SEMANTIC_GATE|ANTI_SPAM)"
```

**Expected Output:**
```
[CONTEXT_LOCK] ✅ Snapshot created for 2007841160015081774 hash=a3f2b8c1...
[SEMANTIC_GATE] ✅ Pass decision_id=8daaf5cd similarity=42.3%
[ANTI_SPAM] ✅ Pass decision_id=8daaf5cd reason=all_anti_spam_checks_passed
```

**OR (if blocking):**
```
[SEMANTIC_GATE] ⛔ Blocked decision_id=817af77d reason=low_similarity_no_topic_overlap similarity=8.2%
[ANTI_SPAM] ⛔ Blocked decision_id=46a20cd7 reason=author_cooldown
```

---

### 4. Check Database for New Columns

```sql
SELECT 
  decision_id,
  LEFT(content, 40) as content_preview,
  target_username,
  status,
  skip_reason,
  semantic_similarity,
  context_lock_verified,
  created_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** New fields populated for recent decisions.

---

## Short-Term Verification (1 hour)

### 5. Verify Context Lock is Working

**Test: Snapshot Creation**
```bash
railway logs --lines 200 | grep "CONTEXT_LOCK.*Snapshot created"
```

**Expected:** Should see snapshots being created for each reply attempt.

**Test: Hash Verification**
```bash
railway logs --lines 200 | grep "CONTEXT_LOCK.*pass="
```

**Expected:** Should see `pass=true` with similarity scores.

---

### 6. Verify Semantic Gate is Filtering

**Query blocked replies:**
```sql
SELECT 
  decision_id,
  LEFT(content, 60) as reply_preview,
  LEFT(target_tweet_content_snapshot, 60) as target_preview,
  semantic_similarity,
  skip_reason,
  created_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'blocked'
  AND skip_reason LIKE '%similarity%'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Expected:** If any blocked, verify they ARE unrelated (manual check).

---

### 7. Verify Anti-Spam is Working

**Test: Duplicate Prevention**
```sql
-- Find any root_tweet_ids we replied to multiple times
SELECT 
  root_tweet_id,
  COUNT(*) as reply_count,
  array_agg(posted_at ORDER BY posted_at) as reply_times
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'posted'
  AND root_tweet_id IS NOT NULL
  AND posted_at > NOW() - INTERVAL '24 hours'
GROUP BY root_tweet_id
HAVING COUNT(*) > 1;
```

**Expected:** **Zero results** (no duplicate replies to same root within 24h).

**Test: Author Cooldown**
```sql
-- Find any authors we replied to multiple times within 12h
SELECT 
  target_username,
  COUNT(*) as reply_count,
  array_agg(posted_at ORDER BY posted_at) as reply_times,
  EXTRACT(EPOCH FROM (MAX(posted_at) - MIN(posted_at)))/3600 as hours_between
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'posted'
  AND posted_at > NOW() - INTERVAL '12 hours'
GROUP BY target_username
HAVING COUNT(*) > 1 AND EXTRACT(EPOCH FROM (MAX(posted_at) - MIN(posted_at)))/3600 < 12;
```

**Expected:** **Zero results** (no replies to same author within 12h).

---

## Medium-Term Verification (24 hours)

### 8. Check False Positive Rate

```sql
-- Semantic gate blocks vs total attempts
SELECT 
  COUNT(*) FILTER (WHERE skip_reason LIKE '%similarity%') as semantic_blocks,
  COUNT(*) FILTER (WHERE status = 'blocked') as total_blocks,
  COUNT(*) FILTER (WHERE status = 'posted') as posted,
  ROUND(100.0 * COUNT(*) FILTER (WHERE skip_reason LIKE '%similarity%') / NULLIF(COUNT(*), 0), 1) as semantic_block_pct
FROM content_metadata
WHERE decision_type = 'reply'
  AND created_at > NOW() - INTERVAL '24 hours';
```

**Expected:** 
- `semantic_block_pct`: 5-15% (filters unrelated, but not too aggressive)
- If >20%: Lower `SEMANTIC_GATE_MIN_SIMILARITY` to 0.10

---

### 9. Verify No Unrelated Replies Posted

```sql
-- Posted replies with low similarity (should be ZERO)
SELECT 
  decision_id,
  LEFT(content, 60) as reply,
  LEFT(target_tweet_content_snapshot, 60) as target,
  semantic_similarity,
  posted_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'posted'
  AND semantic_similarity < 0.15
  AND posted_at > NOW() - INTERVAL '24 hours';
```

**Expected:** **Zero results** (no unrelated replies posted).

---

### 10. Status Endpoint Metrics

```bash
curl -s https://xbot-production-844b.up.railway.app/status/reply | jq '.reply_metrics'
```

**Expected Ranges:**
| Metric | Target Range | Notes |
|--------|--------------|-------|
| `low_similarity_blocked_60m` | 0-5 | Should filter unrelated |
| `root_cooldown_blocked_60m` | 1-10 | Prevents duplicates |
| `author_cooldown_blocked_60m` | 3-15 | Prevents spamming |
| `context_mismatch_blocked_60m` | 0-2 | Rare (only if tweet deleted) |
| `self_reply_blocked_60m` | 0 | Should never happen |

---

## Regression Test (Manual)

### Test: "Turmeric under Grok" Scenario

**Simulate the bug:**
1. Target tweet: "Breaking news: Grok AI is now available on the App Store"
2. Reply (unrelated): "Turmeric has anti-inflammatory properties"

**Expected Behavior:**
- Semantic similarity: ~5-10%
- Status: `blocked`
- Skip reason: `low_similarity_no_topic_overlap`

**Verification Query:**
```sql
SELECT * FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'blocked'
  AND content LIKE '%turmeric%'
  AND target_tweet_content_snapshot LIKE '%Grok%'
ORDER BY created_at DESC
LIMIT 1;
```

---

## Troubleshooting

### Issue: High False Positive Rate (>20%)

**Symptom:** Many valid, related replies are being blocked.

**Fix:**
```bash
# Lower semantic threshold
export SEMANTIC_GATE_MIN_SIMILARITY=0.10
railway up --detach
```

**Or disable semantic gate temporarily:**
Comment out lines 1428-1463 in `src/jobs/replyJob.ts` and redeploy.

---

### Issue: Context Lock Failures

**Symptom:** Logs show `[CONTEXT_LOCK] pass=false reason=context_mismatch`

**Causes:**
1. Opportunity was deleted between decision creation and posting
2. Tweet content was modified (rare)
3. Bug in hash computation

**Investigation:**
```sql
SELECT 
  decision_id,
  target_tweet_id,
  target_tweet_content_snapshot,
  context_lock_similarity,
  skip_reason
FROM content_metadata
WHERE skip_reason = 'context_mismatch'
ORDER BY created_at DESC
LIMIT 5;
```

**Fix:** If systematic, lower `CONTEXT_LOCK_MIN_SIMILARITY` to 0.7.

---

### Issue: No Replies Being Posted

**Symptom:** All replies are being blocked.

**Check:**
1. Are cooldowns too aggressive? 
   - Query: How many unique authors are available?
2. Is semantic gate too strict?
   - Check `semantic_similarity` distribution

**Quick Fix:**
```bash
# Relax anti-spam cooldowns
export REPLY_AUTHOR_COOLDOWN_HOURS=6
export REPLY_ROOT_TWEET_COOLDOWN_HOURS=12
railway up --detach
```

---

## Success Criteria (After 24h)

✅ **Zero unrelated replies posted** (semantic_similarity >= 0.15 for all posted)  
✅ **Zero duplicate replies** (no replies to same root_tweet_id within 24h)  
✅ **Zero self-replies** (never reply to our own tweets)  
✅ **Context lock pass rate > 95%** (most snapshots verify successfully)  
✅ **False positive rate < 20%** (valid replies not over-blocked)  
✅ **All metrics visible** in `/status/reply` endpoint

---

## Rollback Procedure

If critical issues arise:

```bash
cd /Users/jonahtenner/Desktop/xBOT

# Revert code changes
git revert 3eaff3c0

# Revert database migration
source .env
psql "$DATABASE_URL" <<EOF
ALTER TABLE content_generation_metadata_comprehensive 
  DROP COLUMN IF EXISTS target_tweet_content_snapshot,
  DROP COLUMN IF EXISTS target_tweet_content_hash,
  DROP COLUMN IF EXISTS context_lock_verified,
  DROP COLUMN IF EXISTS context_lock_similarity,
  DROP COLUMN IF EXISTS semantic_similarity,
  DROP COLUMN IF EXISTS anti_spam_checks;
EOF

# Redeploy
railway up --detach
```

---

## Contact

If verification fails or unexpected behavior:
1. Check logs: `railway logs --lines 500`
2. Check DB: Run queries above
3. Review metrics: `/status/reply` endpoint
4. Escalate with context from verification steps

