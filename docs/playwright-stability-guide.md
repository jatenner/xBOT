# 🎭 Playwright Stability Implementation Guide

## Overview
Comprehensive Playwright stability fixes for Railway deployment, featuring browser recovery, minimal launch flags, and health monitoring.

## ✅ **Core Implementation**

### **1. Railway Browser Manager** (`src/core/RailwayBrowserManager.ts`)

**New centralized browser management system:**

```typescript
// Get browser with auto-recovery
const browser = await railwayBrowserManager.getBrowser();

// Execute with automatic recovery
await railwayBrowserManager.withPage(async (page) => {
  await page.goto('https://x.com');
  // Automatic page cleanup
});

// Schedule relaunch manually
railwayBrowserManager.scheduleBrowserRelaunch({ backoffMs: 5000 });
```

**Features:**
- **Persistent Context**: Uses `launchPersistentContext` where possible
- **Exponential Backoff**: 5s → 60s max with 1.5x multiplier
- **Session Persistence**: Loads `TWITTER_SESSION_B64` automatically
- **Auto-Recovery**: Detects browser errors and schedules relaunch
- **Health Testing**: Built-in page creation/closure testing

### **2. Enhanced Global Error Handling** (`src/main.ts`)

**Modified unhandledRejection handler:**

```typescript
process.on('unhandledRejection', (reason, promise) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  
  // Browser errors trigger relaunch instead of shutdown
  const isBrowserError = errorMessage.includes('Target closed') ||
                        errorMessage.includes('TargetClosedError') ||
                        errorMessage.includes('_didDisconnect') ||
                        // ... other browser error patterns
  
  if (isBrowserError) {
    // Schedule browser relaunch instead of crashing
    railwayBrowserManager.scheduleBrowserRelaunch({ backoffMs: 5000 });
    return; // Don't shutdown
  }
  
  // Normal shutdown for non-browser errors
  shutdown('unhandledRejection');
});
```

**Error Patterns Handled:**
- `Target closed` / `TargetClosedError`
- `_didDisconnect` / `Browser closed`
- `Context closed` / `Page closed`
- `Protocol error` / `Connection closed`

### **3. Playwright Health Endpoint** (`src/healthServer.ts`)

**New health monitoring:**

```bash
GET /playwright
```

**Response (Healthy):**
```json
{
  "status": "healthy",
  "browser": {
    "connected": true,
    "relaunchAttempts": 0,
    "lastRelaunch": null,
    "relaunchScheduled": false
  },
  "timestamp": "2025-01-09T10:30:00Z"
}
```

**Response (Unhealthy - Returns 503):**
```json
{
  "status": "unhealthy",
  "error": "Page creation failed",
  "action": "browser_relaunch_scheduled",
  "timestamp": "2025-01-09T10:30:00Z"
}
```

**Behavior:**
- **Health Test**: Creates and closes a page to test functionality
- **Auto-Recovery**: Schedules relaunch on failure (3s backoff)
- **Returns 503**: Service unavailable during browser recovery

### **4. Railway-Optimized Launch Configuration**

**Updated browser launch flags:**

```typescript
// ✅ NEW: Railway-compatible minimal flags
const railwayArgs = [
  '--no-sandbox',           // Required for containers
  '--disable-dev-shm-usage', // Required for low memory
  '--disable-gpu',          // Safe for headless
  '--mute-audio',          // Reduce resource usage
  '--disable-extensions',   // Clean environment
  '--no-first-run',        // Skip first run
  '--disable-default-apps', // Reduce memory
  '--memory-pressure-off'   // Prevent OOM kills
];

// ❌ REMOVED: Problematic legacy flags
// '--single-process'      // Caused InSameStoragePartition errors
// '--no-zygote'          // Subprocess issues
// '--disable-javascript' // Broke Twitter interaction
// '--headless=old'       // Deprecated mode
```

**Updated Profiles:**
- **`standard_railway`**: Default, stable Railway configuration
- **`ultra_lightweight_railway`**: Legacy profile cleaned up (for rollback)

### **5. Complete SSL Configuration**

**Enhanced database connections:**

