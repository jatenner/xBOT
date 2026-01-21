# 🚀 Go-Live Checklist

**Mission:** Run xBOT in SHADOW mode for 24h, then ENFORCE for 48h, with monitoring.

---

## PHASE 1: SHADOW MODE (24 hours)

### ✅ Setup Complete

- [x] LaunchAgent installed and running
- [x] Daemon mode active
- [x] Shadow controller job scheduled in JobManager (hourly)
- [x] Daily bake check script ready
- [x] 72h bake report script ready

### 📊 Verification Commands

**Check LaunchAgent:**
```bash
launchctl list | grep com.xbot.runner
```

**Check Daemon Logs:**
```bash
tail -f ./.runner-profile/daemon.log
```

**Check Plans Generating:**
```bash
pnpm run go-live:status
```

**Check Plan Reasons:**
```sql
SELECT COUNT(*) 
FROM system_events
WHERE event_type = 'GROWTH_PLAN_REASON'
  AND created_at >= NOW() - INTERVAL '24 hours';
```

**Daily Bake Check:**
```bash
pnpm run bake:check
```

### Expected Results (24h Shadow)

- ✅ Plans generated hourly (24 plans)
- ✅ Plan reasons logged for each plan
- ✅ No target overruns (enforcement not active)
- ✅ Telemetry tables filling (account_snapshots, performance_snapshots)
- ✅ No inactivity alerts (daemon running)

---

## PHASE 2: ENABLE ENFORCEMENT (After 24h Shadow)

### Step 1: Set Railway Environment Variables

```bash
# Via Railway CLI or Dashboard:
GROWTH_CONTROLLER_ENABLED=true
GROWTH_CONTROLLER_MODE=enforce  # Optional, 'shadow' is default
```

**Or via Railway Dashboard:**
1. Go to Variables
2. Add/Update: `GROWTH_CONTROLLER_ENABLED=true`
3. Redeploy

### Step 2: Restart Daemon (if needed)

```bash
./scripts/mac/uninstall-launchagent.sh
./scripts/mac/install-launchagent.sh
```

### Step 3: Verify Enforcement Active

**Check logs for controller decisions:**
```bash
tail -f ./.runner-profile/daemon.log | grep GROWTH_CONTROLLER
```

**Expected logs:**
- `[GROWTH_CONTROLLER] ✅ Allowed` - Posts allowed
- `[GROWTH_CONTROLLER] ⛔ BLOCKED` - Posts blocked by plan

**Verify execution counters:**
```sql
SELECT 
  ge.plan_id,
  ge.posts_done,
  ge.replies_done,
  gp.target_posts,
  gp.target_replies
FROM growth_execution ge
JOIN growth_plans gp ON ge.plan_id = gp.plan_id
WHERE gp.window_start >= NOW() - INTERVAL '1 hour'
ORDER BY gp.window_start DESC;
```

---

## PHASE 3: ENFORCE MODE (48 hours)

### Daily Checks

**Morning Check:**
```bash
# Status
pnpm run go-live:status

# Bake check
pnpm run bake:check
```

**Key Metrics to Monitor:**
- Plans generating hourly ✅
- Execution counters incrementing ✅
- No target overruns ✅
- Reward trends improving 📈
- Resistance backoff working when needed ✅

### Expected Results (48h Enforce)

- ✅ Plans enforced (targets respected)
- ✅ Execution counters tracking correctly
- ✅ Zero target overruns
- ✅ Strategy weights influencing content/replies
- ✅ Backoff triggered when resistance detected

---

## PHASE 4: FINAL REPORT (After 72h Total)

### Generate 72h Bake Report

```bash
pnpm run bake:report
```

**Report Location:** `docs/GO_LIVE_72H_BAKE_REPORT.md`

### Report Contents

- Uptime (daemon heartbeats)
- Plans generated (#)
- Posts/replies executed (#)
- Reward trends (24h vs 72h)
- Resistance events + backoff actions
- Incidents and fixes

---

## TROUBLESHOOTING

### Plans Not Generating

**Check JobManager:**
- Verify `shadow_controller` job is scheduled
- Check Railway logs for job execution

**Manual trigger:**
```bash
pnpm run runner:controller-recompute-once
```

### Enforcement Not Working

**Verify:**
1. `GROWTH_CONTROLLER_ENABLED=true` in Railway
2. Active plan exists for current hour
3. `canPost()` being called in postingQueue
4. Logs show controller checks

**Check logs:**
```bash
tail -f ./.runner-profile/daemon.log | grep -E "(GROWTH_CONTROLLER|canPost)"
```

### Target Overruns

**Critical Issue:** If overruns detected:
1. Check enforcement logic in `postingQueue.ts`
2. Verify `canPost()` is blocking correctly
3. Check `growth_execution` counters

**Query overruns:**
```sql
SELECT 
  gp.plan_id,
  gp.target_posts,
  gp.target_replies,
  ge.posts_done,
  ge.replies_done
FROM growth_plans gp
JOIN growth_execution ge ON gp.plan_id = ge.plan_id
WHERE (ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies)
  AND gp.window_start >= NOW() - INTERVAL '24 hours';
```

### Inactivity Alerts

**If alerts appear:**
1. Check daemon is running
2. Verify CDP is accessible
3. Check session is valid
4. Review recent POST_SUCCESS events

---

## MONITORING SCHEDULE

### Hourly (Automated)
- Plans generated ✅
- Heartbeats recorded ✅

### Daily (Manual)
- Run `pnpm run bake:check`
- Run `pnpm run go-live:status`
- Review logs for errors

### After 72h
- Generate final report: `pnpm run bake:report`
- Review all metrics
- Document any incidents

---

## SUCCESS CRITERIA

**Shadow Mode (24h):**
- ✅ 24 plans generated
- ✅ 24 plan reasons logged
- ✅ Telemetry tables filling
- ✅ No inactivity alerts

**Enforce Mode (48h):**
- ✅ Plans enforced (targets respected)
- ✅ Zero target overruns
- ✅ Execution counters accurate
- ✅ Strategy weights applied
- ✅ Backoff working correctly

**Overall (72h):**
- ✅ System stable
- ✅ Reward trends positive or stable
- ✅ No critical incidents
- ✅ Ready for continued operation

---

**Current Status:** Check with `pnpm run go-live:status`
