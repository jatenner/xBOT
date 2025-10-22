#!/bin/bash

echo "🔧 DATABASE FIXES - Quick Apply Guide"
echo "======================================"
echo ""
echo "📋 Step 1: Copy the SQL below"
echo "📋 Step 2: Open Supabase SQL Editor: https://supabase.com/dashboard/project/qtgjmaelglghnlahqpbl/sql/new"
echo "📋 Step 3: Paste and run the SQL"
echo ""
echo "Press ENTER to display the SQL..."
read

cat supabase/migrations/20251022_fix_missing_columns.sql

echo ""
echo "======================================"
echo "✅ After running in Supabase, this will fix:"
echo "   1. JOB_OUTCOMES_REAL (missing generation_source column)"
echo "   2. Metrics storage (missing er_calculated column)"
echo "   3. Learning system (missing updated_at column)"
echo "   4. Tweet tracking (missing created_at column)"
echo "   5. Comprehensive metrics upsert errors"
echo ""
echo "💡 Or run this command to open Supabase automatically:"
echo "   open 'https://supabase.com/dashboard/project/qtgjmaelglghnlahqpbl/sql/new'"

