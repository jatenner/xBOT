# xBOT Current Status

**Last Updated:** 2026-01-23  
**Snapshot SHA:** `2db22302785395a6c673809e15641143cdadc76c`

> **Note:** This file is append-only. Each snapshot adds a dated section. Run `pnpm run docs:snapshot` to update.

---

## 2026-01-23 - Initial Snapshot

### Git SHA

- **Local HEAD:** `2db22302785395a6c673809e15641143cdadc76c`
- **xBOT Service:** UNKNOWN (verify via `railway logs --service xBOT | grep BOOT`)
- **serene-cat Service:** UNKNOWN (verify via `railway logs --service serene-cat | grep BOOT`)

**Verification:**
```bash
git rev-parse HEAD
railway run --service xBOT -- node -e "console.log(process.env.RAILWAY_GIT_COMMIT_SHA)"
railway run --service serene-cat -- node -e "console.log(process.env.RAILWAY_GIT_COMMIT_SHA)"
```

### Services Deployed

- **xBOT:** Status UNKNOWN (check via `railway status`)
- **serene-cat:** Status UNKNOWN (check via `railway status`)

**Verification:**
```bash
railway status
railway logs --service xBOT --lines 10 | grep BOOT
railway logs --service serene-cat --lines 10 | grep BOOT
```

### Key Environment Variables

**xBOT:**
- `EXECUTION_MODE`: Expected `control` (verify via Railway dashboard)
- `SERVICE_ROLE`: Expected `main` or inferred from `RAILWAY_SERVICE_NAME`
- `RAILWAY_SERVICE_NAME`: Expected `xBOT`

**serene-cat:**
- `EXECUTION_MODE`: Expected `control` (verify via Railway dashboard)
- `SERVICE_ROLE`: Expected `worker` or inferred from `RAILWAY_SERVICE_NAME`
- `RAILWAY_SERVICE_NAME`: Expected `serene-cat`

**Verification:**
```bash
railway variables --service xBOT | grep EXECUTION_MODE
railway variables --service serene-cat | grep EXECUTION_MODE
```

### Last Plan Age

**Query:**
```sql
SELECT MAX(created_at) AS last_plan, NOW() - MAX(created_at) AS age
FROM content_metadata
WHERE status='queued' AND decision_type IN ('single', 'thread')
ORDER BY created_at DESC LIMIT 1;
```

**Result:** UNKNOWN (run query to verify)

### Last POST_SUCCESS

**Query:**
```sql
SELECT created_at, event_data->>'tweet_id' AS tweet_id, event_data->>'decision_id' AS decision_id
FROM system_events
WHERE event_type='POST_SUCCESS'
ORDER BY created_at DESC LIMIT 1;
```

**Result:** UNKNOWN (run query to verify)

### Last POST_FAILED

**Query:**
```sql
SELECT created_at, event_data->>'reason' AS reason, event_data->>'decision_id' AS decision_id
FROM system_events
WHERE event_type='POST_FAILED'
ORDER BY created_at DESC LIMIT 1;
```

**Result:** UNKNOWN (run query to verify)

### Reply Queue Status

**Ticks (last 30 min):**
```sql
SELECT COUNT(*) AS ticks, MAX(created_at) AS last_tick
FROM system_events
WHERE event_type='REPLY_QUEUE_TICK'
  AND created_at >= NOW() - INTERVAL '30 minutes';
```

**Blocks (last 30 min):**
```sql
SELECT event_data->>'reason' AS reason, COUNT(*) AS count
FROM system_events
WHERE event_type='REPLY_QUEUE_BLOCKED'
  AND created_at >= NOW() - INTERVAL '30 minutes'
GROUP BY reason;
```

**Result:** UNKNOWN (run queries to verify)

### Posting Queue Status

**Ticks (last 30 min):**
```sql
SELECT COUNT(*) AS ticks, MAX(created_at) AS last_tick,
       AVG((event_data->>'attempts_started')::int) AS avg_attempts
FROM system_events
WHERE event_type='POSTING_QUEUE_TICK'
  AND created_at >= NOW() - INTERVAL '30 minutes';
```

**Blocks (last 30 min):**
```sql
SELECT event_data->>'reason' AS reason, COUNT(*) AS count
FROM system_events
WHERE event_type='POSTING_QUEUE_BLOCKED'
  AND created_at >= NOW() - INTERVAL '30 minutes'
GROUP BY reason;
```

**Result:** UNKNOWN (run queries to verify)

### Known Blockers

- None documented yet

---

## How to Update

Run `pnpm run docs:snapshot` to append a new dated section with current state.

**Manual update:** Edit this file, add new dated section, commit with message: `docs: update STATUS.md with <date> snapshot`
