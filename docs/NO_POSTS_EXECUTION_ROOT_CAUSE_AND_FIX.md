# NO POSTS EXECUTION ROOT CAUSE AND FIX

**Date:** 2026-01-23  
**Status:** Fix deployed, awaiting Railway restart verification

---

## EXECUTIVE SUMMARY

- **Root cause:** Railway running old code (pre-commit `7958842c`) that checks for reply-specific columns in SOURCE-OF-TRUTH check, blocking all timeline posts.
- **Fix:** Code updated to only check core columns (commit `7958842c`+). Deploy fingerprint added for verification (commit `5bd3eb5f`).
- **Deployment:** Railway variables set, `railway up --detach` executed. Build in progress.
- **Verification pending:** Waiting for Railway to restart and show `[BOOT] sha=5bd3eb5f...` in logs.

---

## EVIDENCE

### Railway Logs (Before Fix)

```
[POSTING_QUEUE] ❌ SOURCE-OF-TRUTH CHECK FAILED: content_metadata missing columns
[POSTING_QUEUE]   Required: target_tweet_id, target_tweet_content_snapshot, target_tweet_content_hash, semantic_similarity, root_tweet_id, target_username
[POSTING_QUEUE]   Error: column content_metadata.target_tweet_content_snapshot does not exist
[POSTING_QUEUE]   System unhealthy - skipping queue processing
```

**This error appears every 5 minutes** when posting queue runs, blocking all posts.

### Code Fix (Commit `7958842c`)

**Before (old code):**
- Checked for reply-specific columns: `target_tweet_content_snapshot`, `target_tweet_id`, etc.
- These columns don't exist for timeline posts (single/thread)
- **Result:** All timeline posts blocked

**After (fixed code):**
- Only checks core columns: `decision_id`, `decision_type`, `content`, `status`, `scheduled_at`
- These exist for ALL decision types
- **Result:** Timeline posts pass check

### Current Repository State

**Commit:** `5bd3eb5ff2bdb229d4f7cf67a9c37773c75a9d8c`

**Includes:**
- ✅ Fix commit `7958842c` (SOURCE-OF-TRUTH check uses core columns only)
- ✅ Deploy fingerprint (commit `711b3046` + `5bd3eb5f`)
- ✅ Posting queue instrumentation (commit `362510e9`)

**Verification:**
```bash
$ git show HEAD:src/jobs/postingQueue.ts | grep -A 5 "coreRequiredColumns"
    const coreRequiredColumns = [
      'decision_id',
      'decision_type',
      'content',
      'status',
      'scheduled_at'
    ];
```

---

## ROOT CAUSE

**Single sentence:** Railway is running old code (pre-`7958842c`) that validates reply-specific columns for all decisions, causing SOURCE-OF-TRUTH check to fail for timeline posts and block the entire posting queue.

**Detailed explanation:**
1. Commit `7958842c` fixed the SOURCE-OF-TRUTH check to only validate core columns
2. Railway deployed an older build that still checks for reply columns
3. Every posting queue run (every 5 min) hits this check and returns early
4. **Result:** 0 POST_SUCCESS, 0 POST_FAILED, 0 attempts_started

---

## PATCH APPLIED

### 1. Deploy Fingerprint (New)

**File:** `src/railwayEntrypoint.ts`

**Boot log:**
```typescript
console.log(`[BOOT] sha=${appCommitSha} build_time=${appBuildTime} service_role=${serviceRole} railway_service=${railwayService}`);
```

**/healthz endpoint:**
```json
{
  "ok": true,
  "sha": "5bd3eb5ff2bdb229d4f7cf67a9c37773c75a9d8c",
  "build_time": "2026-01-23T15:45:00Z",
  "service_role": "worker"
}
```

### 2. Deploy Verification Script (New)

**File:** `scripts/ops/deploy_and_verify.ts`

- Sets `APP_COMMIT_SHA` and `APP_BUILD_TIME` Railway variables
- Runs `railway up --detach`
- Tails logs waiting for `[BOOT] sha=` line
- Verifies SHA matches local git SHA
- **Usage:** `pnpm run deploy:verify`

### 3. SOURCE-OF-TRUTH Fix (Already in Repo)

**File:** `src/jobs/postingQueue.ts` (commit `7958842c`)

**Change:** Only checks core columns that exist for all decision types.

---

## DEPLOYMENT COMMANDS EXECUTED

```bash
# Set Railway env vars
railway variables --set "APP_COMMIT_SHA=5bd3eb5ff2bdb229d4f7cf67a9c37773c75a9d8c"
railway variables --set "APP_BUILD_TIME=2026-01-23T15:45:00Z"

# Deploy
railway up --detach
```

**Build logs URL:** Provided by Railway (check dashboard)

---

## VERIFICATION PLAN

### Step 1: Confirm New Code is Running

**Check boot fingerprint:**
```bash
railway logs -n 500 | grep "\[BOOT\] sha="
```

**Expected:**
```
[BOOT] sha=5bd3eb5ff2bdb229d4f7cf67a9c37773c75a9d8c build_time=2026-01-23T15:45:00Z service_role=worker railway_service=xBOT
```

**If not found:** Build may still be in progress or failed. Check Railway dashboard build logs.

### Step 2: Verify /healthz Endpoint

