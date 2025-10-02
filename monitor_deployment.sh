#!/bin/bash

echo "🚀 RAILWAY DEPLOYMENT MONITOR"
echo "=============================="
echo ""
echo "✅ Code pushed to GitHub"
echo "⏳ Waiting for Railway to rebuild..."
echo ""
echo "This script will:"
echo "  1. Wait 3 minutes for rebuild"
echo "  2. Check Railway logs for new deployment"
echo "  3. Monitor next posting cycle (every 5 min)"
echo "  4. Verify tweets are posted"
echo ""
echo "Press Ctrl+C to stop monitoring at any time."
echo ""

# Wait for rebuild
echo "⏱️  Waiting 180 seconds for Railway rebuild..."
for i in {180..1}; do
  printf "\r   ⏳ %3d seconds remaining..." $i
  sleep 1
done
echo ""
echo ""

echo "✅ Rebuild should be complete!"
echo ""
echo "📊 Checking Railway logs for new deployment..."
echo ""

# Get latest logs
railway logs --lines 50 2>&1 | grep -E "(Starting Container|RAILWAY_POSTER|POSTING_QUEUE|Posted)" | tail -20

echo ""
echo "🔍 Checking database for recent posts..."
echo ""

# Check database
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "
SELECT 
  COUNT(*) as total_posted,
  MAX(generated_at) as last_post_time
FROM content_metadata 
WHERE status = 'posted' 
AND generated_at > NOW() - INTERVAL '15 minutes';
" 2>/dev/null

echo ""
echo "📈 Next steps:"
echo "  • If total_posted = 0: Wait for next posting cycle (runs every 5 min)"
echo "  • If total_posted > 0: SUCCESS! Check Twitter to verify!"
echo ""
echo "🔄 Want to watch live logs? Run: npm run logs"

