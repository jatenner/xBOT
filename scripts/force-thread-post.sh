#!/bin/bash

# 🧵 FORCE THREAD POST
# Forces the system to generate and post a thread immediately

echo "🧵 Force Thread Post Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from xBOT root directory"
  exit 1
fi

# Build the project if needed
echo "📦 Building TypeScript..."
npm run build > /dev/null 2>&1

# Run health check first
echo "🏥 Running thread health check..."
echo ""
node dist/scripts/thread-health-check.js

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🧪 Testing thread posting with sample content..."
echo ""
node dist/scripts/test-thread-posting.js

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Thread testing complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Check Twitter to verify thread was posted"
echo "   2. If thread posted: System is working! 🎉"
echo "   3. If no thread: Check logs above for errors"
echo ""

