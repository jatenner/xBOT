#!/bin/bash

echo "📤 === PUSHING CHANGES TO GIT ==="
echo "💾 Committing and pushing your changes..."

# Build the project
echo "📦 Building project..."
npm run build

# Add all changes
echo "📋 Adding changes to git..."
git add -A

# Get commit message from user or use default
if [ -z "$1" ]; then
    COMMIT_MSG="💡 Local improvements and updates"
else
    COMMIT_MSG="$1"
fi

echo "💬 Commit message: $COMMIT_MSG"

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "ℹ️ No changes to commit"
    exit 0
fi

# Commit changes
git commit -m "$COMMIT_MSG"

# Push to GitHub (but not trigger Render deployment)
echo "📤 Pushing to GitHub..."
git push origin main

echo "✅ Changes pushed to GitHub!"
echo "📊 Changes are saved but not deployed to Render yet"
echo "🚀 To deploy to Render, use: ./quick_deploy.sh"
echo "📥 To get latest changes, use: ./get_latest.sh" 