#!/bin/bash
# 🚀 PRODUCTION ENVIRONMENT - CLI ADMINISTRATION
# ==========================================
# Source this file for production CLI operations:
# source env.prod-cli.sh

echo "🚀 Loading PRODUCTION environment for CLI administration..."

# ==========================================
# 🏗️ DEPLOYMENT ENVIRONMENT
# ==========================================
export APP_ENV=production
export NODE_ENV=production

# ==========================================
# 🗄️ SUPABASE DATABASE (PRODUCTION)
# ==========================================
export SUPABASE_URL="https://your-production-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your_production_service_role_key"
export SUPABASE_DB_PASSWORD="your_production_db_password"
export PRODUCTION_PROJECT_REF="your_production_ref"
export DATABASE_URL="postgresql://postgres:<PASSWORD>@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

# SSL Configuration
export DB_SSL_MODE="require"
# export DB_SSL_ROOT_CERT_PATH="./ops/supabase-ca.crt"

# ==========================================
# 🎭 BROWSER CONFIGURATION
# ==========================================
export BROWSER_PROFILE="standard_railway"
export BROWSER_CONCURRENCY="1"

# ==========================================
# 🚀 REDIS CACHE (PRODUCTION)
# ==========================================
export REDIS_URL="your_production_redis_url"
export REDIS_BREAKER_ENABLED=true

# ==========================================
# 🤖 OPENAI API (PRODUCTION)
# ==========================================
export OPENAI_API_KEY="your_production_openai_key"

# ==========================================
# 💰 COST CONTROLS (PRODUCTION)
# ==========================================
export COST_TRACKER_ENABLED=true
export DAILY_COST_LIMIT_USD=5.00            # Production daily limit
export COST_SOFT_BUDGET_USD=3.50            # 70% soft threshold
export COST_TRACKER_STRICT=true

# ==========================================
# 🎯 BUDGET OPTIMIZER (PRODUCTION)
# ==========================================
export BUDGET_OPTIMIZER_ENABLED=true
export BUDGET_STRATEGY=adaptive             # Adaptive for production
export BUDGET_PEAK_HOURS=17-23              # Peak engagement hours
export BUDGET_MIN_RESERVE_USD=0.50

# ==========================================
# 🔄 MIGRATIONS (PRODUCTION)
# ==========================================
export RUN_MIGRATIONS=true

# ==========================================
# 🐦 TWITTER (PRODUCTION ACCOUNT)
# ==========================================
export TWITTER_SESSION_B64="your_production_session"

# ==========================================
# 🛡️ SAFETY (PRODUCTION)
# ==========================================
export FACT_CHECK_MODE=light                # Balanced checking for production
export DRY_RUN=false

# ==========================================
# 📊 MONITORING (PRODUCTION)
# ==========================================
export LOG_LEVEL=info                       # Production logging level

echo "✅ PRODUCTION environment loaded"
echo "📊 Database: $(echo $SUPABASE_URL | sed 's/.*\/\/\([^.]*\).*/\1/')..."
echo "💰 Daily limit: $DAILY_COST_LIMIT_USD"
echo "🎯 Strategy: $BUDGET_STRATEGY"
echo ""
echo "⚠️  PRODUCTION MODE - Use with caution!"
echo "💡 Available commands:"
echo "   npm run migrate:prod      # Apply migrations"
echo "   npm run logs             # View Railway logs"
echo "   npm run cost:audit       # Check OpenAI costs"
echo "   npm run dry              # Dry run content generation"