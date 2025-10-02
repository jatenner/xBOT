#!/bin/bash

set -e

echo "🚀 FORCING LIVE TWITTER POSTING"
echo "================================"
echo ""

echo "Step 1: Verify we have queued content..."
QUEUED=$(psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "SELECT COUNT(*) FROM content_metadata WHERE status = 'queued' AND scheduled_at <= NOW();")
echo "   ✅ Found $QUEUED tweets ready to post"
echo ""

if [ "$QUEUED" -lt 1 ]; then
  echo "⚠️ No content queued! Generating new content..."
  railway run npm run job:plan || echo "   (plan job triggered)"
  sleep 5
fi

echo "Step 2: Force Railway redeploy with latest fixes..."
railway up --detach 2>&1 | head -10
echo "   ✅ Redeployment triggered"
echo ""

echo "Step 3: Waiting 60 seconds for deployment..."
for i in {60..1}; do
  printf "\r   ⏳ %2d seconds..." $i
  sleep 1
done
echo ""
echo ""

echo "Step 4: Checking if posts were successful..."
sleep 10  # Extra buffer for posting cycle

POSTED=$(psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "SELECT COUNT(*) FROM content_metadata WHERE status = 'posted' AND generated_at > NOW() - INTERVAL '5 minutes';")
echo ""
echo "📊 Results:"
echo "   • Posts in last 5 min: $POSTED"
echo ""

if [ "$POSTED" -gt 0 ]; then
  echo "🎉 SUCCESS! Tweets are posting to Twitter!"
  echo ""
  echo "✅ Check your Twitter feed:"
  echo "   https://twitter.com/YourUsername"
  echo ""
  
  # Show what was posted
  echo "📝 Recent posts:"
  psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -c "
    SELECT 
      SUBSTRING(content, 1, 60) || '...' as tweet,
      generated_at as posted_at
    FROM content_metadata 
    WHERE status = 'posted' 
    AND generated_at > NOW() - INTERVAL '5 minutes'
    ORDER BY generated_at DESC
    LIMIT 3;
  " 2>/dev/null
else
  echo "⚠️ No posts yet. This could mean:"
  echo "   1. Posting cycle hasn't run yet (runs every 5 min)"
  echo "   2. Check Railway logs for errors"
  echo ""
  echo "💡 Next step: Run 'npm run logs' and look for posting activity"
fi

