#!/bin/bash
# 🏃 MAC RUNNER SETUP SCRIPT
# Installs PM2, creates LaunchAgent for auto-start on reboot

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE_DIR="$REPO_DIR/.runner-profile"
PLIST_PATH="$HOME/Library/LaunchAgents/com.xbot.runner.plist"
SYNC_PLIST_PATH="$HOME/Library/LaunchAgents/com.xbot.runner.sync.plist"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🏃 MAC RUNNER SETUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
  echo "📦 Installing PM2..."
  npm install -g pm2
  echo "✅ PM2 installed"
else
  echo "✅ PM2 already installed"
fi

echo ""
echo "📝 Creating LaunchAgent plist..."

# Create LaunchAgent plist
cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.xbot.runner</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd $REPO_DIR && RUNNER_MODE=true RUNNER_PROFILE_DIR=$PROFILE_DIR pnpm exec tsx scripts/runner/poll-and-post.ts</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$REPO_DIR/.runner-profile/runner.log</string>
  <key>StandardErrorPath</key>
  <string>$REPO_DIR/.runner-profile/runner.error.log</string>
  <key>WorkingDirectory</key>
  <string>$REPO_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
EOF

echo "✅ LaunchAgent plist created: $PLIST_PATH"

# Unload existing agent if present
if launchctl list | grep -q com.xbot.runner; then
  echo "🔄 Unloading existing LaunchAgent..."
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
fi

# Load LaunchAgent
echo "🚀 Loading LaunchAgent..."
launchctl load -w "$PLIST_PATH"

# Create periodic sync LaunchAgent (every 6 hours)
echo ""
echo "📝 Creating periodic sync LaunchAgent (every 6 hours)..."

cat > "$SYNC_PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.xbot.runner.sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd $REPO_DIR && pnpm run runner:autosync</string>
  </array>
  <key>StartInterval</key>
  <integer>21600</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$REPO_DIR/.runner-profile/sync.log</string>
  <key>StandardErrorPath</key>
  <string>$REPO_DIR/.runner-profile/sync.error.log</string>
  <key>WorkingDirectory</key>
  <string>$REPO_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
EOF

echo "✅ Periodic sync LaunchAgent plist created: $SYNC_PLIST_PATH"

# Unload existing sync agent if present
if launchctl list | grep -q com.xbot.runner.sync; then
  echo "🔄 Unloading existing sync LaunchAgent..."
  launchctl unload "$SYNC_PLIST_PATH" 2>/dev/null || true
fi

# Load sync LaunchAgent
echo "🚀 Loading periodic sync LaunchAgent..."
launchctl load -w "$SYNC_PLIST_PATH"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           ✅ SETUP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Runner will start automatically on Mac boot."
echo "Periodic env sync runs every 6 hours automatically."
echo ""
echo "Commands:"
echo "  Check status: launchctl list | grep com.xbot.runner"
echo "  View logs: tail -f $REPO_DIR/.runner-profile/runner.log"
echo "  View sync logs: tail -f $REPO_DIR/.runner-profile/sync.log"
echo "  Stop: launchctl unload $PLIST_PATH"
echo "  Start: launchctl load -w $PLIST_PATH"
echo ""
echo "Or use npm scripts:"
echo "  pnpm run runner:start"
echo "  pnpm run runner:stop"
echo "  pnpm run runner:restart"
echo "  pnpm run runner:logs"
echo ""
