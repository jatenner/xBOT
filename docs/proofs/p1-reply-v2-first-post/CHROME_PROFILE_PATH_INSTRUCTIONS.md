# Chrome Profile Path Instructions

**Date:** January 29, 2026

## Step 1: Get Profile Path from Chrome

1. Open Chrome (the profile where you're logged into X.com)
2. Navigate to: `chrome://version`
3. Find the line that says **"Profile Path"**
4. Copy the entire path (it will look like: `/Users/jonahtenner/Library/Application Support/Google/Chrome/Profile 1`)

## Step 2: Parse Profile Path

Run:
```bash
pnpm tsx scripts/ops/parse-chrome-profile-path.ts "<paste Profile Path here>"
```

This will output the exact command to run.

## Step 3: Quit Chrome Completely

**IMPORTANT:** Fully quit Chrome before running refresh:
- Press `Cmd+Q` (or Chrome → Quit Google Chrome)
- Verify Chrome is closed: `ps aux | grep "Google Chrome" | grep -v grep` should return nothing

## Step 4: Export Session

Run the command from Step 2 (or manually):
```bash
CHROME_USER_DATA_DIR="<user_data_dir>" CHROME_PROFILE_DIR="<profile_dir>" pnpm tsx scripts/refresh-x-session.ts
```

**Expected Output:**
```
🍪 Cookie Check:
   Total cookies: X
   Twitter/X cookies: Y
   auth_token: ✅ YES
   ct0: ✅ YES
```

## Step 5: Push to Railway

```bash
RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json pnpm tsx scripts/ops/push-twitter-session-to-railway.ts
```

## Step 6: Verify Auth on Railway

```bash
railway run --service serene-cat pnpm tsx scripts/ops/run-harvester-single-cycle.ts
```

**Expected:**
```
[HARVESTER_AUTH] logged_in=true handle=@...
```

## Troubleshooting

**If Profile Path shows Chrome Beta/Canary:**
- Chrome Beta: `~/Library/Application Support/Google/Chrome Beta`
- Chrome Canary: `~/Library/Application Support/Google/Chrome Canary`
- Use the same parse script with the Beta/Canary path

**If refresh fails with "profile is already in use":**
- Ensure Chrome is fully quit (not just closed windows)
- Check: `ps aux | grep "Google Chrome"`
- Kill if needed: `pkill -9 "Google Chrome"`
