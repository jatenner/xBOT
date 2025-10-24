# 🚨 REPLY SYSTEM FIX - Missing Environment Variable

## Problem Found

The reply system code checks:
```typescript
// src/jobs/replyCycle.ts:409
if (process.env.ENABLE_REPLIES !== 'true') {
  log(`REPLY_CYCLE: Replies disabled via feature flag`);
  return;
}
```

But the environment variable is named:
```
ENABLE_REPLY_BOT=true  ❌ Wrong name
```

Should be:
```
ENABLE_REPLIES=true  ✅ Correct name
```

## How to Fix

### Option 1: Add via Railway Dashboard
1. Go to Railway dashboard
2. Navigate to your project
3. Go to "Variables" tab
4. Click "New Variable"
5. Add: `ENABLE_REPLIES` = `true`
6. Save

### Option 2: Update via Railway CLI
```bash
railway variables --set ENABLE_REPLIES=true
```

(Note: Railway CLI might not support `set` subcommand, use dashboard instead)

## Why This Happened

The codebase uses multiple environment variable names for replies:
- `ENABLE_REPLY_BOT` (old/unused)
- `ENABLE_REPLIES` (what the code actually checks)

This is a naming inconsistency.

---

## After Fix

Once `ENABLE_REPLIES=true` is set:
1. reply_harvester will run (every 30 min)
2. reply_posting will run (every 15 min)  
3. Replies will start posting

Expected rate: 4 replies/hour (REPLIES_PER_HOUR=4)
