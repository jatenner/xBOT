# Refresh Twitter Session B64 - Proof Document

**Date:** 2026-02-04  
**Purpose:** Safely refresh TWITTER_SESSION_B64 and verify end-to-end functionality

---

## Scripts Created

### A) `scripts/ops/refresh-twitter-session-b64.ts`

**Two modes:**

1. **From existing authenticated Chrome profile (preferred):**
   - Uses `PLAYWRIGHT_PERSIST_BROWSER=true` and configured profile path
   - Opens `https://x.com/home`
   - Waits until logged-in state is confirmed
   - Exports cookies (JSON) and localStorage snapshot
   - Produces base64-encoded cookie payload string
   - Prints: `TWITTER_SESSION_B64=<BASE64>`

2. **Manual login assist (fallback):**
   - Launches headed browser
   - Prompts user to log in
   - After login, repeats export + base64 print

**Safety features:**
- Validates `auth_token` and `ct0` cookies exist (fail-closed)
- Stores intermediate JSON files in `./runtime/secrets/` (gitignored)
- Never writes secrets to git or `.env` files
- Only prints base64 string once, clearly labeled

### B) `scripts/ops/verify-twitter-session.ts`

**Verification steps:**
- Accepts `TWITTER_SESSION_B64` via env
- Boots Playwright, loads cookies
- Navigates to `https://x.com/home` and sample tweet URL
- Emits proof logs: `AUTH_OK`, `SAFE_GOTO_OK`
- Prints counts of cookies and whether `ct0`/`auth_token` exist (no values)

**Fail-closed checks:**
- Validates `auth_token` cookie present
- Validates `ct0` cookie present
- Verifies navigation succeeds (not redirected to login)

---

## Commands

### 1) Generate new session locally

**Mode 1: From existing Chrome profile (preferred)**
```bash
# Set profile directory (if not using default)
export PLAYWRIGHT_PERSIST_BROWSER=true
export RUNNER_PROFILE_DIR=~/.runner-profile  # or your Chrome profile path

# Run refresh script
pnpm exec tsx scripts/ops/refresh-twitter-session-b64.ts

# Output will be:
# TWITTER_SESSION_B64=<BASE64_STRING>
```

**Mode 2: Manual login assist**
```bash
export MODE=manual
export HEADLESS=false
pnpm exec tsx scripts/ops/refresh-twitter-session-b64.ts
```

### 2) Verify session locally

```bash
# Set the session from refresh output
export TWITTER_SESSION_B64=<BASE64_STRING_FROM_REFRESH>

# Run verifier
pnpm exec tsx scripts/ops/verify-twitter-session.ts

# Expected output:
# ✅ AUTH_OK: Session is valid
# ✅ SAFE_GOTO_OK: https://x.com/home
# PASS: Session is valid and can navigate to X.com
```

### 3) Railway variable commands

**For xBOT service:**
```bash
railway variables --service xBOT --set TWITTER_SESSION_B64=<BASE64_STRING>
```

**For serene-cat service:**
```bash
railway variables --service serene-cat --set TWITTER_SESSION_B64=<BASE64_STRING>
```

### 4) Production verification (log grep commands)

**Check session loaded successfully:**
```bash
railway logs --service xBOT --lines 200 | grep -E "TWITTER_SESSION|RAILWAY_SESSION|AUTH_OK"
```

**Check navigation working:**
```bash
railway logs --service xBOT --lines 200 | grep -E "SAFE_GOTO_OK|SAFE_GOTO_FAIL"
```

**Check auth cookies present:**
```bash
railway logs --service xBOT --lines 200 | grep -E "auth_token|ct0|cookies"
```

---

## Safety Measures

### Gitignore Updates

Added to `.gitignore`:
```
runtime/secrets/
*.cookies.json
*.storage.json
```

### Intermediate Files

All intermediate cookie/storage JSON files are stored in:
- `./runtime/secrets/cookies-<timestamp>.json`
- `./runtime/secrets/storage-<timestamp>.json`

These are gitignored and never committed.

### Fail-Closed Validation

Both scripts validate:
- `auth_token` cookie must exist
- `ct0` cookie must exist
- If either missing, script exits with error code 1

---

## Verification Results

### Local Verification Run (Without Session - Fail-Closed Test)

**Command:**
```bash
pnpm exec tsx scripts/ops/verify-twitter-session.ts
```

**Actual Output (No Session Set):**
```
═══════════════════════════════════════════════════════════
✅ Verify Twitter Session
═══════════════════════════════════════════════════════════

[VERIFY_SESSION] ❌ Failed to load cookies: TWITTER_SESSION_B64 environment variable is required
Exit code: 1
```

**Result:** ✅ **PASS** - Script correctly fails-closed when session is missing

### Local Verification Run (With Session - Expected)

**Command:**
```bash
export TWITTER_SESSION_B64=<BASE64_STRING>
pnpm exec tsx scripts/ops/verify-twitter-session.ts
```

**Expected Output:**
```
═══════════════════════════════════════════════════════════
✅ Verify Twitter Session
═══════════════════════════════════════════════════════════

[VERIFY_SESSION] ✅ Loaded <N> cookies from TWITTER_SESSION_B64

[VERIFY_SESSION] 📊 Cookie Statistics:
   Total cookies: <N>
   X.com/Twitter cookies: <M>
   auth_token present: ✅ YES
   ct0 present: ✅ YES

[VERIFY_SESSION] 🚀 Launching browser...
[VERIFY_SESSION] ✅ Cookies added to browser context

[VERIFY_SESSION] 📍 Testing navigation to https://x.com/home...
[VERIFY_SESSION] ✅ SAFE_GOTO_OK: https://x.com/home

[VERIFY_SESSION] 📍 Testing navigation to sample tweet...
[VERIFY_SESSION] ✅ SAFE_GOTO_OK: <tweet_url>

[VERIFY_SESSION] ✅ AUTH_OK: Session is valid

═══════════════════════════════════════════════════════════
✅ Verification Complete
═══════════════════════════════════════════════════════════

PASS: Session is valid and can navigate to X.com
```

---

## Railway Variable Names (No Values)

**Variable name to set:**
- `TWITTER_SESSION_B64`

**Services to update:**
- `xBOT`
- `serene-cat`

---

## Notes

- Never commit `runtime/secrets/` directory
- Never commit `*.cookies.json` or `*.storage.json` files
- Base64 string is only printed once, clearly labeled
- All intermediate files are stored in gitignored `runtime/secrets/` directory
- Both scripts fail-closed if auth cookies are missing
