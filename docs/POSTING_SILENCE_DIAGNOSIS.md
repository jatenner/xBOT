# 🔍 POSTING SILENCE DIAGNOSIS

**Generated:** 2026-01-23T03:31:09.691Z (1/22/2026, 10:31:09 PM)
**Git SHA:** 52cba93a

## Key Facts

- **Last POST_SUCCESS:** Thu Jan 22 2026 13:41:39 GMT-0500 (Eastern Standard Time) (8.83h ago)
- **Silence Status:** 🔴 SILENCED (>2h since last success)

### Pipeline State

**Status Counts (last 6h):**
- queued: 4

**Ready to Post Now:** 7 decisions

### Planning

- **Latest Plan:** Thu Jan 22 2026 21:38:17 GMT-0500 (Eastern Standard Time) (0.88h ago)
- **Targets:** 2 posts, 4 replies

### Runner/Heartbeat Signals

- **Shadow Controller:** Thu Jan 22 2026 21:38:17 GMT-0500 (Eastern Standard Time) (53 min ago)

- **posting_queue_started:** 1 min ago
- **GO_LIVE_MONITOR_CHECK:** 1838 min ago

## Root Cause Classification

**Matched Case:** CASE 2: Ready decisions exist but no executions
**Reason:** Decisions are ready but runner is not executing them (runner stale / CDP not acting)

**Evidence:**
- Ready to post count: 7
- Recent execution attempts (last 2h): 0
- Runner may be stale or CDP connection lost

## Immediate Fix (Next 10 Minutes)

1. Check runner status:
   - Verify runner process is running: `launchctl list | grep com.xbot.runner`
   - Check runner logs: `tail -f .runner-profile/runner.log`
   - Verify CDP connection: `curl -s http://127.0.0.1:9222/json | head -3`

2. Restart runner if needed:
   - `pnpm run runner:restart`

## Console Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           🔍 POSTING SILENCE DIAGNOSTIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Current Time:
   UTC: 2026-01-23T03:31:09.691Z
   Local: 1/22/2026, 10:31:09 PM
   Git SHA: 52cba93a

📊 Querying POST_SUCCESS and failures...

📈 Last POST_SUCCESS:
   Timestamp: Thu Jan 22 2026 13:41:39 GMT-0500 (Eastern Standard Time)
   Tweet ID: 2014365495294570882
   Decision ID: d6f67ec0-8065-43bf-a587-cbe05717f9f7
   Hours ago: 8.83

📦 Inspecting pipeline state...

📊 Content Status Counts (last 6h):
   queued: 4

📋 Oldest Queued/Scheduled Decisions:
   1. decision_id=83806a8e... status=queued scheduled_at=Thu Jan 22 2026 15:16:30 GMT-0500 (Eastern Standard Time) is_test_post=false
   2. decision_id=b2729c6f... status=queued scheduled_at=Thu Jan 22 2026 15:42:36 GMT-0500 (Eastern Standard Time) is_test_post=false
   3. decision_id=1f661b55... status=queued scheduled_at=Thu Jan 22 2026 16:13:00 GMT-0500 (Eastern Standard Time) is_test_post=false
   4. decision_id=4e02c6da... status=queued scheduled_at=Thu Jan 22 2026 17:46:38 GMT-0500 (Eastern Standard Time) is_test_post=false
   5. decision_id=0f59f933... status=queued scheduled_at=Thu Jan 22 2026 18:46:42 GMT-0500 (Eastern Standard Time) is_test_post=false
   ... and 2 more

✅ Ready to Post Now: 7 decisions

📅 Inspecting planning...

📊 Latest Plan:
   Created: Thu Jan 22 2026 21:38:17 GMT-0500 (Eastern Standard Time) (0.88h ago)
   Window: Thu Jan 22 2026 21:00:00 GMT-0500 (Eastern Standard Time)
   Targets: 2 posts, 4 replies

📊 Plan Windows (last 6h):
   ❌ Thu Jan 22 2026 22:31:09 GMT-0500 (Eastern Standard Time): MISSING
   ✅ Thu Jan 22 2026 21:31:09 GMT-0500 (Eastern Standard Time): plan exists (2p/4r)
   ✅ Thu Jan 22 2026 20:31:09 GMT-0500 (Eastern Standard Time): plan exists (2p/4r)
   ✅ Thu Jan 22 2026 19:31:09 GMT-0500 (Eastern Standard Time): plan exists (2p/4r)
   ✅ Thu Jan 22 2026 18:31:09 GMT-0500 (Eastern Standard Time): plan exists (2p/4r)
   ✅ Thu Jan 22 2026 17:31:09 GMT-0500 (Eastern Standard Time): plan exists (2p/4r)

💓 Checking runner/heartbeat signals...

🕐 Shadow Controller: Thu Jan 22 2026 21:38:17 GMT-0500 (Eastern Standard Time) (53 min ago)

💓 Runner/Job Heartbeats:
   posting_queue_started: 1 min ago
   GO_LIVE_MONITOR_CHECK: 1838 min ago

🔍 Classifying root cause...

🎯 Matched: CASE 2: Ready decisions exist but no executions
   Reason: Decisions are ready but runner is not executing them (runner stale / CDP not acting)

📋 Evidence:
   - Ready to post count: 7
   - Recent execution attempts (last 2h): 0
   - Runner may be stale or CDP connection lost

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           📋 EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Posting has been silent for 8.83 hours. CASE 2: Ready decisions exist but no executions: Decisions are ready but runner is not executing them (runner stale / CDP not acting)

Matched Case: CASE 2: Ready decisions exist but no executions

Best Next Action: Ready to post count: 7
```

---

## Follow-up Fix (Code/Monitoring Improvements)

1. Add automated alerts for posting silence > 2 hours
2. Improve monitoring dashboard with ready-to-post counts
3. Add health checks for runner/CDP connection
4. Improve error logging and classification
