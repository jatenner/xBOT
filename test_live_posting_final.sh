#!/bin/bash

set -e

DB='postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require'

echo "🎯 FINAL LIVE POSTING TEST"
echo "=========================="
echo ""

echo "Step 1: Generating fresh content with plan job on Railway..."
railway run bash -c 'npm run job:plan' 2>&1 | grep -E "queued|PLAN_JOB" | tail -5

echo ""
echo "Step 2: Verifying content is queued..."
sleep 3

QUEUED=$(psql "$DB" -t -c "
  SELECT COUNT(*) 
  FROM content_metadata 
  WHERE status = 'queued' 
  AND generation_source = 'real'
  AND scheduled_at <= NOW() + INTERVAL '5 minutes';
")

echo "   Found $QUEUED queued tweets"

if [ "$QUEUED" -lt 1 ]; then
  echo "   ❌ No content queued! Something went wrong with plan job."
  exit 1
fi

echo ""
echo "Step 3: Updating scheduled_at to NOW for immediate posting..."
psql "$DB" -c "
  UPDATE content_metadata 
  SET scheduled_at = NOW() 
  WHERE status = 'queued' 
  AND scheduled_at > NOW()
  RETURNING SUBSTRING(content, 1, 50) as preview;
" | tail -5

echo ""
echo "Step 4: Waiting for next posting cycle (up to 5 min)..."
echo "   Posting runs every 5 minutes automatically"
echo ""

# Watch for 3 minutes
for i in {18..1}; do
  POSTED=$(psql "$DB" -t -c "SELECT COUNT(*) FROM content_metadata WHERE status = 'posted' AND generated_at > NOW() - INTERVAL '2 minutes';")
  FAILED=$(psql "$DB" -t -c "SELECT COUNT(*) FROM content_metadata WHERE status = 'failed' AND generated_at > NOW() - INTERVAL '2 minutes';")
  QUEUED_NOW=$(psql "$DB" -t -c "SELECT COUNT(*) FROM content_metadata WHERE status = 'queued' AND scheduled_at <= NOW();")
  
  printf "\r[%02d:%02d] Queued: %s | Posted: %s | Failed: %s" $((i/6)) $((i%6*10)) "$QUEUED_NOW" "$POSTED" "$FAILED"
  
  if [ "$POSTED" -gt 0 ]; then
    echo ""
    echo ""
    echo "🎉🎉🎉 SUCCESS! TWEET POSTED TO TWITTER! 🎉🎉🎉"
    echo ""
    psql "$DB" -c "
      SELECT 
        SUBSTRING(content, 1, 70) || '...' as tweet,
        generated_at
      FROM content_metadata 
      WHERE status = 'posted' 
      AND generated_at > NOW() - INTERVAL '2 minutes'
      LIMIT 1;
    "
    echo ""
    echo "🐦 Go check your Twitter feed NOW!"
    exit 0
  fi
  
  if [ "$FAILED" -gt 0 ]; then
    echo ""
    echo ""
    echo "⚠️ Tweet FAILED. Need to check Railway logs for error."
    echo ""
    echo "Run: npm run logs"
    exit 1
  fi
  
  sleep 10
done

echo ""
echo ""
echo "⏳ No activity in 3 minutes. Posting cycle may not have run yet."
echo "   Next cycle in 0-5 minutes."
echo ""
echo "Monitor with: npm run logs"

