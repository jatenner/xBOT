#!/bin/bash

echo "🔍 POSTING DIAGNOSTIC REPORT"
echo "============================="
echo ""

echo "📊 1. Recent posting attempts:"
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << 'EOF'
SELECT 
  status,
  COUNT(*) as count,
  MIN(generated_at) as first_attempt,
  MAX(generated_at) as last_attempt
FROM content_metadata
WHERE generated_at > NOW() - INTERVAL '2 hours'
GROUP BY status
ORDER BY status;
EOF

echo ""
echo "📝 2. All content from last 2 hours:"
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << 'EOF'
SELECT 
  id,
  LEFT(content, 60) as preview,
  status,
  generated_at
FROM content_metadata
WHERE generated_at > NOW() - INTERVAL '2 hours'
ORDER BY generated_at DESC;
EOF

echo ""
echo "🚨 3. Problem Analysis:"
echo "   If ALL tweets show 'Post button is disabled':"
echo "   → Twitter has flagged the account for spam"
echo "   → Solution: Wait 1-2 hours, then try ONE unique tweet"
echo ""
echo "   If tweets are too similar:"
echo "   → Twitter spam detection blocking duplicates"
echo "   → Solution: Generate more diverse content with OpenAI"
echo ""
echo "   If session errors:"
echo "   → Session invalid or expired"
echo "   → Solution: Regenerate session with create_fresh_session.js"

