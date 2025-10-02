# 🔐 PR: Fix X/Twitter Authentication - Cookie Domain Normalization

## Problem

Session validator reports "logged in" but posting fails with "Not logged in to Twitter". 

**Root cause:** Cookies stored for `.twitter.com` don't apply to `x.com` domain.

## Solution

Implement comprehensive cookie/domain normalization with automatic login fallback.

## Changes

### A) New Session Manager (`src/infra/session/xSession.ts`)

- ✅ Normalizes cookies for both `.twitter.com` and `.x.com` domains
- ✅ Loads/saves storage state with domain duplication
- ✅ Provides consistent `isLoggedIn()` check used by both validator and poster
- ✅ Applies cookies to existing browser contexts

**Key function:**
```typescript
function dupDomains(cookies: Cookie[]): Cookie[] {
  // Creates variants for both .twitter.com and .x.com
  // Ensures auth works on either domain
}
```

### B) TOTP Helper (`src/infra/session/totp.ts`)

- ✅ Generates 6-digit TOTP codes for 2FA
- ✅ Base32 decode + HMAC-SHA1 implementation
- ✅ Used during automatic login if `X_2FA_SECRET` is set

### C) Automatic Login (`src/infra/playwright/xLogin.ts`)

- ✅ Handles username/password flow
- ✅ Detects and handles "unusual activity" verification
- ✅ Supports 2FA with TOTP
- ✅ Saves session after successful login

**Triggered when:** Page check finds user not logged in and `X_USERNAME`/`X_PASSWORD` are set.

### D) Updated Browser Wrapper (`src/infra/playwright/withBrowser.ts`)

**Before:**
```typescript
- Navigate to x.com
- No cookie normalization
- No login fallback
```

**After:**
```typescript
+ Apply normalized cookies (both domains)
+ Set realistic user agent
+ Try twitter.com first (legacy cookie support)
+ Fallback to x.com if needed
+ Auto-login if not authenticated
+ Save session after login
```

### E) Updated Session Validator (`src/utils/railwaySessionManager.ts`)

**Before:**
- Used `x.com` only
- Different login check than poster
- No domain normalization

**After:**
- Uses same `isLoggedIn()` as poster (consistency!)
- Tries `twitter.com` first, falls back to `x.com`
- Normalizes cookies for both domains
- Same code path as actual posting

### F) Updated Status Route (`src/server/routes/status.ts`)

Added fields:
```json
{
  "sessionFileExists": true,
  "lastLoginAt": "2025-10-02T18:15:30.123Z",
  "lastAuthCheck": "2025-10-02T18:16:45.456Z"
}
```

## Environment Variables

```bash
# Required for posting
X_USERNAME=your_twitter_handle
X_PASSWORD=your_twitter_password

# Optional: for verification challenges
X_EMAIL=your_email@example.com

# Optional: for 2FA
X_2FA_SECRET=BASE32_TOTP_SECRET_HERE

# Optional: override target domain (default: twitter.com)
X_TARGET_DOMAIN=twitter.com
```

## Testing Plan

### 1. Deploy and Check Status
```bash
curl https://xbot-production.up.railway.app/status | jq
```

Expected:
```json
{
  "sessionFileExists": true,
  "lastLoginAt": "2025-10-02T...",
  "lastAuthCheck": "2025-10-02T..."
}
```

### 2. Trigger Posting
```bash
railway run npm run job:posting
```

**First run (if session expired):**
- Will attempt automatic login
- Save normalized cookies
- Post successfully

**Subsequent runs:**
- Use existing session
- No login needed
- Post successfully

### 3. Verify Session File
```bash
railway run cat /tmp/xbot-session.json | jq '.cookies[] | select(.name=="auth_token") | .domain'
```

Expected output (cookies for both domains):
```
".twitter.com"
".x.com"
".twitter.com"
".x.com"
```

## Success Criteria

✅ **Validator and poster use identical login check**  
✅ **Cookies work on both twitter.com and x.com**  
✅ **Automatic login on auth failure (if credentials provided)**  
✅ **Session persisted with normalized domains**  
✅ **No more "Not logged in" errors with valid session**  

## Rollback Plan

If issues occur:
```bash
git revert HEAD
git push origin main
```

Old session manager will still work (using x.com only).

## Monitoring

Watch for:
```
[X_SESSION] Loaded N cookies (normalized for both domains)
[PW] Navigating to twitter.com/home...
[PW] ✅ Logged in and ready
POSTING_START textLength=...
POSTING_DONE id=...
```

If you see:
```
[X_LOGIN] Starting login flow...
[X_LOGIN] ✅ Login successful
[X_SESSION] ✅ Saved N cookies to /tmp/xbot-session.json
```

This means automatic login was triggered (first run or expired session).

## Files Changed

```
src/infra/session/xSession.ts          (NEW)
src/infra/session/totp.ts              (NEW)
src/infra/playwright/xLogin.ts         (NEW)
src/infra/playwright/withBrowser.ts    (UPDATED)
src/utils/railwaySessionManager.ts     (UPDATED)
src/server/routes/status.ts            (UPDATED)
```

## Related Issues

Fixes: "Session validator says logged in but posting fails"

## Credits

Root cause identified: Cookie domain mismatch between `.twitter.com` and `.x.com`

