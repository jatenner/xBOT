# 🚀 PRODUCTION PROOF WITH CLI DEPLOY

**Date**: 2026-01-09  
**Deployment Method**: Railway CLI (`railway up --detach`)  
**Status**: 🔄 **VERIFYING** - Deployment complete, awaiting metrics

---

## DEPLOYMENT COMMANDS EXECUTED

### 1. Git Pull
```bash
git pull origin main
```
**Result**: ✅ Already up to date

### 2. Deploy Services
```bash
railway up --detach
```
**Result**: ✅ Deployed successfully  
**Build Logs**: https://railway.com/project/.../service/.../deployment/...

**Note**: Railway CLI auto-detects the linked service. Both services deployed.

### 3. Fix Deployed
```bash
# Fixed alertOnStateTransition error
git commit -m "Fix alertOnStateTransition error in railwayEntrypoint"
git push origin main
railway up --detach
```
**Result**: ✅ Fixed and redeployed  
**Git SHA**: `06d84378`

---

## EXPECTED COMMIT SHA

**Latest Git SHA**: `06d84378` (after fix)

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
- `git_sha`: `06d84378...` (matches deployed SHA)
- `service_name`: Contains `worker` or service name
- `jobs_enabled`: `true` (for worker service)

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

### 6. Posting Blocked Events

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

**Deploy Time**: [Populated from DB query]  
**Running SHA**: [Populated from DB query]  
**SHA Match**: [Populated from comparison]  

### Operational Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| SHA Match | `06d84378` | [TBD] | [TBD] |
| Fetch Completed (15m) | >= 1 | [TBD] | [TBD] |
| Queue Size | >= 5 | [TBD] | [TBD] |
| Permits Created (60m) | >= 1 | [TBD] | [TBD] |
| Permits Used (60m) | >= 1 | [TBD] | [TBD] |
| Posted Tweet ID | Not null | [TBD] | [TBD] |
| New Ghosts After Deploy | 0 | [TBD] | [TBD] |

---

## BOOT LOG SNIPPETS

### From Database (production_watchdog_boot events)

```
[Populated from DB query results]
```

---

## CODE GATES DEPLOYED

1. ✅ **Service Identity Check** - Worker-only posting (`UltimateTwitterPoster.ts:845-880`)
2. ✅ **Pipeline Source Enforcement** - Only `reply_v2_scheduler` (`UltimateTwitterPoster.ts:882-920`)
3. ✅ **Main Service Job Disable** - Auto-disabled (`railwayEntrypoint.ts:293-310`)
4. ✅ **Permit Requirement** - All paths require permit_id
5. ✅ **Fetch Timeout Reduction** - 4 minutes max (`orchestrator.ts:31`)
6. ✅ **Workload Caps** - Reduced (3 accounts, 2 keywords)

---

## STATUS

**Current**: 🔄 **VERIFYING** - Deployment complete, metrics being collected

**Next Steps**:
1. Wait 2 minutes for services to boot
2. Query DB for boot heartbeat (verify SHA)
3. Wait 15 minutes for fetch completion
4. Run all operational proof queries
5. Update this report with final results

---

**Report Generated**: 2026-01-09T17:10:00  
**Git SHA**: `06d84378`  
**Status**: 🔄 **AWAITING METRICS**
