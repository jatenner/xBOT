# Find Auth Cookies Workflow

**Date:** January 29, 2026  
**Status:** ⏳ Awaiting Manual Execution

## Problem

Executor posts successfully, but Railway harvester shows `logged_in=false`. The executor uses `TWITTER_SESSION_B64` from `.env`, but Railway's session is stale.

## Solution: Extract Session from .env

The executor applies cookies from `TWITTER_SESSION_B64` in `.env`. If posting works, that session likely has valid auth cookies.

### Step 1: Extract Session from .env

```bash
cd /Users/jonahtenner/Desktop/xBOT
pnpm exec tsx scripts/ops/extract-env-session.ts
```

**Expected Output:**
```
auth_token: ✅ YES (domain: .x.com)
ct0: ✅ YES (domain: .x.com)
✅ .env session HAS auth cookies!
✅ Exported to twitter_session.json
```

### Step 2: Push to Railway

```bash
RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json \
  pnpm exec tsx scripts/ops/push-twitter-session-to-railway.ts
```

### Step 3: Verify Auth on Railway

```bash
railway run --service serene-cat pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts | grep "\[HARVESTER_AUTH\]"
```

**Expected:**
```
[HARVESTER_AUTH] logged_in=true handle=@...
```

## Alternative: If .env Session Invalid

If `.env` session doesn't have auth cookies, scan all Chrome channels:

```bash
pnpm exec tsx scripts/ops/scan-all-chrome-channels.ts
```

This will:
1. Check executor profile: `.runner-profile/executor-chrome-profile`
2. Check Chrome Default
3. Check Chrome Beta (if installed)
4. Check Chrome Canary (if installed)
5. Output a table showing which profile has auth cookies

Then export from the profile that shows `auth_token: YES, ct0: YES`.

## Files Created

- `scripts/ops/extract-env-session.ts` - Extract session from .env
- `scripts/ops/find-executor-cookies.ts` - Check executor profile
- `scripts/ops/scan-all-chrome-channels.ts` - Scan all Chrome channels
- `scripts/refresh-x-session.ts` - Updated to support CHROME_PROFILE_PATH

## Commits

- `b8ae0982` - Add Chrome profile path parser and instructions
- `38083bc9` - Add Chrome profile enumeration and fix refresh script
