# Runbook: P1 Reply V2 Success

**Goal:** Get 1 `reply_v2_planner` decision to POST successfully with `runtime_preflight_status='ok'`

**Status:** IN PROGRESS  
**Blocker:** Runtime preflight OK-only gating + stale/deleted targets

---

## Prerequisites

1. **Executor running:** `pnpm run ops:executor:status` shows daemon running
2. **Harvester running:** Local harvester creating fresh opportunities (< 24h old)
3. **Planner running:** Railway planner creating `reply_v2_planner` decisions
4. **Scheduler running:** Railway scheduler selecting candidates

---

## Diagnostic Steps

### Step 1: Check Harvester Status

**Is harvester running?**
```bash
# Check if harvester process is running (local, not Railway)
ps aux | grep replyOpportunityHarvester

# Check harvester logs (if running locally)
tail -100 ./.runner-profile/logs/executor.log | grep HARVESTER

# Run harvester manually to test
pnpm tsx scripts/ops/run-harvester-single-cycle.ts
```

**Are opportunities fresh?**
```sql
-- Check reply opportunities pool
SELECT 
  COUNT(*) as total_opportunities,
  COUNT(*) FILTER (WHERE tweet_posted_at > NOW() - INTERVAL '24 hours') as fresh_count,
  COUNT(*) FILTER (WHERE tweet_posted_at > NOW() - INTERVAL '12 hours') as very_fresh_count,
  MIN(tweet_posted_at) as oldest_opportunity,
  MAX(tweet_posted_at) as newest_opportunity
FROM reply_opportunities
WHERE replied_to = false;
```

**Expected:** At least 50-100 fresh opportunities (< 24h old)

### Step 2: Check Planner Status

**Is planner creating decisions?**
```sql
-- Check recent reply_v2_planner decisions
SELECT 
  decision_id,
  status,
  pipeline_source,
  features->>'preflight_status' as preflight_status,
  features->>'runtime_preflight_status' as runtime_preflight_status,
  created_at,
  target_tweet_id
FROM content_metadata
WHERE decision_type = 'reply'
  AND pipeline_source = 'reply_v2_planner'
ORDER BY created_at DESC
LIMIT 20;
```

**Check planner logs:**
```bash
railway logs --service xBOT --lines 100 | grep "REPLY_V2_PLANNER\|reply_v2_planner"
```

**Expected:** New decisions created every planner run (typically every 15-30 minutes)

### Step 3: Check Scheduler Status

**Is scheduler selecting candidates?**
```sql
-- Check reply_v2_scheduler decisions
SELECT 
  decision_id,
  status,
  pipeline_source,
  features->>'preflight_status' as preflight_status,
  features->>'runtime_preflight_status' as runtime_preflight_status,
  created_at,
  target_tweet_id
FROM content_metadata
WHERE decision_type = 'reply'
  AND pipeline_source = 'reply_v2_scheduler'
ORDER BY created_at DESC
LIMIT 20;
```

**Check scheduler logs:**
```bash
railway logs --service xBOT --lines 100 | grep "REPLY_V2_SCHEDULER\|reply_v2_scheduler"
```

**Expected:** Scheduler updates `pipeline_source='reply_v2_scheduler'` for selected candidates

### Step 4: Check Executor Status

**Is executor claiming decisions?**
```sql
-- Check for claimed decisions (status = 'posting' or 'posting_attempt')
SELECT 
  decision_id,
  status,
  pipeline_source,
  features->>'runtime_preflight_status' as runtime_preflight_status,
  features->>'preflight_status' as preflight_status,
  created_at,
  updated_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND pipeline_source IN ('reply_v2_planner', 'reply_v2_scheduler')
  AND status IN ('posting', 'posting_attempt')
ORDER BY updated_at DESC
LIMIT 10;
```

**Check executor logs:**
```bash
tail -100 ./.runner-profile/logs/executor.log | grep "reply\|RUNTIME_PREFLIGHT"
```

**Expected:** Executor claims decisions and runs runtime preflight checks

### Step 5: Check Runtime Preflight Status

**Why are decisions blocked?**
```sql
-- Check runtime preflight status distribution
SELECT 
  features->>'runtime_preflight_status' as runtime_preflight_status,
  COUNT(*) as count,
  MAX(created_at) as latest_decision
FROM content_metadata
WHERE decision_type = 'reply'
  AND pipeline_source IN ('reply_v2_planner', 'reply_v2_scheduler')
  AND features->>'runtime_preflight_status' IS NOT NULL
GROUP BY features->>'runtime_preflight_status'
ORDER BY count DESC;
```

