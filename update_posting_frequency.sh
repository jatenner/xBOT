#!/bin/bash

# Update xBOT posting frequency to strategic mode
# 8 posts per day at optimal times

echo "🎯 Updating xBOT Posting Frequency Configuration"
echo "================================================"
echo ""
echo "Strategy: 8 posts/day at strategic times"
echo "  • Content generation: Every 10 minutes"
echo "  • Queue check: Every 3 minutes"
echo "  • Post spacing: Every 3 hours"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo "📤 Updating Railway environment variables..."
echo ""

# Content generation - more frequent for variety
railway variables --set JOBS_PLAN_INTERVAL_MIN=10

# Posting queue - check more often
railway variables --set JOBS_POSTING_INTERVAL_MIN=3

# Rate limiting - strategic spacing (8 posts/day)
railway variables --set MIN_POST_INTERVAL_MINUTES=180

# Grace window - already optimal
railway variables --set GRACE_MINUTES=5

# Reply generation
railway variables --set JOBS_REPLY_INTERVAL_MIN=20

# Learning
railway variables --set JOBS_LEARN_INTERVAL_MIN=60

echo ""
echo "✅ Configuration updated!"
echo ""
echo "📊 New Posting Schedule:"
echo "  • Generates content: Every 10 minutes"
echo "  • Checks queue: Every 3 minutes"
echo "  • Posts content: Every 3 hours (8x per day)"
echo ""
echo "🚀 Triggering redeploy..."
git commit --allow-empty -m "config: optimize posting frequency for strategic 8x/day cadence"
git push origin main

echo ""
echo "✅ Done! New configuration will apply on next deployment."
echo ""
echo "📈 Expected Results:"
echo "  • 8 posts per day at optimal times"
echo "  • UCB learns best posting hours"
echo "  • Consistent, strategic presence"
echo "  • High-quality, varied content"

