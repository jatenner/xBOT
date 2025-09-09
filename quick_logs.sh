#!/bin/bash
echo "🔍 Quick Railway Logs Check..."
echo "=============================="
echo ""
echo "📊 Getting recent logs (last 10 lines):"
railway logs 2>/dev/null | tail -10 | head -10
echo ""
echo "✅ Log check complete"