**Check for OK decisions:**
```sql
-- Find decisions with runtime_preflight_status='ok'
SELECT 
  decision_id,
  status,
  pipeline_source,
  features->>'runtime_preflight_status' as runtime_preflight_status,
  features->>'preflight_status' as preflight_status,
  created_at,
  target_tweet_id
FROM content_metadata
WHERE decision_type = 'reply'
  AND pipeline_source IN ('reply_v2_planner', 'reply_v2_scheduler')
  AND features->>'runtime_preflight_status' = 'ok'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:** At least some decisions with `runtime_preflight_status='ok'`

---

## Common Issues and Fixes

### Issue 1: Harvester Not Running

**Symptoms:**
- `reply_opportunities` table empty or stale
- No harvester logs

**Fix:**
```bash
# Run harvester manually
pnpm tsx scripts/ops/run-harvester-single-cycle.ts

# Check HARVESTING_ENABLED flag (should be true locally, false on Railway)
echo $HARVESTING_ENABLED
```

### Issue 2: Opportunities Too Old

**Symptoms:**
- Opportunities exist but > 24 hours old
- Runtime preflight fails with 'deleted' or 'timeout'

**Fix:**
- Run harvester to create fresh opportunities
- Check freshness gates in harvester code
- Verify `tweet_posted_at` timestamps are accurate

### Issue 3: Planner Not Creating Decisions

**Symptoms:**
- No `reply_v2_planner` decisions in `content_metadata`
- Planner logs show "No candidates available"

**Fix:**
```bash
# Trigger planner manually
railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts

# Check planner logs for errors
railway logs --service xBOT --lines 200 | grep "REPLY_V2_PLANNER\|ERROR"
```

### Issue 4: Runtime Preflight Failing

**Symptoms:**
- Decisions have `runtime_preflight_status='deleted'` or `'timeout'`
- No decisions with `runtime_preflight_status='ok'`

**Possible Causes:**
1. Targets deleted by author (expected, need fresh targets)
2. Targets too old (need fresher opportunities)
3. Runtime preflight timeout too short (check `RUNTIME_PREFLIGHT_TIMEOUT_MS`)
4. Network issues (check executor connectivity)

**Fix:**
- Ensure harvester creates fresh opportunities (< 12 hours old)
- Check runtime preflight timeout: `echo $RUNTIME_PREFLIGHT_TIMEOUT_MS` (default: 10000ms)
- Verify executor can reach Twitter/X

### Issue 5: Executor Not Claiming Decisions

**Symptoms:**
- Decisions remain in `queued` status
- No executor activity in logs

**Fix:**
```bash
# Check executor status
pnpm run ops:executor:status

# Restart executor if needed
pnpm run executor:stop
pnpm run executor:daemon

# Check executor logs for errors
tail -200 ./.runner-profile/logs/executor.log | grep "ERROR\|FAILED"
```

---

## Success Criteria

**P1 Milestone achieved when:**
1. ✅ Decision transitions: `queued` → `runtime_preflight_status='ok'` → `posting_attempt` → `posted`
2. ✅ `features.tweet_id` populated
3. ✅ `features.reward` computed (after scraper runs)
4. ✅ `REPLY_SUCCESS` event emitted

**Verification Query:**
```sql
-- Find successful posted reply with runtime_preflight_status='ok'
SELECT 
  decision_id,
  status,
  features->>'tweet_id' as tweet_id,
  features->>'reward' as reward,
  features->>'runtime_preflight_status' as runtime_preflight_status,
  posted_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'posted'
  AND features->>'runtime_preflight_status' = 'ok'
ORDER BY posted_at DESC
LIMIT 1;
```

---

## Monitoring Commands

**Watch for successful post:**
```bash
# Watch executor logs
tail -f ./.runner-profile/logs/executor.log | grep "REPLY_SUCCESS\|runtime_preflight_status=ok"

# Or run proof script
pnpm tsx scripts/ops/e2e-prove-1-posted-reply.ts
```

**Check system events:**
```sql
-- Check for REPLY_SUCCESS events
SELECT 
  event_id,
  event_type,
  event_data->>'decision_id' as decision_id,
  event_data->>'tweet_id' as tweet_id,
  created_at
FROM system_events
WHERE event_type = 'REPLY_SUCCESS'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Next Steps After P1 Success

1. **Verify reward computation:**
   - Check `strategy_rewards` table updated
   - Verify `features.reward` populated

2. **Scale to P2:**
   - Get 5 posted replies with `runtime_preflight_status='ok'`
   - Verify learning loop functioning

3. **Consider P3:**
   - Enable timeout fallback with guardrails
   - Maintain success rate
