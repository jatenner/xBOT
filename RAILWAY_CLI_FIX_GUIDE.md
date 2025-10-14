# 🔧 COMPLETE RAILWAY CLI FIX GUIDE

## 🎯 PROBLEM SUMMARY

Your Railway CLI has authentication and project linking issues:
- ❌ `railway whoami` → "error decoding response body"
- ❌ `railway logs` → "No linked project found"
- ❌ `railway login --browserless` → Stalls on "Waiting for login..."

**Root Cause:** Corrupted Railway config + broken authentication flow

---

## ✅ RECOMMENDED SOLUTION: Token-Based Authentication

This is the **fastest** and **most reliable** method.

### Step 1: Get Your Railway API Token

1. Open: **https://railway.app/account/tokens**
2. Click **"Create Token"**
3. Give it a name: `xBOT-CLI-Access`
4. Click **"Create"**
5. **Copy the token** (looks like: `rw_Fe26.2**...`)

### Step 2: Get Your Project ID

1. Open: **https://railway.app**
2. Click on your **xBOT** project
3. Go to **Settings** → **General**
4. Copy the **Project ID** (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Step 3: Run The Fix Script

```bash
./quick-railway-token-fix.sh [YOUR_TOKEN] [YOUR_PROJECT_ID]
```

**Example:**
```bash
./quick-railway-token-fix.sh rw_Fe26.2**1ab0e3d7... a1b2c3d4-5678-90ab-cdef-1234567890ab
```

### Step 4: Verify It Works

```bash
# Test authentication
railway whoami

# Test project connection
railway status

# View live logs
railway logs
```

---

## 🎉 WHAT THIS FIXES

After running the fix script, you'll be able to:

### ✅ View Live Logs from Terminal
```bash
railway logs
# Shows real-time deployment logs from your xBOT service
```

### ✅ Manage Environment Variables
```bash
railway variables

# Set a variable
railway variables set KEY=value

# Delete a variable
railway variables delete KEY
```

### ✅ Check Deployment Status
```bash
railway status
# Shows current deployment, service health, etc.
```

### ✅ Deploy from Local
```bash
railway up
# Deploys your local code to Railway
```

### ✅ Open Project Dashboard
```bash
railway open
# Opens your Railway project in browser
```

---

## 🚨 IF TOKEN METHOD FAILS

### Alternative: Browser Login (Complete Fix Script)

Run the complete fix script and follow prompts:
```bash
./fix-railway-cli-completely.sh
```

This will:
1. Clean up corrupted config
2. Open Railway login in browser
3. Link to your project
4. Verify everything works

### Alternative: Manual Railway Dashboard

Skip CLI for now and use the web dashboard:

1. **View Logs:** https://railway.app → xBOT → Observability → Logs
2. **Manage Variables:** https://railway.app → xBOT → Variables
3. **Deploy:** Git push to trigger automatic deployment
4. **Monitor Locally:** `npm run logs` (our bulletproof monitor)

---

## 📊 CRITICAL VARIABLES TO SET

Once Railway CLI is working, set these 23 variables:

```bash
# Core Configuration
railway variables set MODE=live
railway variables set JOBS_AUTOSTART=true

# Aggressive Job Intervals (THIS IS CRITICAL!)
railway variables set JOBS_PLAN_INTERVAL_MIN=15
railway variables set JOBS_POSTING_INTERVAL_MIN=5
railway variables set JOBS_REPLY_INTERVAL_MIN=20
railway variables set JOBS_LEARN_INTERVAL_MIN=60

# Rate Limits
railway variables set MAX_POSTS_PER_HOUR=2
railway variables set MAX_DAILY_POSTS=48
railway variables set REPLY_MAX_PER_DAY=72
railway variables set REPLY_MINUTES_BETWEEN=20

# Features
railway variables set ENABLE_REPLIES=true
railway variables set ENABLE_THREADS=true
railway variables set THREAD_PERCENTAGE=10

# Quality & Learning
railway variables set MIN_QUALITY_SCORE=0.7
railway variables set EXPLORE_RATIO_MIN=0.1
railway variables set EXPLORE_RATIO_MAX=0.3

# Budget
railway variables set DAILY_OPENAI_LIMIT_USD=10.0
railway variables set BUDGET_STRICT=false

# Posting
railway variables set GRACE_MINUTES=5
railway variables set MIN_POST_INTERVAL_MINUTES=30

# Advanced Features
railway variables set FEATURE_HOOK_EVOLUTION=true
railway variables set FEATURE_FOLLOWER_OPTIMIZATION=true
railway variables set FEATURE_PERFORMANCE_TRACKING=true
```

After setting variables:
```bash
# Trigger redeploy to apply changes
railway up --detach
```

---

## 🎯 EXPECTED RESULTS

After fixing Railway CLI and setting variables:

**Within 5 minutes:**
- ✅ `railway logs` shows live deployment logs
- ✅ System shows "JOBS_PLAN_INTERVAL_MIN: 15" in config
- ✅ All timers active in bulletproof monitor

**Within 15 minutes:**
- ✅ First content planned (`Plans>0`)
- ✅ Content generation every 15 minutes

**Within 30 minutes:**
- ✅ First post published (`Posts>0`)
- ✅ Replies being generated (`Replies>0`)

**Within 60 minutes:**
- ✅ Full system operational: 2 posts + 3 replies per hour
- ✅ Hook evolution learning from performance
- ✅ Follower optimization active

---

## 🆘 TROUBLESHOOTING

### "railway: command not found"
```bash
# Install Railway CLI
brew install railway
# OR
bash <(curl -fsSL cli.new/railway/install.sh)
```

### "Invalid token"
- Token expired or incorrect
- Generate a new token at: https://railway.app/account/tokens
- Run the fix script again with new token

### "No linked project found"
```bash
# Manual link
railway link [YOUR_PROJECT_ID]

# Or run the fix script again
./quick-railway-token-fix.sh [TOKEN] [PROJECT_ID]
```

### Railway logs still not working
```bash
# Use our bulletproof monitor instead
npm run logs

# Or view in Railway dashboard
railway open
# Go to Observability → Logs
```

---

## 📞 QUICK REFERENCE

| Command | Purpose |
|---------|---------|
| `railway whoami` | Check authentication |
| `railway status` | Check project status |
| `railway logs` | View live logs |
| `railway variables` | Manage environment variables |
| `railway up` | Deploy from local |
| `railway open` | Open dashboard |
| `npm run logs` | Bulletproof local monitor |

---

## 🚀 ONCE CLI IS FIXED

You'll have **full control** over your Railway deployment:

1. **Monitor in real-time:** `railway logs`
2. **Update variables instantly:** `railway variables set KEY=value`
3. **Quick deploys:** `railway up`
4. **Check health:** `railway status`
5. **Emergency access:** Dashboard always available

**No more CLI workarounds needed!** 🎉

