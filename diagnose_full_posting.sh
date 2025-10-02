#!/bin/bash

echo "🔍 COMPREHENSIVE POSTING DIAGNOSTIC"
echo "===================================="
echo ""

echo "1️⃣ Check Recent Logs from Railway:"
echo "-----------------------------------"
railway logs 2>&1 | grep -E "(single-process|RAILWAY_POSTER.*Browser|SESSION.*passed|SESSION.*failed|Post button|Posted successfully)" | tail -20

echo ""
echo "2️⃣ Check Database Status:"
echo "-------------------------"
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << 'EOF'
SELECT 
  'Latest tweets:' as section,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END) as posted,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued
FROM content_metadata
WHERE generated_at > NOW() - INTERVAL '1 hour';

SELECT 
  LEFT(content, 60) as preview,
  status,
  TO_CHAR(generated_at, 'HH24:MI') as time
FROM content_metadata
WHERE generated_at > NOW() - INTERVAL '1 hour'
ORDER BY generated_at DESC
LIMIT 5;
EOF

echo ""
echo "3️⃣ Force Railway Redeploy if Needed:"
echo "-------------------------------------"
echo "If logs don't show '--single-process' flag:"
echo "   railway up --detach"
echo ""
echo "Then wait 2 minutes and retry posting."