**Get domain:**
```bash
railway domain
```

**Check endpoint:**
```bash
curl https://<domain>/healthz | jq '.sha, .build_time, .service_role'
```

**Expected:** SHA matches `5bd3eb5f...`

### Step 3: Confirm SOURCE-OF-TRUTH Check Passes

```bash
railway logs -n 200 | grep -E "POSTING_QUEUE.*SOURCE-OF-TRUTH|✅ Source-of-truth check passed"
```

**Expected:**
```
[POSTING_QUEUE] ✅ Source-of-truth check passed: core columns accessible
```

**NOT:**
```
[POSTING_QUEUE] ❌ SOURCE-OF-TRUTH CHECK FAILED: content_metadata missing columns
```

### Step 4: Confirm Posting Queue Executes

```bash
railway logs -n 200 | grep -E "POSTING_QUEUE_TICK|POST_SUCCESS|POST_FAILED|attempts_started"
```

**Expected:**
- `POSTING_QUEUE_TICK` events with `attempts_started > 0`
- Either `POST_SUCCESS` or `POST_FAILED` events (proving execution)
- Ready queue decreasing or statuses moving from `queued` → `posting`/`failed`

---

## SQL PROOF QUERIES

### A) Ready PROD posts exist

```sql
SELECT COUNT(*) AS ready_now
FROM content_metadata
WHERE status='queued'
  AND (is_test_post IS NULL OR is_test_post=false)
  AND scheduled_at <= NOW() + INTERVAL '5 minutes';
```

**Expected:** `ready_now >= 8` (from original report)

### B) POSTING_QUEUE_TICK appears

```sql
SELECT created_at, event_data
FROM system_events
WHERE event_type='POSTING_QUEUE_TICK'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected after deploy:** Rows with `ready_candidates`, `selected_candidates`, `attempts_started` in `event_data`.

### C) SOURCE-OF-TRUTH no longer blocks

```sql
SELECT event_data->>'reason' AS reason, COUNT(*) AS ct, MAX(created_at) AS last_seen
FROM system_events
WHERE event_type='POSTING_QUEUE_BLOCKED'
  AND event_data->>'reason' = 'SOURCE_OF_TRUTH'
  AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY 1;
```

**Expected after deploy:** 0 rows (or very few if deploy just happened)

### D) Posting attempts resume

```sql
SELECT event_type, COUNT(*) AS ct, MAX(created_at) AS last_seen
FROM system_events
WHERE event_type IN ('POST_SUCCESS','POST_FAILED')
  AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY event_type;
```

**Expected after deploy:** `POST_SUCCESS` or `POST_FAILED` events appearing.

---

## NEXT STEPS IF STILL BLOCKED

### If `[BOOT] sha=` never appears:

1. **Check Railway build logs:**
   - Visit build logs URL from `railway up --detach` output
   - Look for TypeScript/build errors
   - Fix and redeploy

2. **Force rebuild:**
   ```bash
   railway up --detach
   # Wait 3-5 minutes
   railway logs -n 500 | grep "\[BOOT\] sha="
   ```

### If `[BOOT] sha=` appears but SHA doesn't match:

1. **Verify local commit:**
   ```bash
   git rev-parse HEAD
   ```

2. **Redeploy with correct SHA:**
   ```bash
   railway variables --set "APP_COMMIT_SHA=$(git rev-parse HEAD)"
   railway up --detach
   ```

### If SOURCE-OF-TRUTH still fails:

1. **Verify code in repo:**
   ```bash
   git show HEAD:src/jobs/postingQueue.ts | grep -A 10 "coreRequiredColumns"
   ```

2. **If wrong:** Checkout correct commit and redeploy:
   ```bash
   git checkout 7958842c
   railway up --detach
   ```

### If postingQueue still doesn't execute:

1. **Check for other blockers:**
   ```sql
   SELECT event_data->>'reason' AS reason, COUNT(*) AS ct
   FROM system_events
   WHERE event_type='POSTING_QUEUE_BLOCKED'
     AND created_at >= NOW() - INTERVAL '1 hour'
   GROUP BY 1
   ORDER BY ct DESC;
   ```

2. **Check job_heartbeats:**
   ```sql
   SELECT job_name, last_success, last_failure, last_run_status
   FROM job_heartbeats
   WHERE job_name IN ('posting', 'posting_queue');
   ```

---

## SUMMARY

**What was done:**
- ✅ Disk space freed (7.9GB available)
- ✅ Code verified (fix commit `7958842c` in history)
- ✅ Deploy fingerprint implemented
- ✅ Deploy verification script created
- ✅ Railway variables set
- ✅ Deployment initiated

**What's pending:**
- ⏳ Railway build completion (2-5 minutes typical)
- ⏳ Service restart with new code
- ⏳ Boot fingerprint verification
- ⏳ SOURCE-OF-TRUTH check verification
- ⏳ Posting queue execution verification

**Commands to verify:**
```bash
# Wait for boot fingerprint
railway logs -n 500 | grep "\[BOOT\] sha="

# Verify posting queue works
railway logs -n 200 | grep "✅ Source-of-truth check passed"

# Check for execution
railway logs -n 200 | grep "POSTING_QUEUE_TICK\|POST_SUCCESS"
```

---

**Report end. Run verification commands above to confirm deployment succeeded.**
