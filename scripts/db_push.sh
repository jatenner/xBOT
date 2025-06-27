#!/usr/bin/env bash
set -e
echo "📦 Applying pending Supabase migrations…"
supabase db push
echo "✅ Migrations applied"
exec npm start 