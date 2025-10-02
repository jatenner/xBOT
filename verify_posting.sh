#!/bin/bash

echo "🔍 POSTING VERIFICATION (No Stalling)"
echo "====================================="
echo ""

echo "1️⃣ Railway Status:"
railway status | head -5

echo ""
echo "2️⃣ Posted Tweets (Last 10 min):"
POSTED=$(psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "SELECT COUNT(*) FROM content_metadata WHERE status = 'posted' AND generated_at > NOW() - INTERVAL '10 minutes';")

echo "   Count: $POSTED"

if [ "$POSTED" -gt 0 ]; then
  echo "   🎉 SUCCESS! Posting is working!"
  psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -c "SELECT LEFT(content, 60) as tweet, posted_at FROM content_metadata WHERE status = 'posted' ORDER BY posted_at DESC LIMIT 3;"
else
  echo "   ⏳ No posts yet. Status:"
  psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "SELECT 'Queued: ' || COUNT(*) FROM content_metadata WHERE status = 'queued';"
  psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "SELECT 'Failed: ' || COUNT(*) FROM content_metadata WHERE status = 'failed' AND generated_at > NOW() - INTERVAL '10 minutes';"
  echo ""
  echo "   Try again in 5 minutes (next auto-post cycle)"
fi

echo ""
echo "✅ Check complete (no stalling!)"

