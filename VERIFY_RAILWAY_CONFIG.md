# 🔍 VERIFY RAILWAY CONFIGURATION

## Quick Check Commands

### 1. Check Railway Variables (Requires Login)
```bash
railway login
railway variables
```

### 2. Check Specific Variables
```bash
railway variables | grep -E "(MAX_POSTS_PER_HOUR|REPLIES_PER_HOUR|JOBS_PLAN_INTERVAL_MIN|JOBS_REPLY_INTERVAL_MIN|JOBS_POSTING_INTERVAL_MIN|MODE|POSTING_DISABLED|DRY_RUN|ENABLE_REPLIES)"
```

### 3. Set Required Variables (if missing)
```bash
# Rate limits (now have good defaults, but can override)
railway variables --set MAX_POSTS_PER_HOUR=2
railway variables --set REPLIES_PER_HOUR=4

# Job intervals (now have good defaults)
railway variables --set JOBS_PLAN_INTERVAL_MIN=60
railway variables --set JOBS_REPLY_INTERVAL_MIN=30
railway variables --set JOBS_POSTING_INTERVAL_MIN=5

# Enable posting (REQUIRED)
railway variables --set MODE=live
railway variables --set POSTING_DISABLED=false
railway variables --set ENABLE_REPLIES=true
```

## Expected Values

### ✅ Good Configuration:
```
MAX_POSTS_PER_HOUR=2          (or unset, defaults to 2 now)
REPLIES_PER_HOUR=4            (or unset, defaults to 4)
JOBS_PLAN_INTERVAL_MIN=60     (or unset, defaults to 60)
JOBS_REPLY_INTERVAL_MIN=30    (or unset, defaults to 30)
JOBS_POSTING_INTERVAL_MIN=5   (or unset, defaults to 5)
MODE=live                      (REQUIRED for posting)
POSTING_DISABLED=false         (or unset, must not be true)
DRY_RUN=false                  (or unset, must not be true)
ENABLE_REPLIES=true            (or unset, defaults to true)
```

### ❌ Bad Configuration:
```
MAX_POSTS_PER_HOUR=1          (too restrictive)
JOBS_PLAN_INTERVAL_MIN=720    (too high, queue will be empty)
MODE=shadow                    (blocks posting)
POSTING_DISABLED=true          (blocks posting)
DRY_RUN=true                   (blocks posting)
```

## Verification via Railway Dashboard

1. Go to Railway Dashboard → Your Project → Variables
2. Check these variables exist and have correct values
3. If missing, add them with values above

## Verification via Logs

Check Railway logs for configuration:
```bash
railway logs --tail 100 | grep -E "(MAX_POSTS_PER_HOUR|REPLIES_PER_HOUR|posting_disabled|MODE)"
```

Look for:
- `✅ Max posts/hour: 2` (should be 2, not 1)
- `✅ Posting enabled: true` (should be true)
- `✅ Mode: live` (should be live, not shadow)


