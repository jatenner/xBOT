
#!/bin/bash

# 🚀 Deploy Twitter Session to Railway
# This script converts your local session to base64 and uploads it to Railway

set -e

echo "🔄 Converting session to base64..."

if [ ! -f "data/twitter_session.json" ]; then
  echo "❌ ERROR: data/twitter_session.json not found!"
  echo "Run: node create_fresh_session.js first"
  exit 1
fi

# Convert to base64 (works on macOS and Linux)
SESSION_B64=$(base64 < data/twitter_session.json | tr -d '\n')

echo "✅ Session converted to base64 (${#SESSION_B64} characters)"
echo ""
echo "🚄 Uploading to Railway..."

# Set Railway variable
railway variables --set "TWITTER_SESSION_B64=${SESSION_B64}"

echo ""
echo "✅ Session uploaded to Railway!"
echo "🚀 Triggering redeploy..."

# Trigger redeploy
railway up --detach

echo ""
echo "🎉 COMPLETE! Railway will redeploy with the new session."
echo "⏱️  Wait ~60 seconds, then test posting:"
echo "   railway run bash -c 'npm run job:posting'"

