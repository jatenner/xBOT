# Posting Stabilization + TEXT_VERIFY_FAIL Fix

**Date:** December 18, 2025  
**PR Type:** Reliability Fix  
**Status:** Ready for Review

---

## 🎯 Goal

Get the system to GREEN by ensuring:
1. Posting is not starved by background browser operations (vi_scrape/metrics/follower baseline)
2. Thread composer does not fail with TEXT_VERIFY_FAIL got="" after paste

---

## 📋 Changes Summary

### Part A: Stop Background Tasks from Starving Posting (Env Gated)

#### 1. DISABLE_VI_SCRAPE env flag
- **File:** `src/jobs/jobManager.ts`
- **Change:** Added env check to skip peer_scraper job when `DISABLE_VI_SCRAPE=true`
- **Default:** `false` (enabled by default)

#### 2. DISABLE_METRICS_JOB env flag
- **File:** `src/jobs/jobManager.ts`
- **Change:** Added env check to skip metrics_scraper job when `DISABLE_METRICS_JOB=true`
- **Default:** `false` (enabled by default)

#### 3. DISABLE_FOLLOWER_BASELINE env flag
- **File:** `src/jobs/postingQueue.ts`
- **Change:** Added env check to skip follower baseline capture when `DISABLE_FOLLOWER_BASELINE=true`
- **Default:** `false` (enabled by default)
- **Log:** `[FOLLOWER_TRACKER] ⏭️ Baseline disabled via env (DISABLE_FOLLOWER_BASELINE=true)`

#### 4. Posting Priority Guard in UnifiedBrowserPool
- **File:** `src/browser/UnifiedBrowserPool.ts`
- **Change:** Added guard to drop background operations when queue depth >= 3 and posting operations are waiting
- **Log:** `[BROWSER_POOL][GUARD] posting_priority queueDepth=X dropped label=operationName`
- **Behavior:** Background ops (priority > 1) are dropped if queue has 3+ items and posting/reply ops (priority <= 1) are waiting

### Part B: Fix THREAD_COMPOSER TEXT_VERIFY_FAIL

#### Enhanced verifyPasteAndFallback()
- **File:** `src/posting/BulletproofThreadComposer.ts`
- **Changes:**
  1. Wait for composer to be ready before paste
  2. Ensure compose textarea exists, visible, enabled
  3. Ensure it's focused
  4. Attempt paste with proper event dispatching
  5. Wait for textarea value with `waitForFunction` (minLen=20, timeout=3000ms)
  6. If empty → retry paste once (re-focus)
  7. If still empty → fallback to typing
  8. Final verification via DOM value length
  9. If still empty → throw `ComposerTextEmptyAfterPasteAndType` with autopsy info
- **Logs:**
  - `[THREAD_COMPOSER][VERIFY] part i/N composer_len=<len> method=<paste|type> decisionId=<id> attempt=<n>`
  - On failure: includes selector + activeElement tag and visibility info

---

## 🚀 Deployment Instructions

### Step 1: Deploy Code
```bash
git add .
git commit -m "fix: stabilize posting + fix TEXT_VERIFY_FAIL"
git push origin main
```

### Step 2: Enable Reliability Flags (Recommended)
```bash
railway variables set DISABLE_VI_SCRAPE=true
railway variables set DISABLE_METRICS_JOB=true
railway variables set DISABLE_FOLLOWER_BASELINE=true
```

**Note:** These flags default to `false` (disabled), so background operations will continue normally unless explicitly enabled. Enable them only if posting is being starved.

### Step 3: Verify Deployment
```bash
railway logs --service xBOT --lines 8000 | grep -E "\[POSTING_QUEUE\]\[SUCCESS\]|\[BROWSER_POOL\]\[GUARD\]|\[BROWSER_POOL\]\[DROP\]|\[THREAD_COMPOSER\]\[VERIFY\]|TEXT_VERIFY_FAIL" | tail -n 200
```

