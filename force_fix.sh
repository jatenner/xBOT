#!/bin/bash
set -e

echo "🚀 FORCING RAILWAY REBUILD WITH PLAYWRIGHT FIXES"
echo "================================================"
echo ""

cd /Users/jonahtenner/Desktop/xBOT

echo "Step 1: Uploading fixed code..."
railway up --detach

echo ""
echo "✅ Upload complete!"
echo ""
echo "⏳ Railway is now building (takes ~2 minutes)"
echo ""
echo "What's happening:"
echo "  • Railway is compiling TypeScript"
echo "  • Installing Playwright with --single-process fix"
echo "  • Starting new container"
echo ""
echo "📋 NEXT STEPS:"
echo "  1. Wait 2 minutes"
echo "  2. Run: ./verify_posting.sh"
echo "  3. Check if tweets are posting"
echo ""
echo "🎯 The system will auto-post every 5 minutes once deployed."

