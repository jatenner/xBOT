# 🛡️ RAILWAY RATE LIMIT RECOVERY RUNBOOK

## 📊 **SITUATION ANALYSIS**

**Date:** 2025-10-12  
**Issue:** Railway CLI in severe rate limiting (6+ hours)  
**Root Cause:** Aggressive polling from multiple monitoring scripts  

### **Observed Symptoms**
- `railway whoami`: "You are being ratelimited. Please try again later" (429)
- `railway status`: Same 429 response
- `railway logs --help`: ✅ Works (local command, no API call)
- Response times: 175-191ms (server-side rate limiting)

### **Triggering Events**
1. Multiple `railway login` attempts (automated recovery script)
2. Aggressive polling every 5-30 seconds
3. Concurrent monitoring processes
4. Repeated authentication failures
5. No exponential backoff in original scripts

---

## 🔧 **DEPLOYED SOLUTIONS**

### **1. Exponential Backoff Wrapper**
```bash
# Use for all Railway CLI calls
BACKOFF_BASE_MS=5000 BACKOFF_TRIES=7 node scripts/with_backoff.mjs railway status
```

**Features:**
- 5-second base delay with exponential growth
- Jitter (±15%) to prevent thundering herd
- Smart error detection (429 vs 401)
- Max 7 retries before giving up

### **2. SRE Compliant Monitor**
```bash
# Replace old monitor with rate-limit compliant version
node bulletproof_railway_monitor_sre.js
```

**Improvements:**
- 30s base reconnect delay (was 5s)
- 60s health checks (was 30s)
- Single instance protection (lock file)
- Extended backoff on consecutive rate limits
- Max 20 reconnects (was unlimited)

### **3. Diagnostic Tools**
```bash
# Check current rate limit status
node scripts/railway_diag.mjs

# Run multiple diagnostics 60s apart
node scripts/railway_diag.mjs && sleep 60 && node scripts/railway_diag.mjs
```

---

## ⚡ **IMMEDIATE RECOVERY STEPS**

### **If Rate Limited (429)**

1. **Stop all monitoring immediately**
   ```bash
   pkill -f "railway"
   pkill -f "bulletproof"
   rm -f .railway_monitor.lock
   ```

2. **Wait for rate limit to clear**
   - **Typical**: 30-60 minutes
   - **Enhanced**: 2-4 hours  
   - **Severe**: 6-24 hours (our case)

3. **Test with diagnostic (minimal API calls)**
   ```bash
   node scripts/railway_diag.mjs
   ```

4. **When cleared, authenticate ONCE**
   ```bash
   railway login  # Browser-based, do NOT repeat
   railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1
   ```

5. **Resume monitoring with SRE version**
   ```bash
   node bulletproof_railway_monitor_sre.js
   ```

### **If Unauthorized (401)**

1. **Single authentication attempt**
   ```bash
   railway login
   # Complete browser auth, then:
   railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1
   ```

2. **Verify authentication**
   ```bash
   node scripts/with_backoff.mjs railway whoami
   ```

3. **Never repeat `railway login` automatically**

---

## 🚨 **EXTENDED RATE LIMIT RECOVERY**

### **If 429 Persists > 2 Hours**

1. **Complete monitoring shutdown**
   ```bash
   # Kill all Railway processes
   pkill -f "railway"
   pkill -f "monitor"
   
   # Remove lock files
   rm -f .railway_monitor.lock
   rm -f ~/.railway/config.json
   ```

2. **Wait 60-90 minutes with zero API calls**

3. **Network troubleshooting**
   ```bash
   # Check if IP reputation issue
   curl -I https://railway.app  # Should return 200
   
   # Consider switching networks:
   # - Mobile hotspot
   # - Different WiFi
   # - VPN with residential IP
   ```

4. **Single re-authentication attempt**
   ```bash
   # Only after extended wait
   railway login
   railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1
   ```

5. **Resume with maximum backoff**
   ```bash
   BACKOFF_BASE_MS=30000 BACKOFF_TRIES=3 node bulletproof_railway_monitor_sre.js
   ```

---

## 🎯 **PREVENTION STRATEGIES**

### **Authentication Policy**
- ✅ **Single login**: Use `railway login` once, never repeat
- ✅ **Token-based**: Set `RAILWAY_TOKEN` for CI/automation
- ❌ **Avoid**: Automated re-authentication loops

### **Monitoring Policy**
- ✅ **Single instance**: Use lock files to prevent concurrent monitors
- ✅ **Exponential backoff**: Always use `with_backoff.mjs` wrapper
- ✅ **Reduced frequency**: 30s+ intervals, not 5s
- ❌ **Avoid**: Continuous polling without backoff

### **Error Handling**
- ✅ **429 detection**: Implement proper rate limit detection
- ✅ **Extended backoff**: 10+ minutes for consecutive rate limits  
- ✅ **Circuit breaker**: Stop after max failures
- ❌ **Avoid**: Immediate retries on any error

---

## 📋 **MONITORING CHECKLIST**

### **Before Starting Monitor**
- [ ] No other Railway processes running (`ps aux | grep railway`)
- [ ] No lock files present (`ls -la .railway_monitor.lock`)
- [ ] Rate limit cleared (`node scripts/railway_diag.mjs`)
- [ ] Authentication valid (`railway whoami`)

### **During Operation**
- [ ] Monitor stats show reasonable reconnect counts (<20/hour)
- [ ] No consecutive rate limit warnings
- [ ] Logs flowing normally
- [ ] Single instance confirmed

### **Red Flags - Stop Immediately**
- [ ] "being ratelimited" messages
- [ ] Consecutive 429 responses
- [ ] Reconnect loops (<30s intervals)
- [ ] Multiple monitor instances

---

## 🔍 **DIAGNOSTIC COMMANDS**

```bash
# Quick status check
node scripts/railway_diag.mjs

# Test with backoff
BACKOFF_BASE_MS=5000 BACKOFF_TRIES=7 node scripts/with_backoff.mjs railway status

# Monitor with SRE compliance
node bulletproof_railway_monitor_sre.js

# Check for competing processes
ps aux | grep railway
ps aux | grep monitor

# Clean slate (emergency)
pkill -f "railway"; rm -f .railway_monitor.lock; rm -rf ~/.railway
```

---

## 📈 **SUCCESS METRICS**

- **Rate limits per hour**: <1
- **Reconnects per hour**: <5  
- **API calls per minute**: <2
- **Consecutive 429s**: 0
- **Monitor uptime**: >95%

---

## 🚀 **CURRENT STATUS**

**Rate Limit**: ✅ **CLEARED** (as of diagnostic run)  
**Next Steps**: 
1. Authenticate once with `railway login`
2. Link project with `railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1`
3. Start SRE monitor: `node bulletproof_railway_monitor_sre.js`

**Last Updated**: 2025-10-12T18:49:33Z
