#!/bin/bash

echo "⏳ WAITING FOR RAILWAY DEPLOYMENT"
echo "=================================="
echo ""

DB='postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require'

echo "🔗 Build logs: https://railway.com/project/c987ff2e-2bc7-4c65-9187-11c1a82d4ac1/service/21eb1b60-57f1-40fe-bd0e-d589345fc37f"
echo ""
echo "⏱️  Waiting 90 seconds for build + deploy..."

for i in {90..1}; do
  printf "\r   ⏳ %2d seconds remaining..." $i
  sleep 1
done

echo ""
echo ""
echo "✅ Deployment should be complete!"
echo ""

echo "🔍 Checking if posting cycle has run..."
sleep 5

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

QUEUED=$(psql "$DB" -t -c "
  SELECT COUNT(*) 
  FROM content_metadata 
  WHERE status = 'queued' 
  AND generation_source = 'real'
  AND scheduled_at <= NOW();
")

echo ""
echo "📊 CURRENT STATUS:"
echo "   Posted: $POSTED"
echo "   Failed: $FAILED"
echo "   Still Queued: $QUEUED"
echo ""

if [ "$POSTED" -gt 0 ]; then
  echo "🎉🎉🎉 SUCCESS! TWEETS ARE POSTING! 🎉🎉🎉"
  echo ""
  echo "Recent posts:"
  psql "$DB" -c "
    SELECT 
      SUBSTRING(content, 1, 70) || '...' as tweet,
      generated_at as posted_at
    FROM content_metadata 
    WHERE status = 'posted' 
    AND generated_at > NOW() - INTERVAL '5 minutes'
    ORDER BY generated_at DESC
    LIMIT 3;
  "
  echo ""
  echo "🐦 CHECK YOUR TWITTER FEED!"
  
elif [ "$FAILED" -gt 0 ]; then
  echo "⚠️ Posts failed. Checking Railway logs for errors..."
  echo ""
  echo "Run: npm run logs"
  
else
  echo "⏳ No posting activity yet."
  echo ""
  echo "💡 Next steps:"
  echo "   1. Posting cycle runs every 5 minutes"
  echo "   2. Next cycle should be in 0-5 minutes"
  echo "   3. Run this command to watch live:"
  echo "      watch -n 10 'psql \"$DB\" -t -c \"SELECT status, COUNT(*) FROM content_metadata WHERE generated_at > NOW() - INTERVAL \047 10 minutes\047 GROUP BY status\"'"
  echo ""
  echo "   Or watch Railway logs:"
  echo "      npm run logs"
fi

