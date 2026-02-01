# Railway Scheduler Preflight Timeout Setup

## Overview
The scheduler preflight timeout controls how long the scheduler waits when checking if a tweet is accessible before creating a decision. For P1 proving, we need a 20s timeout to accommodate real-world Twitter latency.

## Setup Steps

### 1. Navigate to Railway Dashboard
1. Go to https://railway.app
2. Select your project
3. Click on the `serene-cat` service (or the service that runs the scheduler)

### 2. Add Environment Variable
1. Click on the **Variables** tab
2. Click **+ New Variable**
3. Set:
   - **Key**: `SCHEDULER_PREFLIGHT_TIMEOUT_MS`
   - **Value**: `20000`
4. Click **Add**

### 3. Verify Deployment
1. Railway will automatically redeploy with the new variable
2. Check deployment logs to confirm the service restarted
3. Look for scheduler logs showing the timeout is being used (20s instead of default 6s)

### 4. Verify via Logs
After deployment, check Railway logs for scheduler runs. You should see:
- Preflight attempts completing successfully (not timing out)
- Decisions being created with `preflight_status=ok`

## Verification Query
```sql
-- Check decisions created with preflight ok
SELECT decision_id, features->>'preflight_status' AS preflight_status, created_at
FROM content_generation_metadata_comprehensive
WHERE decision_type='reply'
  AND pipeline_source IN ('reply_v2_planner','reply_v2_scheduler')
  AND features->>'preflight_status'='ok'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting
- If scheduler still times out: Check Railway logs for actual timeout values
- If decisions not created: Verify `REPLY_V2_PLAN_ONLY` is set correctly
- If preflight fails: Check Twitter session/auth status
