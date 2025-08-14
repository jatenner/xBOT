# xBOT Operations Runbook

## Quick Deploy & Test

### 1. Force Deploy Production Config
```bash
# Run preflight checks and deploy
./ops/force_deploy.sh

# Manual Railway variable setup (copy from script output)
# Go to Railway Dashboard > xbot-production > Variables
# Set all variables from the checklist
```

### 2. Smoke Test Deployment
```bash
# Wait for deployment and run tests
export SERVICE_URL="https://xbot-production.up.railway.app"
./ops/smoke_test.sh
```

### 3. Monitor & Verify
```bash
# Check Railway logs
railway logs --tail

# Verify posts on X/Twitter
# - Singles: No 🧵, thread language, or hashtags
# - Threads: Proper reply chains with human delays
# - Content: Value-first, health-focused, engaging
```

## Environment Configuration

### Core Production Settings
```bash
LIVE_POSTS=true                    # Enable real posting
FORCE_NO_HASHTAGS=true            # No hashtags in any content
EMOJI_MAX=2                       # Max 2 emojis per tweet
TWEET_MAX_CHARS_HARD=279          # Hard character limit
```

### Thread Configuration
```bash
ENABLE_THREADS=true               # Enable thread posting
FALLBACK_SINGLE_TWEET_OK=false    # Strict thread requirements
THREAD_MIN_TWEETS=5               # Minimum tweets per thread
THREAD_MAX_TWEETS=9               # Maximum tweets per thread
THREAD_STRICT_REPLY_MODE=true     # Real reply chains
```

### Longform Settings
```bash
LONGFORM_AUTODETECT=true          # Check longform availability
LONGFORM_FALLBACK_TO_THREAD=true  # Fallback to thread if unavailable
```

### Posting Cadence
```bash
MAX_POSTS_PER_DAY=18              # Max daily posts
MAX_POSTS_PER_HOUR=3              # Max hourly posts
MIN_GAP_BETWEEN_POSTS_MIN=60      # Min gap between any posts
MIN_GAP_SAME_FORMAT_MIN=180       # Min gap between same format
THREAD_COOLDOWN_MIN=15            # Cooldown after threads
MIN_POSTS_PER_2HOURS=1            # Ensure regular activity
```

### Growth Intelligence
```bash
EPM_EWMA_HALFLIFE_MIN=480         # Engagement decay rate
EXPLORE_RATIO_MIN=0.2             # Min exploration ratio
EXPLORE_RATIO_MAX=0.4             # Max exploration ratio
ENABLE_TWITTER_TRENDS=true        # Use trending topics
ENABLE_SMART_LIKE_BOT=true        # Intelligent engagement
```

## Smoke Test Endpoints

### Single Post Test
```bash
curl -fsS "$SERVICE_URL/ai-post?format=single&topic=sleep&hook=tip"
```
**Expected**: Clean single tweet, no thread language, under 279 chars

### Thread Test
```bash
curl -fsS "$SERVICE_URL/force-thread?topic=stress%20recovery&mode=how_to"
```
**Expected**: 5-7 tweet reply chain with human delays

### Longform Fallback Test
```bash
curl -fsS "$SERVICE_URL/ai-post?format=longform_single&topic=ultra-processed%20food"
```
**Expected**: Longform post OR thread fallback

## Log Verification Cheatsheet

### Healthy Single Post Logs
```
FORMAT_DECISION: final=single, reason=engine, tweets=1
FORMAT_SANITIZER: removed_thread_language_single (if needed)
LINTER: format=single, tweets=1, t1_chars=XXX, actions=[...]
POST_START
LOGIN_CHECK: Confirmed logged in to X
POST_DONE: id=XXXXXXXXX
✅ Posted intelligent tweet successfully
```

### Healthy Thread Logs
```
FORMAT_DECISION: final=thread, reason=engine, tweets=5-7
LINTER: format=thread, tweets=N, t1_chars=XXX, actions=[...]
POST_START
THREAD_CHAIN: k=1/N, in_reply_to=none
POST_DONE: id=XXXXXXXXX
THREAD_CHAIN: k=2/N, in_reply_to=XXXXXXXXX
POST_DONE: id=YYYYYYYYY
... (for each tweet)
SESSION_SAVED: cookies=XX
```

### Authentication Success
```
LOGIN_CHECK: Found authenticated indicator: [data-testid="SideNav_AccountSwitcher_Button"]
LOGIN_CHECK: Confirmed logged in to X
```

### Warning Signs
```
❌ POST_SKIPPED_PLAYWRIGHT: login_required
❌ THREAD_ABORTED_AFTER: k=X, error=...
❌ FORMAT_SANITIZER: removed_thread_language_single (frequent)
```

## Rollback Plan

### Emergency Rollback
```bash
# 1. Reduce posting volume immediately
railway variables set FALLBACK_SINGLE_TWEET_OK=true
railway variables set MAX_POSTS_PER_DAY=6
railway variables set MAX_POSTS_PER_HOUR=2

# 2. Disable threads if problematic
railway variables set ENABLE_THREADS=false

# 3. Force redeploy
git commit --allow-empty -m "chore: emergency rollback config"
git push origin main

# 4. Verify rollback
./ops/smoke_test.sh
```

### Gradual Recovery
```bash
# Restore settings incrementally
railway variables set ENABLE_THREADS=true
railway variables set MAX_POSTS_PER_DAY=12
railway variables set FALLBACK_SINGLE_TWEET_OK=false
```

## Monitoring

### Real-time Logs
```bash
railway logs --tail
```

### Key Metrics to Watch
- **Authentication**: No `login_required` errors
- **Format Compliance**: Singles have no thread language
- **Thread Structure**: Proper reply chains
- **Posting Cadence**: Respects rate limits
- **Content Quality**: Engaging, value-first tweets

### Health Check
```bash
curl -fsS "$SERVICE_URL/status"
```
Should return `200 OK` with service status.