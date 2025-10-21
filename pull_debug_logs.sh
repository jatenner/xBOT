#!/bin/bash
echo "🔍 PULLING RAILWAY DEBUG LOGS"
echo "=============================="
echo ""

# Pull logs and filter for analytics debug output
railway logs 2>&1 | grep -B 5 -A 100 "ANALYTICS:" | tail -150 > /tmp/analytics_debug.log

if [ -s /tmp/analytics_debug.log ]; then
  echo "✅ Found analytics debug output:"
  echo ""
  cat /tmp/analytics_debug.log
else
  echo "❌ No analytics debug output found in recent logs"
  echo ""
  echo "Trying broader search..."
  railway logs 2>&1 | grep -A 50 "Scraping tweet" | tail -100
fi

rm -f /tmp/analytics_debug.log
