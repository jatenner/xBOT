#!/bin/bash

# Migration Pipeline Setup Script
# Run this to initialize your automated migration system

set -e

echo "🚀 Setting up xBOT Migration Pipeline..."

# Create docs directory if it doesn't exist
mkdir -p docs

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not in a git repository. Please run from your project root."
    exit 1
fi

# Check if supabase/migrations directory exists
if [ ! -d "supabase/migrations" ]; then
    echo "❌ supabase/migrations directory not found. Did you run this from the right directory?"
    exit 1
fi

echo "✅ Directory structure looks good"

# Check if baseline migration exists
if [ ! -f "supabase/migrations/00_baseline.sql" ]; then
    echo "❌ Baseline migration not found. This should have been created by the setup."
    exit 1
fi

echo "✅ Baseline migration found"

# Check if GitHub workflow exists
if [ ! -f ".github/workflows/migrate.yml" ]; then
    echo "❌ GitHub workflow not found. This should have been created by the setup."
    exit 1
fi

echo "✅ GitHub workflow found"

# Test SQL files syntax (basic check)
echo "🔍 Testing SQL file syntax..."

for sql_file in supabase/migrations/*.sql; do
    if [ -f "$sql_file" ]; then
        # Basic syntax check - look for obvious issues
        if grep -q "BEGIN;" "$sql_file" && grep -q "COMMIT;" "$sql_file"; then
            echo "  ✅ $(basename "$sql_file") - looks good"
        elif [[ "$(basename "$sql_file")" == "verify.sql" ]] || [[ "$(basename "$sql_file")" == "drift_check.sql" ]]; then
            echo "  ✅ $(basename "$sql_file") - verification script (no transaction needed)"
        else
            echo "  ⚠️  $(basename "$sql_file") - missing transaction block (consider adding BEGIN/COMMIT)"
        fi
    fi
done

echo ""
echo "🎯 Setup Complete! Next steps:"
echo ""
echo "1. Set up GitHub secrets (see docs/migration-secrets-setup.md):"
echo "   - SUPABASE_ACCESS_TOKEN"
echo "   - STAGING_PROJECT_REF" 
echo "   - PRODUCTION_PROJECT_REF"
echo "   - STAGING_DB_URL"
echo "   - PRODUCTION_DB_URL"
echo ""
echo "2. Configure GitHub environments:"
echo "   - staging (auto-deploy)"
echo "   - production (manual approval)"
echo ""
echo "3. Test the pipeline:"
echo "   - Create a test migration in a branch"
echo "   - Open a pull request"
echo "   - Watch the shadow testing run"
echo "   - Merge to trigger staging deployment"
echo ""
echo "📚 Full documentation: docs/migrations.md"
echo ""
echo "🎉 You're ready to deploy database changes safely!"