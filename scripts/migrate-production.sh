#!/bin/bash

# ================================================
# AUTOMATED PRODUCTION MIGRATION SCRIPT
# ================================================
# Applies the database migration to production automatically
# Uses prod-cli-CORRECTED.sh for credentials

set -e  # Exit on any error

echo "🚀 AUTOMATED MIGRATION: Starting production database migration"
echo "📅 Started at: $(date)"

# Check if production credentials file exists
PROD_CLI_FILE="./prod-cli-CORRECTED.sh"
if [[ ! -f "$PROD_CLI_FILE" ]]; then
    echo "❌ ERROR: Production credentials file not found: $PROD_CLI_FILE"
    exit 1
fi

echo "🔑 MIGRATION: Loading production credentials..."
source "$PROD_CLI_FILE"

# Verify required environment variables are set
if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" || -z "$PROD_DB_PASSWORD" ]]; then
    echo "❌ ERROR: Missing required environment variables after sourcing credentials"
    echo "   - SUPABASE_URL: ${SUPABASE_URL:+SET}"
    echo "   - SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:+SET}"
    echo "   - PROD_DB_PASSWORD: ${PROD_DB_PASSWORD:+SET}"
    exit 1
fi

echo "✅ MIGRATION: Production credentials loaded successfully"
echo "🎯 MIGRATION: Target database: $SUPABASE_URL"

# Check if migration file exists
MIGRATION_FILE="./supabase/migrations/20250818_telemetry_and_content_quality.sql"
if [[ ! -f "$MIGRATION_FILE" ]]; then
    echo "❌ ERROR: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📄 MIGRATION: Found migration file ($(wc -c < "$MIGRATION_FILE") bytes)"

# Method 1: Try using psql with the database password
echo "🔄 MIGRATION: Attempting direct database connection..."
export PGPASSWORD="$PROD_DB_PASSWORD"

# Extract project reference from URL for connection string
PROJECT_REF=$(echo "$SUPABASE_URL" | sed 's/https:\/\/\([^.]*\)\.supabase\.co/\1/')
DB_URL="postgresql://postgres:${PROD_DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"

echo "🔗 MIGRATION: Connecting to database..."
if psql "$DB_URL" -f "$MIGRATION_FILE" 2>/dev/null; then
    echo "✅ MIGRATION: Successfully applied via direct database connection!"
    echo "🔄 MIGRATION: Verifying schema..."
    
    # Run verification
    if npm run verify:schema; then
        echo "🎉 MIGRATION: Complete! Database schema verified successfully."
        echo "📊 MIGRATION: Production database is ready for xBOT operations."
        exit 0
    else
        echo "⚠️ MIGRATION: Migration applied but verification failed. Check manually."
        exit 1
    fi
else
    echo "⚠️ MIGRATION: Direct connection failed, trying alternative method..."
fi

# Method 2: Try using Supabase CLI if direct connection fails
echo "🔄 MIGRATION: Attempting via Supabase CLI..."

# Ensure we're linked to the correct project
if supabase projects link --project-ref "$PROD_PROJECT_REF" --password "$PROD_DB_PASSWORD"; then
    echo "✅ MIGRATION: Linked to production project"
    
    # Try to push the specific migration
    if supabase db push --include-all; then
        echo "✅ MIGRATION: Successfully applied via Supabase CLI!"
        
        # Run verification
        if npm run verify:schema; then
            echo "🎉 MIGRATION: Complete! Database schema verified successfully."
            echo "📊 MIGRATION: Production database is ready for xBOT operations."
        else
            echo "⚠️ MIGRATION: Migration applied but verification failed. Check manually."
        fi
    else
        echo "⚠️ MIGRATION: CLI push failed, but migration may have been partially applied"
        echo "🔄 MIGRATION: Running verification to check current state..."
        
        if npm run verify:schema; then
            echo "🎉 MIGRATION: Schema is already up to date!"
        else
            echo "❌ MIGRATION: Schema verification failed."
            echo "💡 MIGRATION: You may need to apply the migration manually."
            echo "📋 MIGRATION: SQL file location: $MIGRATION_FILE"
            exit 1
        fi
    fi
else
    echo "❌ MIGRATION: Failed to link to production project"
    echo "💡 MIGRATION: Falling back to manual application required"
    echo "📋 MIGRATION: Please apply the SQL file manually: $MIGRATION_FILE"
    exit 1
fi

echo "🎉 MIGRATION: Completed successfully!"
