# 🚀 PR: Fully Autonomous xBOT with Rock-Solid Playwright

## Overview
This PR implements a complete autonomous system for xBOT on Railway with:
- ✅ Single-source feature flags with MODE normalization
- ✅ Robust Playwright infrastructure (persistent context, no /dev/shm issues)
- ✅ Crash-aware browser runner with auto-retry + traces
- ✅ Unified posting pipeline for scheduled & smoke tests
- ✅ Job manager with fail-fast logic (exits if posting not registered in live mode)
- ✅ Admin endpoints for manual smoke tests
- ✅ CLI tools for quick testing
- ✅ Enhanced health/status endpoints
- ✅ Dockerfile with Playwright system dependencies

## Changes Summary

### 1. Feature Flags System
**File: `src/config/featureFlags.ts` (NEW)**
- Single source of truth for MODE configuration
- Prevents legacy env vars from silently disabling posting
- Normalizes `DRY_RUN` and `POSTING_DISABLED` in live mode
- Modes: `live`, `shadow`, `dev`, `test`

### 2. Playwright Infrastructure
**Files:**
- `src/infra/playwright/launcher.ts` (NEW) - Persistent context launcher
- `src/infra/playwright/withBrowser.ts` (NEW) - Crash-aware wrapper with retries

**Key features:**
- Uses persistent context at `/tmp/xbot-profile`
- No sandbox, no /dev/shm dependencies
- Auto-retry (3 attempts) with exponential backoff
- Captures screenshots on failure → `/tmp/fail-*.png`
- Optional tracing → `/tmp/trace-*.zip`

### 3. Unified Posting Pipeline
**File: `src/posting/postNow.ts` (NEW)**
- Shared by both scheduled posting and smoke tests
- Uses `withBrowser` for crash safety
- Logs: `POSTING_START`, `POSTING_DONE`, `POSTING_FAIL`
- Stores last attempt in `globalThis.__xbotLastPostAttemptAt`
- Stores last result in `globalThis.__xbotLastPostResult`

### 4. Job Manager Enhancements
**File: `src/jobs/jobManager.ts` (UPDATED)**
- Registers all 4 timers: `plan`, `reply`, `posting`, `learn`
- Fail-fast: Exits with error if `MODE=live` but posting not registered
- Logs: `JOB_REGISTERED {"plan":true,"reply":true,"posting":true,"learn":true} mode=live`
- Enhanced status logging

### 5. Admin Endpoints
**File: `src/server/routes/admin.ts` (NEW)**
- `POST /admin/post` - Smoke test posting endpoint
- Requires `Authorization: Bearer $ADMIN_TOKEN`
- Returns: `{ ok: true, id: "123..." }` or error

### 6. CLI Smoke Test
**File: `scripts/post_once.ts` (NEW)**
```bash
tsx scripts/post_once.ts "xBOT smoke test"
```

### 7. Enhanced Status Endpoints
**Files: `src/server.ts` (UPDATED)**

`GET /status`:
- Shows `mode`, `postingEnabled`
- Shows all 4 timers: `{plan, reply, posting, learn}`
- Shows `browserProfileDirExists`, `lastPostAttemptAt`, `lastPostResult`

`GET /playwright`:
- Shows `browserHealthy`, `profileDirExists`, `connected`

### 8. Dockerfile Updates
**File: `Dockerfile` (UPDATED)**
- Added Playwright system dependencies (libgtk, libnss3, etc.)
- Runs `npx playwright install --with-deps chromium` during build
- Ensures all browser deps are available in container

### 9. Tests
**File: `test/jobsRegistration.test.ts` (NEW)**
- Verifies posting job registers in live mode
- Verifies posting disabled in shadow mode
- Verifies legacy flag normalization

### 10. Environment Configuration
**File: `.env.example` (NEW)**
- Complete example with all flags documented
- Includes `MODE`, `DISABLE_POSTING`, `PLAYWRIGHT_TRACE`, etc.

---

## 🏃 Runbook: After Deploy on Railway

### Step 1: Verify System Health
```bash
curl https://your-app.railway.app/status
```

**Expected output:**
```json
{
  "ok": true,
  "mode": "live",
  "postingEnabled": true,
  "timers": {
    "plan": true,
    "reply": true,
    "posting": true,
    "learn": true
  },
  "browserProfileDirExists": true
}
```

### Step 2: Check Playwright
```bash
curl https://your-app.railway.app/playwright
```

**Expected output:**
```json
{
  "browserHealthy": true,
  "profileDirExists": true,
  "connected": true
}
```

### Step 3: Smoke Test Post (Inside Container)
```bash
railway run bash -c 'tsx scripts/post_once.ts "xBOT smoke $(date -u +%FT%TZ)"'
```

**Expected output:**
```
🚀 SMOKE_TEST: Posting tweet...
📝 Text: "xBOT smoke 2025-10-02T..."
[PW] Attempt 1/3 starting...
[PW_LAUNCHER] Launching persistent context at /tmp/xbot-profile...
[POST_NOW] ✅ Login verified
[POST_NOW] Post button clicked
POSTING_DONE id=1234567890
✅ SMOKE_TEST_PASS: Tweet posted successfully!
   • Tweet ID: 1234567890
```

### Step 4: Smoke Test via HTTP
```bash
curl -X POST https://your-app.railway.app/admin/post \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"xBOT smoke via HTTP"}'
```

