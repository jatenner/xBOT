# 🚄 Railway Environment Variables Setup

## ⚠️ CRITICAL: Set These Variables Before Deployment

Go to your Railway project → **Variables** tab → Add these:

### 🔧 **REQUIRED Variables**

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

### 🎯 **Optional Variables** (Enhanced Features)

```bash
# Twitter Bearer Token (for enhanced API access)
TWITTER_BEARER_TOKEN=your-bearer-token

# Supabase Anonymous Key (for client-side access)  
SUPABASE_ANON_KEY=your-anon-key

# News API Key (for content inspiration)
NEWS_API_KEY=your-news-api-key

# Pexels API Key (for image content)
PEXELS_API_KEY=your-pexels-api-key
```

### ⚙️ **System Variables** (Pre-configured)

```bash
NODE_ENV=production
PORT=3000
PLAYWRIGHT_BROWSERS_PATH=0
OPENAI_BUDGET_LIMIT=7.5
DAILY_BUDGET_LIMIT=7.5
MAX_DAILY_POSTS=17
```

## 🔍 **Verification Steps**

After setting variables and deploying:

1. **Health Check**: `https://your-app.railway.app/health` → Should return "ok"
2. **Environment Status**: `https://your-app.railway.app/env` → Shows which variables are missing
3. **Bot Status**: `https://your-app.railway.app/status` → Shows bot initialization state

## 🚨 **Common Issues**

- **"service unavailable"** → Missing required environment variables
- **"environment_error"** → Check `/env` endpoint for missing variables  
- **Bot not starting** → Verify OpenAI/Twitter API credentials are valid

## ✅ **Success Indicators**

- Health check returns "ok" immediately
- `/env` shows `"valid": true`
- `/status` shows `"status": "running"`
- Bot logs show successful initialization