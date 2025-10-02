#!/bin/bash
# 🧪 Test Local Browser Server

set -e

echo "╔════════════════════════════════════════════════════╗"
echo "║   🧪 TESTING LOCAL BROWSER SERVER                 ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Check if server is running
if ! curl -s http://localhost:3100/health > /dev/null; then
  echo "❌ Browser server not running on port 3100"
  echo ""
  echo "Start it first:"
  echo "  ./start-browser-server.sh"
  echo ""
  exit 1
fi

echo "✅ Server is running"
echo ""

# Get secret from env or ask
if [ -z "$BROWSER_SERVER_SECRET" ]; then
  echo "Enter BROWSER_SERVER_SECRET:"
  read -r BROWSER_SERVER_SECRET
fi

# Test health endpoint
echo "1️⃣  Testing health endpoint..."
curl -s http://localhost:3100/health | jq .
echo ""

# Test posting
echo "2️⃣  Testing tweet posting..."
echo "   Sending: 'Test tweet from local browser server! 🚀'"
echo ""

curl -X POST http://localhost:3100/post \
  -H "Authorization: Bearer $BROWSER_SERVER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test tweet from local browser server! 🚀 Posted at '"$(date +%H:%M:%S)"'"}' \
  | jq .

echo ""
echo "✅ Test complete! Check your Twitter to verify the post."

