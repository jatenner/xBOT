#!/bin/bash

# Fix Railway CLI Authentication
# This script will help you authenticate and link Railway CLI

set -e

echo "🚂 Railway CLI Authentication & Link Fix"
echo "=========================================="
echo ""

# Step 1: Login
echo "Step 1: Authenticating with Railway..."
echo "This will open your browser for authentication."
echo ""
railway login

echo ""
echo "✅ Authentication successful!"
echo ""

# Step 2: Link project
echo "Step 2: Linking to xBOT project..."
echo "Please select your xBOT project from the list."
echo ""
railway link

echo ""
echo "✅ Project linked successfully!"
echo ""

# Step 3: Test
echo "Step 3: Testing connection..."
railway status

echo ""
echo "🎉 All done! Railway CLI is now configured."
echo ""
echo "You can now run:"
echo "  npm run logs         # View logs"
echo "  npm run logs:follow  # Follow logs"
echo "  railway status       # Check status"
echo ""

