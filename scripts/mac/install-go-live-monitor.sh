#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# INSTALL GO-LIVE MONITOR LAUNCH AGENT
# Sets up a LaunchAgent to run go-live monitoring every 2 hours
# ═══════════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLIST_NAME="com.xbot.go-live-monitor"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/${PLIST_NAME}.plist"
MONITOR_SCRIPT="$PROJECT_DIR/scripts/monitor/go_live_monitor.ts"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🎯 INSTALLING GO-LIVE MONITOR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ensure monitor script exists
if [ ! -f "$MONITOR_SCRIPT" ]; then
  echo "❌ Monitor script not found: $MONITOR_SCRIPT"
  exit 1
fi

# Ensure LaunchAgents directory exists
mkdir -p "$LAUNCH_AGENTS_DIR"

# Get absolute paths
ABSOLUTE_PROJECT_DIR=$(cd "$PROJECT_DIR" && pwd)

# Create plist
cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_NAME}</string>
  
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string>
    <string>-i</string>
    <string>-w</string>
    <string>${ABSOLUTE_PROJECT_DIR}/scripts/mac/run-go-live-monitor.sh</string>
  </array>
  
  <key>StartInterval</key>
  <integer>7200</integer>
  
  <key>RunAtLoad</key>
  <true/>
  
  <key>StandardOutPath</key>
  <string>${ABSOLUTE_PROJECT_DIR}/.runner-profile/go-live-monitor.log</string>
  
  <key>StandardErrorPath</key>
  <string>${ABSOLUTE_PROJECT_DIR}/.runner-profile/go-live-monitor-error.log</string>
  
  <key>WorkingDirectory</key>
  <string>${ABSOLUTE_PROJECT_DIR}</string>
  
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
EOF

echo "✅ Created LaunchAgent plist: $PLIST_PATH"
echo ""

# Unload if already loaded
if launchctl list | grep -q "$PLIST_NAME"; then
  echo "⚠️  LaunchAgent already loaded, unloading first..."
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  sleep 1
fi

# Load the LaunchAgent
echo "📥 Loading LaunchAgent..."
launchctl load -w "$PLIST_PATH"

echo ""
echo "✅ Go-Live Monitor installed and loaded!"
echo ""
echo "📋 Monitor will run every 2 hours for 72 hours"
echo "   Check logs: tail -f $PROJECT_DIR/.runner-profile/go-live-monitor.log"
echo ""
echo "🛑 To stop: launchctl unload $PLIST_PATH"
echo ""
