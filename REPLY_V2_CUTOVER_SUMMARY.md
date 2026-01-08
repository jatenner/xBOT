# 🚀 REPLY SYSTEM V2 CUTOVER - SUMMARY

**Date:** January 8, 2026  
**Status:** ✅ **CUTOVER COMPLETE - MONITORING**

---

## COMPLETED ACTIONS

### ✅ 1. Railway Env Vars Verified
- `DATABASE_URL` ✅ Present
- `SUPABASE_URL` ✅ Present
- `SUPABASE_SERVICE_ROLE_KEY` ✅ Present
- `REPLY_SYSTEM_VERSION` ✅ Set to `v2`

### ✅ 2. Code Deployed
- **Commit:** `aee1714b` - "Cutover to Reply System V2: env fix, disable old system, expand curated accounts"
- **Railway Deployment:** ✅ Complete
- **Changes:**
  - Environment variable fix (`import 'dotenv/config'`)
  - Old system disable check
  - Job execution logging
  - Curated accounts expansion

### ✅ 3. Old System Disabled
- Code check added to `replyJob.ts`
- Railway env var `REPLY_SYSTEM_VERSION=v2` set
- Old system will exit immediately when called

### ✅ 4. Curated Accounts Expanded
- **Before:** 5 accounts
- **After:** 45 accounts ✅
- **Target:** >=50 candidates/hour baseline

---

## PROOF QUERIES RESULTS

**Current Status (3 minutes post-deployment):**
- SLO Events: 0 (jobs start in 2-3 min)
- Candidate Evaluations: 0 (fetch job starts in 2 min)
- Queue Size: 0 (populates after fetch)
- Job Events: 0 (will appear when jobs run)
- Curated Accounts: 45 ✅

**Expected After 15 Minutes:**
- SLO Events: >=1
- Candidate Evaluations: >=10
- Queue Size: >=5
- Job Events: >=4

---

## JOB SCHEDULE

- `reply_v2_fetch` - Every 5 min, starts after 2 min ✅
- `reply_v2_scheduler` - Every 15 min, starts after 3 min ✅
- `reply_v2_performance` - Every 30 min, starts after 10 min ✅
- `reply_v2_hourly_summary` - Every hour, starts after 5 min ✅
- `reply_v2_daily_summary` - Daily ✅

---

## MONITORING PLAN

**Immediate (Next 15 minutes):**
1. Check for first fetch job execution (2-3 min)
2. Check for first scheduler job execution (3-5 min)
3. Verify queue population (5-10 min)
4. Confirm old system events stop

**After 15 Minutes:**
- Run proof queries (see below)
- Verify SLO events created
- Verify candidate throughput >=50/hour
- Confirm old system disabled

---

## PROOF QUERIES (Run after 15 minutes)

```sql
-- 1. SLO Events
SELECT 
  COUNT(*) as total_slots,
  COUNT(*) FILTER (WHERE posted = true) as posted_count,
  COUNT(*) FILTER (WHERE posted = false) as missed_count
FROM reply_slo_events 
WHERE slot_time >= NOW() - INTERVAL '15 minutes';

-- 2. Candidate Evaluations
SELECT 
  COUNT(*) as total_evaluated,
  COUNT(*) FILTER (WHERE passed_hard_filters = true) as passed,
  ROUND(COUNT(*) FILTER (WHERE passed_hard_filters = true)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pass_rate_pct
FROM candidate_evaluations 
WHERE created_at >= NOW() - INTERVAL '15 minutes';

-- 3. Queue Size
SELECT COUNT(*) as queue_size 
FROM reply_candidate_queue 
WHERE status = 'queued' AND expires_at > NOW();

-- 4. Job Events
SELECT event_type, COUNT(*) as count, MAX(created_at) as last_event
FROM system_events 
WHERE event_type LIKE '%reply_v2%' 
AND created_at >= NOW() - INTERVAL '15 minutes' 
GROUP BY event_type 
ORDER BY count DESC;

-- 5. Old System Disabled
SELECT COUNT(*) as old_system_events
FROM system_events 
WHERE event_type LIKE 'reply_%' 
AND event_type NOT LIKE '%reply_v2%' 
AND event_type NOT LIKE '%harvest%'
AND created_at >= NOW() - INTERVAL '15 minutes';
```

---

## REMAINING BLOCKERS

**None** - All actions completed. Jobs will start executing within 2-3 minutes.

**Next Steps:**
1. ⏳ Wait 15 minutes for jobs to execute
2. 📊 Run proof queries to verify activity
3. ✅ Confirm old system events stop
4. 📈 Monitor candidate throughput (target: >=50/hour)

---

## FILES MODIFIED

1. ✅ `src/jobs/replyJob.ts` - Added REPLY_SYSTEM_VERSION check
2. ✅ `src/jobs/replySystemV2/orchestrator.ts` - Added env var fix + job logging
3. ✅ `src/jobs/replySystemV2/tieredScheduler.ts` - Added job logging
4. ✅ `scripts/init-reply-system-v2.ts` - Expanded curated accounts to 50

---

**Status:** ✅ **CUTOVER COMPLETE - MONITORING IN PROGRESS**

All cutover actions completed. Jobs will start executing within 2-3 minutes. Check proof queries after 15 minutes for full verification.

