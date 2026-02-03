# Auth Failure Classification & Handling

This document describes how auth persistence failures are classified and handled.

## Failure Buckets

### Bucket A — `login_redirect`

**Meaning:** X is treating the session as invalid for your automation context.

**Root Cause:** Session revocation or trust issue, not storage.

**Diagnostic:** Run `executor:prove:cookie-persist` to verify cookies are actually persisted to disk:
- If cookies are present but redirect happens anyway → session revocation/trust issue, not storage
- If cookies are missing → storage issue

**Smallest Next Step:** 
```bash
# Before auth
BEFORE_AUTH=true pnpm run executor:prove:cookie-persist

# After auth
AFTER_AUTH=true pnpm run executor:prove:cookie-persist

# After 5 minutes
DELAY_MINUTES=5 pnpm run executor:prove:cookie-persist
```

**Goal:** Show that the login state is actually persisted to disk.

---

### Bucket B — `consent_wall_detected`

**Meaning:** You are logged in, but you're blocked from timeline by consent UX (or region/privacy gating).

**Root Cause:** Consent wall blocking timeline access despite valid session.

**Handling:** Consent dismissal is now integrated into daemon preflight (same logic as `auth-readwrite` proof):
- Detects consent wall using `detectConsentWall()`
- Dismisses using `acceptConsentWall()` with retry
- Waits for page to settle after dismissal
- Re-checks auth state

**Smallest Next Step:** Consent dismissal is automatic in daemon preflight. If `consent_wall_detected` persists:
1. Re-run `executor:prove:auth-persistence`
2. Check if consent dismissal is working (check logs for `EXECUTOR_AUTH_PREFLIGHT` consent messages)
3. If consent dismissal fails repeatedly → may need manual intervention

---

### Bucket C — `challenge_suspected`

**Meaning:** X is presenting verification challenges that automation can't solve reliably.

**Root Cause:** X.com requiring manual verification (CAPTCHA, phone verification, etc.).

**Handling:** Fail-closed + operator alerting is the only stable path:
- **No retries** - challenges require human intervention
- **No churn** - daemon enters 6-hour backoff when challenge detected
- **Operator alerting** - emits `EXECUTOR_AUTH_CHALLENGE_DETECTED` event

**Detection:** URLs containing:
- `/account/access`
- `/i/flow/challenge`
- `/i/flow/verify`
- `/account/verify`

**Smallest Next Step:**
1. Check `system_events` for `EXECUTOR_AUTH_CHALLENGE_DETECTED` events
2. Run `pnpm run executor:auth` (headed) to manually resolve challenge
3. Re-run `executor:prove:auth-persistence`

**Viability Assessment:**
- If `challenge_suspected` shows up within 0–2 minutes repeatedly → Option 1 (browser session) is not viable
- If challenges are rare and recoverable → Option 1 can still work with manual intervention

---

## Cookie Persistence Proof

The `executor:prove:cookie-persist` script proves cookies/session are actually persisted:

**What it checks:**
- Cookie counts for `.x.com` and `.twitter.com` (counts only, no values)
- Existence of key storage files:
  - `Cookies` (SQLite database)
  - `Cookies-journal`
  - `Local Storage/leveldb`
  - `Session Storage`
  - `Preferences`
  - `Login Data`

**Usage:**
```bash
# Full check (before auth, after auth, delayed)
pnpm run executor:prove:cookie-persist

# Individual phases
BEFORE_AUTH=true pnpm run executor:prove:cookie-persist
AFTER_AUTH=true pnpm run executor:prove:cookie-persist
DELAY_MINUTES=5 pnpm run executor:prove:cookie-persist
```

**Analysis:**
- Cookies increased after auth → ✅ Session persisted
- Cookies persisted after delay → ✅ Persistence working
- Cookies DB exists → ✅ Storage files present
- If cookies present but redirect happens → Session revocation, not storage issue

---

## Daemon Preflight Integration

The daemon now includes consent dismissal in auth preflight:

1. **Navigate to `https://x.com/home`**
2. **Detect consent wall** using `detectConsentWall()`
3. **Dismiss consent** using `acceptConsentWall()` if detected
4. **Check for challenges** (fail-closed if detected)
5. **Verify auth state** using `checkWhoami()`

This ensures consent walls don't block the daemon from processing decisions.

---

## Event Types

- `EXECUTOR_AUTH_INVALID` - Auth check failed
- `EXECUTOR_AUTH_REQUIRED` - Auth marker missing or preflight failed
- `EXECUTOR_AUTH_CHALLENGE_DETECTED` - Challenge URL detected (fail-closed)
- `EXECUTOR_AUTH_FAILURE_CLASSIFIED` - Failure classified with reason, URL, screenshot
- `EXECUTOR_CONSENT_DISMISSED` - Consent wall dismissed successfully
- `EXECUTOR_CONSENT_BLOCKED` - Consent wall blocking despite dismissal attempts
