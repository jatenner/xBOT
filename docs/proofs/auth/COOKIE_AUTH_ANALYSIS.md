# Cookie Auth Analysis

**Date:** ${new Date().toISOString()}

## Cookies Provided

**Total Cookies:** 13
**Status:** ❌ **MISSING CRITICAL AUTH COOKIE**

### Cookies Present:
- ✅ `guest_id`, `guest_id_marketing`, `guest_id_ads` - Guest/anonymous identifiers
- ✅ `ct0` - CSRF token (present but needs auth_token to be useful)
- ✅ `twid` - Twitter user ID (present but needs auth_token)
- ✅ `personalization_id` - Personalization tracking
- ✅ `lang`, `dnt` - Preferences
- ✅ `_ga`, `_ga_BLY4P7T5KW` - Analytics cookies
- ✅ `__cuid`, `gt`, `g_state` - Various tracking cookies

### Cookies Missing:
- ❌ **`auth_token`** - **CRITICAL** - Required for authenticated operations
- ❌ `auth_multi` - Multi-factor auth token (if applicable)
- ❌ `_twitter_sess` - Session cookie (if applicable)

## Test Results

**B64 Auth Read/Write Proof:** ❌ **FAILED**
- Cookies loaded: 26 (13 duplicated for both domains)
- B64 encoded: ✅ Success
- `.env.local` updated: ✅ Success
- Auth verification: ❌ **Redirected to login**

**Reason:** Without `auth_token`, X.com treats the session as unauthenticated and redirects to login.

## What These Cookies Can Do

These cookies are **guest/anonymous cookies**. They can:
- ✅ Track analytics
- ✅ Store preferences (language, etc.)
- ❌ **CANNOT** authenticate for posting, replying, harvesting, or any write operations
- ❌ **CANNOT** access authenticated pages (home timeline, compose, etc.)

## How to Get Complete Cookies

### Method 1: Browser DevTools (Recommended)

1. **Open Chrome/Safari** and navigate to `https://x.com`
2. **Ensure you're logged in** (see your home timeline)
3. **Open DevTools** (F12 or Cmd+Option+I)
4. **Go to Application tab** → **Cookies** → **https://x.com**
5. **Export all cookies** including:
   - `auth_token` ⚠️ **CRITICAL** - Usually httpOnly, so you need DevTools
   - `ct0`
   - `twid`
   - All other cookies

### Method 2: Playwright Session Export

If you have a logged-in Playwright session:

```typescript
const storageState = await context.storageState();
// This includes httpOnly cookies like auth_token
```

### Method 3: Cookie Export Extension

Use a browser extension like "Cookie Editor" or "EditThisCookie" to export all cookies including httpOnly ones.

## Required Cookie Format

```json
{
  "cookies": [
    {
      "name": "auth_token",
      "value": "...",  // ⚠️ CRITICAL - Must be present
      "domain": ".x.com",
      "path": "/",
      "expires": -1,
      "httpOnly": true,  // Usually true for auth_token
      "secure": true,
      "sameSite": "None"
    },
    {
      "name": "ct0",
      "value": "...",
      "domain": ".x.com",
      "path": "/",
      "secure": true,
      "httpOnly": false,
      "sameSite": "Lax"
    }
    // ... other cookies
  ]
}
```

## Next Steps

1. **Export complete cookies** including `auth_token` from a logged-in browser
2. **Save to** `.runner-profile/cookies_input.json`
3. **Run:** `pnpm run ops:update:cookies`
4. **Verify:** The B64 readwrite proof should pass
5. **Test comprehensive:** `pnpm run ops:test:profile-auth` (if using profile) or `COOKIE_AUTH_MODE=true pnpm run ops:up:fast` (if using B64)

## Why auth_token is Critical

The `auth_token` cookie is:
- **Required** for all authenticated operations
- Usually **httpOnly** (not accessible via JavaScript, only via DevTools/Playwright)
- **Tied to your account** and session
- **Expires** after a period of inactivity or can be revoked

Without it, X.com treats requests as anonymous/guest, which blocks:
- Posting tweets
- Replying to tweets
- Accessing home timeline
- Harvesting/searching authenticated content
- All write operations
