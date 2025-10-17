#!/bin/bash
source .env

# Extract project ref from SUPABASE_URL (e.g., https://xxxxx.supabase.co -> xxxxx)
PROJECT_REF=$(echo "$SUPABASE_URL" | sed 's|https://||' | sed 's|\.supabase\.co.*||')

echo "🔍 Detected Project Ref: $PROJECT_REF"
echo ""
echo "📋 Your Supabase connection details:"
echo "   Project URL: $SUPABASE_URL"
echo "   Project Ref: $PROJECT_REF"
echo ""
echo "🔧 To apply migrations automatically, you need:"
echo "   1. Your database password"
echo "   2. Then run: supabase db push --db-url 'postgresql://postgres:PASSWORD@db.$PROJECT_REF.supabase.co:5432/postgres'"
echo ""
echo "💡 OR use supabase link (simpler):"
echo "   supabase link --project-ref $PROJECT_REF"
echo "   (Will prompt for database password)"
echo ""
echo "📊 OR manually apply via Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/sql"
echo ""
