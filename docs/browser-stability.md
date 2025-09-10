# 🎭 Browser Stability Guide

## Critical Issues Fixed

### ❌ Previous `ultra_lightweight_railway` Problems:
1. **`--disable-javascript`** - Broke X.com completely (JS required)
2. **`--single-process --no-zygote`** - Caused FATAL `InSameStoragePartition` crashes
3. **`--headless=old`** - Deprecated mode causing storage partition errors
4. **Excessive flags** - Caused browser instability and context failures

### ✅ New `standard_railway` Solution:
- **JavaScript ENABLED** - X.com works properly
- **Modern headless mode** - Uses Playwright's stable `headless: true`
- **Minimal safe flags** - Only essential: `--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`, `--mute-audio`
- **Extended timeout** - 30s vs 15s for stability
- **Context recovery** - Automatic recovery from "Target page/context closed" errors

## Environment Variables

### Production (Recommended)
```bash
BROWSER_PROFILE=standard_railway
BROWSER_CONCURRENCY=1
```

### Rollback (Emergency Only)
```bash
BROWSER_PROFILE=ultra_lightweight_railway
BROWSER_CONCURRENCY=1
```

## Expected Railway Logs

### ✅ Successful Launch
```
🚀 ENTERPRISE_BROWSER: Using profile standard_railway (concurrency: 1)
🚀 ENTERPRISE_BROWSER: Trying standard_railway configuration...
🔧 CHROMIUM_ARGS: --no-sandbox --disable-dev-shm-usage --disable-gpu --mute-audio
✅ ENTERPRISE_BROWSER: standard_railway launched successfully
```

### 🔄 Error Recovery
```
🔄 CONTEXT_RECOVERY: Target closed error on attempt 1/2
🔄 BROWSER_RECOVERY: Attempting context recovery...
✅ BROWSER_RECOVERY: Context recovered successfully
```

### 🚦 Page Ready
```
🚦 PAGE_READY: Waiting for DOM + network idle...
🚦 PAGE_READY: Checking composer availability...
✅ PAGE_READY: Page is ready for interaction
```

## Verification Checklist

### ✅ No More Fatal Errors
- [ ] No `FATAL:render_process_host_impl.cc` crashes
- [ ] No `InSameStoragePartition` errors  
- [ ] No `Target page, context or browser has been closed` loops
- [ ] No `Old Headless mode will be removed` warnings

### ✅ Thread Composer Works
- [ ] Browser launches without crashes
- [ ] Thread composer finds elements (JS enabled)
- [ ] Can post at least one thread successfully
- [ ] Context recovery works on failures

### ✅ Railway Stability  
- [ ] Memory usage stays under limits
- [ ] No browser process multiplication
- [ ] Graceful handling of EAGAIN errors
- [ ] Proper cleanup on shutdown

## Troubleshooting

### If Errors Persist
1. **Check environment**: Ensure `BROWSER_PROFILE=standard_railway`
2. **Emergency rollback**: Set `BROWSER_PROFILE=ultra_lightweight_railway`
3. **Increase timeout**: `PLAYWRIGHT_NAV_TIMEOUT_MS=45000`
4. **Force cleanup**: Restart Railway service

### Performance Tuning
- **Low memory**: Keep `BROWSER_CONCURRENCY=1`
- **High volume**: Increase to `BROWSER_CONCURRENCY=2` (max)
- **Timeout issues**: Increase `PLAYWRIGHT_NAV_TIMEOUT_MS`

## Railway Environment Setup

Add these variables in Railway dashboard:
```
BROWSER_PROFILE=standard_railway
BROWSER_CONCURRENCY=1
PLAYWRIGHT_NAV_TIMEOUT_MS=30000
```

The system will automatically use the stable browser profile and handle context recovery gracefully.
