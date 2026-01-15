#!/bin/bash
# 🏃 MAC RUNNER SETUP SCRIPT
# Installs PM2, creates LaunchAgent for auto-start on reboot

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE_DIR="$REPO_DIR/.runner-profile"
PLIST_PATH="$HOME/Library/LaunchAgents/com.xbot.runner.plist"

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

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           ✅ SETUP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Runner will start automatically on Mac boot."
echo ""
echo "Commands:"
echo "  Check status: launchctl list | grep com.xbot.runner"
echo "  View logs: tail -f $REPO_DIR/.runner-profile/runner.log"
echo "  Stop: launchctl unload $PLIST_PATH"
echo "  Start: launchctl load -w $PLIST_PATH"
echo ""
echo "Alternative (PM2):"
echo "  pm2 start pnpm --name \"xbot-runner\" -- exec tsx scripts/runner/poll-and-post.ts"
echo "  pm2 save"
echo "  pm2 startup"
echo ""
