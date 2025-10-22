# 🔐 Session Management Guide

## 📖 Overview

Your xBOT now has a **clean, organized session management system** that stores all Twitter authentication in one place: `.session/`

## 🗂️ Directory Structure

```
xBOT/
├── .session/                    # ✅ NEW: Centralized session storage
│   ├── current/                 # Active session files
│   │   ├── session.json         # Playwright format
│   │   ├── session.b64          # Base64 for Railway
│   │   └── metadata.json        # Session info
│   ├── archive/                 # Old sessions (auto-managed)
│   │   └── session_*.json       # Timestamped backups
│   └── README.md
├── cookies_raw.txt              # ⚠️ TEMPORARY: Paste DevTools export here
└── [old session files...]       # ⚠️ DEPRECATED: Will be cleaned up
```

## 🚀 Quick Start: Refresh Your Session

### Step 1: Extract Cookies from Browser

1. **Open Twitter in Chrome/Brave:**
   - Go to https://x.com
   - Make sure you're logged in ✅

2. **Open DevTools:**
   - Press **F12** or **Cmd+Option+I**
   - Click **"Application"** tab
   - In left sidebar: **Cookies** → **https://x.com**

3. **Copy ALL cookies:**
   - Click the first cookie
   - Scroll down, **Shift+Click** the last cookie (selects all)
   - Right-click → **"Copy"** (or **Cmd+C**)

4. **Paste into temporary file:**
   ```bash
   # Paste the copied data into: cookies_raw.txt
   # (You can create this file or use any text editor)
   ```

### Step 2: Extract Session
```bash
npm run session:extract
```

This will:
- ✅ Parse cookies from `cookies_raw.txt`
- ✅ Validate critical cookies (`auth_token`, `ct0`)
- ✅ Archive any existing session
- ✅ Save new session to `.session/current/`
- ✅ Create base64 encoding for Railway
- ✅ Generate metadata

### Step 3: Deploy to Railway
```bash
npm run session:deploy
```

This will:
- ✅ Push session to Railway as `TWITTER_SESSION_B64`
- ✅ Restart your Railway service
- ✅ System will start posting within 5-15 minutes

### Step 4: Verify
```bash
# Wait 30 seconds, then check logs
npm run logs

# Look for:
# ✅ "Session loaded"
# ✅ "[POSTING_QUEUE]" activity
# ✅ "Plan job" generating content
```

---

## 📊 Management Commands

### Check Session Status
```bash
npm run session:status
```
Shows:
- Current session age
- Cookie count
- Critical cookies present
- Archived sessions

### Archive Current Session
```bash
npm run session:archive
```
Manually save current session to archive (auto-archives on extract)

### Clean Old Archives
```bash
npm run session:cleanup
```
Keeps 5 newest archives, deletes older ones

---

## 🔍 Troubleshooting

### ❌ "Missing auth_token!"
**Problem:** The `auth_token` cookie is missing (critical!)

**Solution:**
1. Log out of Twitter completely
2. Log back in
3. Extract cookies again from DevTools

### ❌ "Session expired" in Railway logs
**Problem:** Session is too old (Twitter expires them ~1-2 weeks)

**Solution:**
```bash
# Extract fresh session
npm run session:extract
npm run session:deploy
```

### ❌ "cookies_raw.txt not found"
**Problem:** You need to paste the DevTools cookie export first

**Solution:**
1. Copy cookies from DevTools (see Step 1 above)
2. Paste into a file called `cookies_raw.txt` in project root
3. Run `npm run session:extract` again

### ❌ Railway deployment failed
**Problem:** Railway CLI issue or not logged in

**Manual Solution:**
```bash
# 1. Get the base64 string
cat .session/current/session.b64

# 2. Set Railway variable manually
railway variables --set TWITTER_SESSION_B64="<paste base64 here>"

# 3. Restart
railway up --detach
```

---

## 🎯 Benefits of New System

### Before (Messy):
```
session_b64.txt
session_complete_b64.txt
session_final_b64.txt
session_full_b64.txt
twitter_session.json
twitter_session_complete.json
twitter_session_final.json
twitter_session_full.json
bulletproof_session_b64.txt
... 🤯 Which one is current?!
```

### After (Clean):
```
.session/
├── current/
│   ├── session.json      ← Always the active session
│   ├── session.b64       ← Always ready for Railway
│   └── metadata.json     ← Session info
└── archive/              ← Auto-managed history
```

✅ **One canonical location**
✅ **Automatic archiving**
✅ **Validation built-in**
✅ **Git-ignored by default**
✅ **Easy to manage**

---

## 🔄 Session Rotation Schedule

**Recommended:** Refresh session every **1-2 weeks**

You'll know it's time when:
- ❌ Railway logs show "Session expired"
- ❌ Analytics scraping fails
- ❌ System stops posting

**Quick refresh:**
```bash
npm run session:extract  # Extract from browser
npm run session:deploy   # Push to Railway
```

Done! ✨

---

## 📁 What Gets Gitignored

All session files are automatically excluded from git:

```gitignore
.session/
*_session*.json
*session*.txt
session_*.txt
twitter_session*.json
cookies_raw.txt
cookies_export.json
```

**Your secrets are safe!** 🔒

---

## 🧹 Cleaning Up Old Files

After confirming the new system works, you can delete these old files:

```bash
# Check status first
npm run session:status

# If current session is working, clean up:
rm session_*.txt
rm twitter_session*.json
rm cookies_export.json
rm cookies_raw.txt  # After extraction
```

---

## 💡 Pro Tips

1. **Keep cookies_raw.txt until confirmed working**
   - After successful deploy, you can delete it
   - It's git-ignored so it's safe

2. **Check session age regularly**
   ```bash
   npm run session:status
   ```

3. **Archive before experiments**
   ```bash
   npm run session:archive
   ```

4. **Use Railway logs to verify**
   ```bash
   npm run logs | grep -i "session"
   ```

---

## 🎓 How It Works

1. **DevTools Cookie Export** → Tab-separated format
2. **Session Manager** → Parses & validates
3. **Playwright Format** → Compatible with your browser automation
4. **Base64 Encoding** → Safe for environment variables
5. **Railway Deployment** → Updates `TWITTER_SESSION_B64`
6. **Auto-Archive** → Previous sessions backed up
7. **Auto-Cleanup** → Keeps last 5 archives

---

## ❓ Need Help?

- **Session not working?** → `npm run session:status`
- **Railway deployment failed?** → See "Manual Solution" above
- **Missing cookies?** → Re-extract from DevTools
- **System not posting?** → Check `npm run logs` for errors

---

**Ready to refresh your session?**

```bash
# 1. Copy cookies from DevTools (Application tab)
# 2. Paste into cookies_raw.txt
# 3. Run these two commands:

npm run session:extract
npm run session:deploy

# Done! System will resume posting in 5-15 minutes. ✨
```

