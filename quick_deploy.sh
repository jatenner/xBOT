#!/bin/bash

echo "🚀 === QUICK DEPLOY TO RENDER ==="
echo "📝 Building and deploying your changes..."

# Build the project
echo "📦 Building project..."
npm run build

# Add all changes
echo "📋 Adding changes to git..."
git add -A

# Get commit message from user or use default
if [ -z "$1" ]; then
    COMMIT_MSG="🔧 Bot improvements and optimizations"
else
    COMMIT_MSG="$1"
fi

echo "💬 Commit message: $COMMIT_MSG"

# Commit changes
git commit -m "$COMMIT_MSG"

# Push to trigger Render deployment
echo "🚀 Pushing to Render..."
git push origin main

echo "✅ Deployment triggered!"
echo "📊 Monitor progress:"
echo "   • Render Dashboard: https://dashboard.render.com"
echo "   • Local Monitor: http://localhost:3001"
echo "   • Bot Status: node monitor_optimized_ghost_killer.js"
echo ""
echo "⏰ Changes will be live in 2-3 minutes" 