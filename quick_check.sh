#!/bin/bash
set -e

echo "🔍 QUICK NON-STALLING DIAGNOSTIC"
echo "================================"
echo ""

echo "1️⃣ Database Status:"
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "
SELECT 
  COUNT(*) FILTER (WHERE status = 'posted') as posted,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'queued') as queued
FROM content_metadata
WHERE generated_at > NOW() - INTERVAL '1 hour';
"

echo ""
echo "2️⃣ Failed Tweet Details:"
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "
SELECT LEFT(content, 50) FROM content_metadata WHERE status = 'failed' AND generated_at > NOW() - INTERVAL '1 hour' LIMIT 1;
"

echo ""
echo "3️⃣ Railway Build Status (no streaming):"
railway status | head -10

echo ""
echo "✅ DONE - No stalling!"

