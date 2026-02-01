#!/bin/bash
set -e

cd /Users/jonahtenner/Desktop/xBOT

export CHROME_USER_DATA_DIR="$HOME/Library/Application Support/Google/Chrome"
export CHROME_PROFILE_DIR="Default"

echo "🔍 Checking Chrome processes..."
CHROME_COUNT=$(ps aux | grep -i "Google Chrome" | grep -v grep | wc -l | tr -d ' ')
echo "Chrome processes: $CHROME_COUNT"

if [ "$CHROME_COUNT" -gt 0 ]; then
  echo "⚠️  Warning: Chrome processes detected. Please quit Chrome completely."
fi

echo ""
echo "🚀 Running session refresh..."
pnpm exec tsx scripts/refresh-x-session.ts
