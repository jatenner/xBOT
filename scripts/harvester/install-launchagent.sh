#!/bin/bash
# Install Harvester LaunchAgent

set -e

PROJECT_DIR="/Users/jonahtenner/Desktop/xBOT"
PLIST_FILE="$HOME/Library/LaunchAgents/com.xbot.harvester.plist"
SOURCE_PLIST="$PROJECT_DIR/scripts/runner/com.xbot.harvester.plist"

echo "🌾 Installing Harvester LaunchAgent"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if source plist exists
if [ ! -f "$SOURCE_PLIST" ]; then
  echo "❌ Source plist not found: $SOURCE_PLIST"
  exit 1
fi

# Copy plist to LaunchAgents
echo "📋 Copying plist to LaunchAgents..."
cp "$SOURCE_PLIST" "$PLIST_FILE"
echo "✅ Copied: $PLIST_FILE"

# Unload existing agent if present
if launchctl list | grep -q com.xbot.harvester; then
  echo "🔄 Unloading existing LaunchAgent..."
  launchctl unload "$PLIST_FILE" 2>/dev/null || true
fi

# Load LaunchAgent
echo "🚀 Loading LaunchAgent..."
launchctl load -w "$PLIST_FILE"

echo ""
echo "✅ Harvester LaunchAgent installed and started"
echo ""
echo "To check status:"
echo "  launchctl list | grep harvester"
echo ""
echo "To view logs:"
echo "  tail -f $PROJECT_DIR/.runner-profile/harvester.log"
echo ""
echo "To stop:"
echo "  launchctl unload $PLIST_FILE"
echo ""
echo "To restart:"
echo "  launchctl unload $PLIST_FILE && launchctl load -w $PLIST_FILE"
