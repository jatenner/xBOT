# Railway Production Fix Required

## ROOT CAUSE IDENTIFIED

**Problem**: `reply_v2_fetch` job is NOT running in production

**Root Cause**: `JOBS_AUTOSTART` environment variable is NOT set to `'true'` in Railway

**Code Evidence**:
```typescript
// src/config/config.ts:119
JOBS_AUTOSTART: process.env.JOBS_AUTOSTART === 'true',
```

This means:
- If `JOBS_AUTOSTART` is not set → defaults to `false`
- If `JOBS_AUTOSTART='false'` → `false`
- If `JOBS_AUTOSTART='true'` → `true` ✅

**Current State**: Variable not set, so jobs are disabled.

## FIXES REQUIRED IN RAILWAY UI

### 1. Set JOBS_AUTOSTART=true
1. Go to Railway → XBOT project → Variables tab
2. Click "New Variable"
3. Name: `JOBS_AUTOSTART`
4. Value: `true`
5. Save

### 2. Rotate OpenAI API Key (SECURITY)
**Current exposed key**: `sk-proj-N2WVZ3cCPYaDj6eFhu8Qj...` (visible in Railway Variables tab - starts with `sk-proj-N2WVZ3cCPYaDj6eFhu8Qj`)

**Steps**:
1. Generate new OpenAI API key at https://platform.openai.com/api-keys
2. In Railway Variables tab, find `OPENAI_API_KEY`
3. Click the three dots → Edit
4. Replace with new key
5. Save
6. Revoke old key in OpenAI dashboard

## VERIFICATION AFTER FIX

Run these commands to verify:

```bash
# Check for fetch runs (should see entries every 5 minutes)
psql $DATABASE_URL -c "
SELECT created_at, message 
FROM system_events 
WHERE event_type = 'reply_v2_fetch_job_started' 
ORDER BY created_at DESC 
LIMIT 5;
"

# Check for judge calls
psql $DATABASE_URL -c "
SELECT COUNT(*) as judge_calls
FROM llm_usage_log 
WHERE purpose = 'target_judge' 
AND timestamp >= NOW() - INTERVAL '30 minutes';
"

# Check for evaluations with judge decisions
psql $DATABASE_URL -c "
SELECT COUNT(*) as with_judge
FROM candidate_evaluations 
WHERE ai_judge_decision IS NOT NULL 
AND created_at >= NOW() - INTERVAL '30 minutes';
"
```

## EXPECTED RESULTS AFTER FIX

1. **Fetch runs**: Should see `reply_v2_fetch_job_started` events every 5 minutes
2. **Judge calls**: Should see `target_judge` entries in `llm_usage_log`
3. **Judge decisions**: Should see `ai_judge_decision` populated in `candidate_evaluations`

