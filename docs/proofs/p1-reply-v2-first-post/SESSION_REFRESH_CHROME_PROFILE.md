# Session Refresh - Chrome Profile Implementation

**Date:** January 29, 2026  
**Status:** ✅ Code Complete, ⏳ Requires Logged-In Chrome Profile

## Implementation

### Changes Made

**File:** `scripts/refresh-x-session.ts`

**Key Changes:**
1. **Uses Real Chrome:** Changed from `chromium.launch()` with `channel: 'chromium'` to `chromium.launchPersistentContext()` with `channel: 'chrome'`
2. **Persistent Context:** Uses `launchPersistentContext` to access existing Chrome profile cookies
3. **No Login Required:** Extracts cookies from already-logged-in profile (no interactive login)
4. **Profile Detection:** Added helper to check which profiles have X.com auth cookies
5. **Verification:** Confirms `auth_token` and `ct0` cookies exist before saving

**Code:**
```typescript
context = await chromium.launchPersistentContext(profilePath, {
  headless: false, // Visible for verification
  channel: 'chrome', // Use real Chrome, not test browser
  args: ['--no-first-run', '--disable-blink-features=AutomationControlled'],
});
```

### Usage

**Default Profile:**
```bash
pnpm tsx scripts/refresh-x-session.ts
```

**Specific Profile:**
```bash
CHROME_PROFILE_DIR="Profile 1" pnpm tsx scripts/refresh-x-session.ts
```

**Custom Chrome Directory:**
```bash
CHROME_USER_DATA_DIR="/custom/path" CHROME_PROFILE_DIR="Default" pnpm tsx scripts/refresh-x-session.ts
```

## Current Status

**Test Result:**
- ✅ Script runs successfully
- ✅ Uses real Chrome (not test browser)
- ✅ Accesses Default profile
- ❌ Default profile not logged in to X.com (only guest cookies found)

**Evidence:**
```
🍪 Cookie Check:
   Total cookies: 14
   Twitter/X cookies: 12
   auth_token: ❌ NO
   ct0: ❌ NO
```

## Next Steps

**Option 1: Log in to Default Profile**
1. Open Chrome
2. Navigate to x.com
3. Log in
4. Re-run: `pnpm tsx scripts/refresh-x-session.ts`

**Option 2: Use Different Profile**
1. Check which profiles exist: Script will list them if Default fails
2. Use profile that's already logged in: `CHROME_PROFILE_DIR="Profile 1" pnpm tsx scripts/refresh-x-session.ts`

**Option 3: Script Auto-Detection**
- Script will check all profiles and report which has auth cookies
- Use the profile that shows "✅ (has auth cookies)"

## Verification

After successful export:
1. Session file: `./twitter_session.json`
2. File size: ~4KB (varies by cookie count)
3. Contains: `auth_token` and `ct0` cookies for `.x.com` domain

Then push to Railway:
```bash
RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json pnpm tsx scripts/ops/push-twitter-session-to-railway.ts
```

Verify on Railway:
```bash
railway run --service serene-cat pnpm tsx scripts/ops/run-harvester-single-cycle.ts
# Look for: [HARVESTER_AUTH] logged_in=true
```

## Files Changed

- `scripts/refresh-x-session.ts` - Complete rewrite to use Chrome profile
- `docs/OPS_AUTH.md` - Updated with Chrome profile usage

## Commits

- `Fix session refresh: use real Chrome profile cookies`
- `Update OPS_AUTH.md with Chrome profile usage`
