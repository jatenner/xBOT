# 🔑 **SUPABASE KEYS SETUP GUIDE**

## 🚨 **ISSUE DETECTED:**
Your Supabase environment variables are missing, causing "permission denied" errors.

## 🎯 **SOLUTION:**

### **1. Get Your Supabase Credentials:**

Go to your Supabase project dashboard:
- **URL**: `https://supabase.com/dashboard/project/[your-project-id]`
- **Settings** → **API** tab

You need **2 keys**:
1. **Project URL** (looks like: `https://xxx.supabase.co`)
2. **Service Role Key** (long string starting with `eyJ` or `sbp_`)

### **2. Create `.env` file:**

Create a `.env` file in your project root with:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Twitter API Keys (if you have them)
TWITTER_API_KEY=your-twitter-api-key
TWITTER_API_SECRET=your-twitter-api-secret
TWITTER_ACCESS_TOKEN=your-access-token
TWITTER_ACCESS_TOKEN_SECRET=your-access-token-secret
TWITTER_BEARER_TOKEN=your-bearer-token

# OpenAI (if you have it)
OPENAI_API_KEY=your-openai-api-key
```

### **3. Verify Setup:**

Run this command to test:
```bash
node SYSTEM_INTEGRATION_TEST.js
```

## 🔐 **SECURITY NOTES:**

- **Never commit `.env` to git**
- Use **Service Role Key** (not anon key) for full database access
- Keep keys secure and private

## ✅ **EXPECTED RESULT:**

After setting up keys correctly, you should see:
```
🎉 ALL SYSTEMS GO!
Passed: 5/5 tests
✅ Ready for production deployment!
``` 