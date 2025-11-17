# 🔴 RECURRING OUTAGE ROOT CAUSES

## **Why The System Keeps Breaking**

Based on codebase analysis, these are the **underlying issues** that keep causing system-wide outages:

---

## **1. BROWSER RESOURCE EXHAUSTION** 🔴 **MOST CRITICAL**

### **The Problem:**
- Railway has **512MB memory limit**
- System has **7+ different browser manager implementations**
- Each creates **separate Chromium instances** (200-400MB each)
- When multiple jobs run simultaneously, they create 2-3 browsers
- **Result:** Memory limit exceeded → OOM kill → Process crashes

### **Evidence:**
```typescript
// Found in: src/browser/browserManager.ts, src/posting/BrowserManager.ts, 
// src/core/BrowserManager.ts, src/lib/browser.ts, etc.

// Each one does this:
const browser = await chromium.launch(config);  // Creates NEW browser instance
// No sharing between managers!
```

### **Why It Keeps Happening:**
- Different jobs use different browser managers
- No coordination between them
- All managers try to create browsers at the same time
- Memory spikes to 700MB+ → Railway kills the process

### **Fix Status:** ⚠️ **PARTIALLY FIXED**
- `UnifiedBrowserPool.ts` exists but **not fully integrated**
- Many jobs still use old browser managers
- Need to migrate all jobs to UnifiedBrowserPool

---

## **2. BROWSER CONTEXT LIFECYCLE BUGS** 🔴 **CRITICAL**

### **The Problem:**
```typescript
// src/posting/BulletproofThreadComposer.ts (BROKEN PATTERN)
private static async initializeBrowser(): Promise<void> {
  this.browserPage = await browserManager.withContext(async (context) => {
    return await context.newPage();  // ❌ Returns page
  });
  // Context closes here! Page becomes invalid!
}

// Later...
await this.browserPage.click(...);  // ❌ "Target page/context closed" error
```

### **Why It Breaks:**
- `withContext()` is designed to **clean up after execution**
- Storing page reference **outside** context lifecycle
- Context gets cleaned up, page becomes invalid
- All subsequent operations **HANG or FAIL**

### **Impact:**
- Thread posting hangs for hours
- Posting queue blocks
- Entire system stops working

### **Fix Status:** ❌ **NOT FIXED**
- Still using broken pattern in thread composer
- Needs refactor to keep page within context lifecycle

---

## **3. UNBOUNDED WAIT OPERATIONS** 🔴 **HIGH PRIORITY**

### **The Problem:**
```typescript
// src/posting/UltimateTwitterPoster.ts (29 instances found!)
await this.page.waitForLoadState('networkidle');  // ❌ Can hang FOREVER
await this.page.waitForSelector(selector, { timeout: 10000 });  // ❌ 10s can feel like forever
await this.page.waitForTimeout(3000);  // ❌ No overall timeout protection
```

### **Why It Breaks:**
- `waitForLoadState('networkidle')` waits for **ALL network activity to stop**
- Twitter has:
  - Streaming connections that never stop
  - Ad trackers that keep firing
  - Analytics that keep pinging
- **Result:** Operation hangs **indefinitely** (hours!)

### **Evidence:**
```
[POSTING_QUEUE] Starting post...
[ULTIMATE_POSTER] Waiting for network idle...
... 2 hours later ...
[ULTIMATE_POSTER] Still waiting...
```

### **Impact:**
- Single operation hangs for hours
- Job stuck in "running" state
- System appears dead but process is alive (just hung)

### **Fix Status:** ❌ **NOT FIXED**
- Found 29 instances of unbounded waits
- Need to wrap all waits in overall timeouts
- Need to replace `networkidle` with bounded alternatives

---

## **4. MULTIPLE BROWSER MANAGER CONFLICTS** 🟡 **MEDIUM PRIORITY**

### **The Problem:**
System has **7+ different browser manager implementations:**

1. `src/browser/browserManager.ts` ✅ (used by velocity tracker)
2. `src/posting/BrowserManager.ts` ✅ (used by posting)
3. `src/core/BrowserManager.ts` ❌ (old, unused)
4. `src/lib/browser.ts` ❌ (old, unused)
5. `src/core/RailwayBrowserManager.ts` ❌ (old, unused)
6. `src/posting/bulletproofBrowserManager.ts` ❌ (old, unused)
7. `src/browser/UnifiedBrowserPool.ts` ✅ **CORRECT ONE** (used by metrics scraper)

### **Why It Breaks:**
- Different managers use **different browser instances**
- No coordination between them
- Race conditions when jobs run simultaneously
- One manager thinks browser is fine, another thinks it's dead
- **Result:** Conflicting state → crashes

### **Fix Status:** ⚠️ **PARTIALLY FIXED**
- `UnifiedBrowserPool` exists and works
- But most jobs still use old managers
- Need to migrate all jobs to UnifiedBrowserPool

---

## **5. DATABASE CONNECTION TIMEOUTS** 🟡 **MEDIUM PRIORITY**

### **The Problem:**
```
Supabase Error 522: Upstream request timeout
```

