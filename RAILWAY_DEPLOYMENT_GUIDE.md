# 🚄 Railway Deployment Guide for xBOT

## ⚠️ **CRITICAL: SET ENVIRONMENT VARIABLES FIRST**

Your deployment is failing because required environment variables are missing. **Set these in Railway before the bot can start:**

### 🔧 **Railway Environment Setup**

1. Go to your Railway project: https://railway.app/project/[your-project-id]
2. Click **"Variables"** tab  
3. Add these **REQUIRED** environment variables:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Twitter API Configuration  
TWITTER_API_KEY=your-twitter-api-key
TWITTER_API_SECRET=your-twitter-api-secret
TWITTER_ACCESS_TOKEN=your-twitter-access-token
TWITTER_ACCESS_TOKEN_SECRET=your-twitter-access-token-secret
TWITTER_USERNAME=your-twitter-handle-without-@

# Supabase Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

4. **Optional** environment variables (for enhanced features):
```bash
TWITTER_BEARER_TOKEN=your-bearer-token
SUPABASE_ANON_KEY=your-anon-key
NEWS_API_KEY=your-news-api-key
PEXELS_API_KEY=your-pexels-api-key
```

5. Click **"Deploy"** after adding variables

### 🔍 **Check Environment Status**

After deployment, visit these endpoints to debug:
- **Health Check**: `https://your-app.railway.app/health` (should return "ok")
- **Environment Status**: `https://your-app.railway.app/env` (shows missing variables)
- **Bot Status**: `https://your-app.railway.app/status` (shows bot state)

---

## 🚀 Deployment Instructions

## 📋 **Prerequisites**

- Railway account (free tier available)
- GitHub repository: https://github.com/jatenner/xBOT
- Supabase database setup
- OpenAI API key
- Twitter account credentials (`twitter-auth.json`)

## 🔧 **Railway Configuration**

### **1. Connect Repository**
1. Go to [Railway](https://railway.app)
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Connect `https://github.com/jatenner/xBOT`

### **2. Build Settings**
Railway should automatically detect Node.js. If needed, configure:

**Build Command:**
```bash
npx playwright install chromium --force && NODE_OPTIONS=--max_old_space_size=1024 npm run build
```

**Start Command:**
```bash
npm start
```

### **3. Environment Variables**
Add these in Railway's Environment Variables section:

```env
# === REQUIRED API KEYS ===
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# === TWITTER CONFIGURATION ===
TWITTER_USERNAME=snap2health
TWITTER_DISPLAY_NAME=Snap2Health

# === DEPLOYMENT SETTINGS ===
NODE_ENV=production
PORT=3002
RAILWAY_ENVIRONMENT=production

# === BUDGET SETTINGS ===
OPENAI_BUDGET_LIMIT=7.5
DAILY_BUDGET_LIMIT=7.5

# === OPTIONAL ===
NEWS_API_KEY=your_news_api_key_here
DEBUG_SCREENSHOT=false
```

## 🗃️ **Database Setup**

### **1. Apply SQL Migration**
In your Supabase SQL Editor, run:
```sql
-- Copy and paste the contents of:
-- migrations/20250128_intelligent_growth_engine_fixed.sql
```

### **2. Verify Tables**
Ensure these tables exist:
- `tweets`
- `posting_time_analytics`  
- `topic_performance_analytics`
- `influencer_engagement_log`

## 📁 **File Upload**

### **Upload Twitter Session**
1. In Railway dashboard, go to your service
2. Go to "Data" tab
3. Upload your `twitter-auth.json` file to the root directory

## 🚀 **Deployment Process**

### **1. Deploy**
1. Push your code to GitHub
2. Railway will automatically detect changes and deploy
3. Watch the build logs for any errors

### **2. Monitor Logs**
```bash
# Railway CLI (optional)
railway logs
```

### **3. Verify Dashboard**
- Your dashboard will be available at: `https://your-app.up.railway.app`
- Port 3002 is automatically exposed by Railway

## ✅ **Post-Deployment Verification**

### **1. Check Bot Status**
Look for these log messages:
```
🚄 Railway Dashboard server running on http://0.0.0.0:3002
🎭 Playwright browsers installed for Railway
🚀 AUTONOMOUS TWITTER GROWTH MASTER STARTING
✅ Browser launched successfully
```

### **2. Dashboard Access**
- Visit: `https://your-railway-app.up.railway.app`
- Should show real-time bot activity
- Tweet schedule and performance metrics

### **3. Twitter Activity**
- Bot should start posting within 2 hours
- Check your Twitter account for new tweets
- Monitor engagement and follower growth

## 🛠️ **Troubleshooting**

### **Common Issues:**

**1. Build Fails - Playwright Issue**
```bash
# Ensure build command includes:
npx playwright install chromium --force && NODE_OPTIONS=--max_old_space_size=1024 npm run build
```

**2. Environment Variables Missing**
- Double-check all required vars are set
- Restart deployment after adding variables

**3. Database Connection Issues**
- Verify Supabase URL and key
- Check if SQL migration was applied
- Ensure database is accessible

**4. Twitter Authentication**
- Ensure `twitter-auth.json` is uploaded
- File should be in root directory
- Check file permissions

## 📊 **Monitoring**

### **Dashboard Features:**
- ✅ Today's tweet schedule
- ✅ Performance metrics (likes, RTs, follows)  
- ✅ Reply/engagement logs
- ✅ Budget usage tracking
- ✅ Next optimization cycle countdown

### **Log Monitoring:**
```bash
# Key success indicators:
✅ Browser launched successfully
✅ Dashboard server running
✅ Intelligence systems initialized
✅ Tweet posted successfully
```

## 🎯 **Expected Results**

Within 24 hours you should see:
- **15+ daily tweets** with intelligent timing
- **Strategic engagement** (likes, replies, follows)
- **Dashboard analytics** updating in real-time
- **Follower growth** tracking and optimization

## 🚨 **Support**

If you encounter issues:
1. Check Railway deployment logs
2. Verify all environment variables
3. Ensure SQL migration is applied
4. Check `twitter-auth.json` is uploaded

Your autonomous Twitter bot is now running on Railway! 🤖📈