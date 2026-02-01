# Auth Export Fix: Extract Cookies After Navigation

**Date:** January 29, 2026  
**Status:** ✅ Fixed

## Problem

Chrome partitioned/HttpOnly cookies were not being captured by `storageState()` export. The executor posts successfully, but Railway harvester shows `logged_in=false` because auth cookies (`auth_token`, `ct0`) weren't extracted properly.

## Solution

Modified `scripts/refresh-x-session.ts` to:
1. Navigate to `https://x.com/home` using persistent Chrome context
2. Wait for authenticated UI signal (sidebar elements)
3. Call `context.cookies('https://x.com')` AFTER navigation to get partitioned cookies
4. Also get all cookies without URL filter to catch all domains
5. Serialize ONLY required cookie fields (name, value, domain, path, expires, httpOnly, secure, sameSite)
6. Export in Railway-compatible format

## Changes

**File:** `scripts/refresh-x-session.ts`

- Changed from `storageState()` export to manual cookie extraction
- Added `context.cookies('https://x.com')` call after navigation
- Added cookie deduplication logic
- Serialize only required fields for Railway compatibility

## Verification Steps

1. **Extract session:**
   ```bash
   pnpm tsx scripts/refresh-x-session.ts
   ```
   Expected: `auth_token: ✅ YES`, `ct0: ✅ YES`

2. **Push to Railway:**
   ```bash
   RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json \
     pnpm tsx scripts/ops/push-twitter-session-to-railway.ts
   ```

3. **Verify auth:**
   ```bash
   railway run --service serene-cat pnpm tsx scripts/ops/run-harvester-single-cycle.ts | grep "\[HARVESTER_AUTH\]"
   ```
   Expected: `[HARVESTER_AUTH] logged_in=true`

## Files Changed

- `scripts/refresh-x-session.ts` - Fixed cookie extraction after navigation
