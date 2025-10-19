# Railway Authentication - Permanent Fix

## 🔴 THE PROBLEM
Railway CLI keeps getting "Unauthorized" because **OAuth tokens expire** every few days/weeks.

## ✅ THE PERMANENT SOLUTION

### Step 1: Get a Permanent API Token

1. Go to: **https://railway.app/account/tokens**
2. Click **"Create Token"**
3. Name it: `xBOT-CLI-Token`
4. Copy the token (starts with something like `rw_live_...`)

### Step 2: Set it in Your Environment

Add to your `~/.zshrc` (or `~/.bashrc`):

```bash
export RAILWAY_TOKEN="your_permanent_token_here"
```

Then reload your shell:
```bash
source ~/.zshrc
```

### Step 3: Verify It Works

```bash
railway whoami
railway status
```

---

## 🚨 TEMPORARY FIX (Will Expire Again)

If you need logs RIGHT NOW before getting the permanent token:

```bash
railway login
```

This will open your browser for OAuth, but **it will expire again** in a few days/weeks.

---

## 📊 ALTERNATIVE: Use Our API Script

Our `railway-logs.js` script can use the permanent token directly:

```bash
export RAILWAY_TOKEN="your_permanent_token"
node railway-logs.js
```

---

## ⚙️ WHAT WE'VE FIXED

- ✅ Updated `railway-logs.js` to prioritize RAILWAY_TOKEN env var
- ✅ Removed expired hardcoded tokens
- ✅ Created this guide for permanent solution

---

## 🎯 RECOMMENDED NEXT STEPS

1. **Get permanent API token** from Railway dashboard (5 minutes)
2. **Add to ~/.zshrc** so it's always available
3. **Never deal with "Unauthorized" again**

The OAuth method works but will keep expiring. Permanent API tokens are the way to go for automated systems like xBOT.


