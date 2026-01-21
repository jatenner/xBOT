#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# COOLDOWN MONITOR WRAPPER
# Wrapper script for LaunchAgent to run cooldown monitor
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

# Run the cooldown monitor
exec pnpm run cooldown:monitor
