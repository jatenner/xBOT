#!/bin/bash
# scripts/setup-env.sh - Environment validation and setup guidance

echo "🔍 xBOT Environment Setup & Validation"
echo "======================================="

# Critical environment variables (presence check only)
CRITICAL_ENVS=(
  "DATABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY" 
  "OPENAI_API_KEY"
  "REDIS_URL"
)

# Optional but recommended
OPTIONAL_ENVS=(
  "SUPABASE_URL"
  "DB_SSL_MODE"
  "MIGRATION_SSL_MODE"
  "ALLOW_SSL_FALLBACK"
  "NODE_ENV"
  "POSTING_DISABLED"
)

missing_critical=0
missing_optional=0

echo "📋 Critical Environment Variables:"
for env in "${CRITICAL_ENVS[@]}"; do
  if [ -z "${!env}" ]; then
    echo "❌ $env: MISSING"
    missing_critical=$((missing_critical + 1))
  else
    echo "✅ $env: present"
  fi
done

echo ""
echo "📋 Optional Environment Variables:"
for env in "${OPTIONAL_ENVS[@]}"; do
  if [ -z "${!env}" ]; then
    echo "⚠️  $env: not set"
    missing_optional=$((missing_optional + 1))
  else
    # Show actual value for non-secret configs
    if [[ "$env" == "DB_SSL_MODE" || "$env" == "MIGRATION_SSL_MODE" || "$env" == "ALLOW_SSL_FALLBACK" || "$env" == "NODE_ENV" || "$env" == "POSTING_DISABLED" ]]; then
      echo "✅ $env: ${!env}"
    else
      echo "✅ $env: present"
    fi
  fi
done

echo ""
echo "======================================="

if [ $missing_critical -gt 0 ]; then
  echo "❌ Missing $missing_critical critical environment variables"
  echo ""
  echo "🛠️  To fix (Railway):"
  echo "   railway variables set DATABASE_URL=\"postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require\""
  echo "   railway variables set SUPABASE_SERVICE_ROLE_KEY=\"eyJ...\""
  echo "   railway variables set OPENAI_API_KEY=\"sk-...\""
  echo "   railway variables set REDIS_URL=\"redis://...\""
  echo ""
  echo "🛠️  To fix (Local):"
  echo "   Copy .env.example to .env and fill in the values"
  exit 1
else
  echo "✅ All critical environment variables present"
fi

if [ $missing_optional -gt 0 ]; then
  echo "⚠️  $missing_optional optional variables not set (using defaults)"
  echo ""
  echo "📝 Recommended settings:"
  echo "   DB_SSL_MODE=require"
  echo "   MIGRATION_SSL_MODE=require" 
  echo "   ALLOW_SSL_FALLBACK=true"
  echo "   NODE_ENV=production"
  echo "   POSTING_DISABLED=true"
fi

# Database URL validation
if [ -n "$DATABASE_URL" ]; then
  echo ""
  echo "📊 Database URL Analysis:"
  
  if [[ "$DATABASE_URL" == *":6543"* ]]; then
    echo "✅ Transaction Pooler detected (port 6543)"
  else
    echo "⚠️  Direct connection detected (not using Transaction Pooler)"
  fi
  
  if [[ "$DATABASE_URL" == *"sslmode=require"* ]]; then
    echo "✅ SSL mode: require"
  else
    echo "⚠️  SSL mode not specified or not 'require'"
  fi
fi

echo ""
echo "🎯 Setup validation complete"
echo ""
echo "📚 Next steps:"
echo "   1. Run: npm run diagnostics"
echo "   2. Run: npm run build"
echo "   3. Test: npm start (local) or deploy to Railway"
echo "   4. When ready: set POSTING_DISABLED=false"