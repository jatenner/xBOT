# Complete Push and Verify Instructions

Due to shell configuration issues, please run these commands manually in your terminal:

## Step 1: Push Session to Railway

```bash
cd /Users/jonahtenner/Desktop/xBOT
RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json pnpm exec tsx scripts/ops/push-twitter-session-to-railway.ts
```

## Step 2: Verify Auth on Railway

```bash
railway run --service serene-cat pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts | grep "\[HARVESTER_AUTH\]"
```

## Expected Output

You should see:
```
[HARVESTER_AUTH] logged_in=true handle=@yourhandle
```

## Alternative: Use Node.js Script

If pnpm/tsx has issues, you can use the direct Node.js script:

```bash
cd /Users/jonahtenner/Desktop/xBOT
node scripts/ops/push-session-direct.js
```

This script will:
1. Verify session file has auth_token and ct0 ✅
2. Push to Railway
3. Verify auth and print [HARVESTER_AUTH] line

## Session File Status

✅ `twitter_session.json` exists
✅ Contains `auth_token` cookie
✅ Contains `ct0` cookie
✅ Valid JSON format
