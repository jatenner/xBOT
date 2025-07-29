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

## 🚀 **Quick Setup Commands**

After setting variables:

1. **Redeploy**: Railway will automatically redeploy with new variables
2. **Monitor**: Watch the deployment logs for successful startup
3. **Verify**: Check health endpoints once deployed

## 🔍 **Verification Steps**

After setting variables and deploying:

1. **Health Check**: `https://your-app.railway.app/health` → Should return "ok"
2. **Environment Status**: `https://your-app.railway.app/env` → Shows which variables are missing
3. **Bot Status**: `https://your-app.railway.app/status` → Shows bot initialization state

## 🚨 **Common Issues**

- **"service unavailable"** → Missing required environment variables
- **"environment_error"** → Check `/env` endpoint for missing variables  
- **Bot not starting** → Verify OpenAI/Twitter API credentials are valid
- **Health check failing** → Wait 30-60 seconds for initial startup

## ✅ **Success Indicators**

- Health check returns "ok" immediately
- `/env` shows `"valid": true`
- `/status` shows `"status": "running"`
- Bot logs show successful initialization

## 🔑 **How to Get API Keys**

### OpenAI API Key:
1. Visit https://platform.openai.com/api-keys
2. Create new secret key
3. Copy the key (starts with `sk-`)

### Twitter API Keys:
1. Visit https://developer.twitter.com/en/portal/dashboard
2. Create new project/app
3. Generate API keys and access tokens
4. Enable OAuth 1.0a

### Supabase Keys:
1. Visit your Supabase project dashboard
2. Go to Settings → API
3. Copy URL and Service Role key