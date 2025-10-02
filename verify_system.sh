#!/bin/bash

echo "🔍 COMPLETE SYSTEM VERIFICATION"
echo "================================"
echo ""

echo "1️⃣ Railway Deployment Status:"
echo "------------------------------"
railway status | head -6
echo ""

echo "2️⃣ Content Generation (Last Hour):"
echo "-----------------------------------"
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << 'EOF'
SELECT 
  COUNT(*) as total_generated,
  SUM(CASE WHEN content ILIKE 'did you know%' THEN 1 ELSE 0 END) as old_pattern,
  COUNT(*) - SUM(CASE WHEN content ILIKE 'did you know%' THEN 1 ELSE 0 END) as diverse_content
FROM content_metadata
WHERE generated_at > NOW() - INTERVAL '1 hour';
EOF

echo ""
echo "3️⃣ Posting Status (Last 30 Minutes):"
echo "-------------------------------------"
psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << 'EOF'
SELECT 
  status,
  COUNT(*) as count,
  MAX(generated_at) as last_attempt
FROM content_metadata
WHERE generated_at > NOW() - INTERVAL '30 minutes'
GROUP BY status
ORDER BY status;
EOF

echo ""
echo "4️⃣ Recent Posts (if any):"
echo "-------------------------"
POSTED=$(psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "SELECT COUNT(*) FROM content_metadata WHERE status = 'posted' AND generated_at > NOW() - INTERVAL '30 minutes';")

if [ "$POSTED" -gt 0 ]; then
  echo "🎉 SUCCESS! Posts found:"
  psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' << 'EOF'
SELECT 
  LEFT(content, 70) as tweet,
  TO_CHAR(posted_at, 'HH24:MI:SS') as time
FROM content_metadata
WHERE status = 'posted' AND generated_at > NOW() - INTERVAL '30 minutes'
ORDER BY posted_at DESC
LIMIT 5;
EOF
else
  echo "⏳ No posts yet. This is normal if:"
  echo "   • Deployment just completed (wait 5-10 min)"
  echo "   • Content queue is empty (run: npm run job:plan)"
  echo "   • Auto-posting cycle hasn't run yet (every 5 min)"
fi

echo ""
echo "5️⃣ System Health Summary:"
echo "-------------------------"
QUEUED=$(psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "SELECT COUNT(*) FROM content_metadata WHERE status = 'queued';")
FAILED=$(psql 'postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' -t -c "SELECT COUNT(*) FROM content_metadata WHERE status = 'failed' AND generated_at > NOW() - INTERVAL '1 hour';")

echo "Queued tweets: $QUEUED"
echo "Recent failures: $FAILED"

if [ "$POSTED" -gt 0 ]; then
  echo ""
  echo "✅ SYSTEM STATUS: WORKING!"
  echo "🎯 Posting is live and functioning"
elif [ "$QUEUED" -gt 0 ]; then
  echo ""
  echo "⏳ SYSTEM STATUS: WAITING FOR AUTO-POST"
  echo "📍 Next posting cycle: within 5 minutes"
else
  echo ""
  echo "⚠️ SYSTEM STATUS: NEEDS CONTENT"
  echo "Run: npm run job:plan (to generate content)"
fi

echo ""
echo "✅ Verification complete!"

