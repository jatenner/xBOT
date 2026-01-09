# Railway Worker Service Setup

## Purpose

If the main service (web server) doesn't reliably start job scheduling, use a dedicated worker service.

## Setup Steps

1. **Railway Dashboard** → XBOT Project → Settings → Services
2. Click **"+ New Service"**
3. Select **"GitHub Repo"** → Select xBOT repository
4. Configure service:
   - **Name**: `xBOT-Worker` (or similar)
   - **Start Command**: `pnpm tsx src/jobs/jobManagerWorker.ts`
   - **Environment**: Copy all variables from main service (especially `JOBS_AUTOSTART`, `DATABASE_URL`, `OPENAI_API_KEY`, etc.)
5. **Deploy**

## What the Worker Does

- Starts job manager directly (no web server)
- Logs boot info: RAILWAY_GIT_COMMIT_SHA, RAILWAY_ENVIRONMENT_NAME, computed JOBS_AUTOSTART
- Writes boot heartbeat to `system_events` immediately
- Keeps process alive to maintain job timers
- Emits watchdog reports every 5 minutes

## Verification

After deployment, check:

```sql
-- Boot heartbeat should appear immediately
SELECT * FROM system_events
WHERE event_type = 'production_watchdog_boot'
ORDER BY created_at DESC
LIMIT 1;

-- Watchdog reports every 5 minutes
SELECT * FROM system_events
WHERE event_type = 'production_watchdog_report'
ORDER BY created_at DESC
LIMIT 5;
```

## Entrypoint File

**File**: `src/jobs/jobManagerWorker.ts`

**Start Command**: `pnpm tsx src/jobs/jobManagerWorker.ts`

This file:
- Imports and starts `JobManager.getInstance().startJobs()`
- Starts production watchdog (which writes boot heartbeat)
- Keeps process alive

