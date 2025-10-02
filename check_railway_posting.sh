#!/bin/bash

echo "🔍 CHECKING RAILWAY POSTING STATUS"
echo "===================================="
echo ""

echo "Step 1: Verifying Railway has Supabase credentials..."
railway variables 2>&1 | grep -E "^SUPABASE" | wc -l | xargs -I {} echo "   Found {} Supabase variables"

echo ""
echo "Step 2: Checking database for ready content..."
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "
  SELECT 
    COUNT(*) as ready_count
  FROM content_metadata 
  WHERE status = 'queued' 
  AND generation_source = 'real' 
  AND scheduled_at <= NOW();
"

echo ""
echo "Step 3: Getting latest Railway logs (last 50 lines)..."
echo ""

# Get logs without following
railway logs 2>&1 | grep -v "^$" | tail -50

echo ""
echo "================================"
echo ""
echo "🎯 What to look for in logs above:"
echo "   ✅ '[POSTING_QUEUE] 📮 Processing'"
echo "   ✅ 'Tweet posted successfully'"
echo "   ❌ 'browser closed'"
echo "   ❌ 'constraint violation'"
echo "   ℹ️  'No decisions ready'"

