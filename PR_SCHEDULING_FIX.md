# 📅 PR: Fix Scheduling - Post Soon After Boot

## Problem

Content was being scheduled for **tomorrow** instead of posting soon after generation, causing the posting queue to always find zero ready decisions.

**Logs showed:**
```
[PLAN_JOB] ✅ Real LLM content queued scheduled_at=2025-10-03T13:45:27.140Z  # Tomorrow!
[POSTING_QUEUE] ℹ️ No decisions ready for posting  # Nothing ready today
```

## Root Causes

1. **`planJob.ts` line 176**: `scheduled_at = Date.now() + timingSelection.slot * 60 * 60 * 1000`
   - UCB timing selector chose slot 19 (7 PM)
   - Current time was 6:50 PM → scheduled for tomorrow at 7 PM
   
2. **`postingQueue.ts` line 128-133**: No `scheduled_at` filter!
   - Fetched ALL queued items regardless of time
   - No grace window for "close enough" posts

## Solution

Implemented timezone-aware scheduling with same-day preference, grace windows, cold-start detection, and admin overrides.

---

## Changes

### A) Planner: Same-Day Preference (`src/jobs/planJob.ts`)

**New `selectOptimalSchedule()` function:**

```typescript
1. Check if cold start (queue empty) → schedule in 30 seconds
2. Use UCB to find optimal slot
3. If slot < now + MIN_MINUTES_UNTIL_SLOT:
   - Try to find next same-day slot
   - If no same-day slots, use tomorrow at optimal slot
4. Log decision: "Using same-day slot" or "No same-day slots"
```

**Environment Variables:**
- `MIN_MINUTES_UNTIL_SLOT` (default: 0) - Don't schedule within X minutes
- `POST_NOW_ON_COLD_START` (default: true) - Create immediate post on first boot
- `SCHED_TZ` (default: UTC) - Timezone for scheduling (for future use)

### B) Posting Queue: Grace Window (`src/jobs/postingQueue.ts`)

**Before:**
```sql
SELECT * FROM content_metadata
WHERE status = 'queued'
ORDER BY created_at ASC
```

**After:**
```sql
SELECT * FROM content_metadata
WHERE status = 'queued'
AND scheduled_at <= NOW() + interval '5 minutes'
ORDER BY scheduled_at ASC  -- Changed from created_at
```

**Environment Variable:**
- `GRACE_MINUTES` (default: 5) - Post items within X minutes of scheduled time

**Logs:**
```
[POSTING_QUEUE] 📅 Fetching posts ready within 5 minute window
[POSTING_QUEUE] 📝 Found 3 decisions ready for posting (grace_window=5m)
```

### C) Admin Routes for Manual Override (`src/server/routes/admin.ts`)

**1. POST `/admin/queue-now`** - Force a decision to post immediately

```bash
curl -X POST "$HOST/admin/queue-now" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision_id":"abc-123"}'
```

Response:
```json
{
  "ok": true,
  "decision_id": "abc-123",
  "scheduled_at": "2025-10-02T19:00:00.000Z"
}
```

**2. POST `/admin/generate-and-post-now`** - Generate and post immediately

```bash
curl -X POST "$HOST/admin/generate-and-post-now" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Response:
```json
{
  "ok": true,
  "message": "Content generated and posting triggered. Check logs for results."
}
```

### D) Status Route: Scheduling Info (`src/server/routes/status.ts`)

**New `scheduling` section:**
```json
{
  "scheduling": {
    "timezone": "UTC",
    "grace_minutes": 5,
    "next_ready_count": 3,
    "min_minutes_until_slot": 0,
    "post_now_on_cold_start": true
  }
}
```

---

## Environment Variables

Add to Railway:

```bash
# Scheduling
SCHED_TZ=UTC
MIN_MINUTES_UNTIL_SLOT=0
GRACE_MINUTES=5
POST_NOW_ON_COLD_START=true
```

---

## Runbook

### On Deploy

1. **Check status:**
```bash
curl https://xbot-production.up.railway.app/status | jq '.scheduling'
```

Expected:
```json
{
  "timezone": "UTC",
  "grace_minutes": 5,
  "next_ready_count": 1,  # Should be > 0 after cold start
  "min_minutes_until_slot": 0,
  "post_now_on_cold_start": true
}
```

2. **If `next_ready_count` is 0**, force immediate post:
```bash
curl -X POST "https://xbot-production.up.railway.app/admin/generate-and-post-now" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

3. **Watch logs:**
```bash
railway logs | grep -E "SCHEDULE|POSTING_START|POSTING_DONE"
```

Expected:
```
[SCHEDULE] 🚀 Cold start detected - scheduling immediate post
[POSTING_QUEUE] 📅 Fetching posts ready within 5 minute window
[POSTING_QUEUE] 📝 Found 1 decisions ready for posting (grace_window=5m)
POSTING_START textLength=280
POSTING_DONE id=1234567890 url=...
```

---

## Acceptance Criteria

✅ **After cold boot**, either:
- An immediate post is made, OR
- At least one item with `scheduled_at <= now() + 5m`

✅ **Planner prefers same-day slots** over tomorrow

✅ **Posting queue fetches items within grace window**, not all queued items

✅ **Admin can force immediate posts** via `/admin/queue-now` or `/admin/generate-and-post-now`

✅ **Status endpoint shows** `next_ready_count > 0` after generation

---

## Example Flow

### Cold Start (First Boot)

```
1. System boots
2. Planner runs → detects empty queue
3. Schedules content for NOW + 30 seconds
4. Posting queue runs 5 minutes later
5. Finds 1 ready item (within grace window)
6. Posts successfully ✅
```

### Normal Operation

```
1. Planner runs at 6:50 PM
2. UCB selects slot 19 (7:00 PM)
3. Current hour is 18 → 7 PM is same-day
4. Schedules for today at 7:00 PM ✅
5. Posting queue runs at 6:55 PM
6. Grace window: NOW + 5m = 7:00 PM
7. Finds item scheduled for 7:00 PM
8. Posts successfully ✅
```

### Late Evening (No Same-Day Slots)

```
1. Planner runs at 11:30 PM
2. UCB selects slot 8 (8:00 AM)
3. No same-day slots available
4. Schedules for tomorrow at 8:00 AM
5. Logs: "[SCHEDULE] 📅 No same-day slots, using tomorrow at 8:00"
```

---

## Files Changed

```
src/jobs/planJob.ts                   # Added selectOptimalSchedule()
src/jobs/postingQueue.ts              # Added grace window filter
src/server/routes/admin.ts            # Added queue-now & generate-and-post-now
src/server/routes/status.ts           # Added scheduling info
```

---

## Rollback Plan

If issues occur:
```bash
# Set POST_NOW_ON_COLD_START=false to disable immediate posts
railway variables --set POST_NOW_ON_COLD_START=false

# Or revert the commit
git revert HEAD
git push origin main
```

---

## Related Issues

Fixes: "Content scheduled for tomorrow, posting queue finds nothing ready"

## Testing

Test immediate posting:
```bash
curl -X POST "https://xbot-production.up.railway.app/admin/generate-and-post-now" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Watch for:
```
[SCHEDULE] 🚀 Cold start detected - scheduling immediate post
POSTING_START textLength=280
POSTING_DONE id=... ✅
```

