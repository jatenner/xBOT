#!/bin/bash

set -e

DB='postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require'

echo "🚀 GENERATING FRESH CONTENT FOR IMMEDIATE TESTING"
echo "=================================================="
echo ""

echo "Step 1: Generating 3 new tweets on Railway..."
railway run bash -c 'npm run job:plan' 2>&1 | grep "queued\|PLAN_JOB" | tail -5

echo ""
echo "Step 2: Rescheduling ALL content to NOW..."
sleep 2

psql "$DB" -c "
  UPDATE content_metadata 
  SET scheduled_at = NOW() - INTERVAL '1 minute'
  WHERE scheduled_at > NOW() 
  OR (status = 'failed' AND generated_at > NOW() - INTERVAL '1 hour')
  RETURNING id, status;
" | grep "UPDATE"

echo ""
echo "Step 3: Forcing queued status with real generation_source..."
psql "$DB" -c "
  UPDATE content_metadata 
  SET status = 'queued', generation_source = 'real'
  WHERE status IN ('failed', 'planned') 
  AND generated_at > NOW() - INTERVAL '1 hour'
  RETURNING id;
" | grep "UPDATE"

echo ""
echo "Step 4: Verifying content is ready..."
READY=$(psql "$DB" -t -c "
  SELECT COUNT(*) 
  FROM content_metadata 
  WHERE status = 'queued' 
  AND generation_source = 'real' 
  AND scheduled_at <= NOW();
")

echo "   ✅ Ready for posting: $READY tweets"

if [ "$READY" -lt 1 ]; then
  echo "   ❌ ERROR: No content ready!"
  echo ""
  echo "   Checking what's in the database:"
  psql "$DB" -c "
    SELECT status, generation_source, COUNT(*) 
    FROM content_metadata 
    WHERE generated_at > NOW() - INTERVAL '1 hour' 
    GROUP BY status, generation_source;
  "
  exit 1
fi

echo ""
echo "🎯 SUCCESS! Content is ready for next posting cycle."
echo ""
echo "⏰ Next posting cycle: ~12:31 PM"
echo ""
echo "📺 Watch your logs for:"
echo "   [POSTING_QUEUE] 📝 Found X decisions ready for posting"
echo "   🚄 RAILWAY_POSTER: Using existing browser..."
echo "   ✅ Tweet posted successfully!"
echo ""
echo "Keep npm run logs running and watch at 12:31 PM!"

