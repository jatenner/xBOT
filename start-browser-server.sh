#!/bin/bash
# 🏠 Start Local Browser Server
# This runs on your Mac and handles all Twitter posting

set -e

echo "╔════════════════════════════════════════════════════╗"
echo "║   🏠 STARTING LOCAL BROWSER SERVER                ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Check if session file exists
if [ ! -f "data/twitter_session.json" ]; then
  echo "❌ Error: Twitter session not found at data/twitter_session.json"
  echo ""
  echo "Run this first:"
  echo "  npm run auth:session"
  echo ""
  exit 1
fi

# Generate secret if not set
if [ -z "$BROWSER_SERVER_SECRET" ]; then
  export BROWSER_SERVER_SECRET=$(openssl rand -hex 32)
  echo "🔐 Generated secret: $BROWSER_SERVER_SECRET"
  echo ""
  echo "⚠️  IMPORTANT: Add this to Railway env vars:"
  echo ""
  echo "  BROWSER_SERVER_SECRET=$BROWSER_SERVER_SECRET"
  echo "  BROWSER_SERVER_URL=http://YOUR_PUBLIC_URL:3100"
  echo ""
  echo "Press Enter to continue..."
  read
fi

# Start server
echo "🚀 Starting browser server on port 3100..."
echo ""
node local-browser-server.js

