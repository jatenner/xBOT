# 🔍 AUDIT TRAIL INVESTIGATION — Tweet 2008276153908208061

## GREP COMMANDS TO FIND ROOT CAUSE

### 1. Search for the specific tweet_id in Railway logs

```bash
railway logs -n 5000 | grep "2008276153908208061"
```

Expected: If tweet was posted by current codebase, should show:
```
[POST_TWEET] ✅ SUCCESS: tweet_id=2008276153908208061 decision_id=... pipeline_source=... build_sha=... db_env=...
```

### 2. Search for any posting activity with audit trail

```bash
railway logs -n 5000 | grep "AUDIT_TRAIL"
```

Expected: Should show all recent posts with full metadata:
```
[POST_TWEET] 📊 AUDIT_TRAIL: decision_id=... pipeline_source=... job_run_id=... build_sha=... db_env=...
```

### 3. Search for bypass blocks

```bash
railway logs -n 5000 | grep "BYPASS_BLOCKED"
```

Expected: Should show any unauthorized posting attempts with stack traces.

### 4. Search for atomic prewrite activity

```bash
railway logs -n 1000 | grep "ATOMIC_POST"
```

Expected (after atomic executor is integrated):
```
[ATOMIC_POST] ⚛️ Starting atomic post execution
[ATOMIC_POST] 📝 PREWRITE: Inserting DB row with status='posting_attempt'...
[ATOMIC_POST] ✅ PREWRITE SUCCESS: DB row inserted
[ATOMIC_POST] 🚀 POSTING: Calling Twitter API...
[ATOMIC_POST] ✅ POSTING SUCCESS: tweet_id=...
[ATOMIC_POST] 💾 UPDATE: Marking DB row as posted...
[ATOMIC_POST] ✅ UPDATE SUCCESS: DB row updated with tweet_id
```

### 5. Check for multiple running instances (different build_sha)

```bash
railway logs -n 5000 | grep "build_sha=" | awk -F'build_sha=' '{print $2}' | awk '{print $1}' | sort | uniq -c
```

Expected: Should show only ONE build_sha if only one instance running.
If multiple build_sha values appear, indicates multiple deployments running concurrently.

### 6. Check DB environment fingerprint

```bash
railway logs -n 5000 | grep "db_env=" | awk -F'db_env=' '{print $2}' | awk '{print $1}' | sort | uniq -c
```

Expected: Should show only ONE db_env fingerprint.
If multiple fingerprints appear, indicates posting to different databases.

## SQL VERIFICATION QUERIES

### Check if tweet exists in database

```sql
SELECT 
  decision_id,
  status,
  tweet_id,
  pipeline_source,
  build_sha,
  posted_at,
  created_at
FROM content_generation_metadata_comprehensive
WHERE tweet_id = '2008276153908208061';
```

Expected: Should return 1 row if tweet was posted by current system.
If returns 0 rows: Tweet was posted via bypass or different database.

### Check for posts without DB rows (last 24h)

```sql
-- This query can't be run directly (no Twitter API access)
-- But we enforce: NO POST WITHOUT PREWRITE
SELECT COUNT(*) as posts_with_prewrite_status
FROM content_generation_metadata_comprehensive
WHERE status IN ('posting_attempt', 'posted', 'failed')
  AND created_at >= NOW() - INTERVAL '24 hours';
```

### Check for failed prewrite attempts

```sql
SELECT 
  decision_id,
  status,
  skip_reason,
  created_at
FROM content_generation_metadata_comprehensive
WHERE status = 'posting_attempt'
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

Expected: Should be 0 or very few.
If many rows stuck in 'posting_attempt': Posting succeeded but update failed (critical issue).

## FINDINGS FOR TWEET 2008276153908208061

### Database Check Result

```
decision_id | pipeline_source | build_sha | job_run_id | target_tweet_id | root_tweet_id | posted_at | skip_reason
------------|-----------------|-----------|------------|-----------------|---------------|-----------|-------------
(0 rows)
```

**CONCLUSION: Tweet NOT in database → BYPASS POST**

### Likely Root Causes (Priority Order)

1. **Old deployment before PostingGuard was enforced**
   - Tweet may have been posted before current bypass protection was implemented
   - Earlier code allowed direct posting without guard or DB persistence

2. **Deprecated API endpoint still accessible**
   - Check `src/api/emergencySystem.ts`, `src/healthServer.ts` endpoints
   - Some may have been accessible but are now blocked

3. **Manual script execution**
   - Developer may have run a test script that posted directly

4. **Second running instance (different environment)**
   - Check for multiple Railway services or Vercel deployments
   - Use `railway status` to verify only one service is running

### Next Steps

1. Deploy current codebase with enhanced logging
2. Wait for next post and verify audit trail appears in logs
3. Run verification script to confirm DB truth
4. Monitor for any `[BYPASS_BLOCKED]` logs

## PERMANENT FIX IMPLEMENTED

### ✅ Enhanced Audit Logging

- Every post now logs: `build_sha`, `job_run_id`, `pipeline_source`, `decision_id`, `db_env_fingerprint`
- Success log includes `tweet_id` immediately after posting
- Full stack trace on any bypass attempt

### ✅ Atomic DB-Prewrite (Ready to Integrate)

- Created `atomicPostExecutor.ts`
- Flow: PREWRITE → POST → UPDATE
- Fail-closed: If DB insert fails, posting is BLOCKED
- All posting must go through `executeAuthorizedPost()`

### 🔄 Integration Required

Need to update `src/jobs/postingQueue.ts` to use atomic executor:

```typescript
import { executeAuthorizedPost } from '../posting/atomicPostExecutor';

// Replace direct poster.postTweet() calls with:
const result = await executeAuthorizedPost(poster, guard, {
  decision_id: decision.decision_id,
  decision_type: 'post',
  pipeline_source: decision.pipeline_source,
  build_sha: process.env.RAILWAY_GIT_COMMIT_SHA || 'dev',
  job_run_id: decision.job_run_id,
  content: decision.content,
});
```

## VERIFICATION SCRIPT

Use `scripts/verify-tweet-saved.ts <tweet_id>` to check if any tweet exists in DB:

```bash
npx tsx scripts/verify-tweet-saved.ts 2008276153908208061
```

Expected output for missing tweet:
```
❌ Tweet not found in database
```

Expected output for valid tweet:
```
✅ Tweet found!
   decision_id: ...
   status: posted
   posted_at: ...
   pipeline_source: ...
✅ Tweet is SCRAPE-READY!
```

