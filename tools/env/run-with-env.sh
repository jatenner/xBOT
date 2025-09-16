#!/usr/bin/env bash
set -euo pipefail

# Source production environment if available
if [ -f ".env.prod-cli.sh" ]; then 
  echo "🔧 Loading production environment..."
  source .env.prod-cli.sh
elif [ -f ".env-prod-cli.sh" ]; then 
  echo "🔧 Loading production environment..."
  source .env-prod-cli.sh
else
  echo "⚠️  No production environment file found, using system environment"
fi

# Execute the command with bash
exec bash -lc "$*"
