#!/bin/bash

# Update Railway environment variables for growth optimization
# Target: 6-8 posts/day with 40% threads

echo "🚀 Updating Railway Growth Configuration"
echo "=========================================="
echo ""
echo "Changes:"
echo "  • JOBS_PLAN_INTERVAL_MIN: 120 → 90 (more frequent generation)"
echo "  • MAX_POSTS_PER_HOUR: 1 → 2 (allow 2 posts/hour)"
echo ""
echo "Expected Result:"
echo "  • 6-8 posts/day (4-5 singles + 2-3 threads)"
echo "  • 40% threads (from code changes)"
echo "  • Peak hour optimization (from code changes)"
echo "  • Fresh reply targeting <2 hours old (from code changes)"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo "📤 Updating Railway environment variables..."
echo ""

# Content generation frequency (90 minutes = 16 runs/day = supports 6-8 posts/day)
railway variables --set JOBS_PLAN_INTERVAL_MIN=90

# Rate limiting (2 posts/hour = max 48/day, but we'll target 6-8/day)
railway variables --set MAX_POSTS_PER_HOUR=2

echo ""
echo "✅ Railway variables updated!"
echo ""
echo "📊 New Configuration:"
echo "  • Content generation: Every 90 minutes"
echo "  • Max posts per hour: 2"
echo "  • Target: 6-8 posts/day"
echo ""
echo "🎯 Code Changes Already Deployed:"
echo "  • Thread ratio: 40% (2-3 threads/day)"
echo "  • Peak hour timing: 6-9 AM, 12-1 PM, 6-8 PM"
echo "  • Reply recency: <2 hours old only"
echo ""
echo "🚀 Railway will auto-redeploy with new variables..."
echo ""
echo "✅ All done! System will start posting 6-8 times/day with optimized settings."

