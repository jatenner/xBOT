#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Running DB migrations..."
node tools/db/migrate.js

echo "🧪 Running acceptance smoke (posting OFF)..."
# Keep this brief & safe for prod images
npm run jobs:learn || true
npm run dryrun:plan 2 || true
npm run dryrun:reply || true

echo "🚀 Starting app (POSTING_DISABLED must be true here)..."
exec node dist/main-bulletproof.js
