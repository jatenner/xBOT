# P1 Session Refresh → Harvest → Decisions (Step-by-Step)

**Purpose:** Complete operational flow to get P1 milestone ready (1 posted Reply V2)

---

## Step 1: Refresh Twitter Session (MANUAL - Requires Browser)

**⚠️ This step requires manual browser interaction.**

```bash
pnpm tsx scripts/refresh-x-session.ts
```

**What happens:**
1. Browser window opens (headed mode)
2. Navigate to X.com and log in manually
3. Wait until timeline/home feed appears
4. Script detects login and saves session to `twitter_session.json`
5. Press Enter to close browser

**Success indicators:**
- `twitter_session.json` file created/updated
- Script shows: "✅ Session saved to twitter_session.json"
- Cookie count displayed (should be > 15)

**If it fails:**
- Check browser window is visible
- Ensure you're logged into X.com
- Try closing browser and running script again

---

## Step 2: Export Session to TWITTER_SESSION_B64

**After Step 1 completes:**

```bash
# Export to base64
base64 -i twitter_session.json > twitter_session.b64

# Set environment variable (for current shell)
export TWITTER_SESSION_B64=$(cat twitter_session.b64)

# Verify it's set
echo "TWITTER_SESSION_B64 length: ${#TWITTER_SESSION_B64}"
```

**Expected:** Length should be > 7000 characters

**For persistent setup (add to .env):**
```bash
echo "TWITTER_SESSION_B64=$(cat twitter_session.b64)" >> .env
```

---

## Step 3: Verify Authentication

```bash
pnpm tsx scripts/ops/verify-harvester-auth.ts
```

**Success condition:**
```
logged_in: ✅ true
handle: @your_handle
```

**If still false:**
- Session may be expired (refresh again)
- Check reason: `no_timeline`, `checkpoint`, `locked`, etc.
- Re-run Step 1 if needed

---

## Step 4: Harvest Fresh Opportunities

**Once logged_in=true:**

```bash
HARVESTING_ENABLED=true pnpm tsx scripts/ops/run-harvester-single-cycle.ts
```

**Check results:**
```bash
pnpm tsx scripts/ops/p1-diagnostic-queries.ts
```

**Target:**
- `fresh_12h >= 50` (minimum for P1)
- `newest_unclaimed` within last 60 minutes (ideal)

**If fresh_12h < 50:**
- Run harvester again (up to 3 cycles)
- Check harvester logs for errors
- Verify auth is still valid

---

## Step 5: Trigger Planner/Scheduler

**Once pool is healthy (fresh_12h >= 50):**

```bash
# Trigger planner (creates decisions from opportunities)
railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
```

**Or run locally (if configured):**
```bash
REPLY_V2_PLAN_ONLY=true RUNNER_MODE=false pnpm tsx scripts/ops/run-reply-v2-planner-once.ts
```

**Verify decisions created:**
```bash
pnpm tsx scripts/ops/p1-diagnostic-queries.ts | grep -A 20 "Decisions created"
```

**Expected:**
- `decisions_24h > 0` for `reply_v2_planner` or `reply_v2_scheduler`
- `queued > 0` (decisions ready for executor)

---

## Step 6: Ensure Executor is Running

```bash
# Check executor status
pnpm run ops:executor:status

# If not running, start it
pnpm run executor:daemon
```

**Monitor for successful posts:**
```bash
tail -f ./.runner-profile/logs/executor.log | grep "REPLY_SUCCESS\|runtime_preflight_status"
```

---

## Quick All-in-One Script

**After manual session refresh (Step 1), run:**

```bash
./scripts/ops/p1-after-session-refresh.sh
```

This script automates Steps 2-5:
- Exports session to TWITTER_SESSION_B64
- Verifies auth
- Harvests until pool is healthy
- Triggers planner/scheduler

---

## Troubleshooting

### Session refresh fails
- Ensure browser window is visible
- Check internet connection
- Try closing browser and running script again

### Auth verification fails after refresh
- Session may be expired immediately (rare)
- Check for X.com challenges (captcha, 2FA)
- Try refreshing session again

### Harvester finds 0 opportunities
- Check harvester logs for auth errors
- Verify `TWITTER_SESSION_B64` is set correctly
- Check if search queries are too restrictive

### Planner creates 0 decisions
- Check if opportunities exist: `pnpm tsx scripts/ops/p1-diagnostic-queries.ts`
- Verify opportunities are fresh (< 24h old)
- Check planner logs for errors

### Executor not claiming decisions
- Verify executor is running: `pnpm run ops:executor:status`
- Check executor logs for errors
- Verify `RUNNER_MODE=true` and `EXECUTION_MODE=executor`
