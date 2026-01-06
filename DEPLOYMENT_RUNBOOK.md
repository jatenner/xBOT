# 🚀 DEPLOYMENT RUNBOOK — Audit Trail & DB-Prewrite Fix

## DEPLOY COMMANDS

### 1. Verify current git status

```bash
cd /Users/jonahtenner/Desktop/xBOT
git status
git log --oneline -5
```

### 2. Deploy to Railway (detached mode)

```bash
railway up --detach
```

Expected output:
```
Indexed
Compressed [====================] 100%
Uploaded
Build Logs: https://railway.com/project/...
```

### 3. Wait for deployment (90 seconds)

```bash
sleep 90
curl -s https://xbot-production-844b.up.railway.app/ready | jq '{ready}'
```

Expected:
```json
{
  "ready": true
}
```

### 4. Verify deployment build SHA

```bash
railway logs -n 50 | grep "build_sha=" | head -1
```

Expected: Should show current git commit SHA

## CONTROLLED TEST — Single Post/Reply

### Step 1: Pause automated posting

```bash
# Set env var to pause queue
railway variables set POSTING_ENABLED=false
railway variables set DRAIN_QUEUE=true

# Wait for current queue to drain
sleep 60
```

### Step 2: Trigger manual reply (via admin endpoint)

```bash
curl -X POST "https://xbot-production-844b.up.railway.app/admin/run/reply-job" \
  -H "x-admin-token: xbot-admin-2025" \
  --max-time 300
```

### Step 3: Check logs for audit trail

```bash
railway logs -n 200 | grep "AUDIT_TRAIL"
```

Expected output:
```
[POST_REPLY] 📊 AUDIT_TRAIL: decision_id=... target_tweet_id=... pipeline_source=... job_run_id=... build_sha=... db_env=...
[POST_REPLY] ✅ SUCCESS: tweet_id=... decision_id=... pipeline_source=... build_sha=... db_env=...
```

### Step 4: Verify DB row exists

```bash
# Get the tweet_id from logs
TWEET_ID="<from logs>"

# Run verification script
npx tsx scripts/verify-tweet-saved.ts $TWEET_ID
```

Expected output:
```
✅ Tweet found!
   decision_id: ...
   status: posted
   posted_at: ...
   pipeline_source: postingQueue
✅ Tweet is SCRAPE-READY!
```

### Step 5: Resume automated posting

```bash
railway variables set POSTING_ENABLED=true
railway variables set DRAIN_QUEUE=false
```

## MONITORING CHECKLIST

### After Deployment

- [ ] Check `/status/reply` endpoint shows new metrics
- [ ] Verify `bypass_blocked_count` remains 0
- [ ] Monitor logs for `[ATOMIC_POST]` messages (once integrated)
- [ ] Confirm no `[BYPASS_BLOCKED]` logs appear
- [ ] Check system_events table for any critical events

### SQL Monitoring Queries

```sql
-- Check for posts in last hour
SELECT 
  decision_id,
  status,
  tweet_id,
  pipeline_source,
  posted_at
FROM content_generation_metadata_comprehensive
WHERE posted_at >= NOW() - INTERVAL '1 hour'
ORDER BY posted_at DESC;

-- Check for failed prewrite attempts
SELECT COUNT(*) as stuck_in_posting_attempt
FROM content_generation_metadata_comprehensive
WHERE status = 'posting_attempt'
  AND created_at >= NOW() - INTERVAL '1 hour';

-- Should be 0 (or tweets currently in-flight)

-- Check for prewrite failures
SELECT *
FROM system_events
WHERE event_type = 'atomic_post_prewrite_failed'
  AND created_at >= NOW() - INTERVAL '1 hour';

-- Should be 0
```

## ROLLBACK PROCEDURE

If issues detected:

### 1. Immediate pause

```bash
railway variables set POSTING_ENABLED=false
railway variables set REPLIES_ENABLED=false
```

### 2. Check last known good deployment

```bash
git log --oneline -20
railway logs -n 1000 | grep "build_sha=" | head -5
```

### 3. Rollback to previous commit (if needed)

```bash
git log --oneline -10
# Find last good commit SHA
git revert <bad-commit-sha>
railway up --detach
```

### 4. Verify rollback

```bash
sleep 90
curl -s https://xbot-production-844b.up.railway.app/ready
railway logs -n 50 | grep "build_sha="
```

## INCIDENT RESPONSE

### If bypass posting detected

1. **Immediate action:**
   ```bash
   railway variables set POSTING_ENABLED=false
   railway variables set REPLIES_ENABLED=false
   ```

2. **Investigate:**
   ```bash
   railway logs -n 5000 | grep "BYPASS_BLOCKED" > /tmp/bypass_logs.txt
   cat /tmp/bypass_logs.txt
   ```

3. **Identify caller:**
   - Check stack traces in logs
   - Find file:line of bypass attempt
   - Block that path immediately

4. **Verify DB state:**
   ```sql
   SELECT COUNT(*) as posts_without_db_row
   FROM content_generation_metadata_comprehensive
   WHERE status != 'posting_attempt'
     AND created_at >= NOW() - INTERVAL '24 hours';
   ```

### If DB-prewrite failures

1. **Check system_events:**
   ```sql
   SELECT *
   FROM system_events
   WHERE event_type IN ('atomic_post_prewrite_failed', 'atomic_post_update_failed')
     AND created_at >= NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```

2. **Identify root cause:**
   - Database connection issues?
   - Table schema mismatch?
   - Permission errors?

3. **Fix and redeploy:**
   - Address root cause
   - Test locally with `npx tsx scripts/test-atomic-post.ts`
   - Deploy with verification

## SUCCESS CRITERIA

### Post-deployment verification (within 1 hour)

- ✅ At least 1 post/reply with full audit trail in logs
- ✅ Corresponding DB row exists with status='posted'
- ✅ No `[BYPASS_BLOCKED]` logs
- ✅ No `atomic_post_prewrite_failed` events
- ✅ `bypass_blocked_count` remains 0 in `/status/reply`

### Long-term monitoring (24 hours)

- ✅ All posts have corresponding DB rows
- ✅ No tweets posted without `build_sha` in logs
- ✅ No duplicate `db_env_fingerprint` values
- ✅ Audit script passes: `npx tsx scripts/audit-posted-replies.ts 24`

## NOTES

- **Never deploy on Friday afternoon** (gives time to monitor over weekend)
- **Always check logs after deploy** (first 15 minutes critical)
- **Keep #incidents Slack channel updated** (communicate status)
- **Document any anomalies** (helps future debugging)

