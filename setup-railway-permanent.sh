#!/bin/bash

# 🚂 RAILWAY PERMANENT SETUP
# Get your API token from: https://railway.app/account/tokens

echo "🚂 Railway Permanent Token Setup"
echo ""
echo "This will set up a permanent Railway connection that WON'T expire."
echo ""

# Check if token is provided as argument
if [ -z "$1" ]; then
    echo "📋 Steps:"
    echo "1. Go to: https://railway.app/account/tokens"
    echo "2. Click 'Create Token'"
    echo "3. Copy the token"
    echo "4. Run: ./setup-railway-permanent.sh YOUR_TOKEN_HERE"
    echo ""
    echo "OR set it as environment variable:"
    echo "export RAILWAY_TOKEN='your_token_here'"
    echo ""
    exit 1
fi

TOKEN="$1"

echo "✅ Token received"
echo ""

# Add to .zshrc if not already there
if ! grep -q "RAILWAY_TOKEN" ~/.zshrc 2>/dev/null; then
    echo "📝 Adding RAILWAY_TOKEN to ~/.zshrc..."
    echo "" >> ~/.zshrc
    echo "# Railway Permanent Token (added $(date))" >> ~/.zshrc
    echo "export RAILWAY_TOKEN='$TOKEN'" >> ~/.zshrc
    echo "✅ Added to ~/.zshrc"
else
    echo "⚠️  RAILWAY_TOKEN already in ~/.zshrc, updating..."
    # Remove old line and add new one
    grep -v "RAILWAY_TOKEN" ~/.zshrc > ~/.zshrc.tmp
    mv ~/.zshrc.tmp ~/.zshrc
    echo "" >> ~/.zshrc
    echo "# Railway Permanent Token (updated $(date))" >> ~/.zshrc
    echo "export RAILWAY_TOKEN='$TOKEN'" >> ~/.zshrc
    echo "✅ Updated in ~/.zshrc"
fi

# Set for current session
export RAILWAY_TOKEN="$TOKEN"

echo ""
echo "✅ SETUP COMPLETE!"
echo ""
echo "🧪 Testing connection..."
railway whoami 2>&1

echo ""
echo "📊 To view logs, run:"
echo "  railway logs"
echo ""
echo "🔄 Reload your terminal or run:"
echo "  source ~/.zshrc"
echo ""

