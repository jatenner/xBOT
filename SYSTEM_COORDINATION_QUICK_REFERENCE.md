# ⚡ SYSTEM COORDINATION - Quick Reference

## 🎯 HOW JOBS COORDINATE

### **1. Staggered Scheduling** ✅
- Jobs start at different times (spread across 60 minutes)
- Prevents browser resource conflicts
- Each job has "isRunning" guard

### **2. Retry Logic** ✅
- Critical jobs: 3 attempts (2s, 4s, 8s backoff)
- Non-critical: 1 attempt (fail fast)
- Auto-recovers from transient errors

### **3. Health Monitoring** ✅
- **Watchdog:** Every 5 min, detects stalled jobs
- **Health Check:** Every 30 min, checks pipeline
- **Heartbeats:** All jobs report status to database

### **4. Self-Healing** ✅
- Auto-detects stuck jobs
- Auto-recovers from failures
- Emergency runs for critical issues

---

## 📊 JOB SCHEDULE (Key Jobs)

```
Posting:      Every 5 min  (highest priority)
Plan:         Every 90-120 min
Reply:        Every 30 min
Metrics:      Every 20 min
Watchdog:     Every 5 min  (monitors all)
Health Check: Every 30 min (pipeline health)
```

---

## 🔍 QUICK HEALTH CHECK

### **Check Job Status:**
```sql
SELECT job_name, last_success, last_run_status, consecutive_failures
FROM job_heartbeats
ORDER BY last_success DESC;
```

### **Check System Events:**
```sql
SELECT event_type, severity, created_at
FROM system_events
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### **Check Content Pipeline:**
```sql
-- Last content generated
SELECT MAX(created_at) as last_generation
FROM content_metadata
WHERE decision_type IN ('single', 'thread');

-- Queued content
SELECT COUNT(*) as queued_count
FROM content_metadata
WHERE status = 'queued';
```

---

## 🚨 COMMON ISSUES & FIXES

### **Issue: Job Not Running**
**Check:**
1. Job heartbeat status
2. Watchdog alerts
3. System events for errors

**Fix:**
- Watchdog auto-recovers
- Or manually trigger: `jobManager.runJobNow('job_name')`

### **Issue: Resource Conflicts**
**Check:**
1. Browser pool metrics
2. Memory usage
3. Concurrent job execution

**Fix:**
- Staggered scheduling prevents this
- Browser pool manages resources

### **Issue: Stuck Pipeline**
**Check:**
1. Health check logs
2. Last content generation time
3. Queue status

**Fix:**
- Health check auto-recovers
- Triggers emergency plan run

---

## ✅ VERIFICATION COMMANDS

### **Check All Jobs Running:**
```bash
# In Railway logs, look for:
✅ JOB_MANAGER: All jobs scheduled with staggered timing
✅ JOB_POSTING: Completed successfully
✅ JOB_PLAN: Completed successfully
```

### **Check Watchdog Active:**
```bash
# Look for:
[JOB_WATCHDOG] Checking critical jobs...
[JOB_WATCHDOG] All jobs healthy
```

### **Check Health Check:**
```bash
# Look for:
✅ HEALTH_CHECK: Content pipeline healthy
```

---

**Status:** System is well-coordinated ✅  
**Coordination:** Smart and reliable ✅  
**Monitoring:** Comprehensive ✅

