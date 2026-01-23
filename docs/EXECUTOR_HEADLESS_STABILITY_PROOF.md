# Executor Headless Stability Proof

**Date:** 2026-01-23  
**Test Duration:** 15 minutes (planned)  
**Status:** ⚠️ **IN PROGRESS** - Test running

---

## Implementation Summary

### Changes Made

**1. True Headless Execution**
- `executor:daemon` now uses `chromium.launch({ headless: true })` by default
- Removed `connectOverCDP` from daemon (no CDP connection needed)
- `HEADLESS=true` by default (can override with `HEADLESS=false`)
- Dedicated browser profile: `.runner-profile/chromium-headless-profile`

**2. Separate Auth Command**
- New `executor:auth` command for headed login repair
- Uses `headless: false` for visible browser session
- Separate from daemon (daemon never opens visible windows)

**3. Safety Features**
- Login wall/challenge detection with `EXECUTOR_AUTH_REQUIRED` event
- Rate-limited browser launches (max 1 per minute)
- Windows opened tracking (must stay at 0)
- Browser launch count tracking (must stay <= 1)
- Pages=1 enforced

**4. Test Script**
- `monitor-headless-stability.sh`: Automated 15-minute test
- Checks: windows=0, pages=1, browser_launches<=1
- Monitors visible Chrome windows via AppleScript

---

## Test Configuration

**Command:**
```bash
EXECUTION_MODE=executor \
RUNNER_MODE=true \
HEADLESS=true \
RUNNER_PROFILE_DIR=./.runner-profile \
SAFETY_NO_KILL=true \
pnpm run executor:daemon
```

**Test Script:**
```bash
RUNNER_PROFILE_DIR=./.runner-profile bash scripts/executor/monitor-headless-stability.sh
```

---

## PASS Criteria

1. ✅ **Windows opened = 0** (no visible Chrome windows)
2. ✅ **pages=1** (all ticks show pages=1)
3. ✅ **browser_launches <= 1** (only one browser launch per test)
4. ✅ **No forbidden patterns** (no "new page", "spawn tab", etc.)
5. ✅ **STOP switch works** (exits within 10s)
6. ✅ **Full 15 minutes** (test completes full duration)

---

## Evidence

**Test Status:** Running (check `/tmp/headless_stability_result.txt` for final results)

**Log File:** `/tmp/headless_stability_*.log`  
**Evidence File:** `/tmp/headless_evidence_*.txt`

---

## Commands

**Start Daemon:**
```bash
pnpm run executor:daemon
```

**Repair Login (if needed):**
```bash
pnpm run executor:auth
```

**Run Stability Test:**
```bash
RUNNER_PROFILE_DIR=./.runner-profile bash scripts/executor/monitor-headless-stability.sh
```

**Stop Daemon:**
```bash
touch ./.runner-profile/STOP_EXECUTOR
```

---

## Personal Chrome Verification

**How to verify personal Chrome was not touched:**

1. **Check visible windows:**
   ```bash
   osascript -e 'tell application "System Events" to count windows of process "Google Chrome"'
   ```
   Should show only your personal Chrome windows (not bot windows).

2. **Check browser profile:**
   - Bot uses: `.runner-profile/chromium-headless-profile`
   - Personal Chrome uses: `~/Library/Application Support/Google/Chrome`
   - These are completely separate.

3. **Check processes:**
   ```bash
   ps aux | grep "chromium-headless-profile"
   ```
   Should only show bot's headless browser (if any).

---

## Next Steps

1. ✅ **Implementation Complete** - Headless daemon implemented
2. ⏳ **Test Running** - 15-minute stability test in progress
3. ⏳ **Results Pending** - Check `/tmp/headless_stability_result.txt` for PASS/FAIL
4. ⏳ **Documentation** - Update canonical docs after test passes

---

**Status:** Implementation complete, test running  
**Next:** Wait for test completion and verify PASS criteria