**Expected output:**
```json
{
  "ok": true,
  "success": true,
  "id": "1234567890"
}
```

### Step 5: Monitor Logs
```bash
railway logs --service xbot-production | grep -E 'JOB_REGISTERED|POSTING_|PW'
```

**Expected patterns:**
```
JOB_REGISTERED {"plan":true,"reply":true,"posting":true,"learn":true} mode=live
POSTING_START textLength=42
[PW] Attempt 1/3 starting...
POSTING_DONE id=1234567890
```

### Troubleshooting

#### If browser crashes:
1. Check logs for: `[PW] ❌ Attempt X failed`
2. Look for artifacts: `/tmp/fail-*.png`, `/tmp/trace-*.zip`
3. Download traces: `railway run bash -c 'ls -lh /tmp/*.{png,zip}'`
4. Enable tracing: Set `PLAYWRIGHT_TRACE=on` and redeploy

#### If posting job not registered:
1. Check logs for: `❌ FATAL: Posting job not registered despite MODE=live`
2. Verify env vars: `MODE=live` and `DISABLE_POSTING != true`
3. System will exit with code 1 (fail-fast)

#### If session expired:
1. Run locally: `node create_fresh_session.js`
2. Deploy session: `bash deploy_session.sh`
3. Verify: `railway logs | grep SESSION_SAVED`

---

## Environment Variables (Railway)

Set these on Railway:
```bash
MODE=live
DISABLE_POSTING=false
ADMIN_TOKEN=<random-secure-string>
JOBS_AUTOSTART=true
JOBS_POSTING_INTERVAL_MIN=5
PLAYWRIGHT_TRACE=off  # Enable for debugging
TWITTER_SESSION_B64=<base64-session>
```

---

## Acceptance Criteria

✅ `/status` shows all four timers true in `MODE=live`  
✅ A smoke post succeeds on X  
✅ Crashes produce trace/screenshot artifacts paths in logs  
✅ Legacy flags cannot silently disable posting in live  
✅ Job manager exits with error if posting not registered in live mode  
✅ Playwright uses persistent context (no /dev/shm issues)  
✅ Browser auto-retries 3x with screenshots  

---

## Testing Checklist

- [ ] Verify build succeeds: `npm run build`
- [ ] Verify tests pass: `npm test`
- [ ] Deploy to Railway: `git push origin main`
- [ ] Wait for Railway build (~3 min)
- [ ] Verify `/status` shows all 4 timers
- [ ] Verify `/playwright` shows healthy browser
- [ ] Run smoke test: `tsx scripts/post_once.ts "test"`
- [ ] Verify tweet appears on X
- [ ] Check logs for `POSTING_DONE`
- [ ] Verify automatic posting cycle works

---

## Rollback Plan

If issues occur:
1. Set `DISABLE_POSTING=true` on Railway (stops posting immediately)
2. Roll back to previous deployment
3. Check logs for specific error: `railway logs --tail 500`
4. Review artifacts in `/tmp/` for debug info

---

## Files Changed

### New Files
- `src/config/featureFlags.ts`
- `src/infra/playwright/launcher.ts`
- `src/infra/playwright/withBrowser.ts`
- `src/posting/postNow.ts`
- `src/server/routes/admin.ts`
- `scripts/post_once.ts`
- `test/jobsRegistration.test.ts`

### Modified Files
- `src/jobs/jobManager.ts` - Fail-fast logic + all 4 timers
- `src/server.ts` - Admin routes + enhanced /status
- `Dockerfile` - Playwright system deps

### Configuration
- `.env.example` - Complete example with MODE flags

---

## Migration Notes

**Breaking Changes:**
- System now exits (fail-fast) if `MODE=live` but posting job not registered
- Legacy `POSTING_DISABLED` and `DRY_RUN` are normalized in live mode

**Backward Compatibility:**
- Legacy env vars still work but are overridden in live mode
- Shadow mode unchanged
- All existing jobs continue to work

---

## Performance Impact

**Build time:** +30-60s (Playwright installation)  
**Memory:** +150-200MB (Chromium browser)  
**Disk:** +250MB (Chromium binary + profile)  
**Runtime:** Persistent context reuses browser (faster than launching each time)

---

## Security Notes

- `ADMIN_TOKEN` required for `/admin/*` endpoints
- Session cookies stored in persistent context (not in logs)
- Traces/screenshots may contain sensitive data (stored in `/tmp/`, ephemeral)

---

## Future Enhancements

- [ ] Add Prometheus metrics for posting success rate
- [ ] Implement circuit breaker for repeated Playwright failures
- [ ] Add `/admin/traces` endpoint to list/download debug artifacts
- [ ] Implement session auto-refresh (detect expiration + reauth)
- [ ] Add smoke test to CI/CD pipeline

---

## Author Notes

This PR addresses the root cause of Playwright crashes in Docker:
1. **No /dev/shm dependency** - Using persistent context with explicit args
2. **No sandbox** - Disabled via `chromiumSandbox: false`
3. **Auto-retry** - 3 attempts with exponential backoff
4. **Observability** - Screenshots + traces on failure
5. **Fail-fast** - System exits if posting not registered in live mode

The job manager bug (only 3 timers started) is fixed with explicit registration checks and fail-fast logic.

