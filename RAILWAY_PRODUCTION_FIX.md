# Railway Production Fix - January 9, 2026

## 🔴 ROOT CAUSE

**Problem**: `reply_v2_fetch` job NOT running in production

**Root Cause**: `JOBS_AUTOSTART` environment variable missing or not set to `'true'` in Railway

**Code Logic**:
```typescript
// src/config/config.ts:119
JOBS_AUTOSTART: process.env.JOBS_AUTOSTART === 'true',
```
- If variable is missing → `false` (jobs disabled)
- If variable is `'false'` → `false` (jobs disabled)  
- If variable is `'true'` → `true` (jobs enabled) ✅

---

## ✅ FIX STEPS (Railway UI)

### Step 1: Set JOBS_AUTOSTART=true

1. Go to: https://railway.app/project/[your-project-id]
2. Click **"Variables"** tab (already open based on screenshot)
3. Click **"+ New Variable"** button (top right)
4. **Name**: `JOBS_AUTOSTART`
5. **Value**: `true`
6. Click **"Add"**
7. Railway will automatically redeploy

### Step 2: Rotate OpenAI API Key (SECURITY CRITICAL)

**Current exposed key** (visible in Railway Variables tab):
- Starts with: `sk-proj-N2WVZ3cCPYaDj6eFhu8Qj...`
- Full key visible in Railway UI Variables tab

**Steps**:
1. **Generate new key**:
   - Go to: https://platform.openai.com/api-keys
   - Click **"+ Create new secret key"**
   - Copy the new key

2. **Update in Railway**:
   - In Railway Variables tab, find `OPENAI_API_KEY`
   - Click the **three dots (⋮)** on the right
   - Click **"Edit"**
   - Replace value with new key
   - Click **"Save"**
   - Railway will redeploy

3. **Revoke old key**:
   - Go back to OpenAI dashboard
   - Find the old key (starts with `sk-proj-N2WVZ3cCPYaDj6eFhu8Qj...`)
   - Click **"Revoke"**

---

## 🔍 VERIFICATION (After Fix)

Wait 5-10 minutes after Railway redeploys, then run:

```bash
# Check fetch runs are happening
pnpm tsx scripts/verify_ai_judge_deployment.ts
```

**Expected Results**:
- ✅ `reply_v2_fetch_job_started` events every 5 minutes
- ✅ `target_judge` calls in `llm_usage_log`
- ✅ `ai_judge_decision` populated in `candidate_evaluations`

---

## 📊 MONITORING

After fix, check Railway logs for:
```
[BOOT] jobs_start attempt
[BOOT] jobs_started ok
🕒 JOB_MANAGER: Starting job timers...
🕒 JOB_MANAGER: Job scheduling enabled (JOBS_AUTOSTART=true)
```

If you see:
```
🕒 JOB_MANAGER: Job scheduling disabled (JOBS_AUTOSTART=false)
```
→ Variable not set correctly, check Railway Variables tab

