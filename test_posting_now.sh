#!/bin/bash

# 🧪 Complete Posting Test
# This script will:
# 1. Clear old content
# 2. Create a unique test tweet
# 3. Wait for posting cycle
# 4. Verify results

set -e

echo "🧹 Step 1: Clearing old/failed content..."
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << 'EOF'
DELETE FROM content_metadata WHERE status IN ('queued', 'failed');
EOF

echo ""
echo "✅ Cleared old content"
echo ""

echo "📝 Step 2: Creating unique test tweet..."
TIMESTAMP=$(date +%s)
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << EOF
INSERT INTO content_metadata (id, content_id, content, status, scheduled_at, generation_source, quality_score, topic)
VALUES (
  'test-${TIMESTAMP}',
  'test-${TIMESTAMP}',
  '💡 Health Tip #${TIMESTAMP}: Regular sleep patterns strengthen your immune system! Aim for 7-9 hours nightly. Your body repairs itself during deep sleep phases. #HealthTech #WellnessWednesday',
  'queued',
  NOW() - INTERVAL '1 minute',
  'real',
  90,
  'sleep'
);
EOF

echo ""
echo "✅ Test tweet created and queued"
echo ""

echo "⏳ Step 3: Waiting for next posting cycle (~2 minutes)..."
echo "   The posting job runs every 5 minutes"
echo "   Watching Railway logs for activity..."
echo ""

# Start log monitoring in background
railway logs 2>&1 | grep --line-buffered -E "(POSTING_QUEUE|SESSION.*passed|SESSION.*failed|Posted.*decisions)" &
LOGS_PID=$!

# Wait 2 minutes
sleep 120

# Kill logs
kill $LOGS_PID 2>/dev/null || true

echo ""
echo "✅ Step 4: Checking results..."
echo ""

psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << 'EOF'
SELECT 
  CASE 
    WHEN status = 'posted' THEN '✅ SUCCESS'
    WHEN status = 'failed' THEN '❌ FAILED'
    WHEN status = 'queued' THEN '⏳ STILL QUEUED'
    ELSE status
  END as result,
  LEFT(content, 60) as preview,
  posted_at
FROM content_metadata
WHERE id LIKE 'test-%'
ORDER BY generated_at DESC
LIMIT 1;
EOF

echo ""
echo "================================================"
echo "📊 FINAL STATUS:"
echo "   ✅ = Tweet posted successfully"
echo "   ❌ = Failed (check Railway logs for error)"  
echo "   ⏳ = Still waiting (run script again)"
echo "================================================"

