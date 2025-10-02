#!/bin/bash
# Quick status check - no stalling!

echo "🔍 QUICK STATUS CHECK"
echo "===================="
echo ""

# Check if Railway deployment is complete
echo "📦 Railway Deployment:"
railway status 2>&1 | grep -E "(Active|Building)" | head -3
echo ""

# Check database for recent posts
echo "📊 Recent Posts (last 10 min):"
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "
SELECT 
  COALESCE(COUNT(*), 0) as posted_count,
  COALESCE(MAX(generated_at)::text, 'none') as last_post
FROM content_metadata 
WHERE status = 'posted' 
AND generated_at > NOW() - INTERVAL '10 minutes';
" 2>/dev/null || echo "   ❌ Database connection failed"

echo ""
echo "📈 Queued Content Ready:"
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "
SELECT COUNT(*) 
FROM content_metadata 
WHERE status = 'queued' 
AND scheduled_at <= NOW();
" 2>/dev/null || echo "   ❌ Database connection failed"

echo ""
echo "⏰ What's Next:"
echo "   • Posting runs every 5 minutes"
echo "   • Next cycle: $(date -v+5M '+%I:%M %p')"
echo "   • Watch live: npm run logs"
