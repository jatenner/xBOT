#!/bin/bash
set -e

echo "🚀 RAILWAY_START: Beginning startup sequence..."

# Step 1: Run migrations (with timeout safety)
echo "📊 RAILWAY_START: Running migrations..."
timeout 5s node -r dotenv/config scripts/migrate-bulletproof.js dotenv_config_path=.env || {
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    echo "⏱️ RAILWAY_START: Migration timeout (5s) - continuing anyway"
  else
    echo "⚠️ RAILWAY_START: Migrations failed (exit $EXIT_CODE) - continuing anyway"
  fi
}

# Step 2: Start the app (always runs)
echo "✅ RAILWAY_START: Starting application..."
exec node -r dotenv/config dist/src/main-bulletproof.js dotenv_config_path=.env

