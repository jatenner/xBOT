# 🍪 Extract ALL Twitter Cookies (Including HTTPOnly)

## ⚡ FASTEST METHOD - Copy/Paste from DevTools

### Step 1: Open DevTools Application Tab
1. Go to https://x.com (make sure you're logged in)
2. Press **F12** or **Cmd+Option+I** to open DevTools
3. Click the **"Application"** tab at the top
4. In left sidebar: **Cookies** → **https://x.com**

### Step 2: Select and Copy ALL Cookies
1. Click on the **first cookie** in the list
2. Scroll to the bottom
3. Hold **Shift** and click the **last cookie** (selects all)
4. Right-click → **"Copy"** or press **Cmd+C** / **Ctrl+C**

### Step 3: Save to File
The copied data is tab-separated. Create a file called `cookies_raw.txt` and paste it.

### Step 4: Run the Converter Script
```bash
node convert_devtools_cookies.js
```

This will:
- Parse the tab-separated cookie data
- Convert to Playwright format
- Create base64 session
- Deploy to Railway
- Restart the service

---

## 🔑 Critical Cookies You MUST Have

When you look at the cookies in DevTools, make sure you see these:

### Essential (Required):
- ✅ **auth_token** (HTTPOnly) - Main authentication
- ✅ **ct0** - CSRF token
- ✅ **twid** - Twitter ID

### Important (Recommended):
- ✅ **guest_id**
- ✅ **personalization_id**
- ✅ **kdt**

If you don't see `auth_token`, you're not properly logged in or it's expired.

---

## 🚨 Troubleshooting

### "I don't see auth_token"
→ Log out of Twitter completely, then log back in

### "Copy doesn't work"
→ Use Option A instead: `node get_all_cookies.js` (manual entry)

### "Cookies expire quickly"
→ This is normal. You may need to refresh session every 1-2 weeks