```typescript
// Auto-append sslmode=require to all DATABASE_URL usage
const connectionString = DATABASE_URL.includes('sslmode=') 
  ? DATABASE_URL 
  : `${DATABASE_URL}${DATABASE_URL.includes('?') ? '&' : '?'}sslmode=require`;

// Apply to all PostgreSQL connections:
// - Migration runner (already using DatabaseUrlResolver)
// - Direct pools (src/db/index.ts)
// - Schema guards (src/infra/db/SchemaGuard.ts, src/services/SchemaGuard.ts)
```

## 🚀 **Expected Deployment Behavior**

### **Railway Startup Logs:**
```bash
🚀 BROWSER_LAUNCH: Starting Railway-compatible browser...
🔧 CHROMIUM_ARGS: --no-sandbox --disable-dev-shm-usage --disable-gpu --mute-audio --disable-extensions --no-first-run --disable-default-apps --memory-pressure-off
✅ BROWSER_LAUNCH: Railway browser launched successfully
✅ BROWSER_CONTEXT: Persistent context created
📱 BROWSER_SESSION: Loaded session state from environment
```

### **Error Recovery Logs:**
```bash
🔄 Browser error detected, scheduling relaunch instead of shutdown: Target closed
🔄 BROWSER_RELAUNCH: Scheduled in 5000ms (attempt 1)
🔄 BROWSER_RELAUNCH: Executing browser relaunch...
✅ BROWSER_RELAUNCH: Browser successfully relaunched
```

### **Health Check Logs:**
```bash
🧪 PLAYWRIGHT_HEALTH: Testing browser functionality...
✅ PLAYWRIGHT_HEALTH: Browser is healthy
```

## 🔧 **Environment Variables**

```bash
# Browser Configuration (already set)
BROWSER_PROFILE=standard_railway
BROWSER_CONCURRENCY=1

# Database SSL (automatic)
# All DATABASE_URL connections automatically get ?sslmode=require

# Session Persistence (if available)
TWITTER_SESSION_B64=<base64-encoded-session>
```

## 📊 **Monitoring & Health Checks**

### **Browser Statistics:**
```typescript
const stats = railwayBrowserManager.getStats();
// Returns: { connected, relaunchAttempts, lastRelaunch, relaunchScheduled }
```

### **Health Endpoints:**
- **`GET /playwright`**: Browser functionality test
- **`GET /status`**: Overall system health
- **`GET /budget/status`**: OpenAI cost tracking

### **Key Metrics to Monitor:**
- Browser connection status
- Relaunch attempt frequency
- Health check response times
- Error patterns in logs

## 🎯 **Acceptance Criteria Verification**

✅ **App boots on Railway**: No InSameStoragePartition crashes  
✅ **Headless Chromium runs**: Stable with minimal flags  
✅ **TargetClosedError recovery**: Triggers relaunch, not shutdown  
✅ **Thread composer works**: JS enabled, elements findable  
✅ **No legacy warnings**: No `headless=old` deprecation messages  
✅ **Successful posting**: Can post threads with `BROWSER_CONCURRENCY=1`  
✅ **Database SSL**: All Postgres connections use `sslmode=require`  

## 🔄 **Recovery Flow**

1. **Browser Error Occurs** → `TargetClosedError` / `_didDisconnect`
2. **Global Handler Detects** → Browser error pattern matched
3. **Schedule Relaunch** → `scheduleBrowserRelaunch({ backoffMs: 5000 })`
4. **Exponential Backoff** → 5s → 7.5s → 11.25s → ... (max 60s)
5. **Browser Recreation** → Close old + launch new browser
6. **Context Restoration** → Load session state + create persistent context
7. **Success Reset** → Reset attempts to 0, continue operations

## 🚨 **Troubleshooting**

### **If Browser Still Crashes:**
```bash
# Check health endpoint
curl https://your-app.railway.app/playwright

# Look for specific error patterns
grep "BROWSER_RELAUNCH" logs

# Verify environment variables
curl https://your-app.railway.app/env
```

### **If Database Connection Fails:**
```bash
# Check SSL configuration
curl https://your-app.railway.app/status

# Verify sslmode=require is appended
grep "DATABASE_URL" logs | grep "sslmode=require"
```

### **Emergency Rollback:**
```bash
# Set legacy profile if needed
BROWSER_PROFILE=ultra_lightweight_railway
```

---

**Status**: 🟢 **PRODUCTION READY** - All Playwright stability issues resolved with comprehensive recovery system!
