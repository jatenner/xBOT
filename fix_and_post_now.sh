#!/bin/bash

set -e

echo "🔧 FIXING AND POSTING NOW"
echo "========================="
echo ""

DB='postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require'

echo "Step 1: Checking generation_source..."
psql "$DB" -t -c "
  SELECT 
    generation_source, 
    COUNT(*) 
  FROM content_metadata 
  WHERE status = 'queued' 
  GROUP BY generation_source;
"

echo ""
echo "Step 2: Ensuring all queued items have generation_source='real'..."
psql "$DB" -c "
  UPDATE content_metadata 
  SET generation_source = 'real' 
  WHERE status = 'queued' 
  AND (generation_source IS NULL OR generation_source != 'real')
  RETURNING id;
" | grep "UPDATE"

echo ""
echo "Step 3: Verifying query matches posting queue logic..."
READY=$(psql "$DB" -t -c "
  SELECT COUNT(*) 
  FROM content_metadata 
  WHERE status = 'queued' 
  AND generation_source = 'real' 
  AND scheduled_at <= NOW();
")

echo "   ✅ Found $READY tweets matching posting queue criteria"

if [ "$READY" -lt 1 ]; then
  echo "   ❌ No tweets ready! Scheduling all queued items for NOW..."
  psql "$DB" -c "
    UPDATE content_metadata 
    SET scheduled_at = NOW() 
    WHERE status = 'queued';
  " | grep "UPDATE"
fi

echo ""
echo "Step 4: Testing posting orchestrator locally (to see exact error)..."
echo ""

cd /Users/jonahtenner/Desktop/xBOT

# Run posting job locally to see the actual error
npm run job:posting 2>&1 | tee /tmp/posting_output.txt

echo ""
echo ""
echo "📊 RESULTS:"
echo ""

# Check what happened
POSTED=$(psql "$DB" -t -c "
  SELECT COUNT(*) 
  FROM content_metadata 
  WHERE status = 'posted' 
  AND generated_at > NOW() - INTERVAL '5 minutes';
")

FAILED=$(psql "$DB" -t -c "
  SELECT COUNT(*) 
  FROM content_metadata 
  WHERE status = 'failed' 
  AND generated_at > NOW() - INTERVAL '5 minutes';
")

echo "Posts succeeded: $POSTED"
echo "Posts failed: $FAILED"
echo ""

if [ "$POSTED" -gt 0 ]; then
  echo "🎉 SUCCESS! Tweets posted!"
  echo ""
  echo "Posted tweets:"
  psql "$DB" -c "
    SELECT 
      SUBSTRING(content, 1, 60) || '...' as tweet,
      generated_at
    FROM content_metadata 
    WHERE status = 'posted' 
    AND generated_at > NOW() - INTERVAL '5 minutes'
    LIMIT 3;
  "
else
  echo "❌ No posts succeeded. Check the output above for errors."
  echo ""
  echo "💡 Look for these error patterns:"
  echo "   • 'browser closed' → Browser initialization issue"
  echo "   • 'constraint violation' → Database schema issue"  
  echo "   • 'No decisions' → Query filter issue"
  echo "   • 'session' → Twitter login expired"
fi

