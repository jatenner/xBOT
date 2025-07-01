# 🚀 Render Environment Variables Setup

## Required Environment Variables

To fix the "Cannot fetch bot_config" 502 errors, set these environment variables in your Render service:

### **1. Core Supabase Variables** ✅ REQUIRED
- **`SUPABASE_URL`** = `https://your-project-ref.supabase.co`
  - Find this in your Supabase Dashboard → Settings → API
  
- **`SUPABASE_ANON_KEY`** = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - Find this in your Supabase Dashboard → Settings → API → anon public key

- **`SUPABASE_SERVICE_ROLE_KEY`** = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - Find this in your Supabase Dashboard → Settings → API → service_role secret key
  - ⚠️ **Keep this secret!** Only use for server-side operations

### **2. Steps to Set Variables in Render:**

1. **Go to your Render Dashboard**
2. **Select your xBot service**
3. **Navigate to "Environment" tab**
4. **Add each variable:**
   - Click "Add Environment Variable"
   - Enter Key name (e.g., `SUPABASE_URL`)
   - Enter Value (your actual Supabase URL)
   - Click "Save Changes"

### **3. Alternative Names** (if your code uses different names):
- `SUPABASE_KEY` instead of `SUPABASE_ANON_KEY`
- `SUPABASE_SECRET` instead of `SUPABASE_SERVICE_ROLE_KEY`

### **4. Verification:**
After setting variables and running the migration:
- ✅ Bot should start without 502 errors
- ✅ Runtime config should load from database
- ✅ Draft draining should run every 10 minutes
- ✅ Bot should post tweets normally

## 🔧 Quick Deployment Checklist:

- [ ] Run migration in Supabase SQL Editor
- [ ] Set SUPABASE_URL in Render
- [ ] Set SUPABASE_ANON_KEY in Render  
- [ ] Set SUPABASE_SERVICE_ROLE_KEY in Render
- [ ] Redeploy service in Render
- [ ] Check logs for successful startup

**After completing these steps, your bot should start without database errors!** 🎉 