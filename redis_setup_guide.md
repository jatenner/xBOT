# 🔧 Redis Setup for Autonomous Twitter Bot

## Current Issue
Your Redis instance `redis-17514.c92.us-east-1-3.ec2.redis.redis-cloud.com` is returning DNS errors, indicating it's likely expired or terminated.

## ⚡ Quick Solution Options

### Option 1: Upstash Redis (Recommended - Free Tier)
1. Go to https://upstash.com/
2. Create account and new Redis database
3. Copy the Redis URL (looks like: `rediss://default:password@region.upstash.io:6379`)
4. Update your Railway environment variables:
   - `REDIS_URL=your_new_upstash_url`

### Option 2: Railway Redis Add-on
1. In Railway dashboard, go to your project
2. Click "Add Service" → "Database" → "Redis"
3. Railway will provide `REDIS_URL` automatically

### Option 3: Redis Cloud (Current Provider)
1. Go to https://redis.com/redis-enterprise-cloud/
2. Create new database instance
3. Get new connection URL
4. Update environment variables

## 🔥 Immediate Fix for Development

For now, let's make the bot work **without Redis** (Supabase-only mode) until you set up new Redis:

```bash
# In Railway, temporarily remove or comment out:
# REDIS_URL=...

# The bot will automatically detect missing Redis and use Supabase-only mode
```

## 🚀 Production Setup Steps

1. **Set up Supabase tables** (run the SQL file I created)
2. **Get new Redis instance** (Upstash recommended)
3. **Update Railway environment variables**
4. **Redeploy bot**
5. **Test full autonomous operation**

## Environment Variables Needed in Railway

```
SUPABASE_URL=https://qtgjmaelglghnlahqpbl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
REDIS_URL=your_new_redis_url
OPENAI_API_KEY=your_openai_key
TWITTER_CONSUMER_KEY=your_twitter_key
TWITTER_CONSUMER_SECRET=your_twitter_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_secret
```