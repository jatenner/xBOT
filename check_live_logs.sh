#!/bin/bash

echo "📡 CHECKING RAILWAY PRODUCTION LOGS"
echo "====================================="
echo ""

# Get recent logs
echo "🔍 Last 100 lines of Railway logs:"
echo ""

railway logs 2>&1 | tail -100 | grep -A 5 -B 5 "POSTING_QUEUE\|RAILWAY_POSTER\|Tweet posted\|Posted.*decisions"

echo ""
echo "================================"
echo ""
echo "✅ Looking for these SUCCESS signs:"
echo "   • '✅ Tweet posted successfully'"
echo "   • 'Posted X/X decisions'"
echo "   • No 'browser closed' errors"
echo ""

