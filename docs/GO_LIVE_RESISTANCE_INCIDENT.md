# 🚨 Go-Live Resistance Incident

**Date:** 2026-01-21  
**Status:** ✅ **COOLDOWN APPLIED**  
**Severity:** WARNING

---

## 📊 Incident Summary

**Resistance Signals Detected:**
- CONSENT_WALL: 6 events (last 24h)
- POST_FAILED: 6 events (last 24h)
- CHALLENGE: 0 events

**Threshold:** CONSENT_WALL >= 5 (threshold exceeded)

---

## ✅ Backoff Status

**Verification Query:**
```sql
SELECT
  window_start,
  target_posts,
  target_replies,
  resistance_backoff_applied,
  backoff_reason
FROM growth_plans
WHERE window_start > NOW() - INTERVAL '6 hours'
ORDER BY window_start DESC
LIMIT 6;
```

**Result:**
- Plan 1 (2026-01-21 14:00:00): Backoff: **false** (targets: 2 posts, 4 replies)
- Plan 2 (2026-01-21 12:00:00): Backoff: **true** (targets: 1 posts, 2 replies)
  - Reason: "CONSENT_WALL threshold exceeded: 6 in last hour (threshold: 5)"

**Status:** ⚠️  **PARTIALLY ACTIVE** - Latest plan does not have backoff, but previous plan did. Backoff logic is working but may need adjustment for latest resistance spike.

---

## 🔍 POST_FAIL Root Cause Analysis

**Classification Query:**
```sql
SELECT
  created_at,
  event_type,
  message,
  event_data
FROM system_events
WHERE event_type IN ('POST_FAIL', 'POST_FAILED', 'CONSENT_WALL', 'CHALLENGE')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 100;
```

**Initial Classification Results:**
- **Platform Friction:** 0 events
- **UI/Selector Drift:** 6 events
- **Session Drift:** 1 event
- **Unknown:** 5 events

**Refined Analysis (POST_FAILED events):**
- **Safety Gates:** 4 events (ANCESTRY_UNCERTAIN, missing_gate_data, root_resolution_failed, OFF_LIMITS_TOPIC) ✅ Expected - gates working correctly
- **Service Role:** 1 event ("Posting only allowed from worker service")
- **Actual Posting Failures:** 0 events
- **Unknown:** 1 event

**Primary Root Cause:** **Platform Friction (CONSENT_WALL signals)** + **Safety Gates Working (POST_FAILED from gates)**

**Conclusion:** 
- CONSENT_WALL=6 indicates platform resistance (primary concern)
- POST_FAILED events are mostly safety gates blocking unsafe content (expected behavior)
- One service role check failure (may need Railway env var fix)
- Applying cooldown due to CONSENT_WALL signals to reduce platform friction

---

## 🧊 Cooldown Envelope Applied

**Action Taken:** Applied 12-hour cooldown envelope

**Start Time:** 2026-01-21T20:55:00.000Z  
**End Time:** 2026-01-22T08:55:00.000Z (12 hours)

**Caps Applied:**
- `MAX_POSTS_PER_HOUR`: 2 (unchanged, already conservative)
- `MAX_REPLIES_PER_HOUR`: 3 (reduced from 6)
- `GROWTH_CONTROLLER_MAX_STEP_POSTS`: 1 (unchanged)
- `GROWTH_CONTROLLER_MAX_STEP_REPLIES`: 2 (unchanged)

**Previous Caps:**
- `MAX_POSTS_PER_HOUR`: 2
- `MAX_REPLIES_PER_HOUR`: 6

**Reason:** Resistance signals detected (CONSENT_WALL=6, POST_FAILED=6). Applying 12h cooldown to reduce platform friction and allow system to stabilize.

**Railway Variables Updated:**
- ✅ `MAX_REPLIES_PER_HOUR=3`
- ✅ `GROWTH_CONTROLLER_MAX_STEP_POSTS=1`
- ✅ `GROWTH_CONTROLLER_MAX_STEP_REPLIES=2`
- ✅ Railway redeploy triggered

