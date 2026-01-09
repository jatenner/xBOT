# Production Fix Summary - January 9, 2026

## 🔴 ROOT CAUSE IDENTIFIED

**Problem**: `reply_v2_fetch` job NOT running in Railway production

**Root Cause**: `JOBS_AUTOSTART` environment variable missing in Railway

**Code Evidence**:
```typescript
// src/config/config.ts:119
JOBS_AUTOSTART: process.env.JOBS_AUTOSTART === 'true',
```
- Missing variable → `false` (jobs disabled) ❌
- Must be explicitly `'true'` → `true` (jobs enabled) ✅

---

## ✅ EXACT RAILWAY UI STEPS

### Step 1: Enable Job Scheduling (REQUIRED)

**Location**: Railway Dashboard → XBOT Project → Variables Tab

1. Click **"+ New Variable"** button (top right of Variables list)
2. **Variable Name**: `JOBS_AUTOSTART`
3. **Variable Value**: `true`
4. Click **"Add"**
5. Railway will automatically redeploy (watch Deployments tab)

**Verification**: After redeploy, check logs for:
```
[BOOT] jobs_start attempt
🕒 JOB_MANAGER: Starting job timers...
🕒 JOB_MANAGER: Job scheduling enabled (JOBS_AUTOSTART=true)
```

### Step 2: Rotate OpenAI API Key (SECURITY CRITICAL)

**Location**: Railway Dashboard → XBOT Project → Variables Tab

**Current exposed key** (visible in Variables tab):
- Starts with: `sk-proj-N2WVZ3cCPYaDj6eFhu8Qj...`
- Full key is visible in the `OPENAI_API_KEY` variable

**Steps**:
1. **Generate new key**:
   - Go to: https://platform.openai.com/api-keys
   - Click **"+ Create new secret key"**
   - Name it: `xBOT-production-2026-01-09`
   - Copy the key immediately (won't be shown again)

2. **Update in Railway**:
   - In Variables tab, find `OPENAI_API_KEY` row
   - Click **three dots (⋮)** on the right side of that row
   - Click **"Edit"**
   - **Replace** the entire value with the new key
   - Click **"Save"**
   - Railway will redeploy automatically

3. **Revoke old key**:
   - Go back to OpenAI dashboard: https://platform.openai.com/api-keys
   - Find the key starting with `sk-proj-N2WVZ3cCPYaDj6eFhu8Qj...`
   - Click **"Revoke"** button
   - Confirm revocation

**Verification**: After redeploy, check logs for successful API calls (no auth errors)

---

## 🔍 VERIFICATION (After Both Fixes)

Wait 5-10 minutes after Railway redeploys, then run:

```bash
pnpm tsx scripts/verify_railway_fix.ts
```

**Expected Results**:
- ✅ At least 2 `reply_v2_fetch_job_started` events in last 10 minutes
- ✅ `target_judge` calls in `llm_usage_log` (last 30 min)
- ✅ `ai_judge_decision` populated in `candidate_evaluations` (last 30 min)

---

## 📊 MONITORING CHECKLIST

After fixes, verify:

1. **Railway Logs** show:
   ```
   [BOOT] jobs_start attempt
   [BOOT] jobs_started ok
   🕒 JOB_MANAGER: Starting job timers...
   ```

2. **Database** shows fetch runs:
   ```sql
   SELECT COUNT(*) FROM system_events 
   WHERE event_type = 'reply_v2_fetch_job_started' 
   AND created_at >= NOW() - INTERVAL '10 minutes';
   -- Should be >= 2
   ```

3. **Judge is called**:
   ```sql
   SELECT COUNT(*) FROM llm_usage_log 
   WHERE purpose = 'target_judge' 
   AND timestamp >= NOW() - INTERVAL '30 minutes';
   -- Should be > 0
   ```

---

## 🎯 SUMMARY

**What to do**:
1. Set `JOBS_AUTOSTART=true` in Railway Variables
2. Rotate `OPENAI_API_KEY` in Railway Variables
3. Wait 5-10 minutes
4. Run verification script

**Why it wasn't working**:
- `JOBS_AUTOSTART` defaults to `false` if not explicitly set to `'true'`
- Code requires exact string match: `process.env.JOBS_AUTOSTART === 'true'`

**Files created**:
- `RAILWAY_PRODUCTION_FIX.md` - Detailed fix guide
- `scripts/verify_railway_fix.ts` - Verification script
- `scripts/diagnose_railway_jobs.ts` - Diagnostic script

