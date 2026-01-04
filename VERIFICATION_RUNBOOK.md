# VERIFICATION RUNBOOK - Reply Pipeline Wiring Proof

**Purpose:** Verify that all reply generation paths enforce safety gates and no bypass paths exist.

---

## PRE-DEPLOYMENT CHECKS

### 1. Build Verification
```bash
cd /Users/jonahtenner/Desktop/xBOT
pnpm build
```
**Expected:** Exit code 0, no TypeScript errors

### 2. Linter Check
```bash
pnpm lint src/jobs/replyJob.ts src/jobs/postingQueue.ts
```
**Expected:** No linter errors

### 3. Search for Bypass Patterns
```bash
# Check for direct generator imports in reply code
grep -r "import.*strategicThreads\|import.*dynamicContentGenerator" src/jobs/replyJob.ts

# Check for unsafe generation calls
grep -r "strategic_multi_generator\|thread_generator" src/jobs/replyJob.ts | grep -v "^\s*//"
```
**Expected:** No matches (or only in comments)

---

## POST-DEPLOYMENT VERIFICATION

### 4. Synthetic Reply Block Test
```bash
# Should BLOCK in production
NODE_ENV=production ts-node -e "
  const { generateSyntheticReplies } = require('./src/jobs/replyJob');
  generateSyntheticReplies()
    .then(() => console.log('❌ FAIL: Should have blocked'))
    .catch(e => console.log('✅ PASS: Blocked -', e.message));
"
```
**Expected Output:**
```
✅ PASS: Blocked - [SYNTHETIC_REPLIES] ⛔ BLOCKED: Synthetic replies bypass safety gates. Set ALLOW_SYNTHETIC_REPLIES=true if testing.
```

### 5. Database Gate Data Audit
```bash
# Check all queued reply decisions have gate data
psql "$DATABASE_URL" -c "
SELECT 
  decision_id,
  status,
  CASE WHEN target_tweet_content_hash IS NULL THEN 'MISSING' ELSE 'OK' END as hash,
  CASE WHEN semantic_similarity IS NULL THEN 'MISSING' ELSE 'OK' END as similarity,
  CASE WHEN target_tweet_content_snapshot IS NULL THEN 'MISSING' ELSE 'OK' END as snapshot,
  created_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND status IN ('queued', 'ready')
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
"
```
**Expected:** All rows show 'OK' for hash, similarity, snapshot

### 6. Safety Check Logs
```bash
# Verify safety checks run in postingQueue
railway logs --lines 200 | grep -E "SAFETY CHECK|missing_gate_data|All gate data present"
```
**Expected Output (for each reply processed):**
```
[POSTING_QUEUE] ✅ Safety check passed: All gate data present for <decision_id>
```

### 7. Blocked Decisions Audit
```bash
# Check if any decisions were blocked by safety check
psql "$DATABASE_URL" -c "
SELECT 
  decision_id,
  status,
  skip_reason,
  error_message,
  created_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'blocked'
  AND skip_reason = 'missing_gate_data_safety_block'
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
"
```
**Expected:** 
- If 0 results: All decisions properly generated with gate data ✅
- If >0 results: Log these for investigation (indicates generation bug)

### 8. Generator Source Verification
```bash
# Verify no thread generators used in reply mode
psql "$DATABASE_URL" -c "
SELECT 
  decision_id,
  generation_source,
  status,
  created_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND generation_source IN ('strategic_multi_generator', 'thread_generator', 'multi_tweet')
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
"
```
**Expected:** 0 results (no thread generators in reply mode)

### 9. End-to-End Reply Trace
```bash
# Trigger a reply job manually and trace logs
ADMIN_TOKEN=$(grep ADMIN_TOKEN .env | cut -d'=' -f2)

curl -X POST https://xbot-production-844b.up.railway.app/admin/run/replyJob \
  -H "x-admin-token: $ADMIN_TOKEN"

# Wait 10 seconds, then check logs
sleep 10
railway logs --lines 100 | grep -E "REPLY_JOB|CONTEXT_LOCK|SEMANTIC_GATE|ANTI_SPAM|SAFETY CHECK"
```
**Expected Log Sequence:**
```
[REPLY_JOB] 🚀 Starting reply generation...
[CONTEXT_LOCK] ✅ Created snapshot for <tweet_id>
[SEMANTIC_GATE] ✅ Similarity: 0.XX (threshold 0.3)
[ANTI_SPAM] ✅ No spam patterns detected
[REPLY_JOB] ✅ Reply queued decision_id=<uuid>
[POSTING_QUEUE] ✅ Safety check passed: All gate data present for <uuid>
[POSTING_QUEUE] ✅ Reply posted to <tweet_id>
```

