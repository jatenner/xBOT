#!/bin/bash
# Setup script for xBOT Production Environment
# Run this to set all required environment variables on Railway

echo "🚀 Setting up xBOT Production Environment Variables"
echo "======================================================"

# Check if railway CLI is available
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   npm install -g @railway/cli"
    exit 1
fi

echo "📋 Setting core environment variables..."

# SSL and Database
echo "🔒 Setting SSL and Database configuration..."
railway variables set PGSSLMODE=require
railway variables set DB_SSL_ROOT_CERT_PATH=/etc/ssl/certs/ca-certificates.crt
railway variables set ALLOW_SSL_FALLBACK=true

# Migrations
echo "📊 Setting migration configuration..."
railway variables set DB_MIGRATIONS_ENABLED=true
railway variables set MIGRATIONS_RUNTIME_ENABLED=true

# Playwright
echo "🎭 Setting Playwright configuration..."
railway variables set PLAYWRIGHT_BROWSERS_PATH=0
railway variables set PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1

# Feature Flags
echo "🎯 Setting feature flags..."
railway variables set ENABLE_METRICS=true
railway variables set POSTING_DISABLED=true
railway variables set BLOCK_POLITICS=false
railway variables set TOPIC_BLACKLIST=nsfw
railway variables set REPLY_TOPIC_MODE=broad
railway variables set ENABLE_REPLIES=true

# Content Brain Settings
echo "🧠 Setting content brain configuration..."
railway variables set MIN_POST_INTERVAL_MINUTES=45
railway variables set MAX_POSTS_PER_HOUR=3
railway variables set DAILY_OPENAI_LIMIT_USD=5.0

echo ""
echo "✅ Environment variables set successfully!"
echo ""
echo "📝 Manual steps required:"
echo "   1. Set DATABASE_URL (Transaction Pooler URL ending with :6543)"
echo "   2. Set OPENAI_API_KEY"
echo "   3. Set SUPABASE_SERVICE_ROLE_KEY"
echo "   4. Set REDIS_URL"
echo ""
echo "🧪 To verify setup:"
echo "   npm run diagnostics"
echo ""
echo "🚀 To enable posting after verification:"
echo "   railway variables set POSTING_DISABLED=false"
