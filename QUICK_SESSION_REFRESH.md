# ⚡ Quick Session Refresh - 3 Steps

## When to Use This
- ❌ System hasn't posted in hours
- ❌ Logs show "Session expired"
- ❌ Analytics scraping failing
- ❌ "NOT AUTHENTICATED" errors

## 🚀 The Fix (5 minutes)

### 1️⃣ Copy Cookies from Browser

**Open Twitter DevTools:**
```
1. Go to https://x.com (logged in)
2. Press F12 → "Application" tab
3. Sidebar: Cookies → https://x.com
4. Select ALL cookies (Shift+Click first & last)
5. Right-click → "Copy"
```

**Paste into file:**
```bash
# Create/open cookies_raw.txt and paste
# (It will be tab-separated data)
```

### 2️⃣ Extract & Deploy

```bash
npm run session:extract
npm run session:deploy
```

### 3️⃣ Verify (wait 30 seconds)

```bash
npm run logs
```

**Look for:**
- ✅ `Session loaded`
- ✅ `[POSTING_QUEUE]` activity
- ✅ No "NOT AUTHENTICATED" errors

**System will start posting within 5-15 minutes!** 🎉

---

## 💡 One-Line Status Check

```bash
npm run session:status
```

Shows:
- Session age
- Cookie count  
- Critical cookies present

---

## 🔄 How Often to Refresh

**Every 1-2 weeks** (Twitter expires sessions)

Set a reminder! ⏰

---

## ❓ Troubleshooting

**"Missing auth_token"**
→ Log out of Twitter completely, log back in, try again

**"cookies_raw.txt not found"**
→ You need to paste the DevTools export first (Step 1)

**Railway deployment failed**
→ Check you're logged in: `railway whoami`

---

## 📚 Full Documentation

See **SESSION_GUIDE.md** for complete details.

---

That's it! Your system is designed to be **self-healing** for most issues, but session expiry requires manual refresh (Twitter security requirement).