**Logged to `system_events`:**
- Event: `COOLDOWN_MODE_ACTIVE`
- Event: `COOLDOWN_MODE_SCHEDULED_END`

---

## ✅ Safety Invariants Verified

**Overrun Check:**
```sql
SELECT
  gp.window_start, gp.target_posts, gp.target_replies,
  ge.posts_done, ge.replies_done
FROM growth_plans gp
JOIN growth_execution ge ON ge.plan_id = gp.plan_id
WHERE (ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies)
  AND gp.window_start > NOW() - INTERVAL '24 hours'
ORDER BY gp.window_start DESC;
```

**Result:** ✅ **0 rows** (no overruns)

---

## 📋 Next Steps

### Immediate (Next 12 Hours)
1. **Monitor closely:**
   - Check `system_events` for new CONSENT_WALL/POST_FAILED events
   - Verify cooldown caps are being enforced
   - Monitor posting success rate

2. **Verify backoff in next plan:**
   - Next hourly plan should have `resistance_backoff_applied=true`
   - Targets should be reduced

### After 12 Hours (Cooldown End)
1. **Check exit criteria:**
   - CONSENT_WALL < 5 in last 12 hours
   - POST_FAILED rate normalized
   - No new resistance spikes

2. **Restore previous caps:**
   - `MAX_REPLIES_PER_HOUR`: Restore to 6 (or adjust based on conditions)
   - Monitor for 24h before further increases

3. **If UI/selector drift persists:**
   - Review posting selectors in `UltimateTwitterPoster`
   - Test posting flow manually
   - Update selectors if Twitter UI changed

---

## 🔧 Code Changes Made

**None** - Cooldown applied via Railway environment variables only. No code changes required.

**Future Enhancement:** Consider adding automatic cooldown detection and application in `shadowControllerJob.ts` when resistance signals exceed thresholds.

---

## 📊 Exit Criteria

**Cooldown will be manually ended when:**
1. ✅ CONSENT_WALL < 5 in last 12 hours
2. ✅ POST_FAILED rate < 2 per 12 hours
3. ✅ No new resistance spikes detected
4. ✅ System stable for 12 hours

**Next Check:** After 12 hours (2026-01-22 08:55:00 UTC)

---

---

## 🧊 Cooldown Monitoring

**Status:** ✅ **ACTIVE**

**Monitoring Schedule:**
- Cooldown monitor runs every 2 hours
- Tracks: CONSENT_WALL (2h/12h), POST_FAILED breakdown, POST_SUCCESS, overruns
- Logs trends to `system_events` as `COOLDOWN_MONITOR_CHECK`

**Current Trends (from first check):**
- CONSENT_WALL: 0 (2h), 6 (12h) - ✅ Trending DOWN
- POST_FAILED: 2 safety gates, 2 platform failures
- POST_SUCCESS: 1 (6h)
- Overruns: 0 ✅

**Exit Criteria Check:**
- Runs automatically at cooldown end (2026-01-22 09:09 UTC)
- Criteria:
  - CONSENT_WALL < 5 in last 12h
  - CHALLENGE = 0 in last 12h
  - Actual posting failures <= 1 in last 12h
- If pass: Auto-restore MAX_REPLIES_PER_HOUR to 6
- If fail: Auto-extend 12h, reduce MAX_REPLIES_PER_HOUR to 2-3

**Plan Compliance:**
- Plans generated during cooldown must respect caps:
  - MAX_POSTS_PER_HOUR: 2
  - MAX_REPLIES_PER_HOUR: 3
- Next hourly plan will be checked for compliance

---

**Incident Status:** ✅ **COOLDOWN ACTIVE**  
**Monitoring:** ✅ **CONTINUING**  
**Next Action:** Automatic exit criteria check at cooldown end time
