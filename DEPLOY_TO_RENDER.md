# 🚀 Deploy xBOT to Render

This guide will walk you through deploying your autonomous Twitter bot to Render.

## ✅ Pre-Deployment Checklist

### 1. Build Verification
```bash
# Test local build
npm run build

# Test production start
npm start
```

### 2. Environment Variables Ready
Ensure you have all required environment variables:

- `OPENAI_API_KEY` - Your OpenAI API key
- `TWITTER_BEARER_TOKEN` - Twitter API Bearer Token
- `TWITTER_API_KEY` - Twitter API Key
- `TWITTER_API_SECRET` - Twitter API Secret
- `TWITTER_ACCESS_TOKEN` - Twitter Access Token
- `TWITTER_ACCESS_SECRET` - Twitter Access Token Secret
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key
- `NEWS_API_KEY` - NewsAPI key (optional)

## 🚀 Deployment Options

### Option 1: Background Worker (Recommended)
Best for bots that don't need HTTP endpoints.

1. **Create New Service** in Render Dashboard
2. **Select "Background Worker"**
3. **Connect GitHub Repository**
4. **Configure Settings:**
   - **Name:** `snap2health-xbot`
   - **Runtime:** `Node`
   - **Branch:** `main`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `node dist/index.js`

### Option 2: Web Service (With Health Check)
If you need health monitoring or plan to add web features.

1. **Create New Service** in Render Dashboard
2. **Select "Web Service"**
3. **Connect GitHub Repository**
4. **Configure Settings:**
   - **Name:** `snap2health-xbot-web`
   - **Runtime:** `Node`
   - **Branch:** `main`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `node dist/index.js`
   - **Health Check Path:** `/health`

## 🔧 Manual Setup Steps

### Step 1: Create Service
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Background Worker" (or "Web Service")
3. Connect your GitHub repository

### Step 2: Configure Environment Variables
Add all environment variables in Render dashboard:

```
NODE_ENV=production
TZ=UTC
OPENAI_API_KEY=your_openai_key
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_SECRET=your_twitter_access_secret
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
NEWS_API_KEY=your_newsapi_key
```

### Step 3: Deploy
1. Click "Create Service"
2. Render will automatically build and deploy
3. Monitor logs for successful startup

## 📊 Monitoring Deployment

### Build Logs
Watch for:
```
> snap2health-xbot@1.0.0 build
> tsc --build --verbose
Build completed successfully
```

### Runtime Logs
Watch for:
```
🔍 Health check server running on port 10000
✅ X/Twitter client initialized
🚀 Snap2Health Autonomous X-Bot Starting...
⏰ Scheduler started with the following jobs:
🧠 AUTONOMOUS INTELLIGENCE ACTIVATED:
```

### Health Check (Web Service Only)
- Health endpoint: `https://your-service.onrender.com/health`
- Should return: `{"status":"healthy","timestamp":"...","service":"snap2health-xbot"}`

## 🐛 Troubleshooting

### Common Issues

**Build Failures:**
```bash
# If TypeScript errors, check:
npm run build
```

**Runtime Errors:**
- Check environment variables are set correctly
- Verify Twitter API credentials
- Ensure Supabase database is accessible

**Memory Issues:**
- Consider upgrading to a paid plan for more resources
- Monitor memory usage in Render dashboard

### Debug Commands
```bash
# Local debugging
npm run dev

# Production simulation
NODE_ENV=production npm start
```

## 📈 Post-Deployment

### Verify Bot Operation
1. Check logs for successful strategist cycles
2. Monitor Twitter account for posts
3. Verify database updates in Supabase

### Performance Monitoring
- **Render Dashboard:** Monitor CPU/Memory usage
- **Twitter Analytics:** Track engagement metrics
- **Supabase Logs:** Monitor database queries

### Scaling
- **Free Tier:** Limited resources, may sleep after inactivity
- **Paid Plans:** Better for production workloads
- **Auto-scaling:** Configure based on usage patterns

## 🔄 Updates & Maintenance

### Automatic Deployments
Render auto-deploys on `main` branch pushes.

### Manual Deployments
1. Go to Render Dashboard
2. Select your service
3. Click "Manual Deploy" → "Deploy latest commit"

### Rolling Back
1. Go to "Deployments" tab
2. Select previous successful deployment
3. Click "Redeploy"

## 💡 Tips for Success

1. **Test Locally First:** Always test builds and deployments locally
2. **Monitor Logs:** Watch deployment and runtime logs carefully
3. **Environment Variables:** Double-check all required env vars are set
4. **Health Checks:** Use web service if you need monitoring endpoints
5. **Backup Strategy:** Ensure database backups are configured

## 🆘 Support

If deployment fails:
1. Check Render build/runtime logs
2. Verify all environment variables
3. Test locally with `NODE_ENV=production`
4. Check Twitter API rate limits
5. Verify Supabase connectivity

---

**🎉 Once deployed, your autonomous AI bot will be running 24/7, continuously learning and improving!** 