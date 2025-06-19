#!/bin/bash

echo "📥 === GETTING LATEST CHANGES ==="
echo "🔄 Pulling latest from GitHub..."

# Stash any local changes
echo "💾 Stashing local changes..."
git stash

# Pull latest changes
echo "📥 Pulling from origin/main..."
git pull origin main

# Rebuild project
echo "📦 Rebuilding project..."
npm run build

# Restore stashed changes if any
STASH_COUNT=$(git stash list | wc -l)
if [ $STASH_COUNT -gt 0 ]; then
    echo "🔄 Restoring your local changes..."
    git stash pop
fi

echo "✅ Latest changes pulled and built!"
echo "📊 Your dashboard will show the updated bot"
echo "🎯 Monitor at: http://localhost:3001" 