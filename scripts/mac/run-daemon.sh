#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# MAC RUNNER DAEMON WRAPPER
# Wrapper script that LaunchAgent calls to start the daemon
# Uses caffeinate to prevent laptop sleep from stopping the runner
# ═══════════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_DIR"

# Source environment if available
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Ensure profile directory exists
mkdir -p .runner-profile

# Run the daemon wrapped in caffeinate to prevent sleep
# caffeinate -i prevents idle sleep, -w waits for process to exit
exec caffeinate -i -w pnpm run runner:daemon
