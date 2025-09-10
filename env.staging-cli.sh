#!/bin/bash
# 🔧 STAGING ENVIRONMENT - CLI DEVELOPMENT
# ==========================================
# Source this file for local staging development:
# source env.staging-cli.sh

echo "🏗️ Loading STAGING environment for CLI development..."

# ==========================================
# 🏗️ DEPLOYMENT ENVIRONMENT
# ==========================================
export APP_ENV=staging
export NODE_ENV=development

# ==========================================
# 🗄️ SUPABASE DATABASE (STAGING)
# ==========================================
export SUPABASE_URL="https://your-staging-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your_staging_service_role_key"
export SUPABASE_DB_PASSWORD="your_staging_db_password"
export STAGING_PROJECT_REF="your_staging_ref"
export DATABASE_URL="postgresql://postgres:<PASSWORD>@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

# ==========================================
# 🚀 REDIS CACHE (STAGING)
# ==========================================
export REDIS_URL="your_staging_redis_url"
export REDIS_BREAKER_ENABLED=true

# ==========================================
# 🤖 OPENAI API (STAGING - REDUCED LIMITS)
# ==========================================
export OPENAI_API_KEY="your_staging_openai_key"

# ==========================================
# 💰 COST CONTROLS (STAGING - CONSERVATIVE)
# ==========================================
export COST_TRACKER_ENABLED=true
export DAILY_COST_LIMIT_USD=2.00            # Lower limit for staging
export COST_SOFT_BUDGET_USD=1.50            # Conservative staging budget
export COST_TRACKER_STRICT=true

# ==========================================
# 🎯 BUDGET OPTIMIZER (STAGING)
# ==========================================
export BUDGET_OPTIMIZER_ENABLED=true
export BUDGET_STRATEGY=conservative         # Conservative for staging
export BUDGET_MIN_RESERVE_USD=0.25          # Lower reserve for staging

# ==========================================
# 🔄 MIGRATIONS (STAGING)
# ==========================================
export RUN_MIGRATIONS=true

# ==========================================
# 🐦 TWITTER (STAGING/TEST ACCOUNT)
# ==========================================
export TWITTER_SESSION_B64="your_staging_session"

# ==========================================
# 🛡️ SAFETY (STAGING)
# ==========================================
export FACT_CHECK_MODE=strict               # Strict checking in staging
export DRY_RUN=false                        # Set to true for testing

# ==========================================
# 📊 MONITORING (STAGING)
# ==========================================
export LOG_LEVEL=debug                      # Verbose logging for staging

echo "✅ STAGING environment loaded"
echo "📊 Database: $(echo $SUPABASE_URL | sed 's/.*\/\/\([^.]*\).*/\1/')..."
echo "💰 Daily limit: $DAILY_COST_LIMIT_USD"
echo "🎯 Strategy: $BUDGET_STRATEGY"
echo ""
echo "🚀 Ready for staging development!"
echo "💡 Run: npm run build && npm start"
