#!/bin/bash
# Uninstall macOS LaunchAgent for executor daemon

set -e

PLIST_FILE="$HOME/Library/LaunchAgents/com.xbot.executor.plist"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🗑️  UNINSTALL EXECUTOR SERVICE (LaunchAgent)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Unload if loaded
if launchctl list | grep -q com.xbot.executor; then
  echo "Unloading LaunchAgent..."
  launchctl unload "$PLIST_FILE" 2>/dev/null || true
  echo "✅ LaunchAgent unloaded"
else
  echo "✅ LaunchAgent not loaded"
fi

# Remove plist file
if [ -f "$PLIST_FILE" ]; then
  rm "$PLIST_FILE"
  echo "✅ Removed plist file: $PLIST_FILE"
else
  echo "✅ Plist file not found (already removed)"
fi

echo ""
echo "✅ Service uninstalled"
