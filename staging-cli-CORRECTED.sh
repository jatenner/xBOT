#!/bin/bash
# ================================================
# STAGING ENVIRONMENT - CLI SAFE CONFIGURATION
# ================================================
# Usage: source staging-cli-CORRECTED.sh

# Staging Supabase Configuration
export STAGING_PROJECT_REF='uokidymvzfkxwvxlpnfu'
export STAGING_DB_PASSWORD='ChristopherNolanfan123!'
export SUPABASE_URL='https://uokidymvzfkxwvxlpnfu.supabase.co'
export SUPABASE_ACCESS_TOKEN='sbp_d6fed4a8ceff1795b6a3c27bcb8bca75ee7e7fe7'
export SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVva2lkeW12emZreHd2eGxwbmZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkzODMwNywiZXhwIjoyMDcwNTE0MzA3fQ.fyURzMyO-3pVK0-lQC2fHKG0uebNo27Zm_NPZnHKEdM'
export SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVva2lkeW12emZreHd2eGxwbmZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MzgzMDcsImV4cCI6MjA3MDUxNDMwN30.pRnMAP8CDYlPOPm7whloPdtpdTE8BGObm8Uidg7P4tQ'

# Redis Configuration - NON-TLS (tested and working)
export REDIS_URL='redis://default:uYu9N5O1MH1aiHIH7DMS9z0v1zsyIipU@redis-17514.c92.us-east-1-3.ec2.redns.redis-cloud.com:17514'
export REDIS_PREFIX='stg:'

# App Environment Configuration
export APP_ENV='staging'
export LIVE_POSTS='false'
export APP_SCHEMA_VERSION='1'

echo "✅ Staging CLI environment loaded successfully"
echo "📋 Configuration: APP_ENV=$APP_ENV, LIVE_POSTS=$LIVE_POSTS, REDIS_PREFIX=$REDIS_PREFIX"