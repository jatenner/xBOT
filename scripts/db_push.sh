#!/bin/bash

# 🚀 Growth Loop Database Migration Script
# Pushes the growth metrics schema to Supabase

set -e

echo "🚀 GROWTH LOOP DATABASE MIGRATION"
echo "================================="

# Check if environment variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    echo "Example: export SUPABASE_URL='https://your-project.supabase.co'"
    echo "         export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
    exit 1
fi

# Migration file path
MIGRATION_FILE="migrations/20250625_growth_metrics.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📂 Migration file: $MIGRATION_FILE"
echo "🎯 Target database: $SUPABASE_URL"

# Construct the connection URL
DB_URL="${SUPABASE_URL}/rest/v1/rpc/exec_sql"

echo "🔄 Applying growth metrics migration..."

# Read the SQL file and execute it
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Use curl to execute the SQL via Supabase REST API
RESPONSE=$(curl -s -X POST "$DB_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -d "{\"sql\": $(echo "$SQL_CONTENT" | jq -Rs .)}")

# Check if the response contains an error
if echo "$RESPONSE" | grep -q "error"; then
    echo "❌ Migration failed:"
    echo "$RESPONSE" | jq -r '.error.message // .message // .'
    exit 1
else
    echo "✅ Migration applied successfully!"
    echo "📊 Growth metrics tables created:"
    echo "   - growth_metrics (F/1K tracking)"
    echo "   - follow_actions (rate limiting)"
    echo "   - style_rewards (ε-greedy learning)"
    echo "   - incr_metric() function"
fi

echo ""
echo "🎯 Next steps:"
echo "1. Deploy your application with GROWTH_LOOP_ENABLED=true"
echo "2. Monitor metrics at /metrics endpoint"
echo "3. Check Grafana dashboard for F/1K optimization"
echo ""
echo "✅ Growth loop database ready for autonomous optimization!" 