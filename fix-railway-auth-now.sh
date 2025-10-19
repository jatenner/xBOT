#!/bin/bash
# Quick Railway re-authentication script

echo "🚂 Railway CLI Authentication"
echo ""
echo "This will open your browser for Railway login."
echo "After logging in, press Enter to continue."
echo ""
echo "⚠️  NOTE: This OAuth method will expire again in a few days/weeks."
echo "📌 For a PERMANENT fix, get an API token from:"
echo "   https://railway.app/account/tokens"
echo ""
read -p "Press Enter to open browser for Railway login..."

# Open Railway login in browser
railway login --browserless 2>/dev/null || railway login

echo ""
echo "✅ Authentication should be complete"
echo ""
echo "Test it with: railway whoami"
echo ""


