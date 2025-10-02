#!/bin/bash

# ✅ Verify Post Success

echo "🔍 Checking database for posted content..."
echo ""

psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << 'EOF'
-- Check if any content moved from 'queued' to 'posted' status
SELECT 
  status,
  COUNT(*) as count,
  MAX(posted_at) as last_posted
FROM content_metadata
GROUP BY status
ORDER BY status;

-- Show most recent activity
SELECT 
  id,
  LEFT(content, 80) as preview,
  status,
  scheduled_at,
  posted_at
FROM content_metadata
ORDER BY generated_at DESC
LIMIT 5;
EOF

echo ""
echo "✅ If status='posted' and posted_at is recent, SUCCESS!"
echo "❌ If status='queued' or 'failed', check Railway logs for errors"

