# Chrome Profile Enumeration Report

**Date:** January 29, 2026  
**Status:** ❌ No Chrome profiles found with X.com auth cookies

## Summary

Enumerated all Chrome profiles (system Chrome and executor profiles) and found **no profiles with `auth_token` AND `ct0` cookies**.

## System Chrome Profiles Checked

**Location:** `~/Library/Application Support/Google/Chrome`

**Profiles Found:**
- `Default` - ❌ No auth cookies (9 X cookies, but no auth_token/ct0)

**Result:**
```
Profile          | Total Cookies | X Cookies | auth_token | ct0
-----------------|---------------|-----------|------------|-----
Default         |            11 |         9 | NO         | NO
```

## Executor Profile Directories Checked

**Location:** `./.runner-profile`

**Profiles Checked:** 21 directories
- `executor-chrome-profile` - ❌ No X cookies
- `Default` - ❌ No X cookies  
- `chrome-cdp-profile` - ❌ No X cookies
- `.chrome-cdp-profile` - ❌ No X cookies
- (17 other directories) - ❌ No X cookies

**Result:** None had auth cookies.

## Existing Session Files

**`.env.twitter_session_b64`:**
- File exists: ✅ YES
- Size: 4.2KB
- Total cookies: 12
- **auth_token:** ❌ NO
- **ct0:** ❌ NO

**`twitter_session.json` (from .env.twitter_session_b64):**
- File exists: ✅ YES  
- Size: 3.1KB
- Total cookies: 12
- **auth_token:** ❌ NO
- **ct0:** ❌ NO

## Railway Auth Status

**After pushing session from .env.twitter_session_b64:**
```
[HARVESTER_AUTH] logged_in=false handle=unknown url=https://x.com/i/flow/login?redirect_after_login=%2Fhome reason=login_redirect
```

**Status:** ❌ Still failing (login_redirect - session invalid)

## Root Cause

**No Chrome profile contains valid X.com auth cookies (`auth_token` + `ct0`).**

Possible reasons:
1. Chrome is not logged in to X.com in any profile
2. Cookies are stored in a different location
3. Cookies expired/invalidated
4. Using a different authentication mechanism

## Required Action

**Option 1: Log in to X.com in Chrome (Recommended)**
1. Open Chrome
2. Navigate to x.com
3. Log in manually
4. Re-run: `pnpm tsx scripts/ops/enumerate-chrome-profiles.ts`
5. Use the profile that shows `auth_token: YES, ct0: YES`
6. Export: `CHROME_PROFILE_DIR="<profile>" pnpm tsx scripts/refresh-x-session.ts`

**Option 2: Use Executor Session Export**
If executor is running and logged in:
1. Ensure executor is running with valid session
2. Run: `RUNNER_PROFILE_DIR=./.runner-profile pnpm tsx scripts/ops/sync-twitter-session-from-profile.ts`
3. This will export from executor's active session

## Next Steps

Once a profile with auth cookies is found:
1. Export session: `CHROME_PROFILE_DIR="<profile>" pnpm tsx scripts/refresh-x-session.ts`
2. Push to Railway: `RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json pnpm tsx scripts/ops/push-twitter-session-to-railway.ts`
3. Verify: `railway run --service serene-cat pnpm tsx scripts/ops/run-harvester-single-cycle.ts`
4. Expected: `[HARVESTER_AUTH] logged_in=true`

## Files Created

- `scripts/ops/enumerate-chrome-profiles.ts` - Profile enumeration script
- `scripts/ops/check-executor-profiles.ts` - Executor profile checker

## Commits

- `910bf27b` - Fix session refresh: use real Chrome profile cookies
- `325147eb` - Update OPS_AUTH.md with Chrome profile usage
- `a2db120c` - Document Chrome profile session refresh implementation
