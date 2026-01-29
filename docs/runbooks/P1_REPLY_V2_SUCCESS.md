# Runbook: P1 Reply V2 Success

**Goal:** Get 1 `reply_v2_planner` decision to POST successfully with `runtime_preflight_status='ok'`

**Status:** IN PROGRESS  
**Blocker:** Runtime preflight OK-only gating + stale/deleted targets

---

## Fix Harvester Auth (Twitter Session)

**Problem:** Harvester fails with `logged_in=false`, preventing creation of fresh opportunities.

**Root Cause:** `TWITTER_SESSION_B64` env var is missing, invalid, or expired.

### Prerequisites

- Valid X (Twitter) account credentials
- Access to set environment variables (local `.env` or Railway)
- Browser installed (Chrome/Chromium)

### Method 1: Refresh Session via Interactive Script (Recommended)

**Step 1: Run refresh script**
```bash
pnpm tsx scripts/refresh-x-session.ts
```

**Step 2: Follow prompts**
- Browser window opens
- Log in to X (Twitter) manually
- Wait until timeline/home feed appears
- Press Enter when done

**Step 3: Export session to base64**
```bash
# On macOS:
base64 -i twitter_session.json | pbcopy

# On Linux:
base64 twitter_session.json > twitter_session.b64
cat twitter_session.b64
```

**Step 4: Set environment variable**

**For local execution:**
```bash
# Add to .env file:
echo "TWITTER_SESSION_B64=$(base64 -i twitter_session.json)" >> .env
```

**For Railway:**
```bash
railway variables --set "TWITTER_SESSION_B64=<paste_base64_here>"
```

**Step 5: Verify auth works**
```bash
# Check if session is valid
pnpm tsx scripts/ops/p1-diagnostic-queries.ts

# Or run harvester and check logs for:
# [HARVESTER_AUTH] ok=true
HARVESTING_ENABLED=true pnpm tsx scripts/ops/run-harvester-single-cycle.ts
```

**Expected:** Logs show `[HARVESTER_AUTH] ok=true` and `[WHOAMI] logged_in=true`

### Method 2: Executor Auth (Runner Profile)

**If using runner profile directory:**

```bash
# Run executor auth (headed browser)
RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:auth

# This saves session to .runner-profile/chrome-profile/
# Harvester should pick it up automatically if TWITTER_SESSION_B64 is not set
```

**Note:** Executor auth saves to runner profile, but harvester prefers `TWITTER_SESSION_B64` env var.

### Session Storage Locations

1. **Environment Variable:** `TWITTER_SESSION_B64` (preferred for harvester)
2. **File:** `twitter_session.json` (created by `refresh-x-session.ts`)
3. **Runner Profile:** `.runner-profile/chrome-profile/` (used by executor)

### Confirming logged_in=true

**Quick check:**
```bash
# Run a small auth check
pnpm tsx scripts/whoami-check.ts
```

**Expected output:**
```
logged_in: true
handle: @your_handle
```

**Or check harvester logs:**
```bash
HARVESTING_ENABLED=true pnpm tsx scripts/ops/run-harvester-single-cycle.ts 2>&1 | grep "HARVESTER_AUTH\|WHOAMI"
```

**Expected:** `[HARVESTER_AUTH] ok=true` and `[WHOAMI] logged_in=true`

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

## Latency Calibration (Runtime Preflight Timeout)

**Problem:** Runtime preflight checks timeout at 10s default, causing `runtime_preflight_status='timeout'` even when fetches would succeed with more time.

**Root Cause:** Default timeout (10s) is too aggressive for slow network conditions or Twitter's response times.

**Solution:** Increase timeout to 20s via `RUNTIME_PREFLIGHT_TIMEOUT_MS` env var.

### Calibration Steps

**Step 1: Update LaunchAgent plist**
```bash
# Edit ~/Library/LaunchAgents/com.xbot.executor.plist
# Add under EnvironmentVariables:
<key>RUNTIME_PREFLIGHT_TIMEOUT_MS</key>
<string>20000</string>
```

**Step 2: Reload daemon**
```bash
launchctl stop com.xbot.executor
launchctl unload ~/Library/LaunchAgents/com.xbot.executor.plist
launchctl load ~/Library/LaunchAgents/com.xbot.executor.plist
```

**Step 3: Verify timeout in logs**
```bash
tail -f .runner-profile/executor.log | grep "RUNTIME_PREFLIGHT.*timeout_ms=20000"
```

**Note:** Timeout is clamped between 3s (min) and 20s (max) for safety. Default remains 10s if env var not set.

---

## Parallel Ops Routine (Keep-It-Running)

**Once auth is fixed and harvester works:**

### Harvester Frequency

**Target:** Keep `fresh_12h >= 50` opportunities at all times

**Run harvester:**
```bash
# Single cycle (adds ~50-200 opportunities)
HARVESTING_ENABLED=true pnpm tsx scripts/ops/run-harvester-single-cycle.ts

# Check freshness after harvest
pnpm tsx scripts/ops/p1-diagnostic-queries.ts | grep "fresh_12h\|fresh_24h"
```

**Frequency:**
- **If fresh_12h < 50:** Run harvester immediately
- **If fresh_12h >= 50:** Run harvester every 2-4 hours to maintain pool
- **If fresh_12h >= 200:** Skip harvest (pool is healthy)

### Planner/Scheduler + Executor Loop

**After pool is healthy (fresh_12h >= 50):**

1. **Trigger planner** (creates decisions from opportunities):
   ```bash
   railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
   ```

2. **Ensure executor is running:**
   ```bash
   pnpm run ops:executor:status
   # If not running:
   pnpm run executor:daemon
   ```

3. **Monitor for successful post:**
   ```bash
   # Watch executor logs
   tail -f ./.runner-profile/logs/executor.log | grep "REPLY_SUCCESS\|runtime_preflight_status"
   
   # Or check DB for posted replies
   pnpm tsx scripts/ops/p1-diagnostic-queries.ts
   ```

**Expected flow:**
- Planner creates `reply_v2_planner` decisions every 15-30 minutes
- Scheduler selects candidates and updates `pipeline_source='reply_v2_scheduler'`
- Executor claims decisions and runs runtime preflight
- If `runtime_preflight_status='ok'`, executor posts reply
- Reward computed after metrics scraper runs

**Success indicators:**
- `fresh_12h >= 50` (harvester working)
- Decisions created every 15-30 minutes (planner working)
- Decisions claimed within 5 minutes (executor working)
- `runtime_preflight_status='ok'` decisions posting (preflight working)

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