---

## ✅ Validation Commands

### 1. Verify Posting Success Signals
```bash
railway logs --service xBOT --lines 8000 | grep -E "\[POSTING_QUEUE\]\[SUCCESS\]" | tail -n 50
```

**Expected:** Should see `[POSTING_QUEUE][SUCCESS]` logs for successful posts

### 2. Verify Posting Priority Guard
```bash
railway logs --service xBOT --lines 8000 | grep -E "\[BROWSER_POOL\]\[GUARD\]|\[BROWSER_POOL\]\[DROP\]" | tail -n 50
```

**Expected:** Should see guard logs when background ops are dropped due to posting priority

### 3. Verify Thread Composer Verification
```bash
railway logs --service xBOT --lines 8000 | grep -E "\[THREAD_COMPOSER\]\[VERIFY\]" | tail -n 100
```

**Expected:** Should see verification logs with `method=paste` or `method=type` and `composer_len` values

### 4. Verify TEXT_VERIFY_FAIL Reduction
```bash
railway logs --service xBOT --lines 8000 | grep -E "TEXT_VERIFY_FAIL" | tail -n 50
```

**Expected:** Should see fewer or no TEXT_VERIFY_FAIL errors (or clean fallback to typing)

### 5. Verify Background Jobs Skipped (if flags enabled)
```bash
railway logs --service xBOT --lines 8000 | grep -E "\[PEER_SCRAPER\] ⏭️ Skipped|\[METRICS_SCRAPER\] ⏭️ Skipped|\[FOLLOWER_TRACKER\] ⏭️ Baseline disabled" | tail -n 50
```

**Expected:** Should see skip logs when flags are enabled

---

## 🔍 What to Look For

### GREEN Status Indicators:
- ✅ `[POSTING_QUEUE][SUCCESS]` logs appearing regularly
- ✅ `[THREAD_COMPOSER][VERIFY]` logs showing successful paste or clean typing fallback
- ✅ No or minimal `TEXT_VERIFY_FAIL` errors
- ✅ `[BROWSER_POOL][GUARD]` logs when queue is deep (if background ops are being dropped)

### YELLOW Status Indicators:
- ⚠️ `[POSTING_QUEUE][SUCCESS]` logs present but infrequent
- ⚠️ `[THREAD_COMPOSER][VERIFY]` logs showing typing fallback (paste not working but typing succeeds)
- ⚠️ Some `TEXT_VERIFY_FAIL` errors but with clean fallback

### RED Status Indicators:
- ❌ No `[POSTING_QUEUE][SUCCESS]` logs
- ❌ Frequent `TEXT_VERIFY_FAIL` errors without fallback
- ❌ `ComposerTextEmptyAfterPasteAndType` exceptions

---

## 📝 Files Changed

1. `src/jobs/jobManager.ts` - Added DISABLE_VI_SCRAPE and DISABLE_METRICS_JOB flags
2. `src/jobs/postingQueue.ts` - Added DISABLE_FOLLOWER_BASELINE flag
3. `src/browser/UnifiedBrowserPool.ts` - Added posting priority guard
4. `src/posting/BulletproofThreadComposer.ts` - Enhanced verifyPasteAndFallback() with robust verification

---

## 🔄 Rollback Plan

If issues occur, disable the reliability flags:
```bash
railway variables set DISABLE_VI_SCRAPE=false
railway variables set DISABLE_METRICS_JOB=false
railway variables set DISABLE_FOLLOWER_BASELINE=false
```

Or revert the commit:
```bash
git revert HEAD
git push origin main
```

---

## 📊 Expected Impact

- **Posting Reliability:** Improved (background ops won't starve posting)
- **Thread Posting:** More reliable (robust paste verification with fallback)
- **TEXT_VERIFY_FAIL:** Reduced or eliminated (better verification + typing fallback)
- **Background Operations:** May be throttled during high posting load (by design)

---

**Ready for Review & Deployment**

