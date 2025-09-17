#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Running DB migrations..."
node tools/db/migrate.js

if [ "$STARTUP_ACCEPTANCE_ENABLED" = "true" ]; then
  echo "🧪 Running acceptance smoke (posting OFF)..."
  # Use compiled JS versions - no ts-node in production
  echo "→ Testing learning job..."
  npm run jobs:learn:js || echo "⚠️ acceptance jobs:learn failed (non-blocking)"
  echo "→ Testing plan dryrun..."
  npm run dryrun:plan:js 2 || echo "⚠️ acceptance dryrun:plan failed (non-blocking)"
  echo "→ Testing reply dryrun..."
  npm run dryrun:reply:js || echo "⚠️ acceptance dryrun:reply failed (non-blocking)"
  echo "✅ Acceptance smoke completed (failures are non-blocking)"
else
  echo "🧪 Acceptance smoke: skipped (STARTUP_ACCEPTANCE_ENABLED=false)"
fi

echo "🚀 Starting app (POSTING_DISABLED must be true here)..."
exec node dist/main-bulletproof.js
