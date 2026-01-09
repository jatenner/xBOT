# Railway Worker Service Setup - ONE MANUAL STEP

## 🎯 PURPOSE

Worker-first architecture ensures jobs run reliably even if main service is unstable.

## ✅ SINGLE MANUAL STEP

### Railway Dashboard → Create Worker Service

1. **Go to**: Railway Dashboard → XBOT Project → Settings → Services
2. **Click**: "+ New Service"
3. **Select**: "GitHub Repo" → Select xBOT repository
4. **Configure**:
   - **Name**: `xBOT-worker` (or any name you prefer)
   - **Start Command**: `pnpm tsx src/jobs/jobManagerWorker.ts`
   - **Environment**: Copy ALL variables from main service (click "Copy from..." or manually copy)
5. **Save** → Railway will auto-deploy

**That's it!** Worker will start automatically.

---

## 🔍 WHAT THE WORKER DOES

1. **Boot Sequence**:
   - Logs Railway environment info
   - Probes database connectivity (fails fast if unreachable)
   - Starts job manager (which starts watchdog + writes boot heartbeat)
   - Keeps process alive

2. **Job Scheduling**:
   - Starts all scheduled jobs (fetch, scheduler, etc.)
   - Uses same config logic as main service
   - Autostart ON if `RAILWAY_ENVIRONMENT_NAME === 'production'`

3. **Watchdog**:
   - Writes boot heartbeat immediately on start
   - Writes health reports every 5 minutes
   - Self-heals if jobs stall

---

## ✅ VERIFICATION AFTER DEPLOYMENT

Wait 2-3 minutes for Railway to deploy, then run:

```bash
pnpm tsx scripts/full_production_proof.ts
```

**Expected Results**:
- ✅ Boot heartbeat found (`production_watchdog_boot`)
- ✅ Watchdog reports >= 2 in last 15 minutes
- ✅ Fetch started >= 1 in last 10 minutes
- ✅ Judge calls > 0 in last 30 minutes
- ✅ Queue size > 0

---

## 🔍 TROUBLESHOOTING

### If Worker Fails to Start

**Check Railway Logs** for:
- `[WORKER] ❌ Database probe FAILED` → Check DATABASE_URL
- `[WORKER] ❌ Failed to start job manager` → Check error message
- `[WORKER] 💀 FAILING FAST` → Database connectivity issue

### If Boot Heartbeat Not Found

**Check**:
1. Worker service is running (Railway → Services → xBOT-worker)
2. Database connectivity (check logs for probe errors)
3. `system_events` table exists and is writable

### If Jobs Not Ticking

**Check**:
1. Railway logs for `🕒 JOB_MANAGER: Job scheduling ENABLED`
2. `RAILWAY_ENVIRONMENT_NAME` is set to `production`
3. Watchdog reports show `jobs_enabled=true`

---

## 📊 MONITORING

**Watchdog Reports** (every 5 minutes):
```sql
SELECT * FROM system_events
WHERE event_type = 'production_watchdog_report'
ORDER BY created_at DESC
LIMIT 5;
```

**Boot Heartbeat**:
```sql
SELECT * FROM system_events
WHERE event_type = 'production_watchdog_boot'
ORDER BY created_at DESC
LIMIT 1;
```

---

## 🎯 SUMMARY

**One Step**: Create Railway service with start command `pnpm tsx src/jobs/jobManagerWorker.ts`

**Result**: Reliable job scheduling independent of main service

**Verification**: Run `pnpm tsx scripts/full_production_proof.ts` after 5 minutes

