#!/bin/bash

echo "🔍 SYSTEM STATUS CHECK"
echo "===================="
echo ""

echo "1️⃣ Build Status:"
railway status 2>&1 | head -5

echo ""
echo "2️⃣ Latest Deployment Logs (last 20 lines):"
railway logs 2>&1 | tail -20

echo ""
echo "3️⃣ Database - Recent Content:"
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << 'EOF'
SELECT 
  LEFT(content, 70) as preview,
  topic,
  bandit_arm as style,
  status,
  TO_CHAR(generated_at, 'HH24:MI') as time
FROM content_metadata
WHERE generated_at > NOW() - INTERVAL '30 minutes'
ORDER BY generated_at DESC
LIMIT 10;
EOF

echo ""
echo "4️⃣ Content Diversity Check:"
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << 'EOF'
SELECT 
  CASE 
    WHEN content ILIKE 'did you know%' THEN '❌ OLD PATTERN'
    ELSE '✅ DIVERSE'
  END as pattern_check,
  COUNT(*) as count
FROM content_metadata
WHERE generated_at > NOW() - INTERVAL '30 minutes'
GROUP BY pattern_check;
EOF

