#!/bin/bash

# Manual harvester trigger via API
ADMIN_TOKEN="${ADMIN_TOKEN:-xbot-admin-2025}"
RAILWAY_URL="https://xbot-production-844b.up.railway.app"

echo "🔥 Triggering harvester via API..."
echo ""

curl -X POST "${RAILWAY_URL}/api/admin/jobs/run?name=harvester&token=${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  2>&1

echo ""
echo "✅ Harvester triggered!"
echo ""
echo "Wait 30 seconds, then check results:"
echo "  pnpm tsx scripts/check-reply-pipeline-now.ts"

