# Operations: Auth Management

**Last Updated:** 2026-02-01

## Overview

xBOT uses two auth contexts with strict separation:
1. **Railway (control-plane):** Uses `TWITTER_SESSION_B64` environment variable
2. **Executor (Mac Runner):** Uses ONLY local Chrome profile (must NOT use `TWITTER_SESSION_B64`)

## Canonical Auth Flow

### Step 1: Refresh Session (Executor)
```bash
# On Mac Runner - reads from local Chrome profile
pnpm tsx scripts/refresh-x-session.ts
```
- Reads from local Chrome profile
- Saves to `./twitter_session.json`

### Step 2: Push to Railway
```bash
RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json \
  pnpm tsx scripts/ops/push-twitter-session-to-railway.ts
```
- Reads `twitter_session.json`
- Base64 encodes
- Sets `TWITTER_SESSION_B64` on Railway service
- Verifies session on Railway

### Step 3: Verify
```bash
railway run --service serene-cat pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts | grep "\[HARVESTER_AUTH\]"
```
- Expected: `[HARVESTER_AUTH] logged_in=true handle=@SignalAndSynapse url=https://x.com/home reason=ok`

**Done.** Session is synced and verified.

## Session Sync Workflow

### Mac → Railway Sync

**Step 1: Export Session from Real Chrome Profile**

**Script:** `scripts/refresh-x-session.ts`

**Prerequisites:**
- Chrome must be installed
- You must be logged in to X.com in Chrome (any profile)

**Usage:**
```bash
# Default profile
pnpm tsx scripts/refresh-x-session.ts

# Specific profile
CHROME_PROFILE_DIR="Profile 1" pnpm tsx scripts/refresh-x-session.ts

# Custom Chrome user data directory
CHROME_USER_DATA_DIR="/path/to/chrome" CHROME_PROFILE_DIR="Default" pnpm tsx scripts/refresh-x-session.ts
```

**Environment Variables:**
- `CHROME_USER_DATA_DIR`: Chrome user data directory (default: `~/Library/Application Support/Google/Chrome` on Mac)
- `CHROME_PROFILE_DIR`: Profile directory name (default: `Default`)

**What it does:**
1. Launches Chrome using `launchPersistentContext` with your real Chrome profile
2. Uses `channel: 'chrome'` (real Chrome, NOT test browser)
3. Extracts cookies from the profile
4. Verifies `auth_token` and `ct0` cookies exist
5. Saves session to `./twitter_session.json`

**If profile not logged in:**
- Script will list available profiles and check which has X.com auth cookies
- Log in to X.com in Chrome first, then re-run

**Step 2: Push Session to Railway**

**Script:** `scripts/ops/push-twitter-session-to-railway.ts`

**Command:**
```bash
# Set session path if different
export TWITTER_SESSION_PATH=./twitter_session.json
export RAILWAY_SERVICE=serene-cat

# Run sync
pnpm tsx scripts/ops/push-twitter-session-to-railway.ts
```

**Expected Output:**
```
📁 Read session file: ./twitter_session.json (5441 bytes)
📦 Encoded to base64: 7256 chars
🚀 Updating Railway service: serene-cat
✅ Railway variable updated
🔍 Verifying session on Railway...
✅ Session verified on Railway
✅ Session sync complete
```

## Auth Freshness Check

**Utility:** `src/utils/authFreshnessCheck.ts`

**Functions:**
- `checkAuthFreshness(page)`: Checks auth validity, persists to DB
- `isAuthBlocked()`: Returns `{ blocked: boolean, reason?: string }`

**Usage:**
```typescript
import { checkAuthFreshness, isAuthBlocked } from './src/utils/authFreshnessCheck';

// Check if currently blocked
const blockStatus = await isAuthBlocked();
if (blockStatus.blocked) {
  console.error(`Auth blocked: ${blockStatus.reason}`);
}

// Check freshness with page
const page = await browser.newPage();
const result = await checkAuthFreshness(page);
console.log(`Auth valid: ${result.valid}, handle: ${result.handle}`);
```

## Fail-Closed Behavior

### Harvester
- In P1 mode: Exits with code 1 if auth fails
- Emits `harvester_auth_blocked_p1` event
- Prevents harvest cycle from running

### Scheduler
- Checks `isAuthBlocked()` at start
- Returns early with `auth_blocked` reason if blocked
- Prevents decision creation

## Troubleshooting

### Auth Fails on Railway

1. **Check Railway env var:**
   ```bash
   railway variables --service serene-cat | grep TWITTER_SESSION_B64
   ```

2. **Sync session:**
   ```bash
   pnpm tsx scripts/ops/push-twitter-session-to-railway.ts
   ```

3. **Verify on Railway:**
   ```bash
   railway run --service serene-cat pnpm tsx -e "
     import('./src/utils/authFreshnessCheck').then(async ({ checkAuthFreshness }) => {
       const { UnifiedBrowserPool } = await import('./src/browser/UnifiedBrowserPool');
       const pool = UnifiedBrowserPool.getInstance();
       const page = await pool.acquirePage('auth_verify');
       try {
         const result = await checkAuthFreshness(page);
         console.log('Result:', JSON.stringify(result, null, 2));
         process.exit(result.valid ? 0 : 1);
       } finally {
         await pool.releasePage(page);
       }
     });
   "
   ```

### Auth Fails Locally

1. **Refresh session:**
   ```bash
   pnpm tsx scripts/refresh-x-session.ts
   ```

2. **Verify session:**
   ```bash
   pnpm tsx scripts/ops/verify-harvester-auth.ts
   ```

3. **Check .env:**
   ```bash
   grep TWITTER_SESSION_B64 .env
   ```

## Auth Source Guardrails

### Control-Plane (Railway)
- **Required:** `TWITTER_SESSION_B64` must be set
- **Fails fast:** Throws error if missing
- **Logs:** `[AUTH_SOURCE] mode=control source=railway_cookie_blob`

### Executor (Mac Runner)
- **Required:** Local Chrome profile (`RUNNER_PROFILE_DIR/.chrome-cdp-profile`)
- **Forbidden:** `TWITTER_SESSION_B64` must NOT be set
- **Fails fast:** Throws error if `TWITTER_SESSION_B64` is detected
- **Logs:** `[AUTH_SOURCE] mode=executor source=local_chrome_profile`

## Expected Behavior

- **Harvester:** Checks auth before each cycle, fails-closed in P1 mode
- **Scheduler:** Checks auth block status, returns early if blocked
- **Executor:** Uses persistent Chrome profile ONLY (refuses `TWITTER_SESSION_B64`)
- **Railway:** Uses `TWITTER_SESSION_B64` from env vars (required)

## Proof Documents

- `docs/proofs/auth/AUTH_FAIL_CLOSED.md` - Fail-closed implementation proof
- `docs/proofs/p1-reply-v2-first-post/SESSION_SYNC_SELF_HEAL.md` - Session sync proof
