# B64 Auth Persistence Proof Report

**Generated:** 2026-02-03T05:31:11.081Z
**Duration:** 2 minutes
**Tick Interval:** 30 seconds

## Status

**Status:** ❌ **FAIL**

## Summary

- **Minutes OK:** 0 / 2
- **First Failure Minute:** 0
- **Fail Rate:** 100.0%
- **Total Ticks:** 4

## Tick Table

| Minute | Timestamp | Logged In | Reason | Handle | URL |
|--------|-----------|-----------|--------|--------|-----|
| 0 | 2026-02-03T05:29:14.042Z | ❌ | unknown | N/A | https://x.com/home... |
| 0 | 2026-02-03T05:29:48.068Z | ❌ | unknown | N/A | https://x.com/home... |
| 1 | 2026-02-03T05:30:20.439Z | ❌ | unknown | N/A | https://x.com/home... |
| 1 | 2026-02-03T05:30:52.809Z | ❌ | unknown | N/A | https://x.com/home... |

## Failure Fingerprints


### unknown

- **Minute:** 0
- **URL:** https://x.com/home
- **Screenshot:** [b64-auth-persistence-fail-unknown-1770096554042.png](/Users/jonahtenner/Desktop/xBOT/docs/proofs/auth/b64-auth-persistence-fail-unknown-1770096554042.png)
- **Forensics Snapshot:** [b64-auth-flip-snapshot-unknown-1770096554042.json](/Users/jonahtenner/Desktop/xBOT/docs/proofs/auth/b64-auth-flip-snapshot-unknown-1770096554042.json)

**Failure Fingerprint:**
- Cookie count (.x.com): 18
- Cookie count (.twitter.com): 18
- Has auth_token: true
- Has ct0: true
- Has twid: true
- Has cf_clearance: true
- auth_token expiry: 1969-12-31T23:59:59.000Z
- ct0 expiry: 1969-12-31T23:59:59.000Z
- localStorage keys: 1
- sessionStorage keys: 0
- IndexedDB exists: false
- IndexedDB count: 1



## Forensics Comparison


### Minute 0 (Baseline)
- Cookies (.x.com): 18
- Cookies (.twitter.com): 18
- auth_token: true (expiry: 1969-12-31T23:59:59.000Z)
- ct0: true (expiry: 1969-12-31T23:59:59.000Z)
- twid: true
- localStorage: 1 keys
- sessionStorage: 0 keys
- IndexedDB: none (1 DBs)

### Minute 0 (Failure)
- Cookies (.x.com): 18
- Cookies (.twitter.com): 18
- auth_token: true (expiry: 1969-12-31T23:59:59.000Z)
- ct0: true (expiry: 1969-12-31T23:59:59.000Z)
- twid: true
- localStorage: 1 keys
- sessionStorage: 0 keys
- IndexedDB: none (1 DBs)

### Changes
- Cookie count change: 0
- auth_token disappeared: NO
- ct0 disappeared: NO
- twid disappeared: NO


## Hard Assertion

**PASS Criteria:**
- ✅ All ticks logged_in=true
- ✅ No login_redirect events
- ✅ No challenge_suspected events

**Result:** ❌ FAIL

**Failure Reason:** unknown

