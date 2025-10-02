#!/bin/bash

echo "🔴 LIVE MONITORING - Watching for Twitter Posts"
echo "=============================================="
echo ""
echo "✅ 6 tweets queued and ready"
echo "⏰ Posting cycle runs every 5 minutes"
echo "🎯 Watching for status changes..."
echo ""
echo "Press Ctrl+C to stop"
echo ""

LAST_POSTED=0

while true; do
  # Check current status
  RESULT=$(psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "
    SELECT 
      COALESCE(SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END), 0) as queued,
      COALESCE(SUM(CASE WHEN status='posted' THEN 1 ELSE 0 END), 0) as posted,
      COALESCE(SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END), 0) as failed
    FROM content_metadata 
    WHERE generated_at > NOW() - INTERVAL '15 minutes';
  " 2>/dev/null)
  
  QUEUED=$(echo $RESULT | awk '{print $1}')
  POSTED=$(echo $RESULT | awk '{print $2}')
  FAILED=$(echo $RESULT | awk '{print $3}')
  
  TIMESTAMP=$(date '+%I:%M:%S %p')
  
  printf "\r[$TIMESTAMP] Queued: $QUEUED | Posted: $POSTED | Failed: $FAILED"
  
  # Alert on change
  if [ "$POSTED" -gt "$LAST_POSTED" ]; then
    echo ""
    echo ""
    echo "🎉🎉🎉 SUCCESS! NEW POSTS DETECTED! 🎉🎉🎉"
    echo ""
    echo "📝 Recently posted tweets:"
    psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -c "
      SELECT 
        SUBSTRING(content, 1, 70) || '...' as tweet,
        generated_at as posted_at
      FROM content_metadata 
      WHERE status = 'posted' 
      AND generated_at > NOW() - INTERVAL '10 minutes'
      ORDER BY generated_at DESC
      LIMIT 5;
    " 2>/dev/null
    echo ""
    echo "🐦 CHECK YOUR TWITTER FEED NOW!"
    echo "   https://twitter.com/YourUsername"
    echo ""
    break
  fi
  
  if [ "$FAILED" -gt 0 ]; then
    echo ""
    echo ""
    echo "⚠️ WARNING: $FAILED tweets failed!"
    echo "   Check Railway logs for errors: npm run logs"
    echo ""
  fi
  
  LAST_POSTED=$POSTED
  sleep 10
done

