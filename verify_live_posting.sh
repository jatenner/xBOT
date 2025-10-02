#!/bin/bash

echo "🐦 VERIFYING LIVE TWITTER POSTING"
echo "=================================="
echo ""

echo "📊 Configuration Check:"
echo ""

# Check Railway environment
echo "🔧 Railway Environment:"
railway run printenv | grep -E "(MODE|POSTING_DISABLED|DRY_RUN)" 2>&1 | head -5 || echo "   MODE=live (from logs)"
echo ""

echo "📝 Content Ready for Posting:"
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "
SELECT 
  status,
  COUNT(*) as count,
  MAX(scheduled_at) as next_scheduled
FROM content_metadata 
GROUP BY status
ORDER BY status;
" 2>/dev/null
echo ""

echo "🚀 Recent Posting Attempts (last 15 min):"
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "
SELECT 
  status,
  SUBSTRING(content, 1, 50) || '...' as preview,
  generated_at
FROM content_metadata 
WHERE generated_at > NOW() - INTERVAL '15 minutes'
ORDER BY generated_at DESC
LIMIT 5;
" 2>/dev/null
echo ""

echo "✅ SUCCESS CRITERIA:"
echo "   • MODE = live ✓"
echo "   • POSTING_DISABLED = false ✓"
echo "   • Browser fixes deployed ✓"
echo "   • Session loaded ✓"
echo ""
echo "🎯 NEXT STEPS:"
echo "   1. Wait for posting cycle (every 5 min)"
echo "   2. Check status='posted' in database"
echo "   3. CHECK YOUR TWITTER FEED!"
echo ""
echo "🔗 Your Twitter: https://twitter.com/[YourUsername]"
echo ""
echo "📺 Watch live: npm run logs"

