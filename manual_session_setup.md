# 🚄 MANUAL RAILWAY SESSION SETUP

If the automated browser doesn't open, follow these manual steps:

## 📋 **STEP-BY-STEP INSTRUCTIONS:**

### **1. Get Your Twitter Session Cookies**

1. Open Chrome/Firefox and go to https://x.com
2. Log into your Twitter account
3. Open Developer Tools (F12)
4. Go to Application/Storage tab → Cookies → https://x.com
5. Copy all cookies (you'll need: auth_token, ct0, _twitter_sess, etc.)

### **2. Create Session File**

Create `data/twitter_session.json` with this format:

```json
{
  "cookies": [
    {
      "name": "auth_token",
      "value": "YOUR_AUTH_TOKEN_VALUE",
      "domain": ".x.com",
      "path": "/",
      "expires": -1,
      "httpOnly": true,
      "secure": true,
      "sameSite": "None"
    },
    {
      "name": "ct0",
      "value": "YOUR_CT0_VALUE", 
      "domain": ".x.com",
      "path": "/",
      "expires": -1,
      "httpOnly": false,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "timestamp": 1704067200000,
  "isValid": true
}
```

### **3. Convert to Base64 for Railway**

Run this command to convert your session:

```bash
base64 < data/twitter_session.json | tr -d '\n'
```

### **4. Set Railway Environment Variable**

1. Go to your Railway project dashboard
2. Go to Variables tab
3. Add new variable:
   - **Name**: `TWITTER_SESSION_B64`
   - **Value**: [paste the base64 string from step 3]

### **5. Deploy to Railway**

```bash
git add -A
git commit -m "Add Railway session support"
git push origin main
```

## 🔧 **TESTING LOCALLY:**

```bash
# Set the environment variable locally
export TWITTER_SESSION_B64="your_base64_session_here"

# Test the system
npm run build
npm start
```

## ✅ **VERIFICATION:**

Your bot should now:
- ✅ Load session from environment variable
- ✅ Validate session automatically  
- ✅ Post to Twitter successfully
- ✅ Run 24/7 on Railway without manual intervention

## 🚨 **TROUBLESHOOTING:**

If posting fails:
1. Check Railway logs: `npm run rail:logs`
2. Verify session is not expired (max 7 days)
3. Regenerate session if needed
4. Ensure all required cookies are included

The system will automatically validate and refresh sessions as needed!

