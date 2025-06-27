#!/usr/bin/env bash
set -e
echo "📦 Applying pending Supabase migrations…"
npx supabase db push --no-interactive
echo "✅ Migrations applied"
exec node dist/index.js 