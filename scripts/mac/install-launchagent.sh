#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# MAC RUNNER LAUNCH AGENT INSTALLER
# Installs a LaunchAgent that starts Chrome CDP and the runner daemon on login
# ═══════════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLIST_NAME="com.xbot.runner"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/${PLIST_NAME}.plist"
DAEMON_SCRIPT="$PROJECT_DIR/scripts/mac/run-daemon.sh"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🚀 INSTALLING xBOT MAC RUNNER LAUNCH AGENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ensure daemon script exists and is executable
if [ ! -f "$DAEMON_SCRIPT" ]; then
  echo "❌ Daemon script not found: $DAEMON_SCRIPT"
  exit 1
fi

chmod +x "$DAEMON_SCRIPT"

# Ensure LaunchAgents directory exists
mkdir -p "$LAUNCH_AGENTS_DIR"

# Get absolute path to project
ABSOLUTE_PROJECT_DIR=$(cd "$PROJECT_DIR" && pwd)
ABSOLUTE_DAEMON_SCRIPT=$(cd "$(dirname "$DAEMON_SCRIPT")" && pwd)/$(basename "$DAEMON_SCRIPT")

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
    <string>${ABSOLUTE_DAEMON_SCRIPT}</string>
  </array>
  
  <key>RunAtLoad</key>
  <true/>
  
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
    <key>Crashed</key>
    <true/>
  </dict>
  
  <key>StandardOutPath</key>
  <string>${ABSOLUTE_PROJECT_DIR}/.runner-profile/daemon.log</string>
  
  <key>StandardErrorPath</key>
  <string>${ABSOLUTE_PROJECT_DIR}/.runner-profile/daemon-error.log</string>
  
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
echo "✅ LaunchAgent installed and loaded!"
echo ""
echo "📋 Next steps:"
echo "   1. Verify status: launchctl list | grep $PLIST_NAME"
echo "   2. Check logs: tail -f $PROJECT_DIR/.runner-profile/daemon.log"
echo "   3. Check errors: tail -f $PROJECT_DIR/.runner-profile/daemon-error.log"
echo ""
echo "🛑 To stop: pnpm run runner:stop or launchctl unload $PLIST_PATH"
echo "🔄 To restart: pnpm run runner:restart"
echo ""