### 10. Verify No Rehydration
```bash
# Check that postingQueue logs show using snapshot (not re-fetching)
railway logs --lines 200 | grep -E "target_tweet_content_snapshot|re-fetch|rehydrate"
```
**Expected:** 
- No mentions of "re-fetch" or "rehydrate"
- Any mentions of "target_tweet_content_snapshot" should show it's being USED, not FETCHED

---

## CONTINUOUS MONITORING

### Daily Checks

**1. Gate Data Coverage (run daily at 00:00 UTC)**
```bash
psql "$DATABASE_URL" -c "
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_replies,
  COUNT(target_tweet_content_hash) as with_hash,
  COUNT(semantic_similarity) as with_similarity,
  ROUND(100.0 * COUNT(target_tweet_content_hash) / COUNT(*), 2) as coverage_pct
FROM content_metadata
WHERE decision_type = 'reply'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
"
```
**Alert if:** coverage_pct < 100%

**2. Blocked Decisions Monitor**
```bash
psql "$DATABASE_URL" -c "
SELECT 
  skip_reason,
  COUNT(*) as count,
  MAX(created_at) as last_occurrence
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'blocked'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY skip_reason
ORDER BY count DESC;
"
```
**Alert if:** Any new skip_reason appears (investigate)

**3. Generation Source Audit**
```bash
psql "$DATABASE_URL" -c "
SELECT 
  generation_source,
  COUNT(*) as count,
  MAX(created_at) as last_used
FROM content_metadata
WHERE decision_type = 'reply'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY generation_source
ORDER BY count DESC;
"
```
**Alert if:** Any thread-oriented generator appears (strategic_multi_generator, thread_generator)

---

## REGRESSION TEST SUITE

### Test Case 1: Synthetic Reply Block
**Input:** Call `generateSyntheticReplies()` in production  
**Expected:** Throw error immediately  
**Actual:** [Run test 4 above]  
**Status:** ✅ PASS / ❌ FAIL

### Test Case 2: Missing Gate Data Block
**Input:** Manually insert decision without gate data  
```sql
INSERT INTO content_generation_metadata_comprehensive 
(decision_id, decision_type, content, status, scheduled_at)
VALUES (gen_random_uuid(), 'reply', 'Test reply', 'queued', NOW());
```
**Expected:** PostingQueue blocks with "missing_gate_data_safety_block"  
**Actual:** [Check decision status after postingQueue runs]  
**Status:** ✅ PASS / ❌ FAIL

### Test Case 3: Thread Generator in Reply Mode
**Input:** Attempt to set `generation_source='strategic_multi_generator'` for reply  
**Expected:** Pipeline guard blocks  
**Actual:** [Check generation_source audit query]  
**Status:** ✅ PASS / ❌ FAIL

### Test Case 4: Context Lock Verification
**Input:** Generate 1 reply via admin endpoint  
**Expected:** Decision has `target_tweet_content_hash` populated  
**Actual:** [Query decision row]  
**Status:** ✅ PASS / ❌ FAIL

### Test Case 5: Semantic Gate Enforcement
**Input:** Generate 1 reply via admin endpoint  
**Expected:** Decision has `semantic_similarity` >= 0.0 and <= 1.0  
**Actual:** [Query decision row]  
**Status:** ✅ PASS / ❌ FAIL

---

## ROLLBACK PROCEDURE (IF VERIFICATION FAILS)

### Emergency Rollback
```bash
# Revert to previous commit
cd /Users/jonahtenner/Desktop/xBOT
git revert HEAD --no-edit
git push origin main

# Deploy previous version
railway up --detach
```

### Disable Reply System (Circuit Breaker)
```bash
# Set rate limit to 0 in Railway dashboard
railway variables set REPLIES_PER_HOUR=0

# Or via admin endpoint
ADMIN_TOKEN=$(grep ADMIN_TOKEN .env | cut -d'=' -f2)
curl -X POST https://xbot-production-844b.up.railway.app/admin/emergency-stop-replies \
  -H "x-admin-token: $ADMIN_TOKEN"
```

---

## SUCCESS CRITERIA

All tests must pass:
- ✅ Synthetic replies blocked in production
- ✅ All queued decisions have gate data (100% coverage)
- ✅ Safety check logs visible for all reply postings
- ✅ No thread generators in reply decisions
- ✅ End-to-end trace shows all gates enforced
- ✅ No rehydration (uses snapshot from DB)

**If ALL tests pass:** Wiring proof verified ✅  
**If ANY test fails:** Investigate immediately and consider rollback
