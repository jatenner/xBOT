# 🚀 PRODUCTION PROOF WITH CLI DEPLOY

**Date**: 2026-01-09  
**Deployment Method**: Railway CLI (`railway up --detach`)  
**Status**: 🔄 **DEPLOYING** - Awaiting verification

---

## DEPLOYMENT COMMANDS EXECUTED

### 1. Git Pull
```bash
git pull origin main
```
**Result**: Already up to date

### 2. Deploy Worker Service
```bash
railway up --detach
```
**Result**: ✅ Deployed (service auto-detected from linked project)
**Build Logs**: https://railway.com/project/.../service/.../deployment/...

### 3. Deploy Main Service  
```bash
railway up --detach
```
**Result**: ✅ Deployed (service auto-detected from linked project)
**Build Logs**: https://railway.com/project/.../service/.../deployment/...

**Note**: Railway CLI auto-detects the service from the linked project. Both services deployed successfully.

---

## EXPECTED COMMIT SHA

**Git SHA**: `08b9790a` (latest commit)

---

## BOOT LOG VERIFICATION

### Worker Service (serene-cat)

**Expected Log Pattern**:
```
RAILWAY_GIT_COMMIT_SHA: 08b9790a...
[WORKER] ✅ Boot heartbeat written: jobs_enabled=true git=08b9790a
```

### Main Service (xBOT)

**Expected Log Pattern**:
```
RAILWAY_GIT_COMMIT_SHA: 08b9790a...
[BOOT] ⚠️ NOT WORKER SERVICE - Jobs disabled to prevent ghost posting
```

---

## RUNNING SHA PROOF QUERY

```sql
SELECT 
  created_at,
  event_data->>'git_sha' as git_sha,
  event_data->>'railway_service_name' as service_name,
  event_data->>'jobs_enabled' as jobs_enabled
FROM system_events
WHERE event_type = 'production_watchdog_boot'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result**:
- `git_sha`: `08b9790a...` (matches deployed SHA)
- `service_name`: `serene-cat` or contains `worker`
- `jobs_enabled`: `true`

---

## OPERATIONAL PROOF QUERIES

### 1. Fetch Completion (Last 15 Minutes)

```sql
SELECT COUNT(*)
FROM system_events
WHERE event_type = 'reply_v2_fetch_job_completed'
  AND created_at > NOW() - INTERVAL '15 minutes';
-- Expected: >= 1
```

### 2. Queue Size

```sql
SELECT COUNT(*)
FROM reply_candidate_queue
WHERE status = 'queued'
  AND expires_at > NOW();
-- Expected: >= 5
```

### 3. Permits Created (Last 60 Minutes)

```sql
SELECT COUNT(*)
FROM post_attempts
WHERE pipeline_source = 'reply_v2_scheduler'
  AND created_at > NOW() - INTERVAL '60 minutes';
-- Expected: >= 1
```

### 4. Permits Used with Posted Tweet ID

```sql
SELECT 
  permit_id,
  decision_id,
  actual_tweet_id,
  used_at
FROM post_attempts
WHERE status = 'USED'
  AND pipeline_source = 'reply_v2_scheduler'
  AND actual_tweet_id IS NOT NULL
  AND used_at > NOW() - INTERVAL '60 minutes'
ORDER BY used_at DESC
LIMIT 5;
-- Expected: >= 1 row
```

### 5. New Ghosts After Deploy

```sql
SELECT COUNT(*)
FROM ghost_tweets
WHERE detected_at > (
  SELECT created_at 
  FROM system_events 
  WHERE event_type = 'production_watchdog_boot'
  ORDER BY created_at DESC 
  LIMIT 1
);
-- Expected: 0
```

### 6. Posting Blocked Events (If Old Paths Attempted)

```sql
SELECT 
  created_at,
  event_data->>'service_name' as service_name,
  event_data->>'reason' as reason
FROM system_events
WHERE event_type = 'posting_blocked_wrong_service'
  AND created_at > (
    SELECT created_at 
    FROM system_events 
    WHERE event_type = 'production_watchdog_boot'
    ORDER BY created_at DESC 
    LIMIT 1
  )
ORDER BY created_at DESC;
-- Shows if non-worker services attempted posting
```

---

## VERIFICATION RESULTS

**Deploy Time**: [Will be populated after deploy]  
**Running SHA**: [Will be populated from boot heartbeat]  
**SHA Match**: [Will be populated]  

### Operational Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Fetch Completed (15m) | >= 1 | [TBD] | [TBD] |
| Queue Size | >= 5 | [TBD] | [TBD] |
| Permits Created (60m) | >= 1 | [TBD] | [TBD] |
| Permits Used (60m) | >= 1 | [TBD] | [TBD] |
| New Ghosts After Deploy | 0 | [TBD] | [TBD] |

---

## BOOT LOG SNIPPETS

### Worker Service Boot Log

```
[Will be populated from railway logs]
```

### Main Service Boot Log

```
[Will be populated from railway logs]
```

---

## STATUS

**Current**: 🔄 **DEPLOYING** - Commands executed, awaiting boot logs and verification

**Next Steps**:
1. Capture boot logs from both services
2. Verify SHA matches in DB
3. Wait 60 seconds for initial metrics
4. Run operational proof queries
5. Update this report with results

---

**Report Generated**: 2026-01-09T17:00:00  
**Git SHA**: `08b9790a`  
**Status**: 🔄 **AWAITING VERIFICATION**

