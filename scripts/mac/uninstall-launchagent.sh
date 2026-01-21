#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# MAC RUNNER LAUNCH AGENT UNINSTALLER
# Removes the LaunchAgent
# ═══════════════════════════════════════════════════════════════════════════════

set -e

PLIST_NAME="com.xbot.runner"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/${PLIST_NAME}.plist"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🛑 UNINSTALLING xBOT MAC RUNNER LAUNCH AGENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Unload if loaded
if launchctl list | grep -q "$PLIST_NAME"; then
  echo "📥 Unloading LaunchAgent..."
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  sleep 1
  echo "✅ LaunchAgent unloaded"
else
  echo "ℹ️  LaunchAgent not loaded"
fi

# Remove plist
if [ -f "$PLIST_PATH" ]; then
  rm "$PLIST_PATH"
  echo "✅ Removed plist: $PLIST_PATH"
else
  echo "ℹ️  Plist not found: $PLIST_PATH"
fi

echo ""
echo "✅ Uninstallation complete!"