### **Why It Breaks:**
- Database queries timeout after 30 seconds
- No retry logic in some code paths
- Circuit breaker opens → all DB operations fail
- **Result:** Content generation fails, posting fails

### **Evidence:**
```
[PLAN_JOB] ❌ Database query failed: timeout
[POSTING_QUEUE] ❌ Failed to load queued content
```

### **Fix Status:** ⚠️ **PARTIALLY FIXED**
- Some code has circuit breakers
- But not all database calls are protected
- Need comprehensive retry logic

---

## **6. STALE SESSION AUTHENTICATION** 🟡 **MEDIUM PRIORITY**

### **The Problem:**
- `TWITTER_SESSION_B64` cookies expire after 30-60 days
- System loads expired cookies
- Twitter rejects authentication
- **Result:** All browser operations fail

### **Evidence:**
```
[BROWSER_POOL] ✅ Session loaded (8 cookies)
[REAL_DISCOVERY] ❌ Not authenticated
❌ ANALYTICS: NOT AUTHENTICATED
```

### **Why It Keeps Happening:**
- No automatic session refresh
- No detection of expired sessions
- Manual process to refresh cookies
- Easy to forget → system breaks

### **Fix Status:** ❌ **NOT FIXED**
- Need automatic session refresh mechanism
- Need detection of expired sessions
- Need graceful fallback when auth fails

---

## **7. HUNG OPERATIONS WITH NO TIMEOUT** 🔴 **HIGH PRIORITY**

### **The Problem:**
Operations can hang for **hours** with no overall timeout:

```typescript
// Thread posting can take 2+ minutes per attempt
// With 2 retries = 4+ minutes
// If each tweet hangs = hours!

for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    await this.postViaComposer(segments);  // Could hang for 60s
  } catch (composerError) {
    await this.postViaReplies(segments);  // Another 60s
  }
}
// No overall timeout! Can hang forever!
```

### **Impact:**
- Single thread posting hangs for hours
- Job stuck in "running" state
- Watchdog detects after 15 minutes (too late)
- System appears dead

### **Fix Status:** ⚠️ **PARTIALLY FIXED**
- Watchdog detects hung jobs after 15 minutes
- But operations can still hang for 15 minutes
- Need overall operation timeouts (90s max)

---

## **8. MEMORY LEAKS** 🟡 **MEDIUM PRIORITY**

### **The Problem:**
- Browser contexts not properly closed
- Pages accumulate in memory
- Caches grow unbounded
- **Result:** Memory usage grows over time → eventually exceeds 512MB → crash

### **Evidence:**
```
[STARTUP] Memory: 200MB
[1 HOUR LATER] Memory: 400MB
[2 HOURS LATER] Memory: 500MB → CRASH
```

### **Fix Status:** ⚠️ **PARTIALLY FIXED**
- Some cleanup exists
- But not comprehensive
- Need aggressive memory monitoring and cleanup

---

## **SUMMARY: WHY IT KEEPS HAPPENING**

### **The Core Issues:**

1. **Multiple browser managers** → Resource conflicts → Crashes
2. **Unbounded waits** → Operations hang for hours → System appears dead
3. **Context lifecycle bugs** → Pages become invalid → Operations fail
4. **No overall timeouts** → Jobs hang indefinitely → System stuck
5. **Memory exhaustion** → Railway kills process → Full restart needed
6. **Database timeouts** → Operations fail → No content generated
7. **Stale sessions** → Authentication fails → All browser ops fail

### **Why Fixes Don't Stick:**

- Fixes are **partial** (some code updated, some not)
- Root causes are **architectural** (need refactoring, not patches)
- Multiple **interdependent issues** (fixing one doesn't fix others)
- **Testing is hard** (can't easily reproduce issues locally)

---

## **WHAT NEEDS TO HAPPEN**

### **Priority 1: Browser Resource Management** 🔴
1. Migrate ALL jobs to `UnifiedBrowserPool`
2. Remove all other browser managers
3. Enforce single browser instance globally

### **Priority 2: Timeout Protection** 🔴
1. Add overall timeouts to all operations (90s max)
2. Replace `waitForLoadState('networkidle')` with bounded waits
3. Wrap all thread posting in timeout protection

### **Priority 3: Context Lifecycle Fix** 🔴
1. Fix `BulletproofThreadComposer` to keep pages within context
2. Never store page references outside context lifecycle
3. Always use `withContext()` pattern correctly

### **Priority 4: Session Management** 🟡
1. Add automatic session refresh
2. Detect expired sessions gracefully
3. Fail fast with clear error messages

### **Priority 5: Memory Management** 🟡
1. Add aggressive memory monitoring
2. Automatic cleanup of old contexts/pages
3. Memory pressure detection and throttling

---

## **ESTIMATED TIME TO FIX**

- **Priority 1 (Browser):** 4-6 hours
- **Priority 2 (Timeouts):** 3-4 hours
- **Priority 3 (Context):** 2-3 hours
- **Priority 4 (Sessions):** 2-3 hours
- **Priority 5 (Memory):** 2-3 hours

**Total: 13-19 hours of focused work**

---

**Last Updated:** November 17, 2025

