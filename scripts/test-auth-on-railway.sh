#!/bin/bash
# Test Twitter authentication on Railway

echo "🔍 Testing Twitter Authentication on Railway..."
echo ""

railway run npx tsx scripts/check-twitter-auth.ts

