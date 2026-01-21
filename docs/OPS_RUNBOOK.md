# 📋 OPS RUNBOOK

**Last Updated:** 2026-01-21  
**Purpose:** Clear operational procedures for xBOT system

---

## 🎯 Quick Reference

| Command | Purpose |
|---------|---------|
| `pnpm run ops:status` | Comprehensive status check (one screen) |
| `pnpm run ops:logs` | View local logs (daemon, go-live, cooldown) |
| `pnpm run logs:railway` | Stream Railway logs in real-time |
| `pnpm run deploy:railway` | Force clean Railway deploy |

---

## ✅ How to Verify Running

**Command:** `pnpm run ops:status`

**What it shows:**
- **A) LaunchAgents Status:**
  - `com.xbot.runner` - Main runner daemon
  - `com.xbot.go-live-monitor` - Go-live monitoring
  - `com.xbot.cooldown-monitor` - Cooldown monitoring
- **B) CDP Reachable:** Chrome DevTools Protocol on port 9222
- **C) Go-Live Monitor Log:** Last 10 lines from `.runner-profile/go-live-monitor.log`
- **D) Supabase Status:**
  - POST_SUCCESS count (last 6h)
  - Growth plans count (last 6h)
  - Overruns count (last 72h) - must be 0
- **E) Railway Status:**
  - Service name
  - Environment name
  - Current deployment status

**Expected Output:**
```
A) LaunchAgents:
   Runner: ✅ running
   Go-Live Monitor: ✅ running
   Cooldown Monitor: ✅ running

B) CDP:
   ✅ CDP responding

C) Go-Live Monitor Log (last 10 lines):
   [timestamp] [INFO] Status: OK
   ...

D) Supabase:
   POST_SUCCESS (6h): 5
   Plans (6h): 6
   Overruns (72h): 0 ✅

E) Railway:
   Status: ...
   Service: xBOT
   Environment: production
```

---

## 📋 How to View Logs

### Local Logs

**Command:** `pnpm run ops:logs [source]`

**Sources:**
- `all` (default) - All log files
- `daemon` - Runner daemon logs
- `go-live` - Go-live monitor logs
- `cooldown` - Cooldown monitor logs

**Log Locations:**
- `.runner-profile/daemon.log`
- `.runner-profile/go-live-monitor.log`
- `.runner-profile/cooldown-monitor.log`

### Railway Logs

**Command:** `pnpm run logs:railway`

**What it does:**
- Streams Railway logs in real-time
- Shows all stdout/stderr from Railway service
- Press `Ctrl+C` to exit

**Tip:** Use `pnpm run logs:railway | grep -i "error\|warn\|POST_SUCCESS"` to filter

---

## 🚀 How to Deploy Reliably

### Standard Deploy

**Command:** `pnpm run deploy:railway`

**What it does:**
- Runs `railway up --detach`
- Forces a clean build and deploy
- Detaches immediately (non-blocking)
- Uses current git state

**When to use:**
- After code changes
- After env var changes
- When GitHub deploy is skipped
- When you need a guaranteed fresh deploy

**Verification:**
1. Run `pnpm run deploy:railway`
2. Wait ~30-60 seconds for build
3. Run `pnpm run logs:railway` for ~60 seconds
4. Look for:
   - Build success messages
   - App boot messages
   - Job manager starting
   - No fatal errors

---

## ⚠️ If GitHub Deploy Skipped

**Problem:** Railway sometimes skips GitHub-triggered deploys if no code changes detected.

**Solution:** Always use `pnpm run deploy:railway`

**Steps:**
1. **Verify current state:**
   ```bash
   pnpm run ops:status
   ```

2. **Force deploy:**
   ```bash
   pnpm run deploy:railway
   ```

3. **Verify deploy:**
   ```bash
   pnpm run logs:railway
   ```
   - Watch for ~60 seconds
   - Confirm app boots
   - Confirm jobs start
   - No errors

4. **Confirm running:**
   ```bash
   pnpm run ops:status
   ```

**Why `--detach`:**
- Non-blocking (doesn't wait for deploy to finish)
- Returns immediately
- Use `logs:railway` to monitor progress

---

## 🔍 Troubleshooting

### LaunchAgent Not Running

**Check:**
```bash
launchctl list | grep xbot
```

**Restart:**
```bash
# Runner
launchctl unload ~/Library/LaunchAgents/com.xbot.runner.plist
launchctl load ~/Library/LaunchAgents/com.xbot.runner.plist

# Go-Live Monitor
launchctl unload ~/Library/LaunchAgents/com.xbot.go-live-monitor.plist
launchctl load ~/Library/LaunchAgents/com.xbot.go-live-monitor.plist

# Cooldown Monitor
launchctl unload ~/Library/LaunchAgents/com.xbot.cooldown-monitor.plist
launchctl load ~/Library/LaunchAgents/com.xbot.cooldown-monitor.plist
```

### CDP Not Reachable

**Check:**
```bash
curl http://127.0.0.1:9222/json
```

**Fix:**
- Ensure Chrome is running with CDP enabled
- Check port 9222 is not blocked
- Restart Chrome CDP if needed

### Railway Deploy Fails

**Check:**
```bash
railway status
railway service
```

**Fix:**
- Ensure Railway CLI is linked: `railway link`
- Check build logs: `railway logs`
- Verify env vars: `railway variables`

---

## 📊 Deployment Verification Proof

**Date:** 2026-01-21  
**Deploy Command:** `pnpm run deploy:railway`

**Deploy Output:**
```
Indexing...
Uploading...
  Build Logs: https://railway.com/project/.../service/.../...
```

**Logs Snippet (60 seconds after deploy):**
```
[BROWSER_POOL] 🚀 Initializing browser...
[BROWSER_POOL] ✅ TWITTER_SESSION_B64 detected - sessions will be authenticated
[BROWSER_POOL][INIT_BROWSER] chromium.launch_success duration_ms=330
[BROWSER_POOL] ✅ Browser initialized (duration_ms=330)
[BROWSER_POOL] ✅ Session ready (28 cookies, source=env, version 1)
[BROWSER_POOL] ✅ Context created (total: 1/11, duration_ms=573)
[CONSENT_WALL] 🚧 Consent wall detected (containers=0), attempting to clear...
[CONSENT_WALL] ✅ StorageState saved to canonical path
[BOOT] ✅ Session file created: /data/twitter_session.json, size=5441 bytes
[BROWSER_POOL] ✅ boot_session_seed: Completed (26889ms)
```

**Status After Deploy:**
```
A) LaunchAgents:
   Runner: ✅ running
   Go-Live Monitor: ✅ running
   Cooldown Monitor: ✅ running

B) CDP:
   ✅ CDP responding

D) Supabase:
   POST_SUCCESS (6h): 1
   Plans (6h): 2
   Overruns (72h): 0 ✅

E) Railway:
   Status: Project: XBOT | Environment: production | Service: xBOT
   Environment: production
```

**Verification:** ✅ **DEPLOY SUCCESSFUL**
- App booted successfully
- Browser pool initialized
- Session loaded
- Jobs ready to run

---

## 📝 Notes

- **Always use `deploy:railway`** for guaranteed deploys
- **Monitor logs** for 60 seconds after deploy
- **Verify status** with `ops:status` after deploy
- **No manual Railway UI** needed - all via CLI

---

**Status:** ✅ **OPERATIONAL**  
**Last Verified:** 2026-01-21
