# Truth Gap Audit: Last 24 Hours

**Date:** 2025-12-19T15:31:01.843Z

---

## Audit Status

- **X_FETCH_METHOD:** local_playwright
- **AUDIT_VALID:** false

> **Note:** This audit uses Playwright to verify what is visible on X's UI.
> This matches the posting method, ensuring consistency.

## ⚠️ AUDIT INVALID

Could not fetch tweets from X. Cannot determine truth gap.

**Reason:** Unknown error

**What this means:**
- The audit cannot verify if tweets are actually visible on X
- This is NOT the same as "posted but missing in DB"
- Fix X scraping (Playwright) to run a valid audit

**Next Steps:**
1. Check Playwright is installed and working
2. Verify network connectivity to x.com
3. Check browser session (TWITTER_SESSION_B64) if authentication is required

---

**Report Generated:** 2025-12-19T15:31:01.843Z
