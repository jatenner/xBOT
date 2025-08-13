#!/bin/bash
# ================================================
# PRODUCTION ENVIRONMENT - CLI SAFE CONFIGURATION
# ================================================
# Usage: source prod-cli-CORRECTED.sh
# WARNING: This configures PRODUCTION environment with LIVE_POSTS=true

# Production Supabase Configuration
export PROD_PROJECT_REF='qtgjmaelglghnlahqpbl'
export PROD_DB_PASSWORD='Christophernolanfan123!!'
export SUPABASE_URL='https://qtgjmaelglghnlahqpbl.supabase.co'
export SUPABASE_ACCESS_TOKEN='sbp_d6fed4a8ceff1795b6a3c27bcb8bca75ee7e7fe7'
export SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Z2ptYWVsZ2xnaG5sYWhxcGJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYwNjUxMCwiZXhwIjoyMDY1MTgyNTEwfQ.Gze-MRjDg592T02LpyTlyXt14QkiIgRFgvnMeUchUfU'
export SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Z2ptYWVsZ2xnaG5sYWhxcGJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MDY1MTAsImV4cCI6MjA2NTE4MjUxMH0.wGEnhyYJeLcn5itzuxmn8PQ1V5-Q_SBeO9CFXV6iZ3I'

# Redis Configuration - NON-TLS (TLS fails, non-TLS tested and working)
export REDIS_URL='redis://default:uYu9N5O1MH1aiHIH7DMS9z0v1zsyIipU@redis-17514.c92.us-east-1-3.ec2.redns.redis-cloud.com:17514'
export REDIS_PREFIX='prod:'

# App Environment Configuration - PRODUCTION
export APP_ENV='production'
export LIVE_POSTS='true'
export APP_SCHEMA_VERSION='1'
export PROD_URL='https://xbot-production.up.railway.app'

echo "🚀 Production CLI environment loaded successfully"
echo "📋 Configuration: APP_ENV=$APP_ENV, LIVE_POSTS=$LIVE_POSTS, REDIS_PREFIX=$REDIS_PREFIX"
echo "⚠️  WARNING: PRODUCTION ENVIRONMENT - LIVE POSTS ENABLED!"