#!/bin/bash
# Install macOS LaunchAgent for executor daemon

set -e

cd "$(dirname "$0")/../.."
RUNNER_PROFILE_DIR="${RUNNER_PROFILE_DIR:-./.runner-profile}"
PLIST_FILE="$HOME/Library/LaunchAgents/com.xbot.executor.plist"
LOG_DIR="$RUNNER_PROFILE_DIR/logs"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Get absolute paths
PROJECT_DIR=$(pwd)
DAEMON_SCRIPT="$PROJECT_DIR/node_modules/.bin/tsx"
DAEMON_FILE="$PROJECT_DIR/scripts/executor/daemon.ts"
LOG_FILE="$LOG_DIR/executor.log"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           📦 INSTALL EXECUTOR SERVICE (LaunchAgent)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Project dir: $PROJECT_DIR"
echo "Runner profile: $RUNNER_PROFILE_DIR"
echo "Log file: $LOG_FILE"
echo ""

# Check for existing plist and guard against RUNNER_BROWSER=cdp
if [ -f "$PLIST_FILE" ]; then
  if grep -q "RUNNER_BROWSER.*cdp" "$PLIST_FILE" 2>/dev/null; then
    echo "⚠️  WARNING: Existing plist contains RUNNER_BROWSER=cdp"
    echo "   CDP mode is FORBIDDEN for daemon (causes visible Chrome windows)"
    echo ""
    echo "To force install anyway, run:"
    echo "   FORCE_INSTALL=true $0"
    echo ""
    if [ "$FORCE_INSTALL" != "true" ]; then
      echo "❌ Installation aborted. Remove RUNNER_BROWSER=cdp from plist or use FORCE_INSTALL=true"
      exit 1
    fi
    echo "⚠️  FORCE_INSTALL=true - proceeding despite RUNNER_BROWSER=cdp"
  fi
fi

# Create plist file
cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.xbot.executor</string>
    <key>ProgramArguments</key>
    <array>
        <string>$DAEMON_SCRIPT</string>
        <string>$DAEMON_FILE</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>EXECUTION_MODE</key>
        <string>executor</string>
        <key>RUNNER_MODE</key>
        <string>true</string>
        <key>HEADLESS</key>
        <string>true</string>
        <key>RUNNER_PROFILE_DIR</key>
        <string>$RUNNER_PROFILE_DIR</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
    <key>StandardOutPath</key>
    <string>$LOG_FILE</string>
    <key>StandardErrorPath</key>
    <string>$LOG_FILE</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
EOF

echo "✅ Created LaunchAgent plist: $PLIST_FILE"
echo ""
echo "To start the service:"
echo "  launchctl load -w $PLIST_FILE"
echo ""
echo "To stop the service:"
echo "  launchctl unload $PLIST_FILE"
echo ""
echo "To view logs:"
echo "  tail -f $LOG_FILE"
echo ""
